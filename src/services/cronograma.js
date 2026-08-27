import moment from 'moment'
import { supabase } from '../lib/supabase'

/**
 * Suma las horas de las actividades agendadas para un prospecto dentro del
 * mes de `fechaReferencia`.
 * @param {Array} actividades
 * @param {string} prospectoNombre
 * @param {Date} [fechaReferencia]
 * @returns {number}
 */
function horasUsadasEnElMes(actividades, prospectoNombre, fechaReferencia = new Date()) {
  const desde = moment(fechaReferencia).startOf('month')
  const hasta = moment(fechaReferencia).endOf('month')
  return actividades
    .filter(act => act.prospecto_nombre === prospectoNombre)
    .filter(act => moment(act.inicio).isBetween(desde, hasta, null, '[]'))
    .reduce((total, act) => total + moment(act.fin).diff(moment(act.inicio), 'hours', true), 0)
}

/**
 * Calcula el saldo de horas de un prospecto: horas mensuales contratadas
 * (`hs_mensuales`) menos las horas ya agendadas en el mes de `fechaReferencia`.
 * Devuelve `null` cuando el prospecto no tiene un abono de horas configurado,
 * para no mostrar un saldo negativo engañoso en clientes sin bolsa de horas.
 * @param {{nombre: string, hs_mensuales: number|null|undefined}} prospecto
 * @param {Array} actividades
 * @param {Date} [fechaReferencia]
 * @returns {number|null}
 */
export function calcularSaldoHoras(prospecto, actividades, fechaReferencia = new Date()) {
  if (prospecto.hs_mensuales == null) return null
  const contratadas = Number(prospecto.hs_mensuales)
  const usadas = horasUsadasEnElMes(actividades, prospecto.nombre, fechaReferencia)
  return Math.round((contratadas - usadas) * 10) / 10
}

/**
 * Calcula cuántos días pasaron desde la última actividad marcada como
 * "reunión con cliente" (`reunion_cliente = true`) de un prospecto, tomando
 * como referencia `fechaReferencia`. Ignora reuniones futuras. Devuelve
 * `null` si nunca hubo una reunión registrada.
 * @param {Array} actividades
 * @param {string} prospectoNombre
 * @param {Date} [fechaReferencia]
 * @returns {number|null}
 */
export function calcularDiasDesdeUltimaReunion(actividades, prospectoNombre, fechaReferencia = new Date()) {
  const fechasReunion = actividades
    .filter(act => act.prospecto_nombre === prospectoNombre && act.reunion_cliente)
    .map(act => moment(act.inicio))
    .filter(fecha => fecha.isSameOrBefore(fechaReferencia))

  if (fechasReunion.length === 0) return null

  const ultima = moment.max(fechasReunion)
  return moment(fechaReferencia).startOf('day').diff(ultima.startOf('day'), 'days')
}

/**
 * Traduce lo que el usuario escribió en "Prospecto / Cliente" (texto libre,
 * con autocompletado) a lo que hay que guardar en `cronograma`, cuya columna
 * real es `prospecto_id` (FK), no texto. Si el nombre coincide con un
 * prospecto real, guarda su id. Si no (categorías internas como
 * "Consultora" o "Día Libre", que no son clientes), guarda `prospecto_id`
 * null y antepone la categoría a la descripción como "[Categoría] resto" —
 * la misma convención ya usada en el historial migrado del Excel.
 * @param {string} nombreEscrito
 * @param {string} descripcion
 * @param {Array<{id: string, nombre: string}>} prospectos
 * @returns {{prospecto_id: string|null, descripcion: string}}
 */
export function resolverProspectoParaGuardar(nombreEscrito, descripcion, prospectos) {
  const nombre = (nombreEscrito || '').trim()
  const match = prospectos.find(p => p.nombre === nombre)
  if (match) {
    return { prospecto_id: match.id, descripcion: descripcion || '' }
  }
  const desc = (descripcion || '').trim()
  return {
    prospecto_id: null,
    descripcion: nombre ? `[${nombre}]${desc ? ' ' + desc : ''}` : desc
  }
}

/**
 * Inversa de {@link resolverProspectoParaGuardar}: a partir de una fila de
 * cronograma ya leída (con `prospecto_id` resuelto al nombre real del
 * prospecto, o `null`), devuelve qué mostrar en "Prospecto / Cliente" y la
 * descripción limpia (sin el prefijo "[Categoría]").
 * @param {string|null|undefined} prospectoNombreReal
 * @param {string} descripcion
 * @returns {{prospecto_nombre: string, descripcion: string}}
 */
export function extraerProspectoParaMostrar(prospectoNombreReal, descripcion) {
  if (prospectoNombreReal) return { prospecto_nombre: prospectoNombreReal, descripcion: descripcion || '' }
  const desc = descripcion || ''
  const match = /^\[([^\]]+)\]\s?(.*)$/s.exec(desc)
  if (match) return { prospecto_nombre: match[1], descripcion: match[2] }
  return { prospecto_nombre: '', descripcion: desc }
}

export async function getActividades() {
  const { data, error } = await supabase
    .from('apsol_cronograma')
    .select('*')
    .order('inicio', { ascending: false })

  if (error) throw error
  return data
}

export async function getActividadById(id) {
  const { data, error } = await supabase
    .from('apsol_cronograma')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Columnas reales de apsol_cronograma. Cronograma.jsx trabaja con objetos
// "resueltos" que además llevan campos de solo lectura para mostrar
// (ej. `prospecto_nombre`, derivado de `prospecto_id` — ver
// extraerProspectoParaMostrar); filtrar acá evita mandarle a PostgREST una
// columna que no existe (como pasaba antes con `prospecto_nombre`, que
// rompía todo guardado con un 400).
const CAMPOS_EDITABLES_CRONOGRAMA = [
  'prospecto_id', 'inicio', 'fin', 'duracion_horas', 'descripcion',
  'responsable_id', 'reunion_cliente', 'link_reunion', 'comentarios_reunion',
  'multiplicador', 'notas_multiplicador', 'herramientas'
]

function limpiarPayloadCronograma(actividad) {
  const payload = {}
  for (const campo of CAMPOS_EDITABLES_CRONOGRAMA) {
    if (campo in actividad) payload[campo] = actividad[campo]
  }
  return payload
}

export async function saveActividad(actividad) {
  const payload = limpiarPayloadCronograma(actividad)
  if (actividad.id) {
    // Edición (UPDATE)
    const { data, error } = await supabase
      .from('apsol_cronograma')
      .update(payload)
      .eq('id', actividad.id)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Creación (INSERT)
    const { data, error } = await supabase
      .from('apsol_cronograma')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

export async function deleteActividad(id) {
  const { error } = await supabase
    .from('apsol_cronograma')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

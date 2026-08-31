import moment from 'moment'
import { supabase } from '../lib/supabase'

/**
 * Número de semana de `momento` con el mismo criterio que WEEKNUM() de
 * Google Sheets/AppSheet en su modo por defecto (tipo 1): las semanas
 * arrancan en domingo, y la semana 1 es la que contiene el 1° de enero
 * (aunque empiece antes, en diciembre del año anterior).
 * @param {moment.Moment} momento  ya en UTC (ver calcularHorasTeoricas)
 * @returns {number}
 */
function weekNumEstiloAppSheet(momento) {
  const enero1 = momento.clone().startOf('year')
  const inicioSemana1 = enero1.clone().subtract(enero1.day(), 'days') // domingo on/antes del 1° de enero
  const dias = momento.clone().startOf('day').diff(inicioSemana1.startOf('day'), 'days')
  return Math.floor(dias / 7) + 1
}

/**
 * Horas que el prospecto "debería" haber consumido desde que arrancó el
 * servicio, a razón de `hsMensuales` por mes — la misma fórmula que usaba
 * AppSheet (columna virtual "Hs Teoricas"), reconstruida y verificada a
 * mano contra el histórico real:
 *
 *   semanas = (WEEKNUM(HOY()) + (año(HOY()) - año(inicio)) * 52) - WEEKNUM(inicio)
 *   Hs Teoricas = semanas * (hsMensuales / 4.33)
 *
 * (4.33 ≈ 52 semanas / 12 meses: es la conversión de una tarifa mensual a
 * una tarifa semanal que usaba la fórmula original.) HOY() de AppSheet se
 * evalúa en UTC, no en la zona horaria local del navegador — mismo detalle
 * que calcularDiasDesde, por eso acá también todo es moment.utc().
 * @param {number|string} hsMensuales
 * @param {string|Date} inicioServicio
 * @param {Date} [fechaReferencia]
 * @returns {number}
 */
export function calcularHorasTeoricas(hsMensuales, inicioServicio, fechaReferencia = new Date()) {
  const hoy = moment.utc(fechaReferencia)
  const inicio = moment.utc(inicioServicio)
  const semanas = (weekNumEstiloAppSheet(hoy) + (hoy.year() - inicio.year()) * 52) - weekNumEstiloAppSheet(inicio)
  return semanas * (Number(hsMensuales) / 4.33)
}

/**
 * Calcula el saldo de horas de un prospecto: horas efectivamente dedicadas
 * en TODO el historial (`horasDedicadas`, ver `getHorasDedicadasPorProspecto`)
 * menos las horas teóricas que le correspondían desde el inicio del
 * servicio (ver `calcularHorasTeoricas`). Es un saldo acumulado, no se
 * resetea cada mes — igual que en AppSheet, un mes flojo se puede
 * compensar (o arrastrar en contra) en los siguientes.
 *
 * Devuelve `null` cuando el prospecto no tiene un abono de horas
 * configurado, o no tiene fecha de inicio de servicio (no hay desde cuándo
 * contar), para no mostrar un saldo engañoso.
 * @param {{hs_mensuales: number|null|undefined, inicio_servicio: string|null|undefined}} prospecto
 * @param {number|null|undefined} horasDedicadas  del Map que devuelve getHorasDedicadasPorProspecto
 * @param {Date} [fechaReferencia]
 * @returns {number|null}
 */
export function calcularSaldoHoras(prospecto, horasDedicadas, fechaReferencia = new Date()) {
  if (prospecto.hs_mensuales == null) return null
  if (!prospecto.inicio_servicio) return null
  const hsTeoricas = calcularHorasTeoricas(prospecto.hs_mensuales, prospecto.inicio_servicio, fechaReferencia)
  const dedicadas = Number(horasDedicadas) || 0
  return Math.round((dedicadas - hsTeoricas) * 10) / 10
}

/**
 * Calcula "días desde la última reunión", reproduciendo la fórmula real de
 * AppSheet (columna virtual de Prospectos):
 *   IF(no hay ninguna reunión con cliente,
 *      [Días desde el inicio de servicio],
 *      HOUR(HOY() - MAX(fecha de la última reunión)) / 24)
 *
 * Dos detalles no obvios, verificados a mano contra el histórico real:
 *  - HOY() se evalúa en UTC, no en la zona horaria local del navegador.
 *  - Conserva la hora exacta de la reunión (no trunca a medianoche) - una
 *    reunión de la tarde puede dar un día menos que un diff de calendario
 *    puro. Por eso acá todo usa moment.utc(), nunca moment() a secas.
 *  - Una reunión agendada a futuro da un número NEGATIVO (así lo muestra
 *    AppSheet), no se nulea.
 *  - Sin ninguna reunión registrada nunca, cae al fallback: días desde
 *    `fechaInicioServicio` (una fecha pura, sin hora, así que ahí sí es un
 *    diff de calendario simple).
 * @param {string|null|undefined} fechaUltimaReunion
 * @param {string|null|undefined} fechaInicioServicio
 * @param {Date} [fechaReferencia]
 * @returns {number|null}
 */
export function calcularDiasDesde(fechaUltimaReunion, fechaInicioServicio, fechaReferencia = new Date()) {
  const hoyMedianocheUTC = moment.utc(fechaReferencia).startOf('day')

  if (!fechaUltimaReunion) {
    if (!fechaInicioServicio) return null
    return hoyMedianocheUTC.diff(moment.utc(fechaInicioServicio).startOf('day'), 'days')
  }

  const horas = hoyMedianocheUTC.diff(moment.utc(fechaUltimaReunion), 'hours', true)
  return Math.round(horas / 24)
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

/**
 * Trae las actividades cuyo inicio cae dentro de [desde, hasta] (inclusive),
 * YA FILTRADAS SEGÚN EL ROL de quien pregunta (RPC apsol_cronograma_visible,
 * database/migration_cronograma_visibilidad.sql):
 *   - Un Colaborador ve sus actividades y las de otros colaboradores completas.
 *   - Las reuniones del Admin en las que no participa llegan como bloque
 *     "Ocupado" (descripcion='Ocupado', sin datos).
 *   - Los bloques de trabajo del Admin no se devuelven.
 *   - Un Admin ve todo.
 * @param {string} desde  ISO 8601
 * @param {string} hasta  ISO 8601
 */
export async function getActividadesEnRango(desde, hasta) {
  const { data, error } = await supabase.rpc('apsol_cronograma_visible', {
    p_desde: desde,
    p_hasta: hasta
  })
  if (error) throw error
  return data || []
}

/**
 * Trae, por prospecto, el total de horas dedicadas en TODO el historial
 * (`duracion_horas * multiplicador`, sumado server-side vía RPC — no tiene
 * sentido bajar al cliente miles de filas de actividades solo para
 * sumarlas). Es el insumo de `calcularSaldoHoras`, que es un saldo
 * acumulado desde el inicio del servicio, no mensual.
 * @returns {Promise<Map<string, number>>}  prospecto_id -> horas dedicadas
 */
export async function getHorasDedicadasPorProspecto() {
  const { data, error } = await supabase.rpc('get_horas_dedicadas_por_prospecto')
  if (error) throw error

  const horasPorProspecto = new Map()
  for (const fila of data || []) {
    horasPorProspecto.set(fila.prospecto_id, Number(fila.horas_dedicadas) || 0)
  }
  return horasPorProspecto
}

/**
 * Trae, por prospecto, la fecha de su actividad más reciente marcada como
 * "reunión con cliente" hasta `fechaReferencia`. Solo baja las filas con
 * `reunion_cliente = true` (un subconjunto chico que crece lento con el
 * tiempo — unas pocas por cliente al mes), no la tabla entera.
 * @param {Date} [fechaReferencia]
 * @returns {Promise<Map<string, string>>}  prospecto_id -> fecha ISO de la última reunión
 */
export async function getUltimasReunionesPorProspecto(fechaReferencia = new Date()) {
  // Vía RPC (SECURITY DEFINER, ver database/migration_saldo_horas_acumulado.sql)
  // y no una consulta directa a apsol_cronograma: esa vista queda sujeta a
  // la RLS que protege la privacidad de la agenda de Adrian, y "días desde
  // la última reunión" tiene que ser el mismo número para cualquiera que
  // mire el panel, no depender de quién cargó esa reunión puntual.
  const { data, error } = await supabase.rpc('get_ultima_reunion_por_prospecto', {
    p_hasta: moment(fechaReferencia).toISOString()
  })

  if (error) throw error

  const ultimaPorProspecto = new Map()
  for (const fila of data || []) {
    if (fila.prospecto_id) {
      ultimaPorProspecto.set(fila.prospecto_id, fila.ultima_reunion)
    }
  }
  return ultimaPorProspecto
}

/**
 * Resuelve `prospecto_id` -> `prospecto_nombre` de solo lectura sobre una
 * lista de actividades, para mostrar (título de eventos, filtros, saldo).
 * Ver {@link extraerProspectoParaMostrar}.
 * @param {Array} actividades
 * @param {Array<{id: string, nombre: string}>} prospectos
 */
export function resolverActividades(actividades, prospectos) {
  return actividades.map(act => {
    const prospecto = prospectos.find(p => p.id === act.prospecto_id)
    const { prospecto_nombre, descripcion } = extraerProspectoParaMostrar(prospecto?.nombre, act.descripcion)
    return { ...act, prospecto_nombre, descripcion }
  })
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
  'multiplicador', 'notas_multiplicador', 'herramientas', 'participantes_ids'
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
  // No hay ningún trigger en la base que calcule esto solo (se verificó) -
  // si no se manda acá, la columna queda NULL y el saldo de horas la
  // ignora en silencio (la cuenta como 0h). Se recalcula siempre a partir
  // de inicio/fin, tanto al crear como al editar (por si cambió el
  // horario vía drag/resize del calendario).
  if (payload.inicio && payload.fin) {
    payload.duracion_horas = moment(payload.fin).diff(moment(payload.inicio), 'hours', true)
  }
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

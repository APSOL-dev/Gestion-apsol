/**
 * Helpers puros de la sección Colaboradores. Sin dependencias de red ni de
 * React: toda la lógica derivable (fin de contrato, días de descanso,
 * agrupación de la lista, normalización de datos migrados de AppSheet) vive
 * acá para poder testearla aislada.
 */

// Promedio de días por mes (365.25 / 12). Se usa para estimar los días de
// descanso "acumulados" con resolución de días, igual que hacía AppSheet
// (meses fraccionarios, no meses enteros).
const MS_POR_MES = 30.4375 * 24 * 60 * 60 * 1000

function soloFecha(valor) {
  return valor ? String(valor).split('T')[0] : null
}

/**
 * Contrato con `fecha_inicio` más reciente. `null` si la lista está vacía
 * o ninguno tiene fecha de inicio.
 * @param {Array<object>|null|undefined} contratos
 * @returns {object|null}
 */
export function ultimoContrato(contratos) {
  if (!Array.isArray(contratos) || contratos.length === 0) return null
  const conFecha = contratos.filter(c => c && c.fecha_inicio)
  if (conFecha.length === 0) return null
  return conFecha
    .slice()
    .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
    .at(-1)
}

/**
 * "Fin de contrato" que se muestra en la lista y en la ficha: la
 * `fecha_fin` del último contrato (por fecha de inicio). `null` si no hay
 * contratos o el último es indefinido.
 * @param {Array<object>|null|undefined} contratos
 * @returns {string|null}  'YYYY-MM-DD'
 */
export function finDeContrato(contratos) {
  const ultimo = ultimoContrato(contratos)
  return soloFecha(ultimo?.fecha_fin)
}

/**
 * Contrato actualmente en vigencia: `fecha_inicio <= hoy` y
 * (`fecha_fin` vacía o `>= hoy`). Si hay solapamiento, el de inicio más
 * reciente. `null` si ninguno cubre la fecha (todos vencidos, o el próximo
 * todavía no arrancó).
 * @param {Array<object>|null|undefined} contratos
 * @param {Date|string} [hoy]
 * @returns {object|null}
 */
export function contratoVigente(contratos, hoy = new Date()) {
  if (!Array.isArray(contratos) || contratos.length === 0) return null
  const hoyISO = hoy instanceof Date
    ? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    : String(hoy).split('T')[0]

  const vigentes = contratos.filter(c => {
    const ini = soloFecha(c?.fecha_inicio)
    if (!ini || ini > hoyISO) return false
    const fin = soloFecha(c?.fecha_fin)
    return !fin || fin >= hoyISO
  })
  if (vigentes.length === 0) return null
  return vigentes
    .slice()
    .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
    .at(-1)
}

/**
 * Tasa de días libres por mes del último contrato. Acepta coma decimal
 * ('1,25') y cae a 1.25 si falta o no es un número positivo.
 * @param {Array<object>|null|undefined} contratos
 * @returns {number}
 */
export function tasaDiasLibres(contratos) {
  const ultimo = ultimoContrato(contratos)
  const n = parseFloat(String(ultimo?.dias_libres_por_mes ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 1.25
}

/**
 * Desglose de "Días de descanso" de un colaborador.
 * - `acumulados`: meses (fraccionarios) desde `fechaInicio` × tasa del contrato.
 * - `tomados`: los días libres ya usados (se calculan aparte, del cronograma).
 * - `disponibles`: `acumulados - tomados`, nunca negativo.
 * @param {{fechaInicio?: string|null, contratos?: Array<object>, diasTomados?: number, fechaRef?: Date}} args
 * @returns {{acumulados: number, tomados: number, disponibles: number}}
 */
export function calcularDiasDescanso({ fechaInicio, contratos = [], diasTomados = 0, fechaRef = new Date() } = {}) {
  const tomados = Math.max(0, Math.round(Number(diasTomados) || 0))
  const iso = soloFecha(fechaInicio)
  if (!iso) return { acumulados: 0, tomados, disponibles: 0 }

  const [anio, mes, dia] = iso.split('-').map(Number)
  const inicio = new Date(anio, mes - 1, dia)
  const ref = fechaRef instanceof Date ? fechaRef : new Date(fechaRef)
  const meses = Math.max(0, (ref - inicio) / MS_POR_MES)
  const acumulados = Math.floor(meses * tasaDiasLibres(contratos))
  return { acumulados, tomados, disponibles: Math.max(0, acumulados - tomados) }
}

// Filas de `apsol_colaboradores` que no son personas: el recurso interno
// "Mantenimiento" y los placeholders "Sin identificar - conciliar" que dejó
// la reconciliación de facturación. No se muestran en la lista.
function esPersonaReal(c) {
  const puesto = (c.puesto || '').toLowerCase()
  if (puesto.startsWith('recurso interno') || puesto.startsWith('sin identificar')) return false
  if ((c.nombre_manual || '').toLowerCase().startsWith('(sheet id')) return false
  return true
}

function estaInactivo(c) {
  return c.estado === 'Inactivo' || c.activo === false
}

/**
 * Parte la lista de colaboradores en los dos grupos de la vista AppSheet
 * (Activo / No Activo), descartando las filas que no son personas.
 * @param {Array<object>} colaboradores
 * @returns {{activos: Array<object>, inactivos: Array<object>}}
 */
export function agruparColaboradores(colaboradores = []) {
  const reales = (colaboradores || []).filter(esPersonaReal)
  return {
    activos: reales.filter(c => !estaInactivo(c)),
    inactivos: reales.filter(estaInactivo),
  }
}

/**
 * Normaliza un teléfono/WhatsApp. Los valores migrados de AppSheet vinieron
 * como float en texto ('3425672161.0'); se saca el sufijo y se deja solo
 * dígitos (más un '+' inicial opcional).
 * @param {string|number|null|undefined} valor
 * @returns {string}
 */
export function limpiarWhatsapp(valor) {
  if (valor == null) return ''
  return String(valor).replace(/\.0+$/, '').replace(/(?!^\+)[^\d]/g, '')
}

/**
 * Convierte la celda "Prospectos para trabajar" de la hoja (nombres
 * separados por coma) en un array de nombres únicos, en orden.
 * @param {string|null|undefined} celda
 * @returns {string[]}
 */
export function parsearProspectosParaTrabajar(celda) {
  if (!celda) return []
  const vistos = new Set()
  const out = []
  for (const parte of String(celda).split(/\s*,\s*/)) {
    const nombre = parte.trim()
    if (nombre && !vistos.has(nombre)) {
      vistos.add(nombre)
      out.push(nombre)
    }
  }
  return out
}

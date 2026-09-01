import { diasDesde } from './fecha'

/**
 * Formatea un número como monto monetario en locale argentino (es-AR)
 * con exactamente 2 decimales. Acepta null/undefined y devuelve '0,00'.
 * @param {number|null|undefined} valor
 * @returns {string}
 */
export function formatearMonto(valor) {
  const num = valor == null ? 0 : Number(valor)
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Redondea un número a 2 decimales evitando el arrastre de errores de
 * punto flotante típico de JS (ej: 0.1 + 0.2 = 0.30000000000000004).
 * Acepta null/undefined y devuelve 0.
 * @param {number|null|undefined} valor
 * @returns {number}
 */
export function redondear2(valor) {
  const num = valor == null ? 0 : Number(valor)
  return Math.round((num + Number.EPSILON) * 100) / 100
}

/**
 * Lista canónica de estados que puede tener un prospecto a lo largo del
 * pipeline. Es la fuente de verdad tanto para el selector de estado en
 * ProspectoDetalle como para cualquier acción rápida de cambio de estado
 * (ej. desde un drawer), para que ambos lugares ofrezcan siempre las mismas
 * opciones.
 */
export const ESTADOS_PROSPECTO = [
  'Nuevo',
  '1A - Contactado',
  '2A - Reunión Agendada',
  '3A - Seguimiento',
  '4A - Presupuesto Enviado',
  '5A - Negociación',
  '6A - En producción',
  '1H - Caido previo reunión',
  '2H - Caido en reunión',
  '3H - Caido luego del presupuesto',
  '4H - No califica',
  '5H - Finalizados'
]

/**
 * Mapea el estado de un prospecto a un par de colores (fondo/texto) para
 * mostrarlo como badge. Centralizado acá para que Prospectos, Empresas y
 * cualquier vista previa (drawers) usen siempre la misma paleta por estado.
 * Compara por subcadena (no por igualdad exacta) porque el texto real de
 * cada estado incluye una descripción variable (ej. '1A - Contactado') y
 * lo único estable es el prefijo numérico/letra.
 * @param {string} [estado]
 * @returns {{bg: string, text: string}}
 */
export function getEstadoProspectoStyle(estado) {
  const e = estado?.toLowerCase() || ''
  if (e === 'nuevo') return { bg: '#f3f4f6', text: '#374151' }
  if (e.includes('1a')) return { bg: '#dbeafe', text: '#1e40af' }
  if (e.includes('2a')) return { bg: '#e0e7ff', text: '#3730a3' }
  if (e.includes('3a')) return { bg: '#cffafe', text: '#0e7490' }
  if (e.includes('4a')) return { bg: '#fef3c7', text: '#92400e' }
  if (e.includes('5a')) return { bg: '#ffedd5', text: '#9a3412' }
  if (e.includes('6a')) return { bg: '#dcfce7', text: '#166534' }
  if (e.includes('h -') || e.includes('caido') || e.includes('no califica')) return { bg: '#fee2e2', text: '#991b1b' }
  if (e.includes('finalizado')) return { bg: '#f3e8ff', text: '#6b21a8' }
  return { bg: '#f3f4f6', text: '#374151' }
}

/**
 * Posición de un estado de prospecto en el pipeline, a partir de su prefijo
 * ("Nuevo", "1A", "2A", ..., "6A", "1H", ..., "5H"). No depende de que el
 * texto después del prefijo coincida exactamente con ESTADOS_PROSPECTO — en
 * la práctica hay variantes (ej. "1A - Pendiente de contactar" en vez de
 * "1A - Contactado"), y lo único estable es el número + letra. Los activos
 * (A) van siempre antes que los históricos/cerrados (H); "Nuevo" primero
 * de todos; un estado que no matchea ningún patrón va al final.
 * @param {string} [estado]
 * @returns {number}
 */
export function ordenEstadoProspecto(estado) {
  const s = String(estado || '').trim()
  if (/^nuevo\b/i.test(s)) return 0
  const m = /^(\d+)\s*([ah])\b/i.exec(s)
  if (!m) return 999
  const n = parseInt(m[1], 10)
  return m[2].toLowerCase() === 'a' ? n : 100 + n
}

/**
 * Ordena una lista de estados de prospecto según el orden del pipeline
 * (ver ordenEstadoProspecto). No muta el array recibido.
 * @param {string[]} estados
 * @returns {string[]}
 */
export function ordenarEstadosProspecto(estados) {
  return [...(estados || [])].sort((a, b) => {
    const diff = ordenEstadoProspecto(a) - ordenEstadoProspecto(b)
    return diff !== 0 ? diff : String(a).localeCompare(String(b))
  })
}

/**
 * ¿La próxima tarea de un prospecto está vencida? Es decir, su fecha ya pasó
 * (estrictamente antes de hoy — el día de hoy todavía no cuenta como
 * vencido). Usa diasDesde() para parsear la fecha en hora LOCAL: comparar
 * con `new Date(fecha) < new Date()` corre el día en husos horarios
 * negativos como Argentina.
 * @param {string} [fechaProximaTarea]  'YYYY-MM-DD'
 * @returns {boolean}
 */
export function tareaVencida(fechaProximaTarea) {
  const dias = diasDesde(fechaProximaTarea)
  return dias != null && dias > 0
}

/**
 * ¿Hay que facturarle a este prospecto? True cuando su "Próxima Factura"
 * (prospecto.proxima_factura) es HOY, o ya pasó, y todavía no se emitió
 * ninguna factura desde esa fecha (fecha_emision >= proxima_factura). Se usa
 * para marcar en rojo a los prospectos "en producción" a los que hay que
 * facturarles.
 * @param {{proxima_factura?: string}} [prospecto]
 * @param {Array<{fecha_emision?: string}>} [facturasDelProspecto] - solo las
 *   facturas DE ESE prospecto (el caller filtra por prospecto_id)
 * @param {Date} [hoy]
 * @returns {boolean}
 */
export function debeFacturarse(prospecto, facturasDelProspecto = [], hoy = new Date()) {
  const proximaFactura = prospecto?.proxima_factura
  if (!proximaFactura) return false

  const dias = diasDesde(proximaFactura, hoy)
  if (dias == null || dias < 0) return false // fecha inválida o todavía futura

  const yaFacturado = (facturasDelProspecto || []).some(f => {
    const fechaEmision = String(f?.fecha_emision || '').split('T')[0]
    return fechaEmision && fechaEmision >= proximaFactura
  })
  return !yaFacturado
}

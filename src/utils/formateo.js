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

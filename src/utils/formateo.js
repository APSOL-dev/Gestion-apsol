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

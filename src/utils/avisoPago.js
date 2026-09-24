/**
 * Texto que se le muestra a quien registra un pago sobre el aviso de "pago
 * recibido" al cliente. `aviso` es lo que informa savePago por `onAviso`:
 * { ok: true } o { ok: false, error }. Sin aviso (pago parcial) => null.
 * @returns {{tipo: 'success'|'error', texto: string} | null}
 */
export function mensajeAvisoPago(aviso) {
  if (!aviso) return null
  if (aviso.ok) {
    return { tipo: 'success', texto: 'Pago registrado. Se envió el aviso de pago recibido al cliente.' }
  }
  const motivo = aviso.error ? ` (${aviso.error})` : ''
  return {
    tipo: 'error',
    texto: `Pago registrado, pero NO se pudo enviar el aviso de pago recibido al cliente${motivo}. Avisale manualmente.`,
  }
}

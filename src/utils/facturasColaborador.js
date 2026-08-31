import { fechaLocalISO, restarDiasHabiles } from './fecha'

// Días hábiles antes de la fecha de pago en que se le habilita al colaborador
// subir su factura.
export const DIAS_HABILES_VENTANA = 2

/**
 * ¿El colaborador puede subir su factura ahora?
 *
 * Flujo: la ventana abre `DIAS_HABILES_VENTANA` días hábiles antes de la
 * "Próxima fecha de pago" y se cierra cuando el admin registra el pago
 * (mientras haya una factura sin `fecha_pago`, la ventana queda cerrada).
 *
 * @param {{proximaFechaPago?: string|null, facturas?: Array<{fecha_pago?: string|null}>, hoy?: string|Date}} args
 * @returns {{abierta: boolean, desde: string|null, motivo: 'sin-fecha'|'pendiente'|'espera'|'abierta'}}
 */
export function ventanaFacturaAbierta({ proximaFechaPago, facturas = [], hoy = new Date() } = {}) {
  const proxima = proximaFechaPago ? String(proximaFechaPago).split('T')[0] : ''
  if (!proxima) return { abierta: false, desde: null, motivo: 'sin-fecha' }

  const hayPendiente = (facturas || []).some(f => !f.fecha_pago)
  const desde = restarDiasHabiles(proxima, DIAS_HABILES_VENTANA) || null

  if (hayPendiente) return { abierta: false, desde, motivo: 'pendiente' }

  const hoyISO = hoy instanceof Date ? fechaLocalISO(hoy) : String(hoy).split('T')[0]
  if (desde && hoyISO < desde) return { abierta: false, desde, motivo: 'espera' }

  return { abierta: true, desde, motivo: 'abierta' }
}

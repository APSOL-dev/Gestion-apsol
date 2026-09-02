import { fechaLocalISO, restarDiasHabiles } from './fecha'

// Días hábiles antes de la fecha de pago en que se le habilita al colaborador
// subir su factura.
export const DIAS_HABILES_VENTANA = 2

const soloFecha = (v) => String(v || '').split('T')[0]

/**
 * ¿Esta factura del colaborador todavía está pendiente de pago? Lo está
 * mientras no tenga `fecha_pago` registrada. Se usa para mostrar la acción
 * rápida "Registrar pago" en la fila.
 * @param {{fecha_pago?: string|null}} factura
 * @returns {boolean}
 */
export function facturaPendientePago(factura) {
  return !soloFecha(factura?.fecha_pago)
}

/**
 * Arma el formulario para la acción "Registrar pago" de una factura:
 * propone HOY como fecha de pago (editable) cuando la factura no tiene una,
 * y normaliza las fechas a 'YYYY-MM-DD'. Si la factura ya trae `fecha_pago`
 * (reapertura), se respeta.
 * @param {object} factura
 * @param {string} [hoyISO]  Fecha local de hoy, 'YYYY-MM-DD'
 * @returns {object}
 */
export function prepararPagoFactura(factura = {}, hoyISO = fechaLocalISO()) {
  return {
    ...factura,
    fecha_factura: soloFecha(factura.fecha_factura) || hoyISO,
    fecha_pago: soloFecha(factura.fecha_pago) || hoyISO,
  }
}

/**
 * ¿Este guardado de factura es el que registró el pago? Es decir: antes
 * estaba pendiente (sin `fecha_pago`) y ahora ya tiene una. Se usa para
 * disparar el aviso al colaborador una sola vez, sin volver a mandarlo
 * si después se edita cualquier otro dato de una factura ya pagada.
 * @param {{fecha_pago?: string|null}|undefined} antes  Estado previo (o undefined si es un alta)
 * @param {{fecha_pago?: string|null}} despues  Estado ya guardado
 * @returns {boolean}
 */
export function debeNotificarPagoColaborador(antes, despues) {
  if (!antes) return false
  return facturaPendientePago(antes) && !facturaPendientePago(despues)
}

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

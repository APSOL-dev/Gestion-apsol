/**
 * Datos del Invoice ("Solo Invoice") listos para volcar al PDF. Todo el
 * mapeo factura + prospecto + cuenta bancaria -> texto del comprobante vive
 * acá, puro y sin jsPDF, para poder testearlo aislado. El dibujo del PDF
 * (posiciones, fuentes, logo) queda en FacturaDetalle.generarPDF, que solo
 * consume este objeto.
 *
 * El layout de referencia es el invoice que venía generando el flujo normal
 * (ver "OTRV Invoice.pdf"): encabezado, Fecha / N° Comprobante, Cliente,
 * Período facturado (Desde / Hasta / Vencimiento), "Servicio Brindado Según
 * Acuerdo" + Detalle, Monto total, Observaciones y "Cuenta a depositar".
 */

/** 'YYYY-MM-DD' (o ISO con hora) -> 'DD/MM/YYYY'. '' si no matchea. */
export function fechaInvoice(valor) {
  const s = String(valor || '').split('T')[0]
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Número -> '1.234,50 $' (es-AR, 2 decimales). Nulo/NaN -> '0,00 $'. */
export function formatearMontoInvoice(valor) {
  const n = Number(valor)
  const num = Number.isFinite(n) ? n : 0
  return `${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
}

// Un campo de cuenta vacío se muestra como '-' (nunca 'undefined' en el PDF).
const oGuion = (v) => {
  const s = String(v ?? '').trim()
  return s || '-'
}

/**
 * @param {object} args
 * @param {object} args.factura   fila/estado de la factura (numero_factura, fecha_emision,
 *                                periodo_desde/_hasta, fecha_vencimiento, leyenda, notas,
 *                                monto_neto|monto)
 * @param {object|null} args.prospecto  prospecto con su empresa (para el nombre del cliente)
 * @param {object|null} args.cuenta     fila de apsol_cuentas_bancarias seleccionada
 * @returns {{
 *   numero: string, fecha: string, cliente: string,
 *   periodoDesde: string, periodoHasta: string, vencimiento: string,
 *   detalle: string, montoTotal: string, observaciones: string,
 *   cuenta: null | {titular,banco,moneda,direccionBanco,aba,swift,numeroCuenta}
 * }}
 */
export function armarDatosInvoice({ factura = {}, prospecto = null, cuenta = null } = {}) {
  const cliente =
    prospecto?.empresas?.nombre ||
    prospecto?.empresa?.nombre ||
    prospecto?.nombre ||
    'Cliente'

  const monto = factura.monto_neto ?? factura.monto ?? 0

  return {
    numero: String(factura.numero_factura || 'S/N'),
    fecha: fechaInvoice(factura.fecha_emision),
    cliente,
    periodoDesde: fechaInvoice(factura.periodo_desde),
    periodoHasta: fechaInvoice(factura.periodo_hasta),
    vencimiento: fechaInvoice(factura.fecha_vencimiento),
    detalle: String(factura.leyenda || '').trim(),
    montoTotal: formatearMontoInvoice(monto),
    observaciones: String(factura.notas || '').trim(),
    cuenta: cuenta
      ? {
          titular: oGuion(cuenta.titular),
          banco: oGuion(cuenta.banco),
          moneda: oGuion(cuenta.moneda),
          direccionBanco: oGuion(cuenta.direccion_banco),
          aba: oGuion(cuenta.numero_ruta_aba),
          swift: oGuion(cuenta.codigo_swift),
          numeroCuenta: oGuion(cuenta.numero_cuenta_intl || cuenta.cbu),
        }
      : null,
  }
}

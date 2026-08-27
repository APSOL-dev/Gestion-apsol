const WEBHOOK_FACTURACION_URL = 'https://bots.apsol-consultora.com.ar/webhook/facturacion'

/**
 * Notifica al webhook único de n8n que centraliza los avisos de
 * facturación (email + WhatsApp). n8n decide internamente, según
 * 'evento', qué canal(es) y qué plantilla usar - por eso acá se manda
 * la factura completa (con sus joins de contacto/empresa/cuenta
 * bancaria), para que n8n no tenga que volver a consultarla.
 */
export async function notificarFacturacion(evento, factura) {
  const res = await fetch(WEBHOOK_FACTURACION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, factura })
  })
  if (!res.ok) {
    throw new Error(`Error al notificar al webhook de facturación (status ${res.status})`)
  }
}

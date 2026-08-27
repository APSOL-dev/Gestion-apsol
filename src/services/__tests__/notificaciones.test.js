import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ──────────────────────────────────────────────────────────────
// Tests de notificarFacturacion: POST al webhook único de n8n que
// centraliza los avisos de facturación (email + WhatsApp). n8n decide
// internamente el canal y la plantilla según 'evento'; acá solo se
// manda el evento y la factura completa (con joins) para que no
// necesite volver a consultarla.
// ──────────────────────────────────────────────────────────────
describe('notificarFacturacion', () => {
  let notificarFacturacion

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../notificaciones.js')
    notificarFacturacion = mod.notificarFacturacion
  })

  test('hace POST al webhook único de facturación con el evento y la factura', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await notificarFacturacion('primera_vez', { id: 'factura-1', numero_factura: '303' })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://bots.apsol-consultora.com.ar/webhook/facturacion',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento: 'primera_vez', factura: { id: 'factura-1', numero_factura: '303' } })
      }
    )
  })

  test('lanza error cuando el webhook responde con estado no-OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(notificarFacturacion('pago_recibido', { id: 'factura-1' })).rejects.toThrow(
      'Error al notificar al webhook de facturación'
    )
  })
})

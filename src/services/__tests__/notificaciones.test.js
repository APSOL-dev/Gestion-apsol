import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock encadenable de supabase (mismo patrón que colaboradores.test.js):
// cada método devuelve el mismo builder y el builder es "thenable".
const builders = []
const results = []
const fromMock = vi.fn()
const channelMock = vi.fn()
const removeChannelMock = vi.fn()

function makeBuilder(tabla) {
  const calls = []
  const result = results.length ? results.shift() : { data: [], error: null }
  const builder = {
    tabla,
    calls,
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'order', 'limit', 'single', 'maybeSingle']) {
    builder[m] = vi.fn((...args) => {
      calls.push([m, args])
      return builder
    })
  }
  builders.push(builder)
  return builder
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => fromMock(...args),
    channel: (...args) => channelMock(...args),
    removeChannel: (...args) => removeChannelMock(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  builders.length = 0
  results.length = 0
  fromMock.mockImplementation((tabla) => makeBuilder(tabla))
})

function payloadDe(builder, metodo) {
  const call = builder.calls.find(([m]) => m === metodo)
  return call ? call[1][0] : undefined
}
function argsDe(builder, metodo) {
  const call = builder.calls.find(([m]) => m === metodo)
  return call ? call[1] : undefined
}

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

// ──────────────────────────────────────────────────────────────
// Fase 2: lectura y marcado de apsol_notificaciones. Las filas las crea
// un trigger en la base (database/migration_notificaciones_fase2.sql) —
// acá solo se leen y se marcan como leídas, nunca se insertan a mano.
// ──────────────────────────────────────────────────────────────
describe('getNotificaciones', () => {
  test('pide las del usuario, más nuevas primero', async () => {
    results.push({ data: [{ id: 'n1' }], error: null })
    const { getNotificaciones } = await import('../notificaciones.js')

    const out = await getNotificaciones('user-1')

    const builder = builders.find(b => b.tabla === 'apsol_notificaciones')
    expect(argsDe(builder, 'eq')).toEqual(['destinatario_id', 'user-1'])
    expect(argsDe(builder, 'order')).toEqual(['creado_en', { ascending: false }])
    expect(out).toEqual([{ id: 'n1' }])
  })

  test('sin usuario logueado devuelve vacío sin pegarle a la red', async () => {
    const { getNotificaciones } = await import('../notificaciones.js')
    expect(await getNotificaciones(null)).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  test('propaga el error de supabase', async () => {
    results.push({ data: null, error: { message: 'boom' } })
    const { getNotificaciones } = await import('../notificaciones.js')
    await expect(getNotificaciones('user-1')).rejects.toBeTruthy()
  })
})

describe('marcarNotificacionLeida', () => {
  test('hace update de leido_en por id', async () => {
    results.push({ error: null })
    const { marcarNotificacionLeida } = await import('../notificaciones.js')

    await marcarNotificacionLeida('n1')

    const builder = builders.find(b => b.tabla === 'apsol_notificaciones')
    expect(payloadDe(builder, 'update')).toHaveProperty('leido_en')
    expect(argsDe(builder, 'eq')).toEqual(['id', 'n1'])
  })
})

describe('marcarTodasLeidas', () => {
  test('marca solo las del usuario que todavía están sin leer', async () => {
    results.push({ error: null })
    const { marcarTodasLeidas } = await import('../notificaciones.js')

    await marcarTodasLeidas('user-1')

    const builder = builders.find(b => b.tabla === 'apsol_notificaciones')
    expect(argsDe(builder, 'eq')).toEqual(['destinatario_id', 'user-1'])
    expect(argsDe(builder, 'is')).toEqual(['leido_en', null])
  })

  test('sin usuario no hace nada', async () => {
    const { marcarTodasLeidas } = await import('../notificaciones.js')
    await marcarTodasLeidas(null)
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('actualizarPreferenciasNotificacion', () => {
  test('guarda la lista de tipos desactivados del usuario', async () => {
    results.push({ error: null })
    const { actualizarPreferenciasNotificacion } = await import('../notificaciones.js')

    await actualizarPreferenciasNotificacion('user-1', ['ticket_asignado'])

    const builder = builders.find(b => b.tabla === 'apsol_usuarios')
    expect(payloadDe(builder, 'update')).toEqual({ notif_tipos_desactivados: ['ticket_asignado'] })
    expect(argsDe(builder, 'eq')).toEqual(['id', 'user-1'])
  })

  test('sin lista, guarda vacío en vez de null', async () => {
    results.push({ error: null })
    const { actualizarPreferenciasNotificacion } = await import('../notificaciones.js')

    await actualizarPreferenciasNotificacion('user-1', null)

    const builder = builders.find(b => b.tabla === 'apsol_usuarios')
    expect(payloadDe(builder, 'update')).toEqual({ notif_tipos_desactivados: [] })
  })
})

describe('suscribirseANotificaciones', () => {
  test('arma el canal filtrado por destinatario y devuelve función de limpieza', async () => {
    const onMock = vi.fn().mockReturnThis()
    const canalFalso = { on: onMock, subscribe: vi.fn(() => canalFalso) }
    channelMock.mockReturnValue(canalFalso)

    const { suscribirseANotificaciones } = await import('../notificaciones.js')
    const cancelar = suscribirseANotificaciones('user-1', vi.fn())

    expect(channelMock).toHaveBeenCalledWith('notificaciones-user-1')
    expect(onMock).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: 'INSERT', table: 'apsol_notificaciones', filter: 'destinatario_id=eq.user-1' }),
      expect.any(Function)
    )
    expect(canalFalso.subscribe).toHaveBeenCalled()

    cancelar()
    expect(removeChannelMock).toHaveBeenCalledWith(canalFalso)
  })

  test('sin usuario no crea canal', async () => {
    const { suscribirseANotificaciones } = await import('../notificaciones.js')
    suscribirseANotificaciones(null, vi.fn())()
    expect(channelMock).not.toHaveBeenCalled()
  })
})

import { describe, test, expect, vi, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────────────────
// Tests de formateo de montos (2 decimales exactos)
// ──────────────────────────────────────────────────────────────
describe('formatearMonto', () => {
  let formatearMonto

  beforeEach(async () => {
    const mod = await import('../../utils/formateo.js')
    formatearMonto = mod.formatearMonto
  })

  test('formatea un entero con exactamente 2 decimales en locale es-AR', () => {
    expect(formatearMonto(100000)).toBe('100.000,00')
  })

  test('formatea un número con decimales flotantes a exactamente 2 decimales', () => {
    expect(formatearMonto(711386.838)).toBe('711.386,84')
  })

  test('formatea un número negativo (descuento) correctamente', () => {
    expect(formatearMonto(-37441.413)).toBe('-37.441,41')
  })

  test('formatea cero correctamente', () => {
    expect(formatearMonto(0)).toBe('0,00')
  })

  test('formatea null como 0,00', () => {
    expect(formatearMonto(null)).toBe('0,00')
  })

  test('formatea undefined como 0,00', () => {
    expect(formatearMonto(undefined)).toBe('0,00')
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de sincronización de UVA desde API externa
// ──────────────────────────────────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe('sincronizarUVADesdeAPI', () => {
  let sincronizarUVADesdeAPI

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../services/sincronizacionUva.js')
    sincronizarUVADesdeAPI = mod.sincronizarUVADesdeAPI
  })

  test('retorna el valor UVA del día cuando la API responde correctamente', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { fecha: '2026-08-24', valor: 1650.50 },
        { fecha: '2026-08-25', valor: 1655.75 },
      ]
    })
    const resultado = await sincronizarUVADesdeAPI('2026-08-25')
    expect(resultado).toBe(1655.75)
  })

  test('retorna el valor más reciente si la fecha exacta no está en la API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { fecha: '2026-08-24', valor: 1650.50 },
        { fecha: '2026-08-25', valor: 1655.75 },
      ]
    })
    const resultado = await sincronizarUVADesdeAPI('2026-08-27')
    expect(resultado).toBe(1655.75)
  })

  test('lanza error cuando la API responde con estado no-OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(sincronizarUVADesdeAPI('2026-08-25')).rejects.toThrow(
      'Error al consultar la API de cotizaciones UVA'
    )
  })
})

describe('obtenerUVAParaFecha', () => {
  let obtenerUVAParaFecha

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../../services/sincronizacionUva.js')
    obtenerUVAParaFecha = mod.obtenerUVAParaFecha
  })

  test('retorna el valor local sin llamar a la API si ya existe en BD', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: { valor: 1655.75 }, error: null })
    })
    const resultado = await obtenerUVAParaFecha('2026-08-25')
    expect(resultado).toBe(1655.75)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('llama a la API externa como fallback si el valor no existe en BD', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null })
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: { valor: 1655.75 }, error: null })
      })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ fecha: '2026-08-25', valor: 1655.75 }]
    })
    const resultado = await obtenerUVAParaFecha('2026-08-25')
    expect(resultado).toBe(1655.75)
    expect(mockFetch).toHaveBeenCalledOnce()
  })
})

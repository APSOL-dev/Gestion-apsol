import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { crearRefrescador } from '../precargaModulo'

function armar(overrides = {}) {
  const meta = { ultimaCargaOk: 0, enVuelo: null }
  const setData = vi.fn()
  const setLoading = vi.fn()
  const setError = vi.fn()
  const getter = overrides.getter || vi.fn(async () => ['fila'])
  const refrescar = crearRefrescador({
    clave: 'test', getter, meta, setData, setLoading, setError,
    ttlMs: overrides.ttlMs ?? 90_000, timeoutMs: overrides.timeoutMs ?? 12_000
  })
  return { refrescar, meta, setData, setLoading, setError, getter }
}

describe('crearRefrescador', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('primera carga: llama al getter, setea data y apaga el loading', async () => {
    const { refrescar, getter, setData, setLoading } = armar()
    await refrescar(false)
    expect(getter).toHaveBeenCalledTimes(1)
    expect(setData).toHaveBeenCalledWith(['fila'])
    expect(setLoading).toHaveBeenCalledWith(true)
    expect(setLoading).toHaveBeenLastCalledWith(false)
  })

  it('refrescar(true) muestra loader = false (silencioso)', async () => {
    const { refrescar, setLoading } = armar()
    await refrescar(true)
    expect(setLoading).not.toHaveBeenCalledWith(true)
  })

  it('dentro del TTL, refrescar(true) NO vuelve a llamar al getter', async () => {
    const { refrescar, getter } = armar()
    await refrescar(false)                 // 1ª carga real
    await refrescar(true)                  // navegación: dentro del TTL
    await refrescar(true)
    expect(getter).toHaveBeenCalledTimes(1)
  })

  it('refrescar() forzado (post-mutación) sí vuelve a llamar al getter dentro del TTL', async () => {
    const { refrescar, getter } = armar()
    await refrescar(false)
    await refrescar()                      // sin arg = forzar
    expect(getter).toHaveBeenCalledTimes(2)
  })

  it('un evento de React como argumento se trata como forzar (no como opciones)', async () => {
    const { refrescar, getter } = armar()
    await refrescar(false)
    await refrescar({ nativeEvent: {}, target: {} }) // SyntheticEvent
    expect(getter).toHaveBeenCalledTimes(2)
  })

  it('single-flight: dos llamadas casi simultáneas disparan UN solo getter', async () => {
    let resolver
    const getter = vi.fn(() => new Promise(r => { resolver = r }))
    const { refrescar } = armar({ getter })
    const a = refrescar()
    const b = refrescar()
    resolver(['x'])
    await Promise.all([a, b])
    expect(getter).toHaveBeenCalledTimes(1)
  })

  it('si el getter se cuelga, corta por timeout y marca error (sin dejar loading)', async () => {
    vi.useFakeTimers()
    const getter = vi.fn(() => new Promise(() => {})) // nunca resuelve
    const { refrescar, setError, setLoading, setData } = armar({ getter, timeoutMs: 8_000 })

    const p = refrescar(false)
    await vi.advanceTimersByTimeAsync(8_000)
    await p

    expect(setError).toHaveBeenLastCalledWith(true)
    expect(setLoading).toHaveBeenLastCalledWith(false)
    expect(setData).not.toHaveBeenCalled()
  })

  it('tras un error, el TTL no aplica: el próximo refrescar reintenta de verdad', async () => {
    const getter = vi.fn()
      .mockRejectedValueOnce(new Error('cayó'))
      .mockResolvedValue(['ok'])
    const { refrescar, setData } = armar({ getter })

    await refrescar(false)                 // falla -> no marca ultimaCargaOk
    await refrescar(true)                  // aunque sea "silencioso/TTL", como no hubo carga OK, ejecuta

    expect(getter).toHaveBeenCalledTimes(2)
    expect(setData).toHaveBeenCalledWith(['ok'])
  })

  it('ttlMs = 0 desactiva la caché: cada refrescar(true) va a la red', async () => {
    const { refrescar, getter } = armar({ ttlMs: 0 })
    await refrescar(false)
    await refrescar(true)
    expect(getter).toHaveBeenCalledTimes(2)
  })
})

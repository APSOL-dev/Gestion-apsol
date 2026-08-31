import { describe, it, expect, vi } from 'vitest'
import { reintentar, conTimeout } from '../reintentar'

// reintentar(fn, { intentos, esperaMs }): ejecuta fn y, si lanza, reintenta
// hasta `intentos` veces con `esperaMs` de espera entre intentos. Sirve para
// llamadas de red que fallan de forma transitoria (token de Supabase que se
// está refrescando, hipo de red) y hoy obligan a recargar la página.

describe('reintentar', () => {
  it('devuelve el resultado sin reintentar si fn funciona a la primera', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(reintentar(fn, { esperaMs: 1 })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('reintenta y devuelve el resultado cuando fn falla las primeras veces y después funciona', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('401 transitorio'))
      .mockRejectedValueOnce(new Error('otra vez'))
      .mockResolvedValue('recuperado')

    await expect(reintentar(fn, { intentos: 3, esperaMs: 1 })).resolves.toBe('recuperado')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('agota los intentos y relanza el ÚLTIMO error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('err 1'))
      .mockRejectedValueOnce(new Error('err 2'))
      .mockRejectedValue(new Error('err final'))

    await expect(reintentar(fn, { intentos: 3, esperaMs: 1 })).rejects.toThrow('err final')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('con intentos: 1 llama una sola vez y no reintenta', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('falló'))
    await expect(reintentar(fn, { intentos: 1, esperaMs: 1 })).rejects.toThrow('falló')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('por defecto hace 3 intentos', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nop'))
    await expect(reintentar(fn, { esperaMs: 1 })).rejects.toThrow('nop')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('espera esperaMs entre intentos (no reintenta de inmediato)', async () => {
    vi.useFakeTimers()
    try {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('1'))
        .mockResolvedValue('ok')

      const promesa = reintentar(fn, { intentos: 2, esperaMs: 500 })
      // Tras el primer fallo, todavía no reintentó: está esperando.
      await Promise.resolve()
      expect(fn).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(500)
      await expect(promesa).resolves.toBe('ok')
      expect(fn).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('acepta un intentos inválido (0 o negativo) y ejecuta fn al menos una vez', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(reintentar(fn, { intentos: 0, esperaMs: 1 })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('conTimeout', () => {
  it('resuelve con el valor de la promesa si termina antes del límite', async () => {
    await expect(conTimeout(Promise.resolve('listo'), 1000)).resolves.toBe('listo')
  })

  it('propaga el rechazo de la promesa si falla antes del límite', async () => {
    await expect(conTimeout(Promise.reject(new Error('falló')), 1000)).rejects.toThrow('falló')
  })

  it('rechaza con Error de timeout si la promesa nunca termina', async () => {
    vi.useFakeTimers()
    try {
      const colgada = new Promise(() => {}) // nunca resuelve
      const p = conTimeout(colgada, 5000, 'La carga tardó demasiado')
      const expectativa = expect(p).rejects.toThrow('La carga tardó demasiado')
      await vi.advanceTimersByTimeAsync(5000)
      await expectativa
    } finally {
      vi.useRealTimers()
    }
  })

  it('limpia el timer cuando la promesa gana la carrera (no deja timers colgando)', async () => {
    vi.useFakeTimers()
    try {
      const p = conTimeout(Promise.resolve('ok'), 10000)
      await expect(p).resolves.toBe('ok')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('combina con reintentar: reintenta cuando un intento se cuelga y el siguiente responde', async () => {
    let intento = 0
    const fn = () => {
      intento++
      return intento === 1
        ? new Promise(() => {})          // 1er intento: se cuelga
        : Promise.resolve('recuperado')  // 2do intento: responde
    }
    vi.useFakeTimers()
    try {
      const p = reintentar(() => conTimeout(fn(), 3000, 'timeout'), { intentos: 2, esperaMs: 500 })
      await vi.advanceTimersByTimeAsync(3000) // vence el timeout del 1er intento
      await vi.advanceTimersByTimeAsync(500)  // espera entre intentos
      await expect(p).resolves.toBe('recuperado')
    } finally {
      vi.useRealTimers()
    }
  })
})

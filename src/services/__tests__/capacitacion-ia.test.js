import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const getSessionMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock
    }
  },
  supabaseUrl: 'https://kursvmadozcqxoaeaccd.supabase.co'
}))

describe('preguntarAsistenteIA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('rechaza sin lanzar el fetch si no hay sesión activa', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    const { preguntarAsistenteIA } = await import('../capacitacion.js')

    await expect(preguntarAsistenteIA('hola')).rejects.toThrow('iniciar sesión')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('llama a la Edge Function con el token de sesión y el mensaje', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok-123' } } })
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Mirá el tema "N8N Básico".' })
    })
    const { preguntarAsistenteIA } = await import('../capacitacion.js')

    const reply = await preguntarAsistenteIA('¿cómo configuro n8n?', [{ role: 'user', content: 'hola' }])

    expect(reply).toBe('Mirá el tema "N8N Básico".')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://kursvmadozcqxoaeaccd.supabase.co/functions/v1/capacitacion-chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      })
    )
    const [, options] = global.fetch.mock.calls[0]
    const sentBody = JSON.parse(options.body)
    expect(sentBody).toEqual({ message: '¿cómo configuro n8n?', history: [{ role: 'user', content: 'hola' }] })
  })

  test('lanza un error legible si la Edge Function responde con error', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok-123' } } })
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'El chat de IA no está configurado todavía' })
    })
    const { preguntarAsistenteIA } = await import('../capacitacion.js')

    await expect(preguntarAsistenteIA('hola')).rejects.toThrow('El chat de IA no está configurado todavía')
  })
})

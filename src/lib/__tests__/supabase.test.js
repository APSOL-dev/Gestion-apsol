import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// El cliente de Supabase NO debe desactivar `navigator.locks`.
//
// Había un parche que hacía `navigator.locks = undefined` para evitar
// "candados huérfanos". Sin esa API, auth-js cae a `lockNoOp` (sin lock) y
// `_acquireLock` deja de tener exclusión mutua: varias consultas paralelas
// (la precarga) entran todas como "dueñas del lock", cada una queda esperando
// a las otras en su bucle de drenaje y la app se cuelga para siempre — había
// que recargar la página con F5.
//
// La librería ya resuelve el caso del candado huérfano con
// `lockAcquireTimeout` (default 5000ms, "then steal orphaned lock"), así que
// el parche era además innecesario.

const createClientMock = vi.fn(() => ({ auth: {}, from: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

const locksFalsa = { request: vi.fn() }

describe('lib/supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    Object.defineProperty(window.navigator, 'locks', {
      value: locksFalsa, configurable: true, writable: true
    })
  })

  afterEach(() => {
    delete window.navigator.locks
  })

  it('NO desactiva navigator.locks (sin esa API auth-js se queda sin lock y se cuelga)', async () => {
    await import('../supabase')
    expect(window.navigator.locks).toBe(locksFalsa)
    expect(window.navigator.locks).toBeDefined()
  })

  it('configura lockAcquireTimeout para que un candado huérfano no bloquee para siempre', async () => {
    await import('../supabase')
    const opciones = createClientMock.mock.calls[0][2]
    expect(opciones?.auth?.lockAcquireTimeout).toBeGreaterThan(0)
    expect(opciones?.auth?.lockAcquireTimeout).toBeLessThanOrEqual(10_000)
  })

  it('mantiene la sesión persistida y el refresco automático de token', async () => {
    await import('../supabase')
    const opciones = createClientMock.mock.calls[0][2]
    expect(opciones?.auth?.persistSession).toBe(true)
    expect(opciones?.auth?.autoRefreshToken).toBe(true)
  })
})

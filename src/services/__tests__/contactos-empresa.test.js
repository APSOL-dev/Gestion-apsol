import { describe, test, expect, vi, beforeEach } from 'vitest'

const eqMock = vi.fn()
const orderMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => fromMock(...args)
  }
}))

describe('getContactosPorEmpresa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockReturnValue({ select: selectMock })
    selectMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ order: orderMock })
    orderMock.mockResolvedValue({ data: [{ id: 'c1', nombre: 'Rodrigo' }], error: null })
  })

  test('filtra server-side por empresa_id, no trae todos los contactos', async () => {
    const { getContactosPorEmpresa } = await import('../contactos')

    const data = await getContactosPorEmpresa('empresa-1')

    expect(fromMock).toHaveBeenCalledWith('apsol_contactos')
    expect(eqMock).toHaveBeenCalledWith('empresa_id', 'empresa-1')
    expect(data).toEqual([{ id: 'c1', nombre: 'Rodrigo' }])
  })

  test('sin empresaId no consulta nada y devuelve lista vacía', async () => {
    const { getContactosPorEmpresa } = await import('../contactos')

    const data = await getContactosPorEmpresa(null)

    expect(fromMock).not.toHaveBeenCalled()
    expect(data).toEqual([])
  })
})

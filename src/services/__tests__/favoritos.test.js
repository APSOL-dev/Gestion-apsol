import { describe, test, expect, vi, beforeEach } from 'vitest'
import { guardarFavoritos } from '../favoritos'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

describe('guardarFavoritos', () => {
  beforeEach(() => vi.clearAllMocks())

  test('actualiza la columna favoritos del usuario logueado', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ update })

    const favoritos = [{ to: '/proyectos', icon: 'FileText', label: 'Proyectos' }]
    await guardarFavoritos('user-1', favoritos)

    expect(supabase.from).toHaveBeenCalledWith('apsol_usuarios')
    expect(update).toHaveBeenCalledWith({ favoritos })
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
  })

  test('propaga el error si falla la actualización', async () => {
    const eq = vi.fn().mockResolvedValue({ error: new Error('boom') })
    supabase.from.mockReturnValue({ update: vi.fn(() => ({ eq })) })

    await expect(guardarFavoritos('user-1', [])).rejects.toThrow('boom')
  })
})

import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

// BUG real: getTickets pedía `apsol_colaboradores(nombre, apellido)`, pero esa
// tabla NO tiene esas columnas (tiene nombre_manual/apellido_manual y el
// nombre real sale de apsol_usuarios). Postgres devolvía
// "column apsol_colaboradores_1.nombre does not exist" y la pantalla de
// Tickets fallaba siempre, con o sin sesión.
describe('getTickets', () => {
  let getTickets

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    getTickets = (await import('../operaciones.js')).getTickets
  })

  test('no pide columnas inexistentes de apsol_colaboradores; toma el nombre de apsol_usuarios', async () => {
    const { supabase } = await import('../../lib/supabase')
    const select = vi.fn().mockReturnThis()
    supabase.from.mockReturnValueOnce({
      select,
      order: vi.fn().mockResolvedValueOnce({ data: [], error: null })
    })

    await getTickets()

    const consulta = select.mock.calls[0][0]
    // apsol_colaboradores NO expone `nombre`/`apellido` sueltos
    expect(consulta).not.toContain("apsol_colaboradores(nombre,")
    expect(consulta).not.toContain("apsol_colaboradores(nombre, apellido)")
    // el nombre debe venir del join a usuarios
    expect(consulta).toMatch(/apsol_colaboradores\([^)]*usuarios:apsol_usuarios\(/)
  })
})

describe('getTickets — normalización del nombre del colaborador', () => {
  let getTickets
  beforeEach(async () => {
    vi.clearAllMocks(); vi.resetModules()
    getTickets = (await import('../operaciones.js')).getTickets
  })

  async function conDatos(filas) {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValueOnce({ data: filas, error: null })
    })
    return getTickets()
  }

  test('toma nombre y apellido del usuario vinculado', async () => {
    const [t] = await conDatos([{ id: 't1', colaboradores: { nombre_manual: null, apellido_manual: null, usuarios: { nombre: 'Renata', apellido: 'Morano' } } }])
    expect(t.colaboradores.nombre).toBe('Renata')
    expect(t.colaboradores.apellido).toBe('Morano')
  })

  test('cae a los campos manuales cuando el colaborador no tiene usuario', async () => {
    const [t] = await conDatos([{ id: 't1', colaboradores: { nombre_manual: 'Juan', apellido_manual: 'Pérez', usuarios: null } }])
    expect(t.colaboradores.nombre).toBe('Juan')
    expect(t.colaboradores.apellido).toBe('Pérez')
  })

  test('un ticket sin colaborador asignado pasa intacto', async () => {
    const [t] = await conDatos([{ id: 't1', colaboradores: null }])
    expect(t.colaboradores).toBeNull()
  })
})

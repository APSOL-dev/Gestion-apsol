import { describe, test, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
const selectMock = vi.fn()
const singleMock = vi.fn()
const fromMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => fromMock(...args)
  }
}))

describe('saveContacto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockReturnValue({ insert: insertMock })
    insertMock.mockReturnValue({ select: selectMock })
    selectMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: { id: '1', activo: true }, error: null })
  })

  // Regresión: apsol_contactos no tenía columna `activo` en la base, aunque
  // crearContactoRapido (ProspectoDetalle.jsx) y ContactoDrawer.jsx ya
  // asumían que existía - el insert fallaba con error 400 ("Error al crear
  // el contacto. Intente nuevamente."). Se agregó la columna vía
  // database/migration_activo_contactos.sql. Este test deja documentado
  // que `activo` tiene que viajar intacto en el insert - si alguien vuelve
  // a sacarlo del payload del lado del cliente, se rompe de nuevo.
  test('envía el campo activo tal cual viene, sin filtrarlo del payload', async () => {
    const { saveContacto } = await import('../contactos')

    await saveContacto({
      nombre: 'Rodrigo',
      apellido: 'Wolf',
      telefono: '3424476596',
      email: 'omegasonido@gmail.com',
      cargo: 'Gerente General',
      area: 'PostVenta',
      empresa_id: 'empresa-1',
      activo: true
    })

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({ activo: true, empresa_id: 'empresa-1' })
    ])
  })
})

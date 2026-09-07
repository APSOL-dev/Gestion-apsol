import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import MiPerfil from '../MiPerfil'
import { useAuth } from '../../context/AuthContext'

// El bug: `Seccion` y `Mensaje` se definen DENTRO de MiPerfil, así que en
// cada render (cada tecla) React ve un tipo de componente nuevo y desmonta /
// vuelve a montar toda la sección. El <input> se destruye y se recrea: se
// pierde el foco y la pantalla salta. Este test tipea una tecla y verifica
// que el input siga siendo el mismo nodo y conserve el foco.

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { nombre: 'Mateo', apellido: 'Courault', email: 'mateo.apsol@gmail.com', email_personal: '' },
            error: null,
          })),
        })),
      })),
    })),
    auth: { updateUser: vi.fn(() => Promise.resolve({ error: null })) },
  },
}))

vi.mock('../../services/colaboradores', () => ({
  getMiFichaColaborador: vi.fn(() => Promise.resolve(null)),
  saveFacturaColaborador: vi.fn(),
  uploadFile: vi.fn(),
}))

vi.mock('../../services/notificaciones', () => ({
  notificarFacturaColaborador: vi.fn(),
}))

describe('MiPerfil — cambiar contraseña', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u-mateo', email: 'mateo.apsol@gmail.com' } })
  })

  test('el input de contraseña conserva el foco y su nodo al tipear (no re-monta)', async () => {
    const { container } = render(<MiPerfil />)
    await screen.findByText('Cambiar contraseña')

    const nueva = container.querySelectorAll('input[type="password"]')[0]
    nueva.focus()
    expect(nueva).toHaveFocus()

    fireEvent.change(nueva, { target: { value: 'M' } })

    const despues = container.querySelectorAll('input[type="password"]')[0]
    expect(despues).toBe(nueva)       // mismo nodo: no hubo desmontaje/re-montaje
    expect(despues).toHaveFocus()     // conserva el foco
    expect(despues).toHaveValue('M')
  })

  test('se puede escribir una contraseña completa de corrido', async () => {
    const { container } = render(<MiPerfil />)
    await screen.findByText('Cambiar contraseña')

    const nueva = container.querySelectorAll('input[type="password"]')[0]
    nueva.focus()

    for (const ch of 'Mateo0426') {
      const vivo = container.querySelectorAll('input[type="password"]')[0]
      fireEvent.change(vivo, { target: { value: vivo.value + ch } })
    }

    expect(container.querySelectorAll('input[type="password"]')[0]).toHaveValue('Mateo0426')
  })
})

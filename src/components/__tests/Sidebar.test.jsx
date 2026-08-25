import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '../Sidebar'
import { useAuth } from '../../context/AuthContext'

// Crear mock de useNavigate que podamos verificar en las pruebas
const mockNavigate = vi.fn()

// Mock de AuthContext y react-router-dom
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Componente Sidebar', () => {
  const mockLogout = vi.fn()
  const mockPerfil = { nombre: 'Adrian', apellido: 'Admin', cargo: 'Admin' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    useAuth.mockReturnValue({
      perfil: mockPerfil,
      logout: mockLogout,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('debe renderizar el sidebar expandido por defecto', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )

    // El aside no debe tener la clase de colapsado
    const aside = container.querySelector('aside')
    expect(aside).toBeInTheDocument()
    expect(aside).not.toHaveClass('sidebar--collapsed')

    // El nombre de la marca debe ser visible
    expect(screen.getByText('APSOL')).toBeInTheDocument()
  })

  test('debe colapsar el sidebar al pulsar el botón manualmente', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )

    const aside = container.querySelector('aside')
    const toggleBtn = screen.getByTitle('Colapsar')

    // Pulsamos el botón
    fireEvent.click(toggleBtn)

    expect(aside).toHaveClass('sidebar--collapsed')
    expect(screen.getByTitle('Expandir')).toBeInTheDocument()
  })

  test('debe colapsar el sidebar automáticamente después de 10 segundos', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )

    const aside = container.querySelector('aside')
    expect(aside).not.toHaveClass('sidebar--collapsed')

    // Adelantamos el tiempo 9.9 segundos
    act(() => {
      vi.advanceTimersByTime(9900)
    })
    expect(aside).not.toHaveClass('sidebar--collapsed')

    // Adelantamos el tiempo para completar los 10 segundos
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(aside).toHaveClass('sidebar--collapsed')
  })

  test('debe pausar el temporizador si el cursor entra (mouseenter) y reiniciarlo al salir (mouseleave)', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )

    const aside = container.querySelector('aside')

    // Adelantamos 5 segundos
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(aside).not.toHaveClass('sidebar--collapsed')

    // El cursor entra al menú lateral
    fireEvent.mouseEnter(aside)

    // Adelantamos otros 10 segundos
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    // No debe haberse cerrado porque el cursor está encima
    expect(aside).not.toHaveClass('sidebar--collapsed')

    // El cursor sale del menú lateral
    fireEvent.mouseLeave(aside)

    // Adelantamos 9.9 segundos después de salir
    act(() => {
      vi.advanceTimersByTime(9900)
    })
    expect(aside).not.toHaveClass('sidebar--collapsed')

    // Completamos los 10 segundos desde la salida
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(aside).toHaveClass('sidebar--collapsed')
  })
})

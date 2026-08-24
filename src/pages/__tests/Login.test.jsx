import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import Login from '../Login'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

// Mockear el contexto de autenticación y react-router-dom
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}))

describe('Componente Login', () => {
  const mockNavigate = vi.fn()
  const mockLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useNavigate.mockReturnValue(mockNavigate)
    useAuth.mockReturnValue({
      user: null,
      login: mockLogin,
    })
  })

  test('debe renderizar el formulario correctamente', () => {
    render(<Login />)

    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ingresar/i })).toBeInTheDocument()
  })

  test('debe alternar la visibilidad de la contraseña al pulsar el botón del ojo', () => {
    render(<Login />)

    const inputPassword = screen.getByLabelText(/Contraseña/i)
    const toggleButton = screen.getByRole('button', { name: '' }) // el botón del icono no tiene texto de nombre por defecto

    // Por defecto el tipo de entrada debe ser 'password'
    expect(inputPassword).toHaveAttribute('type', 'password')

    // Hacemos clic para mostrar contraseña
    fireEvent.click(toggleButton)
    expect(inputPassword).toHaveAttribute('type', 'text')

    // Volvemos a hacer clic para ocultarla
    fireEvent.click(toggleButton)
    expect(inputPassword).toHaveAttribute('type', 'password')
  })

  test('debe mostrar mensaje de error si el login falla', async () => {
    // Simulamos que el login devuelve un error
    mockLogin.mockResolvedValue({ error: { message: 'AuthApiError' } })

    render(<Login />)

    const inputEmail = screen.getByLabelText(/Email/i)
    const inputPassword = screen.getByLabelText(/Contraseña/i)
    const btnSubmit = screen.getByRole('button', { name: /Ingresar/i })

    // Rellenamos el formulario
    fireEvent.change(inputEmail, { target: { value: 'error@apsol.com' } })
    fireEvent.change(inputPassword, { target: { value: 'wrongpass' } })

    // Enviamos
    fireEvent.click(btnSubmit)

    // Esperamos a que aparezca la alerta de error
    await waitFor(() => {
      expect(screen.getByText(/Email o contraseña incorrectos/i)).toBeInTheDocument()
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('debe iniciar sesión exitosamente y redirigir al dashboard', async () => {
    // Simulamos que el login es exitoso (devuelve error: null)
    mockLogin.mockResolvedValue({ error: null })

    render(<Login />)

    const inputEmail = screen.getByLabelText(/Email/i)
    const inputPassword = screen.getByLabelText(/Contraseña/i)
    const btnSubmit = screen.getByRole('button', { name: /Ingresar/i })

    // Rellenamos el formulario
    fireEvent.change(inputEmail, { target: { value: 'admin@apsol.com' } })
    fireEvent.change(inputPassword, { target: { value: 'acpacp' } })

    // Enviamos
    fireEvent.click(btnSubmit)

    // Esperamos que se llame a login y luego a navigate
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@apsol.com', 'acpacp')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  test('debe redirigir al dashboard inmediatamente si el usuario ya está autenticado', () => {
    // Simulamos que el usuario ya tiene sesión iniciada al montar el componente
    useAuth.mockReturnValue({
      user: { id: 'user-id', email: 'admin@apsol.com' },
      login: mockLogin,
    })

    render(<Login />)

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})

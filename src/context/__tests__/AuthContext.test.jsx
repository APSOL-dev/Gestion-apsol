import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthProvider, useAuth } from '../AuthContext'
import { supabase } from '../../lib/supabase'

// Mockear el cliente de Supabase. cargarPerfil hace DOS consultas: el
// perfil (apsol_usuarios, vía .single()) y la ficha de colaborador para
// el flag es_team_lead (apsol_colaboradores, vía .maybeSingle()) — cada
// tabla tiene su propio resultado configurable por separado.
vi.mock('../../lib/supabase', () => {
  const resultadosPorTabla = {}
  function resultadoDe(tabla) {
    return resultadosPorTabla[tabla] || { data: null, error: null }
  }
  const mockFrom = vi.fn((tabla) => {
    const builder = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.single = vi.fn(() => Promise.resolve(resultadoDe(tabla)))
    builder.maybeSingle = vi.fn(() => Promise.resolve(resultadoDe(tabla)))
    return builder
  })

  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
      from: mockFrom,
      _mockFrom: mockFrom,
      // Configurar el resultado que devuelve cada tabla en los tests
      _setResultado: (tabla, resultado) => { resultadosPorTabla[tabla] = resultado },
      _resetResultados: () => { for (const k of Object.keys(resultadosPorTabla)) delete resultadosPorTabla[k] },
    },
  }
})

// Componente helper de pruebas para consumir el contexto
function TestConsumer() {
  const { user, perfil, loading, esDuenio, esTeamLead, login, logout } = useAuth()
  if (loading) return <div>Cargando...</div>
  return (
    <div>
      <div data-testid="user-email">{user ? user.email : 'no-user'}</div>
      <div data-testid="perfil-cargo">{perfil ? perfil.cargo : 'no-cargo'}</div>
      <div data-testid="es-duenio">{esDuenio ? 'si' : 'no'}</div>
      <div data-testid="es-team-lead">{esTeamLead ? 'si' : 'no'}</div>
    </div>
  )
}

describe('Contexto AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase._resetResultados()
    // Configuración por defecto de sesión nula
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
  })

  test('debe inicializar en estado de carga y luego sin sesión activa', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    // Al inicio debe decir cargando
    expect(screen.getByText('Cargando...')).toBeInTheDocument()

    // Después de resolver la sesión, debe cambiar
    await waitFor(() => {
      expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('user-email')).toHaveTextContent('no-user')
    expect(screen.getByTestId('perfil-cargo')).toHaveTextContent('no-cargo')
    expect(screen.getByTestId('es-duenio')).toHaveTextContent('no')
  })

  test('debe cargar el perfil de un Colaborador y configurar esDuenio a false', async () => {
    const mockUser = { id: 'colab-id', email: 'colab@apsol.com' }
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    })

    // Mockear la respuesta de la base de datos para el perfil del colaborador
    supabase._setResultado('apsol_usuarios', {
      data: { id: 'colab-id', email: 'colab@apsol.com', cargo: 'Colaborador', nombre: 'colab' },
      error: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('user-email')).toHaveTextContent('colab@apsol.com')
    expect(screen.getByTestId('perfil-cargo')).toHaveTextContent('Colaborador')
    expect(screen.getByTestId('es-duenio')).toHaveTextContent('no')
  })

  test('debe marcar esTeamLead cuando la ficha de colaborador tiene el flag activo', async () => {
    const mockUser = { id: 'lead-id', email: 'lead@apsol.com' }
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    })
    supabase._setResultado('apsol_usuarios', {
      data: { id: 'lead-id', email: 'lead@apsol.com', cargo: 'Colaborador', nombre: 'lead' },
      error: null,
    })
    supabase._setResultado('apsol_colaboradores', {
      data: { es_team_lead: true },
      error: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('es-team-lead')).toHaveTextContent('si')
  })

  test('sin ficha de colaborador (o sin el flag), esTeamLead queda en false', async () => {
    const mockUser = { id: 'colab-id', email: 'colab@apsol.com' }
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    })
    supabase._setResultado('apsol_usuarios', {
      data: { id: 'colab-id', email: 'colab@apsol.com', cargo: 'Colaborador', nombre: 'colab' },
      error: null,
    })
    supabase._setResultado('apsol_colaboradores', { data: null, error: null })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('es-team-lead')).toHaveTextContent('no')
  })

  test('debe cargar el perfil de un Admin y configurar esDuenio a true', async () => {
    const mockUser = { id: 'admin-id', email: 'admin@apsol.com' }
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    })

    // Mockear la respuesta de la base de datos para el perfil del administrador
    supabase._setResultado('apsol_usuarios', {
      data: { id: 'admin-id', email: 'admin@apsol.com', cargo: 'Admin', nombre: 'admin' },
      error: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('user-email')).toHaveTextContent('admin@apsol.com')
    expect(screen.getByTestId('perfil-cargo')).toHaveTextContent('Admin')
    expect(screen.getByTestId('es-duenio')).toHaveTextContent('si')
  })
})

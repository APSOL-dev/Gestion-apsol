import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Planificacion from '../Planificacion'
import { getPlanes, crearPlan } from '../../services/planificacion'

// Mock de los servicios
vi.mock('../../services/planificacion', () => ({
  getPlanes: vi.fn(),
  crearPlan: vi.fn(),
  eliminarPlan: vi.fn(),
}))

const mockPlanes = [
  {
    id: 'plan-1',
    nombre: 'Plan Q3 2026',
    fecha_inicio: '2026-07-01',
    fecha_fin: '2026-10-31',
    estado: 'en_curso'
  },
  {
    id: 'plan-2',
    nombre: 'Plan Q4 2026',
    fecha_inicio: '2026-11-01',
    fecha_fin: '2027-02-28',
    estado: 'borrador'
  }
]

describe('Componente Planificacion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPlanes.mockResolvedValue(mockPlanes)
  })

  test('debe renderizar el titulo y los planes cargados', async () => {
    render(
      <BrowserRouter>
        <Planificacion />
      </BrowserRouter>
    )

    expect(screen.getByText('Cargando planes...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Planificación')).toBeInTheDocument()
      expect(screen.getByText('Plan Q3 2026')).toBeInTheDocument()
      expect(screen.getByText('Plan Q4 2026')).toBeInTheDocument()
    })
  })

  test('debe filtrar planes por termino de busqueda', async () => {
    render(
      <BrowserRouter>
        <Planificacion />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Plan Q3 2026')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Buscar por nombre de plan...')
    fireEvent.change(searchInput, { target: { value: 'Q3' } })

    expect(screen.getByText('Plan Q3 2026')).toBeInTheDocument()
    expect(screen.queryByText('Plan Q4 2026')).not.toBeInTheDocument()
  })

  test('debe filtrar planes por estado al hacer click en los botones de filtro', async () => {
    render(
      <BrowserRouter>
        <Planificacion />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Plan Q3 2026')).toBeInTheDocument()
      expect(screen.getByText('Plan Q4 2026')).toBeInTheDocument()
    })

    const filterBorrador = screen.getByRole('button', { name: 'Borrador' })
    fireEvent.click(filterBorrador)

    expect(screen.queryByText('Plan Q3 2026')).not.toBeInTheDocument()
    expect(screen.getByText('Plan Q4 2026')).toBeInTheDocument()
  })

  test('debe abrir el modal para crear nuevo plan y enviar datos', async () => {
    const nuevoPlan = {
      id: 'plan-3',
      nombre: 'Plan Q1 2027',
      fecha_inicio: '2027-03-01',
      fecha_fin: '2027-06-30',
      estado: 'borrador'
    }
    crearPlan.mockResolvedValue(nuevoPlan)

    render(
      <BrowserRouter>
        <Planificacion />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Plan Q3 2026')).toBeInTheDocument()
    })

    // Hacer click en "Nuevo Plan"
    const openModalBtn = screen.getByRole('button', { name: 'Nuevo Plan' })
    fireEvent.click(openModalBtn)

    // Completar el formulario del modal
    const nameInput = screen.getByLabelText('Nombre del Plan')
    const startInput = screen.getByLabelText('Fecha Inicio')
    const endInput = screen.getByLabelText('Fecha Fin')
    const submitBtn = screen.getByRole('button', { name: 'Crear Plan' })

    fireEvent.change(nameInput, { target: { value: 'Plan Q1 2027' } })
    fireEvent.change(startInput, { target: { value: '2027-03-01' } })
    fireEvent.change(endInput, { target: { value: '2027-06-30' } })

    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(crearPlan).toHaveBeenCalledWith({
        nombre: 'Plan Q1 2027',
        fecha_inicio: '2027-03-01',
        fecha_fin: '2027-06-30'
      })
      expect(screen.getByText('Plan Q1 2027')).toBeInTheDocument()
    })
  })
})

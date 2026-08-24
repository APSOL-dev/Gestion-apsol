import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PlanDetalle from '../PlanDetalle'
import {
  getPlanById,
  getColaboradoresActivos,
  actualizarPlan,
  crearObjetivo
} from '../../services/planificacion'

// Mock de los servicios
vi.mock('../../services/planificacion', () => ({
  getPlanById: vi.fn(),
  getColaboradoresActivos: vi.fn(),
  actualizarPlan: vi.fn(),
  crearObjetivo: vi.fn(),
  actualizarObjetivo: vi.fn(),
  eliminarObjetivo: vi.fn(),
  crearSubobjetivo: vi.fn(),
  actualizarSubobjetivo: vi.fn(),
  eliminarSubobjetivo: vi.fn(),
  crearTarea: vi.fn(),
  actualizarTarea: vi.fn(),
  eliminarTarea: vi.fn(),
  setAsignaciones: vi.fn()
}))

const mockPlan = {
  id: 'plan-1',
  nombre: 'Plan Q3 2026',
  fecha_inicio: '2026-07-01',
  fecha_fin: '2026-10-31',
  estado: 'en_curso',
  objetivos: [
    {
      id: 'obj-1',
      titulo: 'Objetivo Ventas',
      descripcion: 'Subir ventas 20%',
      color: '#2563EB',
      orden: 0
    }
  ],
  subobjetivos: [
    {
      id: 'sub-1',
      texto: 'Subobjetivo A',
      orden: 0
    }
  ],
  tareas: [
    {
      id: 'task-1',
      objetivo_id: 'obj-1',
      nombre: 'Tarea A',
      semana_inicio: 1,
      duracion_semanas: 3,
      progreso: 30,
      orden: 0,
      asignaciones: []
    }
  ]
}

const mockColaboradores = [
  {
    id: 'colab-1',
    usuario: {
      nombre: 'Juan',
      apellido: 'Perez'
    }
  }
]

describe('Componente PlanDetalle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPlanById.mockResolvedValue(mockPlan)
    getColaboradoresActivos.mockResolvedValue(mockColaboradores)
  })

  test('debe renderizar el detalle del plan correctamente', async () => {
    render(
      <MemoryRouter initialEntries={['/planificacion/plan-1']}>
        <Routes>
          <Route path="/planificacion/:id" element={<PlanDetalle />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Cargando detalles del plan...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Plan Q3 2026')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Objetivo Ventas')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Subobjetivo A')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Tarea A')).toBeInTheDocument()
    })
  })

  test('debe actualizar el nombre del plan', async () => {
    actualizarPlan.mockResolvedValue({ ...mockPlan, nombre: 'Plan Editado' })

    render(
      <MemoryRouter initialEntries={['/planificacion/plan-1']}>
        <Routes>
          <Route path="/planificacion/:id" element={<PlanDetalle />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Plan Q3 2026')).toBeInTheDocument()
    })

    const titleInput = screen.getByDisplayValue('Plan Q3 2026')
    fireEvent.change(titleInput, { target: { value: 'Plan Editado' } })
    fireEvent.blur(titleInput)

    expect(actualizarPlan).toHaveBeenCalledWith('plan-1', { nombre: 'Plan Editado' })
  })

  test('debe agregar un nuevo objetivo', async () => {
    const nuevoObj = {
      id: 'obj-2',
      titulo: 'Nuevo objetivo',
      descripcion: 'Descripción del objetivo',
      color: '#059669',
      orden: 1
    }
    crearObjetivo.mockResolvedValue(nuevoObj)

    render(
      <MemoryRouter initialEntries={['/planificacion/plan-1']}>
        <Routes>
          <Route path="/planificacion/:id" element={<PlanDetalle />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Objetivo Ventas')).toBeInTheDocument()
    })

    const addObjBtn = screen.getByText('Agregar Objetivo')
    fireEvent.click(addObjBtn)

    await waitFor(() => {
      expect(crearObjetivo).toHaveBeenCalledWith({
        plan_id: 'plan-1',
        titulo: 'Nuevo objetivo',
        descripcion: 'Descripción del objetivo',
        color: '#059669',
        orden: 1
      })
      expect(screen.getByDisplayValue('Nuevo objetivo')).toBeInTheDocument()
    })
  })
})

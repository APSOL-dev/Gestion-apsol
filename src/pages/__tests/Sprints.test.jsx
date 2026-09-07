import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Sprints from '../Sprints'
import {
  getSprintsActivos, getSprintsPlanificados, getSprintsDeProyecto, crearSprint,
} from '../../services/sprints'
import { getProyectos } from '../../services/proyectos'

vi.mock('../../services/sprints', () => ({
  getSprintsActivos: vi.fn(),
  getSprintsPlanificados: vi.fn(),
  getSprintsDeProyecto: vi.fn(),
  crearSprint: vi.fn(),
}))
vi.mock('../../services/proyectos', () => ({
  getProyectos: vi.fn(),
}))

const mockSprint = {
  id: 'sprint-1',
  numero: 1,
  nombre: 'Sprint 1',
  proyecto: { id: 'proy-1', nombre: 'proyecto 2' },
  items: [],
}

function renderSprints() {
  return render(
    <MemoryRouter initialEntries={['/sprints']}>
      <Routes>
        <Route path="/sprints" element={<Sprints />} />
        <Route path="/sprints/:id" element={<div>Detalle del sprint</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Sprints — fila clickeable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSprintsActivos.mockResolvedValue([mockSprint])
    getSprintsPlanificados.mockResolvedValue([])
  })

  test('clic en la celda del proyecto (no en el link) navega al detalle del sprint', async () => {
    renderSprints()
    const celdaProyecto = await screen.findByText('proyecto 2')
    fireEvent.click(celdaProyecto)
    await waitFor(() => {
      expect(screen.getByText('Detalle del sprint')).toBeInTheDocument()
    })
  })

  test('clic en la celda de avance navega al detalle del sprint', async () => {
    renderSprints()
    const celdaAvance = await screen.findByText('0%')
    fireEvent.click(celdaAvance)
    await waitFor(() => {
      expect(screen.getByText('Detalle del sprint')).toBeInTheDocument()
    })
  })
})

describe('Sprints — planificados y alta directa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSprintsActivos.mockResolvedValue([mockSprint])
    getSprintsPlanificados.mockResolvedValue([])
  })

  test('los sprints planificados aparecen en su propia sección (no quedan escondidos)', async () => {
    getSprintsPlanificados.mockResolvedValue([{
      id: 'sp-plan', numero: 2, nombre: 'Sin iniciar',
      proyecto: { id: 'proy-9', nombre: 'PRUEBA Proyecto' }, items: [],
    }])
    renderSprints()

    const seccion = (await screen.findByText(/Planificados \(1\)/)).closest('.card')
    expect(within(seccion).getByText('PRUEBA Proyecto')).toBeInTheDocument()
    expect(within(seccion).getByText('Sprint 2 · Sin iniciar')).toBeInTheDocument()
  })

  test('sin planificados no se muestra la sección "Planificados"', async () => {
    renderSprints()
    await screen.findByText(/Sprints activos/)
    expect(screen.queryByText(/Planificados \(/)).not.toBeInTheDocument()
  })

  test('"Nuevo Sprint" pide un proyecto, crea el sprint y navega a su ficha', async () => {
    getProyectos.mockResolvedValue([
      { id: 'proy-1', nombre: 'proyecto 2' },
      { id: 'proy-7', nombre: 'App Consultora' },
    ])
    getSprintsDeProyecto.mockResolvedValue([{ numero: 1 }, { numero: 2 }])
    crearSprint.mockResolvedValue({ id: 'sprint-nuevo' })

    renderSprints()
    await screen.findByText(/Sprints activos/)

    fireEvent.click(screen.getByRole('button', { name: /Nuevo Sprint/ }))
    await screen.findByText('-- Elegí un proyecto --')

    fireEvent.change(screen.getByLabelText('Proyecto'), { target: { value: 'proy-7' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear Sprint/ }))

    await waitFor(() => {
      expect(getSprintsDeProyecto).toHaveBeenCalledWith('proy-7')
      // numero siguiente = 3 (había 1 y 2)
      expect(crearSprint).toHaveBeenCalledWith({ proyecto_id: 'proy-7', numero: 3 })
      expect(screen.getByText('Detalle del sprint')).toBeInTheDocument()
    })
  })
})

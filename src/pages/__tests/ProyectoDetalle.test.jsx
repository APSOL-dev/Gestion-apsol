import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProyectoDetalle from '../ProyectoDetalle'
import { useData } from '../../context/DataContext'
import { getProyectoById, saveProyecto, deleteProyecto } from '../../services/proyectos'
import { getProspectos } from '../../services/prospectos'
import { getColaboradores } from '../../services/colaboradores'
import { getSprintsDeProyecto } from '../../services/sprints'

// Al guardar un proyecto, la lista de /proyectos (cacheada en DataContext)
// no se refrescaba: quedaba mostrando datos viejos (ej. el join con la
// empresa del prospecto) hasta que venciera el TTL de la caché.

vi.mock('../../context/DataContext', () => ({
  useData: vi.fn(),
}))

vi.mock('../../services/proyectos', () => ({
  getProyectoById: vi.fn(),
  saveProyecto: vi.fn(),
  deleteProyecto: vi.fn(),
}))

vi.mock('../../services/prospectos', () => ({
  getProspectos: vi.fn(),
}))

vi.mock('../../services/colaboradores', () => ({
  getColaboradores: vi.fn(),
}))

vi.mock('../../services/sprints', () => ({
  getSprintsDeProyecto: vi.fn(),
  crearSprint: vi.fn(),
}))

const mockProyecto = {
  id: 'proy-1',
  nombre: 'proyecto 1',
  prospecto_id: 'prospecto-1',
  lider_colaborador_id: '',
  fecha_inicio: '',
  fecha_fin_estimada: '',
  estado: 'Activo',
  porcentaje_avance: 0,
  descripcion: '',
  prospectos: { id: 'prospecto-1', nombre: 'Open Pack Final', empresas: { nombre: 'Open Pack' } },
  tickets: [],
  preventivos: [],
}

function renderDetalle() {
  return render(
    <MemoryRouter initialEntries={['/proyectos/proy-1']}>
      <Routes>
        <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProyectoDetalle — refresco de caché al guardar', () => {
  let refreshProyectos

  beforeEach(() => {
    vi.clearAllMocks()
    refreshProyectos = vi.fn()
    useData.mockReturnValue({ refreshProyectos })
    getProyectoById.mockResolvedValue(mockProyecto)
    getProspectos.mockResolvedValue([
      { id: 'prospecto-1', nombre: 'Open Pack Final', estado: '6A', empresas: { nombre: 'Open Pack' } },
    ])
    getColaboradores.mockResolvedValue([])
    getSprintsDeProyecto.mockResolvedValue([])
    saveProyecto.mockResolvedValue({ ...mockProyecto, porcentaje_avance: 35 })
  })

  test('guardar cambios fuerza el refresco de la lista de proyectos', async () => {
    renderDetalle()

    const botonGuardar = await screen.findByRole('button', { name: /guardar cambios/i })
    fireEvent.click(botonGuardar)

    await waitFor(() => {
      expect(saveProyecto).toHaveBeenCalled()
      expect(refreshProyectos).toHaveBeenCalledWith({ forzar: true })
    })
  })

  test('el prospecto vinculado no aparece duplicado en el select cuando ya es elegible', async () => {
    // getProspectos()/getColaboradores() (cargarDependencias) resuelven ya
    // pobladas la lista base ANTES de que getProyectoById() (cargarProyecto)
    // resuelva y agregue "si falta" el prospecto vinculado: reproduce el
    // orden real (de red) en el que aparecía duplicado.
    getProyectoById.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockProyecto), 10))
    )

    renderDetalle()

    await screen.findByRole('button', { name: /guardar cambios/i })

    const opciones = screen.getAllByText('Open Pack Final (Open Pack)')
    expect(opciones).toHaveLength(1)
  })
})

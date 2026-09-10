import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Sprints from '../Sprints'
import {
  getSprintsActivos, getSprintsPlanificados, getSprintsDeProyecto, crearSprint,
} from '../../services/sprints'
import { getProyectos } from '../../services/proyectos'
import { getMiFichaColaborador } from '../../services/colaboradores'
import { useAuth } from '../../context/AuthContext'

vi.mock('../../services/sprints', () => ({
  getSprintsActivos: vi.fn(),
  getSprintsPlanificados: vi.fn(),
  getSprintsDeProyecto: vi.fn(),
  crearSprint: vi.fn(),
}))
vi.mock('../../services/proyectos', () => ({ getProyectos: vi.fn() }))
vi.mock('../../services/colaboradores', () => ({ getMiFichaColaborador: vi.fn() }))
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

function sprintCon(id, { numero = 1, nombre = 'Sprint 1', proyecto = 'proyecto 2', proyectoId = 'proy-1', prospectoId = 'pr-1', prospecto = 'Amipack', empresaId = 'e-1', empresa = 'Amipack SA' } = {}) {
  return {
    id, numero, nombre, items: [],
    proyecto: {
      id: proyectoId, nombre: proyecto,
      prospecto: { id: prospectoId, nombre: prospecto, empresa: { id: empresaId, nombre: empresa } },
    },
  }
}

const mockSprint = sprintCon('sprint-1')

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
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esDuenio: true, esTeamLead: false })
  })

  test('clic en la celda del proyecto (no en el link) navega al detalle del sprint', async () => {
    renderSprints()
    const celdaProyecto = await screen.findByRole('cell', { name: 'proyecto 2' })
    fireEvent.click(celdaProyecto)
    await waitFor(() => expect(screen.getByText('Detalle del sprint')).toBeInTheDocument())
  })

  test('clic en la celda de avance navega al detalle del sprint', async () => {
    renderSprints()
    const celdaAvance = await screen.findByText('0%')
    fireEvent.click(celdaAvance)
    await waitFor(() => expect(screen.getByText('Detalle del sprint')).toBeInTheDocument())
  })
})

describe('Sprints — planificados y alta directa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSprintsActivos.mockResolvedValue([mockSprint])
    getSprintsPlanificados.mockResolvedValue([])
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esDuenio: true, esTeamLead: false })
  })

  test('los sprints planificados aparecen en su propia sección (no quedan escondidos)', async () => {
    getSprintsPlanificados.mockResolvedValue([sprintCon('sp-plan', { numero: 2, nombre: 'Sin iniciar', proyecto: 'PRUEBA Proyecto', proyectoId: 'proy-9' })])
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
      expect(crearSprint).toHaveBeenCalledWith({ proyecto_id: 'proy-7', numero: 3, creado_por: 'user-1' })
      expect(screen.getByText('Detalle del sprint')).toBeInTheDocument()
    })
  })

  test('el modal "Nuevo Sprint" se monta fuera de .page (portal)', async () => {
    const { container } = renderSprints()
    await screen.findByText(/Sprints activos/)
    fireEvent.click(screen.getByRole('button', { name: /Nuevo Sprint/ }))

    const overlay = document.querySelector('.modal-overlay')
    expect(overlay).not.toBeNull()
    expect(container.querySelector('.page').contains(overlay)).toBe(false)
    expect(overlay.parentElement).toBe(document.body)
  })
})

describe('Sprints — filtros (proyecto / prospecto / empresa)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esDuenio: true, esTeamLead: false })
    getSprintsActivos.mockResolvedValue([
      sprintCon('s1', { proyecto: 'Portal', proyectoId: 'py1', prospecto: 'Amipack', prospectoId: 'pr1', empresa: 'Amipack SA', empresaId: 'e1' }),
      sprintCon('s2', { proyecto: 'Tablero', proyectoId: 'py2', prospecto: 'Norte', prospectoId: 'pr2', empresa: 'El Norte', empresaId: 'e2' }),
    ])
    getSprintsPlanificados.mockResolvedValue([])
  })

  test('elegir un proyecto en el filtro deja solo sus sprints', async () => {
    renderSprints()
    await screen.findByText('Portal')
    expect(screen.getByText('Tablero')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Proyecto/ }))
    fireEvent.click(await screen.findByText('Portal', { selector: '.picker-option' }))

    await waitFor(() => {
      expect(screen.getByRole('cell', { name: 'Portal' })).toBeInTheDocument()
      expect(screen.queryByRole('cell', { name: 'Tablero' })).not.toBeInTheDocument()
    })
    expect(screen.getByText(/Sprints activos \(1\)/)).toBeInTheDocument()
  })

  test('"Limpiar" vuelve a mostrar todo', async () => {
    renderSprints()
    await screen.findByText('Portal')
    fireEvent.click(screen.getByRole('button', { name: /Empresa/ }))
    fireEvent.click(await screen.findByText('El Norte', { selector: '.picker-option' }))
    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Portal' })).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Limpiar/ }))
    await waitFor(() => expect(screen.getByRole('cell', { name: 'Portal' })).toBeInTheDocument())
  })
})

describe('Sprints — permisos por prospecto asignado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSprintsActivos.mockResolvedValue([
      sprintCon('s1', { proyecto: 'Portal', proyectoId: 'py1', prospectoId: 'pr1' }),
      sprintCon('s2', { proyecto: 'Tablero', proyectoId: 'py2', prospectoId: 'pr2' }),
    ])
    getSprintsPlanificados.mockResolvedValue([])
  })

  test('un colaborador ve solo los sprints de los prospectos que tiene asignados', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, esDuenio: false, esTeamLead: false })
    getMiFichaColaborador.mockResolvedValue({ prospectos_asignados: ['pr2'] })

    renderSprints()

    await screen.findByRole('cell', { name: 'Tablero' })
    expect(screen.queryByRole('cell', { name: 'Portal' })).not.toBeInTheDocument()
    expect(getMiFichaColaborador).toHaveBeenCalledWith('u1')
  })

  test('un Dueño ve todos y no consulta su ficha de colaborador', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, esDuenio: true, esTeamLead: false })
    renderSprints()

    await screen.findByRole('cell', { name: 'Portal' })
    expect(screen.getByRole('cell', { name: 'Tablero' })).toBeInTheDocument()
    expect(getMiFichaColaborador).not.toHaveBeenCalled()
  })

  test('un Team Lead ve todos', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, esDuenio: false, esTeamLead: true })
    renderSprints()

    await screen.findByRole('cell', { name: 'Portal' })
    expect(screen.getByRole('cell', { name: 'Tablero' })).toBeInTheDocument()
    expect(getMiFichaColaborador).not.toHaveBeenCalled()
  })
})

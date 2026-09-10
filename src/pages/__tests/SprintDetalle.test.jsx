import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SprintDetalle from '../SprintDetalle'
import {
  getSprintById, crearItem, actualizarItem, agregarAdjunto, guardarOrdenItems,
  crearNotaSprint, eliminarNotaSprint, eliminarSprint,
  crearComentarioItem, eliminarComentarioItem,
} from '../../services/sprints'
import { getMiFichaColaborador, getColaboradoresLista } from '../../services/colaboradores'
import { useAuth } from '../../context/AuthContext'

vi.mock('../../services/sprints', () => ({
  getSprintById: vi.fn(),
  actualizarSprint: vi.fn(),
  cerrarSprint: vi.fn(),
  reabrirSprint: vi.fn(),
  crearItem: vi.fn(),
  actualizarItem: vi.fn(),
  eliminarItem: vi.fn(),
  guardarOrdenItems: vi.fn(),
  agregarAdjunto: vi.fn(),
  eliminarAdjunto: vi.fn(),
  crearNotaSprint: vi.fn(),
  eliminarNotaSprint: vi.fn(),
  eliminarSprint: vi.fn(),
  crearComentarioItem: vi.fn(),
  eliminarComentarioItem: vi.fn(),
}))
vi.mock('../../services/storage', () => ({ uploadFile: vi.fn() }))
vi.mock('../../services/colaboradores', () => ({
  getMiFichaColaborador: vi.fn(),
  getColaboradoresLista: vi.fn(),
}))
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

const mockSprint = {
  id: 'sprint-1',
  numero: 1,
  nombre: 'Carrito y stock',
  estado: 'activo',
  objetivo: '',
  notas: '',
  proyecto: { id: 'proy-1', nombre: 'Proyecto X', prospecto: { id: 'pr-1', nombre: 'Amipack', empresa: { id: 'e-1', nombre: 'Amipack SA' } } },
  items: [
    { id: 'item-1', sprint_id: 'sprint-1', orden: 0, titulo: 'Punto existente', estado: 'pendiente', adjuntos: [], comentarios: [] },
  ],
  notas_items: [
    {
      id: 'nota-1', sprint_id: 'sprint-1', nota: 'Arrancamos con el módulo de stock.',
      creado_por: 'otro-user', fecha: '2026-08-29T10:00:00.000Z',
      autor: { nombre: 'Renata', apellido: 'Morano' },
    },
  ],
}

function renderSprint() {
  return render(
    <MemoryRouter initialEntries={['/sprints/sprint-1']}>
      <Routes>
        <Route path="/sprints/:id" element={<SprintDetalle />} />
        <Route path="/sprints" element={<div>Listado de sprints</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getSprintById.mockResolvedValue(mockSprint)
  getMiFichaColaborador.mockResolvedValue({ prospectos_asignados: ['pr-1'] })
  getColaboradoresLista.mockResolvedValue([
    { id: 'col-1', nombre: 'Renata', apellido: 'Morano', activo: true },
    { id: 'col-2', nombre: 'Mateo', apellido: 'Courault', activo: true },
  ])
  useAuth.mockReturnValue({ user: { id: 'user-1' }, esDuenio: true, esTeamLead: false })
})

describe('SprintDetalle — puntos', () => {
  test('escribir en el alta rápida + Enter agrega el punto y limpia el campo', async () => {
    crearItem.mockResolvedValue({ id: 'item-2', sprint_id: 'sprint-1', orden: 1, titulo: 'Probar el flujo de pago', estado: 'pendiente', adjuntos: [], comentarios: [] })
    renderSprint()

    const input = await screen.findByPlaceholderText('Escribí un punto…')
    fireEvent.change(input, { target: { value: 'Probar el flujo de pago' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(crearItem).toHaveBeenCalledWith({ sprint_id: 'sprint-1', orden: 1, titulo: 'Probar el flujo de pago' })
      expect(screen.getByText('Probar el flujo de pago')).toBeInTheDocument()
    })
    expect(input.value).toBe('')
  })

  test('un título en blanco no agrega nada', async () => {
    renderSprint()
    const input = await screen.findByPlaceholderText('Escribí un punto…')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('Punto existente')).toBeInTheDocument())
    expect(crearItem).not.toHaveBeenCalled()
  })

  test('el botón "Agregar" suma el punto sin depender de Enter', async () => {
    crearItem.mockResolvedValue({ id: 'item-3', sprint_id: 'sprint-1', orden: 1, titulo: 'Desde el botón', estado: 'pendiente', adjuntos: [], comentarios: [] })
    renderSprint()

    const input = await screen.findByPlaceholderText('Escribí un punto…')
    fireEvent.change(input, { target: { value: 'Desde el botón' } })
    fireEvent.click(screen.getByRole('button', { name: /^Agregar$/i }))

    await waitFor(() => {
      expect(crearItem).toHaveBeenCalledWith({ sprint_id: 'sprint-1', orden: 1, titulo: 'Desde el botón' })
      expect(screen.getByText('Desde el botón')).toBeInTheDocument()
    })
  })

  test('click en el colorcito avanza al siguiente estado del semáforo', async () => {
    actualizarItem.mockResolvedValue({ ...mockSprint.items[0], estado: 'en_progreso' })
    renderSprint()

    const dot = await screen.findByTitle('Pendiente — click para cambiar')
    fireEvent.click(dot)

    await waitFor(() => {
      expect(actualizarItem).toHaveBeenCalledWith('item-1', { estado: 'en_progreso' }, 'user-1')
    })
  })

  test('adjuntar un link: click, pegar URL, Enter -> se agrega como chip', async () => {
    agregarAdjunto.mockResolvedValue({ id: 'adj-1', item_id: 'item-1', url: 'https://github.com/apsol/repo', nombre: '' })
    renderSprint()

    fireEvent.click(await screen.findByTitle('Adjuntar link'))
    const linkInput = await screen.findByPlaceholderText('Pegá el link y apretá Enter…')
    fireEvent.change(linkInput, { target: { value: 'https://github.com/apsol/repo' } })
    fireEvent.keyDown(linkInput, { key: 'Enter' })

    await waitFor(() => {
      expect(agregarAdjunto).toHaveBeenCalledWith({ item_id: 'item-1', url: 'https://github.com/apsol/repo', subido_por: 'user-1' })
      expect(screen.getByText('github.com')).toBeInTheDocument()
    })
  })
})

describe('SprintDetalle — formato del texto del punto', () => {
  test('el punto se ve con **negrita** renderizada y viñetas', async () => {
    getSprintById.mockResolvedValue({
      ...mockSprint,
      items: [{ id: 'i1', sprint_id: 'sprint-1', orden: 0, estado: 'pendiente', adjuntos: [], comentarios: [], titulo: 'hacer **esto**\n• y lo otro' }],
    })
    renderSprint()

    const negrita = await screen.findByText('esto')
    expect(negrita.tagName).toBe('STRONG')
    expect(screen.getByText('y lo otro')).toBeInTheDocument()
  })

  test('al escribir "- " en el editor se autoconvierte a viñeta', async () => {
    renderSprint()
    // abrir el editor tocando el texto
    fireEvent.click(await screen.findByText('Punto existente'))
    const ta = await screen.findByDisplayValue('Punto existente')
    fireEvent.change(ta, { target: { value: 'Punto existente\n- sub' } })

    await waitFor(() => {
      expect(actualizarItem).not.toHaveBeenCalled() // todavía no hizo blur
    })
    expect(ta.value).toBe('Punto existente\n• sub')
  })
})

describe('SprintDetalle — responsable y comentarios por punto', () => {
  test('asignar un responsable persiste responsable_id', async () => {
    actualizarItem.mockResolvedValue({ ...mockSprint.items[0], responsable_id: 'col-2' })
    renderSprint()
    await screen.findByText('Punto existente')

    fireEvent.click(screen.getByTitle('Sin responsable'))
    fireEvent.click(await screen.findByText('Mateo Courault'))

    await waitFor(() => {
      expect(actualizarItem).toHaveBeenCalledWith('item-1', { responsable_id: 'col-2' }, 'user-1')
    })
  })

  test('agregar un comentario lo manda con autor y lo muestra', async () => {
    crearComentarioItem.mockResolvedValue({
      id: 'c1', item_id: 'item-1', texto: 'Ojo con el stock', creado_por: 'user-1',
      fecha: '2026-09-10T10:00:00.000Z', autor: { nombre: 'Mateo', apellido: 'Courault' },
    })
    renderSprint()
    await screen.findByText('Punto existente')

    fireEvent.click(screen.getByTitle('Comentarios'))
    const input = await screen.findByPlaceholderText('Escribí un comentario…')
    fireEvent.change(input, { target: { value: 'Ojo con el stock' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }))

    await waitFor(() => {
      expect(crearComentarioItem).toHaveBeenCalledWith({ item_id: 'item-1', creado_por: 'user-1', texto: 'Ojo con el stock' })
      expect(screen.getByText('Ojo con el stock')).toBeInTheDocument()
    })
  })

  test('borrar un comentario propio', async () => {
    getSprintById.mockResolvedValue({
      ...mockSprint,
      items: [{
        ...mockSprint.items[0],
        comentarios: [{ id: 'c9', item_id: 'item-1', texto: 'mío', creado_por: 'user-1', fecha: '2026-09-10T09:00:00.000Z', autor: { nombre: 'Yo', apellido: '' } }],
      }],
    })
    eliminarComentarioItem.mockResolvedValue()
    renderSprint()

    fireEvent.click(await screen.findByTitle(/comentario/i))
    fireEvent.click(await screen.findByTitle('Borrar'))

    await waitFor(() => {
      expect(eliminarComentarioItem).toHaveBeenCalledWith('c9')
      expect(screen.queryByText('mío')).not.toBeInTheDocument()
    })
  })
})

describe('SprintDetalle — reordenar con flechitas (drag: ver E2E)', () => {
  test('la flecha ↓ del primer punto persiste el nuevo orden', async () => {
    getSprintById.mockResolvedValue({
      ...mockSprint,
      items: [
        { id: 'a', sprint_id: 'sprint-1', orden: 0, titulo: 'Uno', estado: 'pendiente', adjuntos: [], comentarios: [] },
        { id: 'b', sprint_id: 'sprint-1', orden: 1, titulo: 'Dos', estado: 'pendiente', adjuntos: [], comentarios: [] },
      ],
    })
    guardarOrdenItems.mockResolvedValue()
    renderSprint()

    await screen.findByText('Uno')
    fireEvent.click(screen.getAllByTitle('Bajar')[0])

    await waitFor(() => {
      expect(guardarOrdenItems).toHaveBeenCalledWith([{ id: 'b', orden: 0 }, { id: 'a', orden: 1 }])
    })
  })
})

describe('SprintDetalle — notas', () => {
  test('cada nota muestra quién la escribió, y una nota ajena no se puede borrar', async () => {
    renderSprint()
    expect(await screen.findByText('Arrancamos con el módulo de stock.')).toBeInTheDocument()
    expect(screen.getByText('Renata Morano')).toBeInTheDocument()
    expect(screen.queryByTitle('Eliminar nota')).not.toBeInTheDocument()
  })

  test('agregar una nota la manda con autor y la muestra primera en la lista', async () => {
    crearNotaSprint.mockResolvedValue({
      id: 'nota-2', sprint_id: 'sprint-1', nota: 'Quedó pendiente el checkout.',
      creado_por: 'user-1', fecha: '2026-08-30T12:00:00.000Z',
      autor: { nombre: 'Mateo', apellido: 'Courault' },
    })
    renderSprint()

    const textarea = await screen.findByPlaceholderText('Escribí una nota…')
    fireEvent.change(textarea, { target: { value: 'Quedó pendiente el checkout.' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar nota/i }))

    await waitFor(() => {
      expect(crearNotaSprint).toHaveBeenCalledWith({ sprint_id: 'sprint-1', creado_por: 'user-1', nota: 'Quedó pendiente el checkout.' })
      expect(screen.getByText('Quedó pendiente el checkout.')).toBeInTheDocument()
    })
    expect(textarea.value).toBe('')
    expect(screen.getAllByTestId('nota-item')[0]).toHaveTextContent('Quedó pendiente el checkout.')
  })

  test('borrar una nota propia', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    getSprintById.mockResolvedValue({
      ...mockSprint,
      notas_items: [
        { id: 'nota-propia', sprint_id: 'sprint-1', nota: 'Nota mía', creado_por: 'user-1', fecha: '2026-08-30T09:00:00.000Z', autor: { nombre: 'Mateo', apellido: 'Courault' } },
      ],
    })
    renderSprint()

    fireEvent.click(await screen.findByTitle('Eliminar nota'))
    await waitFor(() => {
      expect(eliminarNotaSprint).toHaveBeenCalledWith('nota-propia')
      expect(screen.queryByText('Nota mía')).not.toBeInTheDocument()
    })
  })
})

describe('SprintDetalle — eliminar sprint', () => {
  const sprintVacio = { ...mockSprint, items: [], notas_items: [] }

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  test('un Dueño puede eliminar un sprint vacío', async () => {
    getSprintById.mockResolvedValue(sprintVacio)
    useAuth.mockReturnValue({ user: { id: 'otro' }, esDuenio: true, esTeamLead: false })
    eliminarSprint.mockResolvedValue()
    renderSprint()

    fireEvent.click(await screen.findByRole('button', { name: /^Eliminar$/i }))
    await waitFor(() => expect(eliminarSprint).toHaveBeenCalledWith('sprint-1'))
  })

  test('el autor del sprint también puede eliminarlo si está vacío', async () => {
    getSprintById.mockResolvedValue({ ...sprintVacio, creado_por: 'user-1' })
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esDuenio: false, esTeamLead: false })
    renderSprint()

    expect(await screen.findByRole('button', { name: /^Eliminar$/i })).toBeInTheDocument()
  })

  test('no aparece el botón si el sprint tiene puntos', async () => {
    getSprintById.mockResolvedValue({ ...mockSprint, notas_items: [] })
    renderSprint()

    await screen.findByText('Punto existente')
    expect(screen.queryByRole('button', { name: /^Eliminar$/i })).not.toBeInTheDocument()
  })

  test('no aparece el botón para quien no es Dueño ni autor', async () => {
    getSprintById.mockResolvedValue({ ...sprintVacio, creado_por: 'otro' })
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esDuenio: false, esTeamLead: false })
    renderSprint()

    await screen.findByRole('heading', { name: /Carrito y stock/ })
    expect(screen.queryByRole('button', { name: /^Eliminar$/i })).not.toBeInTheDocument()
  })
})

describe('SprintDetalle — acceso por prospecto asignado', () => {
  test('un colaborador sin el prospecto asignado ve "no tenés acceso"', async () => {
    useAuth.mockReturnValue({ user: { id: 'u9' }, esDuenio: false, esTeamLead: false })
    getMiFichaColaborador.mockResolvedValue({ prospectos_asignados: ['otro-prospecto'] })
    renderSprint()

    expect(await screen.findByText(/No tenés acceso a este sprint/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Carrito y stock/ })).not.toBeInTheDocument()
  })

  test('un colaborador con el prospecto asignado sí entra', async () => {
    useAuth.mockReturnValue({ user: { id: 'u9' }, esDuenio: false, esTeamLead: false })
    getMiFichaColaborador.mockResolvedValue({ prospectos_asignados: ['pr-1'] })
    renderSprint()

    expect(await screen.findByRole('heading', { name: /Carrito y stock/ })).toBeInTheDocument()
  })
})

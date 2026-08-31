import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SprintDetalle from '../SprintDetalle'
import {
  getSprintById, crearItem, actualizarItem, agregarAdjunto,
  crearNotaSprint, eliminarNotaSprint,
} from '../../services/sprints'
import { useAuth } from '../../context/AuthContext'

// ──────────────────────────────────────────────────────────────
// Pedido real: agregar un punto era "muy tosco" (botón + card entera
// por punto). Ahora es: escribir + Enter agrega, click en el colorcito
// cicla el estado, y "adjuntar" (imagen o link) sin abrir ningún form.
//
// Además, "Notas del sprint" era un solo textarea sin autor ni fecha.
// Pasa a ser una lista: cada nota muestra quién la escribió y cuándo.
// ──────────────────────────────────────────────────────────────

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
}))

vi.mock('../../services/storage', () => ({ uploadFile: vi.fn() }))

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

const mockSprint = {
  id: 'sprint-1',
  numero: 1,
  nombre: 'Carrito y stock',
  estado: 'activo',
  objetivo: '',
  notas: '',
  proyecto: { id: 'proy-1', nombre: 'Proyecto X' },
  items: [
    { id: 'item-1', sprint_id: 'sprint-1', orden: 0, titulo: 'Punto existente', estado: 'pendiente', adjuntos: [] },
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
      </Routes>
    </MemoryRouter>
  )
}

describe('SprintDetalle — puntos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSprintById.mockResolvedValue(mockSprint)
    useAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  test('escribir en el alta rápida + Enter agrega el punto y limpia el campo', async () => {
    const nuevoItem = { id: 'item-2', sprint_id: 'sprint-1', orden: 1, titulo: 'Probar el flujo de pago', estado: 'pendiente', adjuntos: [] }
    crearItem.mockResolvedValue(nuevoItem)

    renderSprint()

    const input = await screen.findByPlaceholderText('Escribí un punto y apretá Enter…')
    fireEvent.change(input, { target: { value: 'Probar el flujo de pago' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(crearItem).toHaveBeenCalledWith({ sprint_id: 'sprint-1', orden: 1, titulo: 'Probar el flujo de pago' })
      expect(screen.getByDisplayValue('Probar el flujo de pago')).toBeInTheDocument()
    })
    expect(input.value).toBe('')
  })

  test('un título en blanco no agrega nada', async () => {
    renderSprint()
    const input = await screen.findByPlaceholderText('Escribí un punto y apretá Enter…')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByDisplayValue('Punto existente')).toBeInTheDocument())
    expect(crearItem).not.toHaveBeenCalled()
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

    const btnLink = await screen.findByTitle('Adjuntar link')
    fireEvent.click(btnLink)

    const linkInput = await screen.findByPlaceholderText('Pegá el link y apretá Enter…')
    fireEvent.change(linkInput, { target: { value: 'https://github.com/apsol/repo' } })
    fireEvent.keyDown(linkInput, { key: 'Enter' })

    await waitFor(() => {
      expect(agregarAdjunto).toHaveBeenCalledWith({ item_id: 'item-1', url: 'https://github.com/apsol/repo', subido_por: 'user-1' })
      expect(screen.getByText('github.com')).toBeInTheDocument()
    })
  })
})

describe('SprintDetalle — notas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSprintById.mockResolvedValue(mockSprint)
    useAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

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

    const notas = screen.getAllByTestId('nota-item')
    expect(notas[0]).toHaveTextContent('Quedó pendiente el checkout.')
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

    const btnBorrar = await screen.findByTitle('Eliminar nota')
    fireEvent.click(btnBorrar)

    await waitFor(() => {
      expect(eliminarNotaSprint).toHaveBeenCalledWith('nota-propia')
      expect(screen.queryByText('Nota mía')).not.toBeInTheDocument()
    })
  })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TicketDetalle from '../TicketDetalle'
import { getTicketById, saveTicket, deleteTicket } from '../../services/operaciones'
import { getProyectos } from '../../services/proyectos'
import { getColaboradoresLista } from '../../services/colaboradores'

vi.mock('../../services/operaciones', () => ({
  getTicketById: vi.fn(),
  saveTicket: vi.fn(),
  deleteTicket: vi.fn(),
}))
vi.mock('../../services/proyectos', () => ({ getProyectos: vi.fn() }))
vi.mock('../../services/colaboradores', () => ({ getColaboradoresLista: vi.fn() }))

const colaboradores = [
  { id: 'c-adrian', usuario_id: 'u-1', nombre: 'Adrian', apellido: 'Patriarca', activo: true },
  { id: 'c-renata', usuario_id: 'u-2', nombre: 'Renata', apellido: 'Morano', activo: true },
  { id: 'c-mant', usuario_id: null, nombre: 'Mantenimiento', apellido: '', activo: true },
  { id: 'c-ex', usuario_id: 'u-9', nombre: 'Felipe', apellido: 'Duarte', activo: false },
]

const proyectos = [
  { id: 'p1', nombre: 'Proyecto Uno', estado: 'Activo', lider_colaborador_id: 'c-renata', prospectos: { empresas: { nombre: 'Uno SA' } } },
  { id: 'p2', nombre: 'Proyecto Dos', estado: 'Activo', lider_colaborador_id: 'c-mant', prospectos: { empresas: { nombre: 'Dos SA' } } },
  { id: 'p3', nombre: 'Proyecto Tres', estado: 'Activo', lider_colaborador_id: null, prospectos: { empresas: { nombre: 'Tres SA' } } },
]

function renderEn(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetalle />} />
        <Route path="/tickets" element={<div>LISTA</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const selectDe = (etiqueta) => screen.getByText(etiqueta).closest('.field').querySelector('select')
const opciones = (select) => [...select.options].map(o => o.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  getProyectos.mockResolvedValue(proyectos)
  getColaboradoresLista.mockResolvedValue(colaboradores)
  saveTicket.mockImplementation(async t => ({ ...t, id: t.id || 'nuevo-id' }))
})

describe('TicketDetalle — responsable', () => {
  test('el desplegable solo ofrece colaboradores activos y con usuario (no "Mantenimiento" ni ex-colaboradores)', async () => {
    renderEn('/tickets/nuevo')
    await screen.findByText('Nuevo Ticket', { selector: 'h1' })
    await waitFor(() => expect(opciones(selectDe('Responsable'))).toContain('Adrian Patriarca'))

    const ops = opciones(selectDe('Responsable'))
    expect(ops).toContain('Renata Morano')
    expect(ops).not.toContain('Mantenimiento')
    expect(ops).not.toContain('Felipe Duarte')
  })

  test('al elegir un proyecto en un ticket nuevo, el responsable pasa a ser el líder del proyecto', async () => {
    renderEn('/tickets/nuevo')
    await waitFor(() => expect(opciones(selectDe('Proyecto Vinculado')).length).toBeGreaterThan(1))

    fireEvent.change(selectDe('Proyecto Vinculado'), { target: { value: 'p1' } })

    expect(selectDe('Responsable').value).toBe('c-renata')
  })

  test('si el líder no es asignable (sin usuario) el responsable queda sin asignar', async () => {
    renderEn('/tickets/nuevo')
    await waitFor(() => expect(opciones(selectDe('Proyecto Vinculado')).length).toBeGreaterThan(1))

    fireEvent.change(selectDe('Proyecto Vinculado'), { target: { value: 'p2' } })

    expect(selectDe('Responsable').value).toBe('')
  })

  test('cambiar de proyecto actualiza el líder sugerido mientras nadie eligió a mano', async () => {
    renderEn('/tickets/nuevo')
    await waitFor(() => expect(opciones(selectDe('Proyecto Vinculado')).length).toBeGreaterThan(1))

    fireEvent.change(selectDe('Proyecto Vinculado'), { target: { value: 'p1' } })
    expect(selectDe('Responsable').value).toBe('c-renata')
    fireEvent.change(selectDe('Proyecto Vinculado'), { target: { value: 'p3' } })
    expect(selectDe('Responsable').value).toBe('')
  })

  test('si la persona ya eligió responsable a mano, cambiar de proyecto no se lo pisa', async () => {
    renderEn('/tickets/nuevo')
    await waitFor(() => expect(opciones(selectDe('Responsable'))).toContain('Adrian Patriarca'))

    fireEvent.change(selectDe('Responsable'), { target: { value: 'c-adrian' } })
    fireEvent.change(selectDe('Proyecto Vinculado'), { target: { value: 'p1' } })

    expect(selectDe('Responsable').value).toBe('c-adrian')
  })

  test('un ticket existente conserva su responsable aunque ya no sea asignable, y no se cambia al abrirlo', async () => {
    getTicketById.mockResolvedValue({
      id: 't1', titulo: 'Viejo', descripcion: '', proyecto_id: 'p1', estado: 'Abierto', prioridad: 'Media',
      tipo_ticket: 'Correctivo', responsable_id: 'c-mant', fecha_resolucion: null,
      proyectos: { id: 'p1', nombre: 'Proyecto Uno' },
    })
    renderEn('/tickets/t1')
    await screen.findByDisplayValue('Viejo')

    await waitFor(() => expect(opciones(selectDe('Responsable')).some(o => o.startsWith('Mantenimiento'))).toBe(true))
    expect(selectDe('Responsable').value).toBe('c-mant')
  })
})

describe('TicketDetalle — pantalla', () => {
  const ticketBase = {
    id: 't1', titulo: 'Falla X', descripcion: '', proyecto_id: 'p1', estado: 'Abierto', prioridad: 'Media',
    tipo_ticket: 'Correctivo', responsable_id: 'c-adrian', fecha_resolucion: null,
    proyectos: { id: 'p1', nombre: 'Proyecto Uno' },
  }

  test('el proyecto del ticket aparece una sola vez en el desplegable', async () => {
    getTicketById.mockResolvedValue(ticketBase)
    renderEn('/tickets/t1')
    await screen.findByDisplayValue('Falla X')
    await waitFor(() => expect(opciones(selectDe('Proyecto Vinculado')).length).toBeGreaterThan(1))

    const repetidas = opciones(selectDe('Proyecto Vinculado')).filter(o => o.startsWith('Proyecto Uno'))
    expect(repetidas).toHaveLength(1)
  })

  test('el proyecto de un ticket viejo (que no está entre los activos) se agrega una vez', async () => {
    getProyectos.mockResolvedValue([proyectos[1]])
    getTicketById.mockResolvedValue(ticketBase)
    renderEn('/tickets/t1')
    await screen.findByDisplayValue('Falla X')
    await waitFor(() => expect(opciones(selectDe('Proyecto Vinculado')).some(o => o.startsWith('Proyecto Uno'))).toBe(true))

    expect(opciones(selectDe('Proyecto Vinculado')).filter(o => o.startsWith('Proyecto Uno'))).toHaveLength(1)
  })

  test('el cartel de estado de arriba no cambia hasta guardar', async () => {
    getTicketById.mockResolvedValue(ticketBase)
    renderEn('/tickets/t1')
    await screen.findByDisplayValue('Falla X')
    const cartel = () => document.querySelector('.page-header .badge')

    expect(cartel().textContent).toBe('Abierto')
    fireEvent.change(selectDe('Estado'), { target: { value: 'Resuelto' } })
    expect(cartel().textContent).toBe('Abierto')

    fireEvent.click(screen.getByRole('button', { name: /Guardar Ticket/ }))
    await waitFor(() => expect(cartel().textContent).toBe('Resuelto'))
  })

  test('al guardar un ticket existente avisa "Ticket guardado"', async () => {
    getTicketById.mockResolvedValue(ticketBase)
    renderEn('/tickets/t1')
    await screen.findByDisplayValue('Falla X')

    fireEvent.click(screen.getByRole('button', { name: /Guardar Ticket/ }))

    expect(await screen.findByText('Ticket guardado')).toBeInTheDocument()
  })

  test('el aviso de guardado desaparece al volver a editar', async () => {
    getTicketById.mockResolvedValue(ticketBase)
    renderEn('/tickets/t1')
    const titulo = await screen.findByDisplayValue('Falla X')

    fireEvent.click(screen.getByRole('button', { name: /Guardar Ticket/ }))
    await screen.findByText('Ticket guardado')
    fireEvent.change(titulo, { target: { value: 'Falla Y' } })

    expect(screen.queryByText('Ticket guardado')).not.toBeInTheDocument()
  })

  test('un ticket nuevo se guarda con el responsable propuesto y navega al detalle avisando que se creó', async () => {
    getTicketById.mockResolvedValue({ ...ticketBase, id: 'nuevo-id', titulo: 'Nuevo' })
    renderEn('/tickets/nuevo')
    await waitFor(() => expect(opciones(selectDe('Proyecto Vinculado')).length).toBeGreaterThan(1))

    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Nuevo' } })
    fireEvent.change(selectDe('Proyecto Vinculado'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar Ticket/ }))

    await waitFor(() => expect(saveTicket).toHaveBeenCalled())
    expect(saveTicket.mock.calls[0][0]).toMatchObject({ proyecto_id: 'p1', responsable_id: 'c-renata' })
    expect(await screen.findByText('Ticket creado')).toBeInTheDocument()
  })
})

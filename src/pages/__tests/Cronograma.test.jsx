import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import Cronograma from '../Cronograma'
import { useData } from '../../context/DataContext'
import * as cronogramaService from '../../services/cronograma'

// --- Mocks de módulos externos ---
vi.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}))
vi.mock('moment/dist/locale/es', () => ({}))

// Mock del calendario: renderiza los eventos como divs y expone botones para simular clicks
vi.mock('react-big-calendar', () => ({
  Calendar: ({ events, onSelectSlot, onSelectEvent }) => (
    <div data-testid="mock-calendar">
      {events.map(evt => (
        <div
          key={evt.id}
          data-testid={`event-${evt.id}`}
          onClick={() => onSelectEvent(evt)}
        >
          {evt.title}
        </div>
      ))}
      <button
        data-testid="select-slot-btn"
        onClick={() => onSelectSlot({
          start: new Date('2026-08-25T09:00:00'),
          end: new Date('2026-08-25T10:00:00')
        })}
      >
        Seleccionar slot vacío
      </button>
    </div>
  ),
  momentLocalizer: () => ({}),
  Views: { WEEK: 'week', DAY: 'day', MONTH: 'month' }
}))

vi.mock('../../context/DataContext', () => ({
  useData: vi.fn()
}))

vi.mock('../../services/cronograma', () => ({
  saveActividad: vi.fn(),
  deleteActividad: vi.fn()
}))

// --- Datos de prueba ---
const ACTIVIDADES_MOCK = [
  {
    id: '1',
    prospecto_nombre: 'Escobar',
    descripcion: 'Reunión de seguimiento',
    inicio: '2026-08-20T09:00:00',
    fin: '2026-08-20T10:00:00',
    responsable_id: 'col-1',
    responsable_nombre: 'Ana López',
    reunion_cliente: false,
    link_reunion: '',
    comentarios_reunion: '',
    multiplicador: 1
  },
  {
    id: '2',
    prospecto_nombre: 'Consultora',
    descripcion: 'Entrega de informe mensual',
    inicio: '2026-08-21T14:00:00',
    fin: '2026-08-21T16:00:00',
    responsable_id: 'col-2',
    responsable_nombre: 'Carlos Gómez',
    reunion_cliente: true,
    link_reunion: 'https://teams.microsoft.com/meet/123',
    comentarios_reunion: 'Revisión del informe',
    multiplicador: 1
  }
]

const PROSPECTOS_MOCK = [
  { id: 'pros-1', nombre: 'Escobar', estado: '6A - En producción' },
  { id: 'pros-2', nombre: 'Consultora', estado: '6A - En producción' },
  { id: 'pros-3', nombre: 'Norte 2025', estado: '4 - Propuesta enviada' }
]

const COLABORADORES_MOCK = [
  { id: 'col-1', usuarios: { nombre: 'Ana', apellido: 'López' } },
  { id: 'col-2', usuarios: { nombre: 'Carlos', apellido: 'Gómez' } }
]

function mockUseData(overrides = {}) {
  useData.mockReturnValue({
    actividades: ACTIVIDADES_MOCK,
    loadingActividades: false,
    refreshActividades: vi.fn().mockResolvedValue(),
    prospectos: PROSPECTOS_MOCK,
    loadingProspectos: false,
    refreshProspectos: vi.fn().mockResolvedValue(),
    colaboradores: COLABORADORES_MOCK,
    loadingColaboradores: false,
    refreshColaboradores: vi.fn().mockResolvedValue(),
    ...overrides
  })
}

describe('Cronograma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseData()
  })

  // ─── Tests de filtros ───────────────────────────────────────────────────────

  test('sin filtros activos, muestra todos los eventos', () => {
    render(<Cronograma />)
    expect(screen.getByTestId('event-1')).toBeInTheDocument()
    expect(screen.getByTestId('event-2')).toBeInTheDocument()
  })

  test('filtro de fecha "Hasta" oculta eventos que caen después de la fecha indicada', () => {
    render(<Cronograma />)

    const inputHasta = screen.getByLabelText('Hasta')
    // Ponemos la fecha hasta el 20 de agosto → el evento del 21 debe desaparecer
    fireEvent.change(inputHasta, { target: { value: '2026-08-20' } })

    expect(screen.getByTestId('event-1')).toBeInTheDocument()
    expect(screen.queryByTestId('event-2')).not.toBeInTheDocument()
  })

  test('filtro de fecha "Desde" oculta eventos anteriores a la fecha indicada', () => {
    render(<Cronograma />)

    const inputDesde = screen.getByLabelText('Desde')
    // Ponemos la fecha desde el 21 de agosto → el evento del 20 debe desaparecer
    fireEvent.change(inputDesde, { target: { value: '2026-08-21' } })

    expect(screen.queryByTestId('event-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('event-2')).toBeInTheDocument()
  })

  // ─── Tests de buscador ──────────────────────────────────────────────────────

  test('el buscador filtra eventos por nombre del prospecto', () => {
    render(<Cronograma />)

    const buscador = screen.getByPlaceholderText('Buscar Cronograma...')
    fireEvent.change(buscador, { target: { value: 'Escobar' } })

    expect(screen.getByTestId('event-1')).toBeInTheDocument()
    expect(screen.queryByTestId('event-2')).not.toBeInTheDocument()
  })

  test('el buscador filtra eventos por descripción', () => {
    render(<Cronograma />)

    const buscador = screen.getByPlaceholderText('Buscar Cronograma...')
    fireEvent.change(buscador, { target: { value: 'informe' } })

    expect(screen.queryByTestId('event-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('event-2')).toBeInTheDocument()
  })

  test('borrar el texto del buscador vuelve a mostrar todos los eventos', () => {
    render(<Cronograma />)

    const buscador = screen.getByPlaceholderText('Buscar Cronograma...')
    fireEvent.change(buscador, { target: { value: 'algo que no existe' } })
    expect(screen.queryByTestId('event-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('event-2')).not.toBeInTheDocument()

    fireEvent.change(buscador, { target: { value: '' } })
    expect(screen.getByTestId('event-1')).toBeInTheDocument()
    expect(screen.getByTestId('event-2')).toBeInTheDocument()
  })

  // ─── Tests del modal ────────────────────────────────────────────────────────

  test('el modal se abre con formulario vacío al hacer clic en el botón "+"', () => {
    render(<Cronograma />)

    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    expect(screen.getByPlaceholderText('Escribí para buscar...')).toHaveValue('')
    expect(screen.getByPlaceholderText('¿Qué se va a realizar?')).toHaveValue('')
  })

  test('el modal se rellena con los datos del evento al hacer clic en uno existente', async () => {
    render(<Cronograma />)

    fireEvent.click(screen.getByTestId('event-1'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Escobar')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Reunión de seguimiento')).toBeInTheDocument()
    })
  })

  test('abrir modal de edición y luego abrir nuevo no mezcla los datos', async () => {
    render(<Cronograma />)

    // Abrir un evento existente
    fireEvent.click(screen.getByTestId('event-1'))
    await waitFor(() => expect(screen.getByDisplayValue('Escobar')).toBeInTheDocument())

    // Cerrar con Cancelar
    fireEvent.click(screen.getByText('Cancelar'))

    // Abrir nuevo con el botón +
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    // El campo debe estar vacío
    expect(screen.getByPlaceholderText('Escribí para buscar...')).toHaveValue('')
  })

  test('seleccionar un slot vacío del calendario abre el modal con las fechas del slot', async () => {
    render(<Cronograma />)

    fireEvent.click(screen.getByTestId('select-slot-btn'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Actividad')).toBeInTheDocument()
    })
    // El campo de descripción debe estar vacío (es una nueva actividad)
    expect(screen.getByPlaceholderText('¿Qué se va a realizar?')).toHaveValue('')
  })

  // ─── Tests de eliminación ───────────────────────────────────────────────────

  test('el botón "Eliminar" NO aparece en el modal de nueva actividad', () => {
    render(<Cronograma />)

    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
  })

  test('el botón "Eliminar" SÍ aparece en el modal de edición de actividad existente', async () => {
    render(<Cronograma />)

    fireEvent.click(screen.getByTestId('event-1'))

    await waitFor(() => {
      expect(screen.getByText('Eliminar')).toBeInTheDocument()
    })
  })

  test('confirmar la eliminación llama a deleteActividad con el ID correcto', async () => {
    cronogramaService.deleteActividad.mockResolvedValue(true)
    window.confirm = vi.fn().mockReturnValue(true)

    render(<Cronograma />)
    fireEvent.click(screen.getByTestId('event-1'))
    await waitFor(() => expect(screen.getByText('Eliminar')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Eliminar'))

    await waitFor(() => {
      expect(cronogramaService.deleteActividad).toHaveBeenCalledWith('1')
    })
  })

  test('cancelar la confirmación de eliminar NO llama a deleteActividad', async () => {
    window.confirm = vi.fn().mockReturnValue(false)

    render(<Cronograma />)
    fireEvent.click(screen.getByTestId('event-1'))
    await waitFor(() => expect(screen.getByText('Eliminar')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Eliminar'))

    expect(cronogramaService.deleteActividad).not.toHaveBeenCalled()
  })

  // ─── Tests del sistema de notificaciones (sin alert) ────────────────────────

  test('un error al guardar muestra un toast de error en lugar de usar alert()', async () => {
    cronogramaService.saveActividad.mockRejectedValue(new Error('DB error'))
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    fireEvent.change(screen.getByPlaceholderText('Escribí para buscar...'), { target: { value: 'Escobar' } })
    // Hay dos combobox en el modal: el input con datalist y el select. Tomamos el select (índice 1).
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'col-1' } })
    fireEvent.click(screen.getByText('Confirmar y Agendar'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar')
    })

    expect(alertMock).not.toHaveBeenCalled()
    alertMock.mockRestore()
  })

  test('un error al eliminar muestra un toast de error en lugar de usar alert()', async () => {
    cronogramaService.deleteActividad.mockRejectedValue(new Error('DB error'))
    window.confirm = vi.fn().mockReturnValue(true)
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<Cronograma />)
    fireEvent.click(screen.getByTestId('event-1'))
    await waitFor(() => expect(screen.getByText('Eliminar')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Eliminar'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo eliminar')
    })

    expect(alertMock).not.toHaveBeenCalled()
    alertMock.mockRestore()
  })

  // ─── Tests del panel de cumplimiento (sin Math.random) ─────────────────────

  test('el panel de cumplimiento muestra valores estables entre renders consecutivos', () => {
    const { unmount, container: c1 } = render(<Cronograma />)
    const texto1 = c1.querySelector('.compliance-list')?.textContent ?? ''
    unmount()

    const { container: c2 } = render(<Cronograma />)
    const texto2 = c2.querySelector('.compliance-list')?.textContent ?? ''

    expect(texto1).toBe(texto2)
  })

  // ─── Tests de campos de reunión ─────────────────────────────────────────────

  test('el campo de link de reunión NO se muestra hasta marcar "¿Es reunión con el cliente?"', () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    expect(screen.queryByPlaceholderText(/teams.microsoft.com/i)).not.toBeInTheDocument()
  })

  test('el campo de link de reunión SE muestra al marcar "¿Es reunión con el cliente?"', async () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    fireEvent.click(screen.getByText('¿Es reunión con el cliente?'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/teams.microsoft.com/i)).toBeInTheDocument()
    })
  })

  test('los comentarios de la reunión se muestran solo si "¿Es reunión con el cliente?" está activo', async () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    expect(screen.queryByPlaceholderText(/Temas tratados/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('¿Es reunión con el cliente?'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Temas tratados/i)).toBeInTheDocument()
    })
  })

  test('no permite guardar una actividad con fecha de fin anterior a la de inicio', async () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    // Rellenamos el prospecto
    fireEvent.change(screen.getByPlaceholderText('Escribí para buscar...'), { target: { value: 'Escobar' } })
    // Seleccionamos responsable (el segundo combobox)
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'col-1' } })

    // Ponemos inicio = 2026-08-25T19:00 y fin = 2026-08-25T18:00
    const inputInicio = screen.getByLabelText('Desde', { selector: '#modal-desde' })
    const inputFin = screen.getByLabelText('Hasta', { selector: '#modal-hasta' })

    fireEvent.change(inputInicio, { target: { value: '2026-08-25T19:00' } })
    fireEvent.change(inputFin, { target: { value: '2026-08-25T18:00' } })

    fireEvent.click(screen.getByText('Confirmar y Agendar'))

    // Debe mostrar la alerta/toast de error de fecha
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('La fecha y hora de fin no puede ser anterior a la de inicio.')
    })

    // No debe haber llamado a saveActividad
    expect(cronogramaService.saveActividad).not.toHaveBeenCalled()
  })
})

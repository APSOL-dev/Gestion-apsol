import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { useState } from 'react'
import moment from 'moment'
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

vi.mock('../../services/cronograma', async () => {
  const real = await vi.importActual('../../services/cronograma')
  return {
    ...real,
    saveActividad: vi.fn(),
    deleteActividad: vi.fn()
  }
})

// --- Datos de prueba ---
// `cronograma.prospecto_id` es la columna real (FK a prospectos); el
// componente deriva `prospecto_nombre` de acá (ver extraerProspectoParaMostrar
// en services/cronograma.js). Los mocks reflejan eso: `prospecto_id` en vez
// de un `prospecto_nombre` de texto libre.
const ACTIVIDADES_MOCK = [
  {
    id: '1',
    prospecto_id: 'pros-1',
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
    prospecto_id: 'pros-2',
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

// `useData` se mockea con un hook de verdad (usa useState internamente) en
// vez de un valor estático, para poder probar las actualizaciones optimistas:
// el componente llama a `setActividades` del contexto y esperamos que el
// cambio se refleje ya, sin esperar a que el servidor responda.
function mockUseData(overrides = {}) {
  const { actividades: actividadesIniciales, prospectos: prospectosOverride, colaboradores: colaboradoresOverride, ...resto } = overrides
  useData.mockImplementation(() => {
    const [actividadesState, setActividadesState] = useState(actividadesIniciales ?? ACTIVIDADES_MOCK)
    return {
      actividades: actividadesState,
      setActividades: setActividadesState,
      loadingActividades: false,
      refreshActividades: vi.fn().mockResolvedValue(),
      prospectos: prospectosOverride ?? PROSPECTOS_MOCK,
      loadingProspectos: false,
      refreshProspectos: vi.fn().mockResolvedValue(),
      colaboradores: colaboradoresOverride ?? COLABORADORES_MOCK,
      loadingColaboradores: false,
      refreshColaboradores: vi.fn().mockResolvedValue(),
      ...resto
    }
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

  test('ya no muestra el buscador de texto libre (eliminado por confuso/redundante)', () => {
    render(<Cronograma />)
    expect(screen.queryByPlaceholderText('Buscar Cronograma...')).not.toBeInTheDocument()
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

  // ─── Tests del panel de saldo de horas (ex "cumplimiento") ─────────────────

  test('el panel de saldo de horas muestra valores estables entre renders consecutivos', () => {
    const { unmount, container: c1 } = render(<Cronograma />)
    const texto1 = c1.querySelector('.compliance-list')?.textContent ?? ''
    unmount()

    const { container: c2 } = render(<Cronograma />)
    const texto2 = c2.querySelector('.compliance-list')?.textContent ?? ''

    expect(texto1).toBe(texto2)
  })

  test('muestra "—" de saldo cuando el prospecto no tiene horas mensuales contratadas', () => {
    render(<Cronograma />)
    // PROSPECTOS_MOCK no define hs_mensuales para ningún prospecto
    const item = screen.getByText('Escobar').closest('.compliance-item')
    expect(item).toHaveTextContent('—')
  })

  test('calcula el saldo de horas restando lo agendado en el mes de las horas contratadas', () => {
    const inicio = moment().startOf('month').add(2, 'days').hour(9).minute(0)
    const fin = inicio.clone().add(3, 'hours')
    mockUseData({
      prospectos: [{ id: 'pros-4', nombre: 'Open Pack', estado: '6A - En producción', hs_mensuales: 10 }],
      actividades: [{
        id: '9', prospecto_id: 'pros-4', descripcion: 'Trabajo',
        inicio: inicio.format(), fin: fin.format(),
        responsable_id: 'col-1', reunion_cliente: false
      }]
    })

    const { container } = render(<Cronograma />)
    const item = container.querySelector('.compliance-item')
    // 10h contratadas - 3h agendadas = 7h de saldo
    expect(item).toHaveTextContent('7h')
  })

  test('muestra "—" en días desde la última reunión cuando el prospecto nunca tuvo una reunión con cliente', () => {
    render(<Cronograma />)
    // Escobar solo tiene una actividad con reunion_cliente: false
    const item = screen.getByText('Escobar').closest('.compliance-item')
    expect(item.querySelector('.p-days')).toHaveTextContent('—')
  })

  test('muestra los días transcurridos desde la última reunión con cliente', () => {
    const fechaReunion = moment().subtract(5, 'days').hour(10).minute(0)
    mockUseData({
      prospectos: [{ id: 'pros-5', nombre: 'DG 2026', estado: '6A - En producción' }],
      actividades: [{
        id: '10', prospecto_id: 'pros-5', descripcion: 'Reunión',
        inicio: fechaReunion.format(), fin: fechaReunion.clone().add(1, 'hour').format(),
        responsable_id: 'col-1', reunion_cliente: true
      }]
    })

    const { container } = render(<Cronograma />)
    const item = container.querySelector('.compliance-item')
    expect(item.querySelector('.p-days')).toHaveTextContent('5d')
  })

  // ─── Tests de la barra de filtros (ahora arriba, no en un panel lateral) ───

  test('los filtros de fecha/personal/prospectos aparecen en una barra arriba del calendario, no en un panel lateral izquierdo', () => {
    const { container } = render(<Cronograma />)
    expect(container.querySelector('.cronograma-sidebar.left')).toBeNull()
    expect(container.querySelector('.cronograma-filtros-bar')).not.toBeNull()
    expect(screen.getByLabelText('Desde')).toBeInTheDocument()
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument()
  })

  // ─── Tests del ancho ajustable de la columna "Prospecto" ────────────────────

  describe('Ancho ajustable de la columna "Prospecto" del panel de saldo', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    test('usa 110px por defecto cuando no hay nada guardado en localStorage', () => {
      const { container } = render(<Cronograma />)
      const lista = container.querySelector('.compliance-list')
      expect(lista.style.getPropertyValue('--ancho-col-nombre')).toBe('110px')
    })

    test('arrastrar el divisor cambia el ancho de la columna', () => {
      const { container } = render(<Cronograma />)
      const handle = container.querySelector('.col-resize-handle')
      const lista = container.querySelector('.compliance-list')

      fireEvent.mouseDown(handle, { clientX: 110 })
      fireEvent.mouseMove(document, { clientX: 150 })
      fireEvent.mouseUp(document)

      expect(lista.style.getPropertyValue('--ancho-col-nombre')).toBe('150px')
    })

    test('el ancho no baja del mínimo ni supera el máximo permitido (que escala con el ancho del panel)', () => {
      const { container } = render(<Cronograma />)
      const handle = container.querySelector('.col-resize-handle')
      const lista = container.querySelector('.compliance-list')

      fireEvent.mouseDown(handle, { clientX: 110 })
      fireEvent.mouseMove(document, { clientX: -1000 })
      fireEvent.mouseUp(document)
      expect(lista.style.getPropertyValue('--ancho-col-nombre')).toBe('70px')

      // Con el panel en su ancho por defecto (320px), el máximo es
      // 320 - 152 (padding + columnas fijas) = 168px.
      fireEvent.mouseDown(handle, { clientX: 70 })
      fireEvent.mouseMove(document, { clientX: 5000 })
      fireEvent.mouseUp(document)
      expect(lista.style.getPropertyValue('--ancho-col-nombre')).toBe('168px')
    })

    test('el ancho elegido se guarda en localStorage y se recupera en el próximo render', () => {
      const { container, unmount } = render(<Cronograma />)
      const handle = container.querySelector('.col-resize-handle')

      fireEvent.mouseDown(handle, { clientX: 110 })
      fireEvent.mouseMove(document, { clientX: 160 })
      fireEvent.mouseUp(document)

      expect(localStorage.getItem('apsol_cronograma_saldo_col_nombre_width')).toBe('160')

      unmount()
      const { container: container2 } = render(<Cronograma />)
      const lista2 = container2.querySelector('.compliance-list')
      expect(lista2.style.getPropertyValue('--ancho-col-nombre')).toBe('160px')
    })
  })

  describe('Ancho ajustable del panel de saldo completo (no solo sus columnas internas)', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    test('usa 320px por defecto cuando no hay nada guardado en localStorage', () => {
      const { container } = render(<Cronograma />)
      const layout = container.querySelector('.cronograma-layout')
      expect(layout.style.getPropertyValue('--ancho-panel-saldo')).toBe('320px')
    })

    test('arrastrar el divisor hacia la izquierda agranda el panel (está pegado al borde derecho)', () => {
      const { container } = render(<Cronograma />)
      const handle = container.querySelector('.panel-resize-handle')
      const layout = container.querySelector('.cronograma-layout')

      fireEvent.mouseDown(handle, { clientX: 500 })
      fireEvent.mouseMove(document, { clientX: 450 }) // 50px hacia la izquierda
      fireEvent.mouseUp(document)

      expect(layout.style.getPropertyValue('--ancho-panel-saldo')).toBe('370px')
    })

    test('el ancho del panel no baja del mínimo ni supera el máximo permitido', () => {
      const { container } = render(<Cronograma />)
      const handle = container.querySelector('.panel-resize-handle')
      const layout = container.querySelector('.cronograma-layout')

      fireEvent.mouseDown(handle, { clientX: 500 })
      fireEvent.mouseMove(document, { clientX: 5000 }) // muy hacia la derecha: debe angostar hasta el mínimo
      fireEvent.mouseUp(document)
      expect(layout.style.getPropertyValue('--ancho-panel-saldo')).toBe('280px')

      fireEvent.mouseDown(handle, { clientX: 500 })
      fireEvent.mouseMove(document, { clientX: -5000 }) // muy hacia la izquierda: debe agrandar hasta el máximo
      fireEvent.mouseUp(document)
      expect(layout.style.getPropertyValue('--ancho-panel-saldo')).toBe('560px')
    })

    test('el ancho elegido se guarda en localStorage y se recupera en el próximo render', () => {
      const { container, unmount } = render(<Cronograma />)
      const handle = container.querySelector('.panel-resize-handle')

      fireEvent.mouseDown(handle, { clientX: 500 })
      fireEvent.mouseMove(document, { clientX: 400 }) // +100px
      fireEvent.mouseUp(document)

      expect(localStorage.getItem('apsol_cronograma_saldo_panel_width')).toBe('420')

      unmount()
      const { container: container2 } = render(<Cronograma />)
      const layout2 = container2.querySelector('.cronograma-layout')
      expect(layout2.style.getPropertyValue('--ancho-panel-saldo')).toBe('420px')
    })

    test('agrandar el panel completo también permite agrandar más la columna "Prospecto"', () => {
      const { container } = render(<Cronograma />)
      const panelHandle = container.querySelector('.panel-resize-handle')
      const colHandle = container.querySelector('.col-resize-handle')
      const lista = container.querySelector('.compliance-list')

      // Agranda el panel de 320px a 470px (+150px)
      fireEvent.mouseDown(panelHandle, { clientX: 500 })
      fireEvent.mouseMove(document, { clientX: 350 })
      fireEvent.mouseUp(document)

      // Ahora el máximo de la columna debería ser 470 - 152 = 318px
      fireEvent.mouseDown(colHandle, { clientX: 110 })
      fireEvent.mouseMove(document, { clientX: 5000 })
      fireEvent.mouseUp(document)

      expect(lista.style.getPropertyValue('--ancho-col-nombre')).toBe('318px')
    })
  })

  // ─── Actualizaciones optimistas: la UI no espera al servidor ──────────────

  describe('Actualizaciones optimistas', () => {
    test('crear una actividad la muestra en el calendario antes de que el servidor confirme el guardado', async () => {
      let resolverGuardado
      cronogramaService.saveActividad.mockImplementation(() => new Promise(resolve => { resolverGuardado = resolve }))

      render(<Cronograma />)
      fireEvent.click(screen.getByTitle('Nueva Actividad'))
      fireEvent.change(screen.getByPlaceholderText('Escribí para buscar...'), { target: { value: 'Escobar' } })
      fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'col-1' } })
      fireEvent.click(screen.getByText('Confirmar y Agendar'))

      // El modal se cierra y el evento nuevo ya aparece SIN que saveActividad
      // se haya resuelto todavía (la promesa sigue pendiente acá).
      await waitFor(() => {
        expect(screen.queryByText('Nueva Actividad')).not.toBeInTheDocument()
      })
      expect(screen.getByTestId('event-1')).toBeInTheDocument()
      expect(screen.getByTestId('event-2')).toBeInTheDocument()
      const eventosAntes = screen.getAllByTestId(/^event-/)
      expect(eventosAntes).toHaveLength(3)

      // Ahora se resuelve el guardado real: no debe duplicarse el evento.
      resolverGuardado({ id: 'real-id-3', prospecto_id: 'pros-1', descripcion: '', inicio: moment().format(), fin: moment().add(1, 'hour').format(), responsable_id: 'col-1' })
      await waitFor(() => {
        expect(screen.getAllByTestId(/^event-/)).toHaveLength(3)
      })
    })

    test('si falla el guardado optimista de una nueva actividad, la saca del calendario y avisa con un toast', async () => {
      let rechazarGuardado
      cronogramaService.saveActividad.mockImplementation(() => new Promise((resolve, reject) => { rechazarGuardado = reject }))

      render(<Cronograma />)
      fireEvent.click(screen.getByTitle('Nueva Actividad'))
      fireEvent.change(screen.getByPlaceholderText('Escribí para buscar...'), { target: { value: 'Escobar' } })
      fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'col-1' } })
      fireEvent.click(screen.getByText('Confirmar y Agendar'))

      await waitFor(() => {
        expect(screen.getAllByTestId(/^event-/)).toHaveLength(3)
      })

      rechazarGuardado(new Error('DB error'))

      await waitFor(() => {
        expect(screen.getAllByTestId(/^event-/)).toHaveLength(2)
        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar')
      })
    })

    test('eliminar una actividad la saca del calendario antes de que el servidor confirme el borrado', async () => {
      window.confirm = vi.fn().mockReturnValue(true)
      let resolverBorrado
      cronogramaService.deleteActividad.mockImplementation(() => new Promise(resolve => { resolverBorrado = resolve }))

      render(<Cronograma />)
      fireEvent.click(screen.getByTestId('event-1'))
      await waitFor(() => expect(screen.getByText('Eliminar')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Eliminar'))

      // Desaparece del calendario antes de que se resuelva deleteActividad.
      await waitFor(() => {
        expect(screen.queryByTestId('event-1')).not.toBeInTheDocument()
      })
      expect(screen.getByTestId('event-2')).toBeInTheDocument()

      resolverBorrado(true)
      await waitFor(() => {
        expect(screen.queryByTestId('event-1')).not.toBeInTheDocument()
      })
    })

    test('si falla el borrado optimista, la actividad vuelve a aparecer y avisa con un toast', async () => {
      window.confirm = vi.fn().mockReturnValue(true)
      let rechazarBorrado
      cronogramaService.deleteActividad.mockImplementation(() => new Promise((resolve, reject) => { rechazarBorrado = reject }))

      render(<Cronograma />)
      fireEvent.click(screen.getByTestId('event-1'))
      await waitFor(() => expect(screen.getByText('Eliminar')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Eliminar'))

      await waitFor(() => {
        expect(screen.queryByTestId('event-1')).not.toBeInTheDocument()
      })

      rechazarBorrado(new Error('DB error'))

      await waitFor(() => {
        expect(screen.getByTestId('event-1')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo eliminar')
      })
    })
  })
})

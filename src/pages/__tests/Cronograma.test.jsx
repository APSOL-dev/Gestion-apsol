import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import moment from 'moment'
import Cronograma from '../Cronograma'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import * as cronogramaService from '../../services/cronograma'
import * as colaboradoresService from '../../services/colaboradores'

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

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn()
}))

// El Cronograma ya no trae toda la tabla vía DataContext: pide 3 recortes
// puntuales directo al servicio (ver services/cronograma.js). Se mockean
// esas 3 funciones además de saveActividad/deleteActividad; el resto
// (resolverProspectoParaGuardar, extraerProspectoParaMostrar, etc.) se deja
// real vía importActual.
vi.mock('../../services/cronograma', async () => {
  const real = await vi.importActual('../../services/cronograma')
  return {
    ...real,
    saveActividad: vi.fn(),
    deleteActividad: vi.fn(),
    getActividadesEnRango: vi.fn(),
    getHorasDedicadasPorProspecto: vi.fn(),
    getUltimasReunionesPorProspecto: vi.fn()
  }
})

// El Cronograma trae la lista mínima de colaboradores (para el filtro
// "Personal" y el selector de invitados) con getColaboradoresLista().
vi.mock('../../services/colaboradores', async () => {
  const real = await vi.importActual('../../services/colaboradores')
  return { ...real, getColaboradoresLista: vi.fn() }
})

// Contactos de la empresa del prospecto (para invitar a la reunión).
vi.mock('../../services/contactos', () => ({
  getContactosPorEmpresa: vi.fn().mockResolvedValue([])
}))
import { getContactosPorEmpresa } from '../../services/contactos'

// Sincronización con Google Calendar (Edge Function).
vi.mock('../../services/calendario', () => ({
  sincronizarEventoReunion: vi.fn().mockResolvedValue({ id: 'gcal-evt-1', htmlLink: 'http://cal/x' })
}))
import { sincronizarEventoReunion } from '../../services/calendario'

// --- Datos de prueba ---
// `cronograma.prospecto_id` es la columna real (FK a prospectos); el
// componente deriva `prospecto_nombre` de acá (ver resolverActividades en
// services/cronograma.js).
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
  { id: 'pros-3', nombre: 'Norte 2025', estado: '4 - Propuesta enviada' },
  { id: 'pros-4', nombre: 'Cliente Cerrado', estado: '5H - Finalizados' }
]

const COLABORADORES_MOCK = [
  { id: 'col-1', usuario_id: 'user-1', nombre: 'Ana', apellido: 'López', activo: true },
  { id: 'col-2', usuario_id: 'user-2', nombre: 'Carlos', apellido: 'Gómez', activo: true }
]

function mockUseData(overrides = {}) {
  const { prospectos: prospectosOverride, colaboradores: colaboradoresOverride, ...resto } = overrides
  // El componente lee la lista de colaboradores por getColaboradoresLista(),
  // no por DataContext.
  colaboradoresService.getColaboradoresLista.mockResolvedValue(colaboradoresOverride ?? COLABORADORES_MOCK)
  useData.mockReturnValue({
    prospectos: prospectosOverride ?? PROSPECTOS_MOCK,
    loadingProspectos: false,
    refreshProspectos: vi.fn().mockResolvedValue(),
    ...resto
  })
}

// Mockea los 3 servicios acotados del cronograma. Por defecto simula un
// filtrado real por fecha (como haría el servidor), para poder probar que
// cambiar "Desde"/"Hasta" realmente dispara una consulta nueva con otro
// rango — no un filtro client-side como antes. `horasDedicadas` es el Map
// prospecto_id -> horas (lo que agrega server-side getHorasDedicadasPorProspecto,
// ver services/cronograma.js) - el saldo es acumulado desde el inicio del
// servicio, ya no "lo agendado este mes", así que no sale de `actividades`.
function mockServiciosCronograma({ actividades = ACTIVIDADES_MOCK, reuniones = new Map(), horasDedicadas = new Map() } = {}) {
  cronogramaService.getActividadesEnRango.mockImplementation((desde, hasta) => (
    Promise.resolve(actividades.filter(a => moment(a.inicio).isBetween(moment(desde), moment(hasta), null, '[]')))
  ))
  cronogramaService.getHorasDedicadasPorProspecto.mockResolvedValue(horasDedicadas)
  cronogramaService.getUltimasReunionesPorProspecto.mockResolvedValue(reuniones)
}

async function esperarCargaInicial() {
  await waitFor(() => {
    expect(screen.getByTestId('event-1')).toBeInTheDocument()
    expect(screen.getByTestId('event-2')).toBeInTheDocument()
  })
}

function mockUseAuth(user = null) {
  useAuth.mockReturnValue({ user })
}

// Prospecto / Responsable / Invitados son react-select. Helper para elegir
// una opción por su texto visible.
async function elegirEnRS(inputEl, texto) {
  fireEvent.focus(inputEl)
  fireEvent.change(inputEl, { target: { value: texto } })
  const opt = await screen.findByText(texto, { selector: '.rs__option' })
  fireEvent.click(opt)
}
// Lista de opciones visibles de un react-select (abre el menú y lee los textos).
function opcionesRS(inputEl) {
  fireEvent.focus(inputEl)
  fireEvent.keyDown(inputEl, { key: 'ArrowDown', code: 'ArrowDown' })
  return [...document.querySelectorAll('.rs__option')].map(o => o.textContent)
}
const rsValor = () => document.querySelector('.rs__single-value')?.textContent ?? null

describe('Cronograma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // El componente recuerda algunas preferencias en localStorage (ancho del
    // panel de saldo, tilde "Ver histórico"); sin limpiar, un test le filtra
    // el estado al siguiente.
    localStorage.clear()
    mockUseData()
    mockServiciosCronograma()
    // Sin usuario logueado por defecto: así el preseleccionado automático
    // de "Personal" no interfiere con los tests que no lo ejercitan.
    mockUseAuth(null)
  })

  // ─── Tests de filtros ───────────────────────────────────────────────────────

  test('sin filtros activos, muestra todos los eventos', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()
  })

  test('filtro de fecha "Hasta" oculta eventos que caen después de la fecha indicada', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    const inputHasta = screen.getByLabelText('Hasta')
    // Ponemos la fecha hasta el 20 de agosto → el evento del 21 debe desaparecer
    fireEvent.change(inputHasta, { target: { value: '2026-08-20' } })

    await waitFor(() => {
      expect(screen.getByTestId('event-1')).toBeInTheDocument()
      expect(screen.queryByTestId('event-2')).not.toBeInTheDocument()
    })
  })

  test('filtro de fecha "Desde" oculta eventos anteriores a la fecha indicada', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    const inputDesde = screen.getByLabelText('Desde')
    // Ponemos la fecha desde el 21 de agosto → el evento del 20 debe desaparecer
    fireEvent.change(inputDesde, { target: { value: '2026-08-21' } })

    await waitFor(() => {
      expect(screen.queryByTestId('event-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('event-2')).toBeInTheDocument()
    })
  })

  test('ya no muestra el buscador de texto libre (eliminado por confuso/redundante)', () => {
    render(<Cronograma />)
    expect(screen.queryByPlaceholderText('Buscar Cronograma...')).not.toBeInTheDocument()
  })

  // ─── Tests de la preselección de "Personal" con el usuario logueado ───────

  test('preselecciona en "Personal" al colaborador que corresponde al usuario logueado', async () => {
    mockUseData({
      colaboradores: [
        { id: 'col-1', usuario_id: 'user-1', nombre: 'Ana', apellido: 'López' },
        { id: 'col-2', usuario_id: 'user-2', nombre: 'Carlos', apellido: 'Gómez' }
      ]
    })
    mockUseAuth({ id: 'user-1' })

    render(<Cronograma />)

    // Con "Personal" preseleccionado en Ana (col-1), el evento de Carlos
    // (responsable_id col-2) queda filtrado y desaparece del calendario.
    await waitFor(() => {
      expect(screen.getByTestId('event-1')).toBeInTheDocument()
      expect(screen.queryByTestId('event-2')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Personal/ })).toHaveTextContent('Personal (1)')
  })

  test('sin colaborador asociado al usuario logueado, "Personal" arranca sin filtrar (se ven todos)', async () => {
    mockUseData({
      colaboradores: [
        { id: 'col-1', usuario_id: 'user-1', nombre: 'Ana', apellido: 'López' },
        { id: 'col-2', usuario_id: 'user-2', nombre: 'Carlos', apellido: 'Gómez' }
      ]
    })
    // El usuario logueado no tiene ficha de colaborador (ej: es un rol admin puro)
    mockUseAuth({ id: 'user-sin-colaborador' })

    render(<Cronograma />)
    await esperarCargaInicial()
    expect(screen.getByRole('button', { name: /Personal/ })).toHaveTextContent('Personal')
    expect(screen.getByRole('button', { name: /Personal/ })).not.toHaveTextContent('Personal (')
  })

  test('si el usuario destilda manualmente su preselección de "Personal", no se le vuelve a imponer', async () => {
    mockUseData({
      colaboradores: [
        { id: 'col-1', usuario_id: 'user-1', nombre: 'Ana', apellido: 'López' },
        { id: 'col-2', usuario_id: 'user-2', nombre: 'Carlos', apellido: 'Gómez' }
      ]
    })
    mockUseAuth({ id: 'user-1' })

    render(<Cronograma />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Personal/ })).toHaveTextContent('Personal (1)')
    })

    // Abre el desplegable y destilda a Ana (la única preseleccionada)
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.click(screen.getByText('Ana López'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Personal/ })).toHaveTextContent('Personal')
      expect(screen.getByRole('button', { name: /Personal/ })).not.toHaveTextContent('Personal (')
    })
  })

  // ─── Indicadores de dedicación (recuadro bajo el saldo) ─────────────────────

  const ACTIVIDADES_CON_DURACION = [
    { ...ACTIVIDADES_MOCK[0], duracion_horas: 1 },   // col-1, pros-1 (Escobar)
    { ...ACTIVIDADES_MOCK[1], duracion_horas: 2 },   // col-2, pros-2 (Consultora)
    {
      id: '3', prospecto_id: 'pros-1', descripcion: 'Ajustes',
      inicio: '2026-08-22T09:00:00', fin: '2026-08-22T12:00:00',
      responsable_id: 'col-2', responsable_nombre: 'Carlos Gómez',
      reunion_cliente: false, link_reunion: '', comentarios_reunion: '',
      duracion_horas: 3, multiplicador: 1
    }
  ]

  test('sin filtros, el recuadro de indicadores suma todas las horas del rango', async () => {
    mockServiciosCronograma({ actividades: ACTIVIDADES_CON_DURACION })
    render(<Cronograma />)
    await esperarCargaInicial()

    const caja = screen.getByText('Horas dedicadas — según filtros').closest('.sidebar-section')
    expect(caja).toHaveTextContent('Todo el personal · Todos los prospectos')
    expect(caja).toHaveTextContent('6.00h')   // 1 + 2 + 3
    expect(caja).toHaveTextContent('Actividades')
  })

  test('cruza el filtro de Personal con el de Prospectos y suma solo esa intersección', async () => {
    mockServiciosCronograma({ actividades: ACTIVIDADES_CON_DURACION })
    render(<Cronograma />)
    await esperarCargaInicial()

    // Personal -> Carlos (col-2)
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    const dropdownPersonal = screen.getByLabelText('Buscar en Personal').closest('.picker-dropdown')
    fireEvent.click(within(dropdownPersonal).getByText('Carlos Gómez'))
    // Prospectos -> Escobar (pros-1). "Escobar" también figura en el panel de
    // saldo, así que se acota la búsqueda al desplegable del filtro.
    fireEvent.click(screen.getByRole('button', { name: /Prospectos/ }))
    const dropdownProsp = screen.getByLabelText('Buscar en Prospectos').closest('.picker-dropdown')
    fireEvent.click(within(dropdownProsp).getByText('Escobar'))

    const caja = screen.getByText('Horas dedicadas — según filtros').closest('.sidebar-section')
    await waitFor(() => {
      expect(caja).toHaveTextContent('Carlos Gómez · Escobar')
      // Solo la actividad 3 (Carlos en Escobar, 3h). La 1 es de Ana, la 2 es otro prospecto.
      expect(caja).toHaveTextContent('3.00h')
    })
  })

  test('el filtro de Prospectos incluye las categorías internas y suma sus horas', async () => {
    mockServiciosCronograma({
      actividades: [
        ...ACTIVIDADES_CON_DURACION, // 6h en prospectos reales
        {
          id: 'cat1', prospecto_id: null, descripcion: '[Día Libre] Vacaciones de Ana',
          inicio: '2026-08-24T09:00:00', fin: '2026-08-24T14:00:00',
          responsable_id: 'col-1', responsable_nombre: 'Ana López',
          reunion_cliente: false, link_reunion: '', comentarios_reunion: '',
          duracion_horas: 5, multiplicador: 1,
        },
      ],
    })
    render(<Cronograma />)
    await esperarCargaInicial()

    fireEvent.click(screen.getByRole('button', { name: /Prospectos/ }))
    const dd = screen.getByLabelText('Buscar en Prospectos').closest('.picker-dropdown')
    // las categorías internas figuran como opción
    expect(within(dd).getByText('Día Libre')).toBeInTheDocument()
    expect(within(dd).getByText('Capacitación')).toBeInTheDocument()

    // al elegir "Día Libre" el recuadro cuenta SOLO esa categoría
    fireEvent.click(within(dd).getByText('Día Libre'))
    const caja = screen.getByText('Horas dedicadas — según filtros').closest('.sidebar-section')
    await waitFor(() => {
      expect(caja).toHaveTextContent('Todo el personal · Día Libre')
      expect(caja).toHaveTextContent('5.00h')
    })
  })

  // ─── Tests del modal ────────────────────────────────────────────────────────

  test('el modal se abre con formulario vacío al hacer clic en el botón "+"', () => {
    render(<Cronograma />)

    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    expect(rsValor()).toBeNull() // Prospecto sin elegir
    expect(screen.getByPlaceholderText('¿Qué se va a realizar?')).toHaveValue('')
  })

  test('el modal se rellena con los datos del evento al hacer clic en uno existente', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    fireEvent.click(screen.getByTestId('event-1'))

    await waitFor(() => {
      expect(screen.getByText('Escobar', { selector: '.rs__single-value' })).toBeInTheDocument()
      expect(screen.getByDisplayValue('Reunión de seguimiento')).toBeInTheDocument()
    })
  })

  test('abrir modal de edición y luego abrir nuevo no mezcla los datos', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    // Abrir un evento existente
    fireEvent.click(screen.getByTestId('event-1'))
    await waitFor(() => expect(screen.getByText('Escobar', { selector: '.rs__single-value' })).toBeInTheDocument())

    // Cerrar con Cancelar
    fireEvent.click(screen.getByText('Cancelar'))

    // Abrir nuevo con el botón +
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    // El campo debe estar vacío
    expect(rsValor()).toBeNull()
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

  test('hacer clic fuera del modal (en el fondo) NO lo cierra — así no se pierde lo escrito', () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    expect(screen.getByText('Nueva Actividad')).toBeInTheDocument()

    fireEvent.click(document.querySelector('.modal-overlay'))

    expect(screen.getByText('Nueva Actividad')).toBeInTheDocument() // sigue abierto
  })

  test('la tecla Escape cierra el modal', () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    expect(screen.getByText('Nueva Actividad')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText('Nueva Actividad')).not.toBeInTheDocument()
  })

  test('la X cierra el modal', () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    fireEvent.click(document.querySelector('.btn-close'))
    expect(screen.queryByText('Nueva Actividad')).not.toBeInTheDocument()
  })

  test('al abrir "Nueva Actividad" el responsable arranca en la persona logueada', async () => {
    mockUseAuth({ id: 'user-1' }) // user-1 = col-1 = Ana López (COLABORADORES_MOCK)
    render(<Cronograma />)
    await esperarCargaInicial()

    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    // Prospecto queda vacío; el único single-value es el de Responsable
    expect(rsValor()).toBe('Ana López')
  })

  test('duplicar una actividad reabre el editor como NUEVA con los mismos datos', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    fireEvent.click(screen.getByTestId('event-1'))
    await waitFor(() => {
      expect(screen.getByText('Editar Actividad')).toBeInTheDocument()
      expect(screen.getByText('Escobar', { selector: '.rs__single-value' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Duplicar/ }))

    // Pasa a modo alta: título "Nueva Actividad", sin botón Eliminar ni Duplicar
    expect(screen.getByText('Nueva Actividad')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Duplicar/ })).not.toBeInTheDocument()
    // ...pero conserva los datos de la original
    expect(screen.getByText('Escobar', { selector: '.rs__single-value' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Reunión de seguimiento')).toBeInTheDocument()
  })

  // ─── Panel "Saldo de Horas": buscador + semáforo de color ─────────────────

  test('el buscador del panel de saldo filtra la lista por nombre de prospecto', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    const lista = document.querySelector('.compliance-list')
    expect(within(lista).getByText('Escobar')).toBeInTheDocument()
    expect(within(lista).getByText('Consultora')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Buscar prospecto'), { target: { value: 'cons' } })

    expect(within(lista).getByText('Consultora')).toBeInTheDocument()
    expect(within(lista).queryByText('Escobar')).not.toBeInTheDocument()
  })

  test('el saldo se pinta según el semáforo: negativo rojo, al día verde, excedente violeta con reloj', async () => {
    mockUseData({
      prospectos: [
        { id: 'p-rojo', nombre: 'Rojo SA', estado: '6A - En producción', hs_mensuales: 24, inicio_servicio: '2025-01-01' },
        { id: 'p-verde', nombre: 'Verde SA', estado: '6A - En producción', hs_mensuales: 0, inicio_servicio: '2025-01-01' },
        { id: 'p-violeta', nombre: 'Violeta SA', estado: '6A - En producción', hs_mensuales: 0, inicio_servicio: '2025-01-01' },
      ],
    })
    mockServiciosCronograma({
      actividades: [],
      horasDedicadas: new Map([['p-rojo', 0], ['p-verde', 0], ['p-violeta', 6]]),
    })
    render(<Cronograma />)

    const lista = await screen.findByText('Rojo SA').then(el => el.closest('.compliance-list'))
    const saldoDe = nombre => within(lista).getByText(nombre).closest('.compliance-item').querySelector('.p-saldo')

    expect(saldoDe('Rojo SA')).toHaveClass('saldo-negativo')
    expect(saldoDe('Verde SA')).toHaveClass('saldo-ok')
    expect(saldoDe('Violeta SA')).toHaveClass('saldo-excedente')
    // El excedente lleva un ícono (relojito); los otros no
    expect(saldoDe('Violeta SA').querySelector('svg')).toBeInTheDocument()
    expect(saldoDe('Verde SA').querySelector('svg')).not.toBeInTheDocument()
  })

  // Bug (Santiago): el campo "Prospecto / Cliente" era un CreatableSelect, así
  // que se podía TIPEAR cualquier texto ("MD (Futbol y Agencia)", o cualquier
  // pavada) y quedaba guardado con prospecto_id NULL. Tiene que ser elegir
  // sí o sí de la lista.
  test('el campo Prospecto no permite texto libre: no ofrece opción "Usar ..." al tipear algo que no está', async () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    const input = document.getElementById('sel-prospecto')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'MD Futbol y Agencia' } })

    expect(await screen.findByText('Sin coincidencias')).toBeInTheDocument()
    expect(screen.queryByText(/^Usar "/)).not.toBeInTheDocument()
    expect(rsValor()).toBeNull()
  })

  test('el campo Prospecto sí deja elegir un prospecto en producción de la lista', async () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    await elegirEnRS(document.getElementById('sel-prospecto'), 'Escobar')

    expect(rsValor()).toBe('Escobar')
  })

  // ─── Filtro "Prospectos" / "Personal" y el tilde "Ver histórico" ──────────

  test('por defecto el filtro de Prospectos muestra solo los que están en producción (no los finalizados)', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    fireEvent.click(screen.getByRole('button', { name: /Prospectos/ }))
    const dd = screen.getByLabelText('Buscar en Prospectos').closest('.picker-dropdown')
    expect(within(dd).getByText('Escobar')).toBeInTheDocument()               // 6A - En producción
    expect(within(dd).queryByText('Cliente Cerrado')).not.toBeInTheDocument() // 5H - Finalizados, oculto
    expect(within(dd).queryByText('Norte 2025')).not.toBeInTheDocument()      // pipeline, nunca
  })

  test('"Ver histórico" suma los finalizados al filtro de Prospectos y los de baja al de Personal', async () => {
    mockUseData({
      colaboradores: [
        ...COLABORADORES_MOCK,
        { id: 'col-baja', usuario_id: null, nombre: 'Felipe', apellido: 'Duarte', activo: false }
      ]
    })
    render(<Cronograma />)
    await esperarCargaInicial()

    // Antes de tildar: ni el finalizado ni el de baja aparecen
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(within(screen.getByLabelText('Buscar en Personal').closest('.picker-dropdown'))
      .queryByText('Felipe Duarte')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Personal/ })) // cerrar

    fireEvent.click(screen.getByRole('button', { name: /Ver histórico/ }))

    fireEvent.click(screen.getByRole('button', { name: /Prospectos/ }))
    expect(within(screen.getByLabelText('Buscar en Prospectos').closest('.picker-dropdown'))
      .getByText('Cliente Cerrado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Prospectos/ }))

    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(within(screen.getByLabelText('Buscar en Personal').closest('.picker-dropdown'))
      .getByText('Felipe Duarte')).toBeInTheDocument()
  })

  test('con "Ver histórico" tildado se puede filtrar por un prospecto finalizado y ver sus actividades', async () => {
    mockServiciosCronograma({
      actividades: [
        ...ACTIVIDADES_MOCK,
        {
          id: '9', prospecto_id: 'pros-4', descripcion: 'Cierre de servicio',
          inicio: '2026-08-19T09:00:00', fin: '2026-08-19T10:00:00',
          responsable_id: 'col-1', responsable_nombre: 'Ana López',
          reunion_cliente: false, link_reunion: '', comentarios_reunion: '',
          duracion_horas: 1, multiplicador: 1
        }
      ]
    })
    render(<Cronograma />)
    await waitFor(() => expect(screen.getByTestId('event-9')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Ver histórico/ }))
    fireEvent.click(screen.getByRole('button', { name: /Prospectos/ }))
    const dd = screen.getByLabelText('Buscar en Prospectos').closest('.picker-dropdown')
    fireEvent.click(within(dd).getByText('Cliente Cerrado'))

    await waitFor(() => {
      expect(screen.getByTestId('event-9')).toBeInTheDocument()
      expect(screen.queryByTestId('event-1')).not.toBeInTheDocument()
    })
  })

  test('al DEStildar "Ver histórico" se limpia del filtro el prospecto finalizado que había quedado seleccionado (sin chip fantasma)', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    fireEvent.click(screen.getByRole('button', { name: /Ver histórico/ }))
    fireEvent.click(screen.getByRole('button', { name: /Prospectos/ }))
    fireEvent.click(within(screen.getByLabelText('Buscar en Prospectos').closest('.picker-dropdown'))
      .getByText('Cliente Cerrado'))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Prospectos/ })).toHaveTextContent('Prospectos (1)')
    })

    fireEvent.click(screen.getByRole('button', { name: /Ver histórico/ })) // destildar

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Prospectos/ })).toHaveTextContent('Prospectos')
      expect(screen.getByRole('button', { name: /Prospectos/ })).not.toHaveTextContent('Prospectos (')
    })
  })

  // ─── Memoria de los filtros de la barra (Desde/Hasta, Personal, Prospectos,
  //     Ver histórico, Agenda externa) entre recargas / re-login ─────────────

  test('los filtros de la barra se recuerdan al volver a montar la página', async () => {
    mockUseAuth({ id: 'user-1' })

    const { unmount } = render(<Cronograma />)
    await esperarCargaInicial()

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-05-10' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-06-20' } })
    // Ver histórico ON, Agenda externa OFF (arranca ON para admin)
    fireEvent.click(screen.getByRole('button', { name: /Ver histórico/ }))
    fireEvent.click(screen.getByRole('button', { name: /Agenda externa/ }))
    fireEvent.click(screen.getByRole('button', { name: /Prospectos/ }))
    fireEvent.click(within(screen.getByLabelText('Buscar en Prospectos').closest('.picker-dropdown'))
      .getByText('Escobar'))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Prospectos/ })).toHaveTextContent('Prospectos (1)')
    })

    unmount()

    // Segundo montaje: sin volver a tocar nada, todo vuelve como quedó
    render(<Cronograma />)
    await waitFor(() => {
      expect(screen.getByLabelText('Desde')).toHaveValue('2026-05-10')
    })
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-06-20')
    expect(screen.getByRole('button', { name: /Ver histórico/ })).toHaveClass('active')
    expect(screen.getByRole('button', { name: /Agenda externa/ })).not.toHaveClass('active')
    expect(screen.getByRole('button', { name: /Prospectos/ })).toHaveTextContent('Prospectos (1)')
  })

  test('si el usuario nunca toca el rango de fechas, no se persiste (sigue la ventana móvil)', async () => {
    mockUseAuth({ id: 'user-1' })
    render(<Cronograma />)
    await esperarCargaInicial()

    // Tocó "Ver histórico" pero NO las fechas
    fireEvent.click(screen.getByRole('button', { name: /Ver histórico/ }))
    await waitFor(() => {
      const guardado = JSON.parse(localStorage.getItem('apsol_cronograma_filtros') || '{}')
      expect(guardado['user-1']).toMatchObject({ verHistorico: true })
    })

    const guardado = JSON.parse(localStorage.getItem('apsol_cronograma_filtros'))
    expect(guardado['user-1']).not.toHaveProperty('fechaDesde')
    expect(guardado['user-1']).not.toHaveProperty('fechaHasta')

    // Ahora sí toca "Desde": a partir de acá se persiste
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-04-01' } })
    await waitFor(() => {
      const g = JSON.parse(localStorage.getItem('apsol_cronograma_filtros'))
      expect(g['user-1']).toMatchObject({ fechaDesde: '2026-04-01' })
    })
  })

  test('la memoria de filtros es por usuario: la de user-1 no se le aplica a user-2', async () => {
    mockUseAuth({ id: 'user-1' })
    const { unmount } = render(<Cronograma />)
    await esperarCargaInicial()
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-02' } })
    await waitFor(() => expect(screen.getByLabelText('Desde')).toHaveValue('2026-01-02'))
    unmount()

    mockUseAuth({ id: 'user-2' })
    render(<Cronograma />)
    // user-2 no hereda el 2026-01-02 de user-1 (usa el rango por defecto)
    await waitFor(() => expect(screen.getByLabelText('Desde')).toBeInTheDocument())
    expect(screen.getByLabelText('Desde')).not.toHaveValue('2026-01-02')
  })

  // ─── Tests del selector "Prospecto / Cliente" del modal ────────────────────

  test('el selector ofrece las categorías internas fijas además de los prospectos', () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    const opciones = opcionesRS(screen.getByLabelText('Prospecto / Cliente'))
    for (const cat of ['Consultora', 'Capacitación', 'Investigación', 'Día Libre', 'otros', 'Acción de venta']) {
      expect(opciones).toContain(cat)
    }
  })

  test('el selector solo lista prospectos en producción, no los que siguen en pipeline', () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    const opciones = opcionesRS(screen.getByLabelText('Prospecto / Cliente'))
    expect(opciones).toContain('Escobar')        // pros-1, 6A - En producción
    expect(opciones).not.toContain('Norte 2025') // pros-3, 4 - Propuesta enviada
  })

  test('el selector no duplica una opción si un prospecto se llama igual que una categoría', () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    // PROSPECTOS_MOCK tiene un prospecto "Consultora" (pros-2) y además
    // existe la categoría fija "Consultora": debe aparecer una sola vez.
    const opciones = opcionesRS(screen.getByLabelText('Prospecto / Cliente'))
    expect(opciones.filter(v => v === 'Consultora')).toHaveLength(1)
  })

  // ─── Duración rápida, mínimo de descripción, solo lectura ──────────────────

  test('los chips de duración fijan "Hasta" = "Desde" + N horas', () => {
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    fireEvent.change(screen.getByLabelText('Desde', { selector: '#modal-desde' }), { target: { value: '2026-09-02T17:00' } })
    fireEvent.click(screen.getByRole('button', { name: '3h' }))
    expect(screen.getByLabelText('Hasta', { selector: '#modal-hasta' })).toHaveValue('2026-09-02T20:00')
  })

  test('muestra el contador de caracteres y bloquea guardar con menos de 60', async () => {
    cronogramaService.saveActividad.mockResolvedValue({})
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')
    fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'), { target: { value: 'corto' } })

    expect(screen.getByText(/5 \/ 60 caracteres/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Confirmar'))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/al menos 60 caracteres/i)
    })
    expect(cronogramaService.saveActividad).not.toHaveBeenCalled()
  })

  test('al marcar "reunión con cliente", ofrece invitar a los contactos con email de la empresa del prospecto', async () => {
    getContactosPorEmpresa.mockResolvedValue([
      { id: 'c1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@acme.com' },
      { id: 'c2', nombre: 'Sin', apellido: 'Mail', email: null }
    ])
    mockUseData({ prospectos: [{ id: 'pros-1', nombre: 'Escobar', estado: '6A - En producción', empresa_id: 'emp-1' }] })

    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    fireEvent.click(screen.getByText('¿Es reunión con el cliente?'))

    await waitFor(() => expect(getContactosPorEmpresa).toHaveBeenCalledWith('emp-1'))

    const opciones = opcionesRS(screen.getByLabelText('Invitados del cliente (para la reunión)'))
    expect(opciones).toContain('Juan Pérez — juan@acme.com')
    expect(opciones.some(o => o.includes('Sin Mail'))).toBe(false) // sin email -> no aparece
  })

  test('al guardar una "reunión con cliente" crea el evento en Google Calendar con esos datos', async () => {
    cronogramaService.saveActividad.mockResolvedValue({ id: 'real-1' })
    getContactosPorEmpresa.mockResolvedValue([{ id: 'c1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@acme.com' }])
    mockUseData({ prospectos: [{ id: 'pros-1', nombre: 'Escobar', estado: '6A - En producción', empresa_id: 'emp-1' }] })

    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')
    fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'),
      { target: { value: 'Reunión de arranque del proyecto con el equipo del cliente y APSOL' } })
    fireEvent.click(screen.getByText('¿Es reunión con el cliente?'))
    await waitFor(() => expect(getContactosPorEmpresa).toHaveBeenCalledWith('emp-1'))
    await elegirEnRS(screen.getByLabelText('Invitados del cliente (para la reunión)'), 'Juan Pérez — juan@acme.com')

    fireEvent.click(screen.getByText('Confirmar'))

    await waitFor(() => {
      expect(sincronizarEventoReunion).toHaveBeenCalledWith('crear', expect.objectContaining({
        evento: expect.objectContaining({
          summary: 'Reunión de arranque del proyecto con el equipo del cliente y APSOL',
          attendees: [{ email: 'juan@acme.com' }]
        })
      }))
    })
  })

  test('si NO es reunión con cliente, no toca Google Calendar', async () => {
    cronogramaService.saveActividad.mockResolvedValue({ id: 'real-1' })
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')
    fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'), { target: { value: 'x'.repeat(60) } })
    fireEvent.click(screen.getByText('Confirmar'))

    await waitFor(() => expect(cronogramaService.saveActividad).toHaveBeenCalled())
    expect(sincronizarEventoReunion).not.toHaveBeenCalled()
  })

  test('las herramientas son botones toggle: se elige una o varias y se guardan como array', async () => {
    cronogramaService.saveActividad.mockResolvedValue({ id: 'real-1' })
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')
    fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'), { target: { value: 'x'.repeat(60) } })

    const grupo = screen.getByRole('group', { name: 'Herramientas utilizadas' })
    fireEvent.click(within(grupo).getByRole('button', { name: 'Antigravity' }))
    fireEvent.click(within(grupo).getByRole('button', { name: 'N8N' }))
    fireEvent.click(within(grupo).getByRole('button', { name: 'Power Bi' }))
    // toggle off: vuelvo a tocar Power Bi y queda sin marcar
    fireEvent.click(within(grupo).getByRole('button', { name: 'Power Bi' }))

    expect(within(grupo).getByRole('button', { name: 'Antigravity' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupo).getByRole('button', { name: 'Power Bi' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByText('Confirmar'))

    await waitFor(() => expect(cronogramaService.saveActividad).toHaveBeenCalled())
    expect(cronogramaService.saveActividad).toHaveBeenCalledWith(
      expect.objectContaining({ herramientas: ['Antigravity', 'N8N'] })
    )
  })

  test('el administrador ve el multiplicador y por defecto se guarda 1', async () => {
    cronogramaService.saveActividad.mockResolvedValue({ id: 'real-1' })
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    expect(screen.getByLabelText('Multiplicador')).toHaveValue(1)

    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')
    fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'), { target: { value: 'x'.repeat(60) } })
    fireEvent.click(screen.getByText('Confirmar'))

    await waitFor(() => expect(cronogramaService.saveActividad).toHaveBeenCalled())
    expect(cronogramaService.saveActividad).toHaveBeenCalledWith(
      expect.objectContaining({ multiplicador: 1 })
    )
  })

  test('un colaborador no ve el campo multiplicador', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esColaborador: true })
    render(<Cronograma />)
    fireEvent.click(screen.getByTitle('Nueva Actividad'))
    expect(screen.queryByLabelText('Multiplicador')).not.toBeInTheDocument()
  })

  test('un colaborador raso: el Responsable es un campo fijo con su nombre (no puede elegir a otro)', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esColaborador: true }) // user-1 = Ana López
    render(<Cronograma />)
    await esperarCargaInicial()
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    const resp = screen.getByLabelText('Responsable Asignado')
    expect(resp).toHaveAttribute('readonly')
    expect(resp).toHaveValue('Ana López')
  })

  test('el selector de Responsable solo lista colaboradores activos (ni stubs "(sheet id ...)" ni ex-colaboradores)', async () => {
    mockUseData({
      colaboradores: [
        ...COLABORADORES_MOCK,
        { id: 'stub-1', usuario_id: null, nombre: '(sheet id 3)', apellido: '', activo: false },
        { id: 'ex-1', usuario_id: null, nombre: 'Felipe', apellido: 'Duarte', activo: false },
      ],
    })
    render(<Cronograma />)
    await esperarCargaInicial()
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    const opciones = opcionesRS(screen.getByLabelText('Responsable Asignado'))
    expect(opciones).toContain('Ana López')      // activo
    expect(opciones).toContain('Carlos Gómez')   // activo
    expect(opciones.some(o => o.includes('sheet id'))).toBe(false)
    expect(opciones).not.toContain('Felipe Duarte') // de baja
  })

  test('al editar una actividad cuyo responsable ya no está activo, ese responsable sigue visible/seleccionado', async () => {
    mockUseData({
      colaboradores: [
        ...COLABORADORES_MOCK,
        { id: 'ex-1', usuario_id: null, nombre: 'Felipe', apellido: 'Duarte', activo: false },
      ],
    })
    mockServiciosCronograma({
      actividades: [{
        id: '77', prospecto_id: 'pros-1', descripcion: 'Trabajo viejo de Felipe',
        inicio: '2026-08-20T09:00:00', fin: '2026-08-20T10:00:00',
        responsable_id: 'ex-1', responsable_nombre: 'Felipe Duarte',
        reunion_cliente: false, link_reunion: '', comentarios_reunion: '', duracion_horas: 1, multiplicador: 1,
      }],
    })
    render(<Cronograma />)
    await waitFor(() => expect(screen.getByTestId('event-77')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('event-77'))
    await waitFor(() => expect(screen.getByText('Editar Actividad')).toBeInTheDocument())

    // El responsable de baja se muestra como valor elegido (no queda en blanco)
    expect(screen.getByText('Felipe Duarte', { selector: '.rs__single-value' })).toBeInTheDocument()
  })

  test('un Team Lead puede agendar para otra persona y se guarda ese responsable', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esColaborador: true, esTeamLead: true })
    cronogramaService.saveActividad.mockResolvedValue({ id: 'real-1' })
    render(<Cronograma />)
    await esperarCargaInicial()
    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    // Arranca en la persona logueada (Ana López) pero es un selector editable
    expect(rsValor()).toBe('Ana López')
    await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Carlos Gómez')

    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'), { target: { value: 'x'.repeat(60) } })
    fireEvent.click(screen.getByText('Confirmar'))

    await waitFor(() => expect(cronogramaService.saveActividad).toHaveBeenCalled())
    expect(cronogramaService.saveActividad).toHaveBeenCalledWith(
      expect.objectContaining({ responsable_id: 'col-2' })
    )
  })

  test('un colaborador abre un evento pasado hace más de 2 días hábiles en SOLO LECTURA', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, esColaborador: true })
    render(<Cronograma />)
    // event-1: fin 2026-08-20 -> hace rato para cualquier "ahora" real del test
    await waitFor(() => expect(screen.getByTestId('event-1')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('event-1'))

    await waitFor(() => expect(screen.getByText(/Solo lectura/i)).toBeInTheDocument())
    expect(screen.queryByText('Confirmar')).not.toBeInTheDocument()
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
    expect(screen.getByText('Cerrar')).toBeInTheDocument()
  })

  // ─── Tests de eliminación ───────────────────────────────────────────────────

  test('el botón "Eliminar" NO aparece en el modal de nueva actividad', () => {
    render(<Cronograma />)

    fireEvent.click(screen.getByTitle('Nueva Actividad'))

    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
  })

  test('el botón "Eliminar" SÍ aparece en el modal de edición de actividad existente', async () => {
    render(<Cronograma />)
    await esperarCargaInicial()

    fireEvent.click(screen.getByTestId('event-1'))

    await waitFor(() => {
      expect(screen.getByText('Eliminar')).toBeInTheDocument()
    })
  })

  test('confirmar la eliminación llama a deleteActividad con el ID correcto', async () => {
    cronogramaService.deleteActividad.mockResolvedValue(true)
    window.confirm = vi.fn().mockReturnValue(true)

    render(<Cronograma />)
    await esperarCargaInicial()
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
    await esperarCargaInicial()
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

    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')
    fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'), { target: { value: 'x'.repeat(60) } })
    fireEvent.click(screen.getByText('Confirmar'))

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
    await esperarCargaInicial()
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

    // Rellenamos el prospecto y el responsable
    await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
    await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')

    // Ponemos inicio = 2026-08-25T19:00 y fin = 2026-08-25T18:00
    const inputInicio = screen.getByLabelText('Desde', { selector: '#modal-desde' })
    const inputFin = screen.getByLabelText('Hasta', { selector: '#modal-hasta' })

    fireEvent.change(inputInicio, { target: { value: '2026-08-25T19:00' } })
    fireEvent.change(inputFin, { target: { value: '2026-08-25T18:00' } })

    fireEvent.click(screen.getByText('Confirmar'))

    // Debe mostrar la alerta/toast de error de fecha
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('La fecha y hora de fin no puede ser anterior a la de inicio.')
    })

    // No debe haber llamado a saveActividad
    expect(cronogramaService.saveActividad).not.toHaveBeenCalled()
  })

  // ─── Tests del panel de saldo de horas (ex "cumplimiento") ─────────────────

  test('el panel de saldo de horas muestra valores estables entre renders consecutivos', async () => {
    const { unmount, container: c1 } = render(<Cronograma />)
    await waitFor(() => expect(c1.querySelector('.compliance-item')).toBeInTheDocument())
    const texto1 = c1.querySelector('.compliance-list')?.textContent ?? ''
    unmount()

    const { container: c2 } = render(<Cronograma />)
    await waitFor(() => expect(c2.querySelector('.compliance-item')).toBeInTheDocument())
    const texto2 = c2.querySelector('.compliance-list')?.textContent ?? ''

    expect(texto1).toBe(texto2)
  })

  test('muestra "—" de saldo cuando el prospecto no tiene horas mensuales contratadas', async () => {
    render(<Cronograma />)
    // PROSPECTOS_MOCK no define hs_mensuales para ningún prospecto
    await waitFor(() => {
      const item = screen.getByText('Escobar').closest('.compliance-item')
      expect(item).toHaveTextContent('—')
    })
  })

  test('muestra "—" de saldo cuando el prospecto no tiene fecha de inicio de servicio', async () => {
    mockUseData({
      prospectos: [{ id: 'pros-4', nombre: 'Open Pack', estado: '6A - En producción', hs_mensuales: 10 }]
    })
    mockServiciosCronograma({ horasDedicadas: new Map([['pros-4', 5]]) })

    const { container } = render(<Cronograma />)
    await waitFor(() => {
      const item = container.querySelector('.compliance-item')
      expect(item).toHaveTextContent('—')
    })
  })

  test('calcula el saldo acumulado desde el inicio del servicio, no lo agendado este mes', async () => {
    // Mismo cálculo que hace la función real (calcularSaldoHoras) - acá
    // solo se arma el escenario y se verifica que el panel muestre
    // exactamente lo que esa función (ya probada aparte, con casos reales
    // verificados contra el histórico) calcularía para estos datos.
    const inicioServicio = moment().subtract(4, 'weeks').format('YYYY-MM-DD')
    const prospecto = { id: 'pros-4', nombre: 'Open Pack', estado: '6A - En producción', hs_mensuales: 16, inicio_servicio: inicioServicio }
    mockUseData({ prospectos: [prospecto] })
    mockServiciosCronograma({ horasDedicadas: new Map([['pros-4', 20]]) })

    const esperado = cronogramaService.calcularSaldoHoras(prospecto, 20)

    const { container } = render(<Cronograma />)
    await waitFor(() => {
      const item = container.querySelector('.compliance-item')
      // El panel siempre muestra 2 decimales (ej. "5.22h", "2.00h").
      expect(item).toHaveTextContent(`${esperado.toFixed(2)}h`)
    })
  })

  test('muestra "—" en días desde la última reunión cuando el prospecto nunca tuvo una reunión con cliente', async () => {
    render(<Cronograma />)
    // getUltimasReunionesPorProspecto por defecto no trae ninguna reunión
    await waitFor(() => {
      const item = screen.getByText('Escobar').closest('.compliance-item')
      expect(item.querySelector('.p-days')).toHaveTextContent('—')
    })
  })

  test('muestra los días transcurridos desde la última reunión con cliente', async () => {
    // Fecha fija en UTC (no relativa a "ahora" ni al huso horario de quien
    // corre el test) - calcularDiasDesde ya está probado a fondo aparte;
    // acá solo se verifica que el panel muestre lo que esa función calcula.
    const fechaReunion = '2026-08-25T10:00:00Z'
    const prospecto = { id: 'pros-5', nombre: 'DG 2026', estado: '6A - En producción' }
    mockUseData({ prospectos: [prospecto] })
    mockServiciosCronograma({
      actividades: [],
      reuniones: new Map([['pros-5', fechaReunion]])
    })

    const esperado = cronogramaService.calcularDiasDesde(fechaReunion, prospecto.inicio_servicio)

    const { container } = render(<Cronograma />)
    await waitFor(() => {
      const item = container.querySelector('.compliance-item')
      expect(item.querySelector('.p-days')).toHaveTextContent(`${esperado}d`)
    })
  })

  test('sin ninguna reunión registrada, muestra los días desde el inicio de servicio (fallback de la fórmula real)', async () => {
    const inicioServicio = moment.utc().subtract(10, 'days').format('YYYY-MM-DD')
    const prospecto = { id: 'pros-6', nombre: 'Sin Reuniones', estado: '6A - En producción', inicio_servicio: inicioServicio }
    mockUseData({ prospectos: [prospecto] })
    mockServiciosCronograma({ actividades: [] }) // reuniones: Map vacío por defecto

    const esperado = cronogramaService.calcularDiasDesde(undefined, inicioServicio)

    const { container } = render(<Cronograma />)
    await waitFor(() => {
      const item = container.querySelector('.compliance-item')
      expect(item.querySelector('.p-days')).toHaveTextContent(`${esperado}d`)
    })
  })

  test('por defecto ordena el panel de saldo de horas de más negativo a más positivo', async () => {
    // Mismo hs_mensuales/inicio_servicio (misma base "horas teóricas") en
    // los tres, así el orden del saldo es exactamente el orden de las
    // horas dedicadas que se le asigna a cada uno.
    const inicioServicio = moment().subtract(4, 'weeks').format('YYYY-MM-DD')
    mockUseData({
      prospectos: [
        { id: 'p-alto', nombre: 'Saldo Alto', estado: '6A - En producción', hs_mensuales: 10, inicio_servicio: inicioServicio },
        { id: 'p-medio', nombre: 'Saldo Medio Negativo', estado: '6A - En producción', hs_mensuales: 10, inicio_servicio: inicioServicio },
        { id: 'p-bajo', nombre: 'Saldo Muy Negativo', estado: '6A - En producción', hs_mensuales: 10, inicio_servicio: inicioServicio }
      ]
    })
    mockServiciosCronograma({
      horasDedicadas: new Map([
        ['p-alto', 100],
        ['p-medio', 5],
        ['p-bajo', 0]
      ])
    })

    const { container } = render(<Cronograma />)
    await waitFor(() => {
      const nombres = [...container.querySelectorAll('.compliance-item .p-name')].map(el => el.textContent)
      expect(nombres).toEqual(['Saldo Muy Negativo', 'Saldo Medio Negativo', 'Saldo Alto'])
    })
  })

  test('un clic en el encabezado "Saldo" invierte el orden del panel', async () => {
    const inicioServicio = moment().subtract(4, 'weeks').format('YYYY-MM-DD')
    mockUseData({
      prospectos: [
        { id: 'p-alto', nombre: 'Saldo Alto', estado: '6A - En producción', hs_mensuales: 10, inicio_servicio: inicioServicio },
        { id: 'p-bajo', nombre: 'Saldo Bajo', estado: '6A - En producción', hs_mensuales: 10, inicio_servicio: inicioServicio }
      ]
    })
    mockServiciosCronograma({
      horasDedicadas: new Map([
        ['p-alto', 100],
        ['p-bajo', 0]
      ])
    })

    const { container } = render(<Cronograma />)
    await waitFor(() => {
      const nombres = [...container.querySelectorAll('.compliance-item .p-name')].map(el => el.textContent)
      expect(nombres).toEqual(['Saldo Bajo', 'Saldo Alto'])
    })

    fireEvent.click(screen.getByRole('button', { name: /Saldo/ }))

    await waitFor(() => {
      const nombres = [...container.querySelectorAll('.compliance-item .p-name')].map(el => el.textContent)
      expect(nombres).toEqual(['Saldo Alto', 'Saldo Bajo'])
    })
  })

  test('por defecto no ordena por días, pero un clic en el encabezado "Días" sí lo hace (más días primero)', async () => {
    mockUseData({
      prospectos: [
        { id: 'p-reciente', nombre: 'Vio Hace Poco', estado: '6A - En producción' },
        { id: 'p-viejo', nombre: 'No Lo Vemos Hace Rato', estado: '6A - En producción' }
      ]
    })
    mockServiciosCronograma({
      actividades: [],
      reuniones: new Map([
        ['p-reciente', moment().subtract(2, 'days').format()],
        ['p-viejo', moment().subtract(40, 'days').format()]
      ])
    })

    const { container } = render(<Cronograma />)
    // Por defecto se ordena por saldo (ambos null acá), así que el orden
    // de días todavía no cambió respecto al orden original de carga.
    await waitFor(() => {
      expect(container.querySelectorAll('.compliance-item').length).toBe(2)
    })

    fireEvent.click(screen.getByRole('button', { name: /Días/ }))

    // Primer clic en "Días" ordena descendente por defecto: el que hace
    // más tiempo que no se ve (más urgente) queda arriba.
    await waitFor(() => {
      const nombres = [...container.querySelectorAll('.compliance-item .p-name')].map(el => el.textContent)
      expect(nombres).toEqual(['No Lo Vemos Hace Rato', 'Vio Hace Poco'])
    })

    fireEvent.click(screen.getByRole('button', { name: /Días/ }))

    await waitFor(() => {
      const nombres = [...container.querySelectorAll('.compliance-item .p-name')].map(el => el.textContent)
      expect(nombres).toEqual(['Vio Hace Poco', 'No Lo Vemos Hace Rato'])
    })
  })

  // ─── Tests de la barra de filtros (ahora arriba, no en un panel lateral) ───

  test('los filtros de fecha/personal/prospectos aparecen en una barra arriba del calendario, no en un panel lateral izquierdo', () => {
    const { container } = render(<Cronograma />)
    expect(container.querySelector('.cronograma-sidebar.left')).toBeNull()
    expect(container.querySelector('.cronograma-filtros-bar')).not.toBeNull()
    expect(screen.getByLabelText('Desde')).toBeInTheDocument()
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument()
  })

  test('el rango de fechas arranca en una ventana móvil de los últimos 3 meses (hoy - 3 meses .. hoy)', () => {
    render(<Cronograma />)
    expect(screen.getByLabelText('Desde')).toHaveValue(moment().subtract(3, 'months').format('YYYY-MM-DD'))
    expect(screen.getByLabelText('Hasta')).toHaveValue(moment().format('YYYY-MM-DD'))
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
      let listaActual = [...ACTIVIDADES_MOCK]
      cronogramaService.getActividadesEnRango.mockImplementation(() => Promise.resolve(listaActual))

      let resolverGuardado
      cronogramaService.saveActividad.mockImplementation(() => new Promise(resolve => { resolverGuardado = resolve }))

      render(<Cronograma />)
      await esperarCargaInicial()

      fireEvent.click(screen.getByTitle('Nueva Actividad'))
      await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
      await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')
      fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'), { target: { value: 'x'.repeat(60) } })
      fireEvent.click(screen.getByText('Confirmar'))

      // El modal se cierra y el evento nuevo ya aparece SIN que saveActividad
      // se haya resuelto todavía (la promesa sigue pendiente acá).
      await waitFor(() => {
        expect(screen.queryByText('Nueva Actividad')).not.toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getAllByTestId(/^event-/)).toHaveLength(3)
      })

      // Se resuelve el guardado real: la reconciliación en segundo plano
      // (cargarCronograma) vuelve a pedir los datos, que ahora incluyen la
      // fila real guardada. No debe duplicarse el evento.
      const nuevaReal = {
        id: 'real-id-3', prospecto_id: 'pros-1', descripcion: '',
        inicio: moment().format(), fin: moment().add(1, 'hour').format(), responsable_id: 'col-1'
      }
      listaActual = [...ACTIVIDADES_MOCK, nuevaReal]
      resolverGuardado(nuevaReal)

      await waitFor(() => {
        expect(screen.getAllByTestId(/^event-/)).toHaveLength(3)
      })
    })

    test('si falla el guardado optimista de una nueva actividad, la saca del calendario y avisa con un toast', async () => {
      let rechazarGuardado
      cronogramaService.saveActividad.mockImplementation(() => new Promise((resolve, reject) => { rechazarGuardado = reject }))

      render(<Cronograma />)
      await esperarCargaInicial()

      fireEvent.click(screen.getByTitle('Nueva Actividad'))
      await elegirEnRS(screen.getByLabelText('Prospecto / Cliente'), 'Escobar')
      await elegirEnRS(screen.getByLabelText('Responsable Asignado'), 'Ana López')
      fireEvent.change(screen.getByPlaceholderText('¿Qué se va a realizar?'), { target: { value: 'x'.repeat(60) } })
      fireEvent.click(screen.getByText('Confirmar'))

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
      await esperarCargaInicial()
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
      await esperarCargaInicial()
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

  // ─── Botón Teams: elegir sala ──────────────────────────────────────────────

  describe('Botón Teams', () => {
    test('al hacer click despliega las dos salas', async () => {
      render(<Cronograma />)
      await esperarCargaInicial()

      expect(screen.queryByText('Sala Adrian')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Teams/ }))

      expect(screen.getByText('Sala Adrian')).toBeInTheDocument()
      expect(screen.getByText('Sala Renata')).toBeInTheDocument()
    })

    test('"Sala Adrian" abre el link de Adrian en una pestaña nueva', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {})
      render(<Cronograma />)
      await esperarCargaInicial()

      fireEvent.click(screen.getByRole('button', { name: /Teams/ }))
      fireEvent.click(screen.getByText('Sala Adrian'))

      expect(openSpy).toHaveBeenCalledWith('https://teams.live.com/meet/9383050901412?p=QyyQxYjU3rEeQGYXMe', '_blank')
      // El menú se cierra después de elegir.
      expect(screen.queryByText('Sala Adrian')).not.toBeInTheDocument()
    })

    test('"Sala Renata" abre el link de Renata en una pestaña nueva', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {})
      render(<Cronograma />)
      await esperarCargaInicial()

      fireEvent.click(screen.getByRole('button', { name: /Teams/ }))
      fireEvent.click(screen.getByText('Sala Renata'))

      expect(openSpy).toHaveBeenCalledWith('https://teams.live.com/meet/9392993299338?p=h1MiJvj4Jyym4VfsWO', '_blank')
    })

    test('click afuera cierra el desplegable sin abrir ninguna sala', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {})
      render(<Cronograma />)
      await esperarCargaInicial()

      fireEvent.click(screen.getByRole('button', { name: /Teams/ }))
      expect(screen.getByText('Sala Adrian')).toBeInTheDocument()

      fireEvent.mouseDown(document.body)

      expect(screen.queryByText('Sala Adrian')).not.toBeInTheDocument()
      expect(openSpy).not.toHaveBeenCalled()
    })
  })
})

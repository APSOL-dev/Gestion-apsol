import { useState, useEffect, useRef, useMemo } from 'react'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import moment from 'moment'
import 'moment/dist/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import {
  Plus, ChevronLeft, ChevronRight,
  Users, Target, Edit3, X, Video, Trash2, CheckSquare, Square
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import {
  saveActividad, deleteActividad, calcularSaldoHoras, calcularDiasDesde,
  resolverProspectoParaGuardar, resolverActividades,
  getActividadesEnRango, getHorasDedicadasPorProspecto, getUltimasReunionesPorProspecto,
  rangoCronogramaPorDefecto, CATEGORIAS_CRONOGRAMA,
  calcularHastaConDuracion, descripcionCumpleMinimo, DESCRIPCION_MIN_CARACTERES, DURACIONES_RAPIDAS,
  construirEventoReunion, fusionarEventosCalendar, colorDeProspecto,
  HERRAMIENTAS_CRONOGRAMA, normalizarMultiplicador
} from '../services/cronograma'
import { getColaboradoresLista } from '../services/colaboradores'
import { getContactosPorEmpresa } from '../services/contactos'
import { sincronizarEventoReunion, listarEventosCalendar } from '../services/calendario'
import {
  esActividadOcupada, normalizarResponsableEInvitados, colaboradorPuedeEditarActividad
} from '../utils/cronogramaVisibilidad'
import FiltroMultiSelect from '../components/FiltroMultiSelect'

moment.locale('es')
const localizer = momentLocalizer(moment)
const DnDCalendar = (withDragAndDrop.default || withDragAndDrop)(Calendar)

const messages = {
  allDay: 'Todo el día',
  previous: 'Anterior',
  next: 'Siguiente',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'No hay actividades en este rango',
  showMore: total => `+ Ver más (${total})`
}

// Ancho ajustable del panel de saldo de horas (el panel completo) y de su
// columna "Prospecto" (la distribución interna). Ambos se persisten para
// que cada usuario configure una vez cómo prefiere verlo.
const ANCHO_PANEL_SALDO_MIN = 280
const ANCHO_PANEL_SALDO_MAX = 560
const ANCHO_PANEL_SALDO_DEFAULT = 320
const CLAVE_ANCHO_PANEL_SALDO = 'apsol_cronograma_saldo_panel_width'

function leerAnchoPanelSaldoGuardado() {
  const guardado = Number(localStorage.getItem(CLAVE_ANCHO_PANEL_SALDO))
  if (guardado >= ANCHO_PANEL_SALDO_MIN && guardado <= ANCHO_PANEL_SALDO_MAX) return guardado
  return ANCHO_PANEL_SALDO_DEFAULT
}

// Ancho de todo lo que NO es la columna "Prospecto" dentro de una fila:
// padding del panel (24px x2) + padding de la fila (8px x2) + columna
// Saldo (48px) + columna Días (40px). Se usa para que el máximo de la
// columna "Prospecto" escale con el ancho del panel en vez de quedar fijo.
const ANCHO_NO_NOMBRE_FIJO = 152

const ANCHO_COL_NOMBRE_MIN = 70
const ANCHO_COL_NOMBRE_ABS_MAX = 400 // techo de sanidad ante un valor corrupto en localStorage
const ANCHO_COL_NOMBRE_DEFAULT = 110
const CLAVE_ANCHO_COL_NOMBRE = 'apsol_cronograma_saldo_col_nombre_width'

function leerAnchoColNombreGuardado() {
  const guardado = Number(localStorage.getItem(CLAVE_ANCHO_COL_NOMBRE))
  if (guardado >= ANCHO_COL_NOMBRE_MIN && guardado <= ANCHO_COL_NOMBRE_ABS_MAX) return guardado
  return ANCHO_COL_NOMBRE_DEFAULT
}

// FIX Bug #6: Formulario vacío extraído como constante para reusar
const FORM_VACÍO = {
  prospecto_nombre: '',
  inicio: moment().format('YYYY-MM-DDTHH:mm'),
  fin: moment().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
  descripcion: '',
  responsable_id: '',
  reunion_cliente: false,
  link_reunion: '',
  comentarios_reunion: '',
  participantes_ids: [],
  // Herramientas usadas en la actividad (selección múltiple).
  herramientas: [],
  // Multiplicador de horas para el saldo (solo lo edita el administrador).
  // Por defecto 1 = sin ajuste.
  multiplicador: 1,
  notas_multiplicador: '',
  // Emails de contactos del cliente a invitar a la reunión (Google Calendar).
  invitados_externos: [],
  // ID del evento ya creado en Google Calendar (para actualizar/borrar).
  google_calendar_id: null
}

export default function Cronograma() {
  const {
    prospectos, loadingProspectos, refreshProspectos
  } = useData()
  const { user, esColaborador } = useAuth()
  // Lista mínima de colaboradores (id + nombre), NO la ficha completa: un
  // Colaborador por RLS solo ve su propia ficha en apsol_colaboradores, pero
  // necesita la lista para el filtro "Personal" y el selector de invitados.
  const [colaboradores, setColaboradores] = useState([])
  const miColaborador = useMemo(
    () => colaboradores.find(c => c.usuario_id === user?.id) || null,
    [colaboradores, user?.id]
  )
  const [view, setView] = useState(Views.WEEK)
  const [date, setDate] = useState(new Date())

  // FIX Bug #1: Estados para los filtros de fecha.
  // El estándar es una ventana MÓVIL de los últimos 3 meses (de hoy hacia
  // atrás), no el mes calendario en curso — ver rangoCronogramaPorDefecto.
  const [fechaDesde, setFechaDesde] = useState(() => rangoCronogramaPorDefecto().desde)
  const [fechaHasta, setFechaHasta] = useState(() => rangoCronogramaPorDefecto().hasta)

  // El Cronograma maneja su propio estado de actividades (no el global de
  // DataContext): antes se precargaban TODAS las filas de la tabla (4400+
  // y creciendo) en cada login. Ahora se piden 3 recortes chicos y
  // puntuales, acotados a lo que la pantalla realmente necesita:
  //   - actividadesRango: lo que se ve en el calendario (el filtro Desde/Hasta)
  //   - horasDedicadasPorProspecto: horas totales históricas por prospecto
  //     (Map id -> horas), agregadas server-side — el saldo de horas es
  //     acumulado desde el inicio del servicio, no "del mes actual".
  //   - reunionesPorProspecto: la última reunión de cada cliente (Map id -> fecha)
  const [actividadesRango, setActividadesRango] = useState([])
  const [horasDedicadasPorProspecto, setHorasDedicadasPorProspecto] = useState(new Map())
  const [reunionesPorProspecto, setReunionesPorProspecto] = useState(new Map())
  // Eventos leídos del Google Calendar de APSOL (Calendly, agendados a mano
  // desde cualquier lado, etc.) — se muestran como bloques de solo lectura.
  const [eventosCalendar, setEventosCalendar] = useState([])
  // Toggle (solo administrador) para mostrar/ocultar en el calendario los
  // agendamientos que vienen de afuera (Google Calendar de APSOL: Calendly,
  // eventos cargados a mano desde otro dispositivo, etc.).
  const [verAgendaExterna, setVerAgendaExterna] = useState(true)

  const [selectedColab, setSelectedColab] = useState([])
  const [selectedProspectos, setSelectedProspectos] = useState([])

  // Por defecto, el filtro "Personal" arranca con el usuario logueado ya
  // tildado (lo más común es que cada uno quiera ver su propia agenda al
  // entrar) - una sola vez, apenas están disponibles los colaboradores y
  // la sesión. `colabDefaultAplicado` evita que esto se reimponga si el
  // usuario después destilda manualmente el filtro.
  const [colabDefaultAplicado, setColabDefaultAplicado] = useState(false)
  useEffect(() => {
    if (colabDefaultAplicado) return
    if (!user || colaboradores.length === 0) return
    const miColaborador = colaboradores.find(c => c.usuario_id === user.id)
    if (miColaborador) setSelectedColab([miColaborador.id])
    setColabDefaultAplicado(true)
  }, [user, colaboradores, colabDefaultAplicado])

  const [showModal, setShowModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [formData, setFormData] = useState(FORM_VACÍO)
  // Un Colaborador que abre un evento pasado hace más de 2 días hábiles lo
  // ve en SOLO LECTURA (no puede editar ni borrar). Un admin nunca.
  const [soloLectura, setSoloLectura] = useState(false)
  // Contactos de la empresa del prospecto elegido, para invitar a la reunión.
  const [contactosEmpresa, setContactosEmpresa] = useState([])

  // Invitados posibles: solo usuarios REALES del sistema que estén activos
  // (tienen cuenta de login = usuario_id), nunca el propio responsable.
  const opcionesInvitados = useMemo(
    () => colaboradores
      .filter(c => c.usuario_id && c.activo && c.id !== formData.responsable_id)
      .map(c => ({ value: c.id, label: `${c.nombre} ${c.apellido || ''}`.trim() })),
    [colaboradores, formData.responsable_id]
  )

  // Opciones del selector de responsable (cualquier colaborador; un
  // colaborador no lo elige, siempre es él mismo — ver más abajo).
  const opcionesResponsable = useMemo(
    () => colaboradores.map(c => ({ value: c.id, label: `${c.nombre} ${c.apellido || ''}`.trim() })),
    [colaboradores]
  )

  const opcionesHerramientas = useMemo(
    () => HERRAMIENTAS_CRONOGRAMA.map(h => ({ value: h, label: h })),
    []
  )

  // Estilos compartidos por los 3 react-select del modal (portal por
  // encima del overlay del modal).
  const rsProps = {
    classNamePrefix: 'rs',
    menuPortalTarget: typeof document !== 'undefined' ? document.body : undefined,
    styles: { menuPortal: base => ({ ...base, zIndex: 10000 }) }
  }

  // FIX Bug #10: Sistema de notificaciones (reemplaza alert)
  const [toast, setToast] = useState(null)

  const [anchoPanelSaldo, setAnchoPanelSaldo] = useState(leerAnchoPanelSaldoGuardado)
  const anchoPanelSaldoRef = useRef(anchoPanelSaldo)

  const [anchoColNombre, setAnchoColNombre] = useState(leerAnchoColNombreGuardado)
  const anchoColNombreRef = useRef(anchoColNombre)

  // El máximo de la columna "Prospecto" escala con el ancho del panel: si
  // el usuario agranda todo el panel, también gana margen para agrandar
  // esta columna (antes quedaba fija en 180px sin importar el panel).
  const anchoColNombreMax = Math.max(ANCHO_COL_NOMBRE_MIN, anchoPanelSaldo - ANCHO_NO_NOMBRE_FIJO)
  const anchoColNombreAplicado = Math.min(anchoColNombre, anchoColNombreMax)

  function iniciarResizePanelSaldo(e) {
    e.preventDefault()
    const anchoInicial = anchoPanelSaldo
    const xInicial = e.clientX

    function onMouseMove(ev) {
      // El panel está pegado al borde derecho: arrastrar hacia la
      // izquierda (clientX menor) debe agrandarlo.
      const delta = xInicial - ev.clientX
      const nuevoAncho = Math.min(ANCHO_PANEL_SALDO_MAX, Math.max(ANCHO_PANEL_SALDO_MIN, anchoInicial + delta))
      anchoPanelSaldoRef.current = nuevoAncho
      setAnchoPanelSaldo(nuevoAncho)
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      localStorage.setItem(CLAVE_ANCHO_PANEL_SALDO, String(anchoPanelSaldoRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function iniciarResizeColNombre(e) {
    e.preventDefault()
    const anchoInicial = anchoColNombreAplicado
    const xInicial = e.clientX
    const maximoActual = anchoColNombreMax

    function onMouseMove(ev) {
      const delta = ev.clientX - xInicial
      const nuevoAncho = Math.min(maximoActual, Math.max(ANCHO_COL_NOMBRE_MIN, anchoInicial + delta))
      anchoColNombreRef.current = nuevoAncho
      setAnchoColNombre(nuevoAncho)
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      localStorage.setItem(CLAVE_ANCHO_COL_NOMBRE, String(anchoColNombreRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  useEffect(() => {
    refreshProspectos(prospectos.length > 0)
    getColaboradoresLista()
      .then(setColaboradores)
      .catch(err => console.error('Error al cargar la lista de colaboradores:', err))
  }, [])

  // Recarga las 3 consultas acotadas. `silencioso` no cambia nada visible
  // hoy (no hay spinner propio del calendario), pero se mantiene el patrón
  // para no bloquear la UI durante la reconciliación en segundo plano tras
  // guardar/borrar/mover una actividad.
  async function cargarCronograma() {
    const desde = moment(fechaDesde).startOf('day').toISOString()
    const hasta = moment(fechaHasta).endOf('day').toISOString()
    try {
      const [rango, horasDedicadas, reuniones] = await Promise.all([
        getActividadesEnRango(desde, hasta),
        getHorasDedicadasPorProspecto(),
        getUltimasReunionesPorProspecto()
      ])
      setActividadesRango(rango)
      setHorasDedicadasPorProspecto(horasDedicadas)
      setReunionesPorProspecto(reuniones)
    } catch (err) {
      console.error('Error al cargar el cronograma:', err)
    }
    // Eventos del Google Calendar de APSOL en el mismo rango — best-effort:
    // si la función/Calendar no responde, el cronograma se ve igual.
    // Solo el administrador ve la agenda externa; para un colaborador ni
    // siquiera se pide.
    if (esColaborador) {
      setEventosCalendar([])
    } else {
      try {
        setEventosCalendar(await listarEventosCalendar(desde, hasta))
      } catch (err) {
        console.error('Error al leer el Google Calendar:', err)
      }
    }
  }

  useEffect(() => {
    cargarCronograma()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta])

  // Prospecto elegido en el modal (por nombre) y su empresa, para traer los
  // contactos que se pueden invitar a la reunión.
  const prospectoSeleccionado = prospectos.find(p => p.nombre === formData.prospecto_nombre) || null
  const empresaIdReunion = prospectoSeleccionado?.empresa_id || null

  // Trae los contactos de la empresa del prospecto solo cuando el modal está
  // en modo "reunión con cliente" y hay empresa; si no, limpia la lista.
  useEffect(() => {
    if (!showModal || !formData.reunion_cliente || !empresaIdReunion) {
      setContactosEmpresa([])
      return
    }
    let vigente = true
    getContactosPorEmpresa(empresaIdReunion)
      .then(cs => { if (vigente) setContactosEmpresa(cs || []) })
      .catch(err => console.error('Error al cargar contactos de la empresa:', err))
    return () => { vigente = false }
  }, [showModal, formData.reunion_cliente, empresaIdReunion])

  function mostrarToast(mensaje, tipo = 'error') {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // Filtrar prospectos en producción
  const prospectosProduccion = prospectos.filter(p => p.estado === '6A - En producción')

  // Opciones del selector "Prospecto / Cliente": prospectos EN PRODUCCIÓN +
  // categorías internas fijas, deduplicadas (por si un prospecto se llama
  // igual que una categoría).
  const opcionesProspecto = [...new Set([
    ...prospectosProduccion.map(p => p.nombre),
    ...CATEGORIAS_CRONOGRAMA
  ])].map(nombre => ({ value: nombre, label: nombre }))

  // Opciones de invitados externos = contactos con email de esa empresa.
  const opcionesContactosCliente = useMemo(
    () => (contactosEmpresa || [])
      .filter(c => c.email)
      .map(c => ({
        value: c.email.trim().toLowerCase(),
        label: `${`${c.nombre || ''} ${c.apellido || ''}`.trim() || c.email} — ${c.email}`
      })),
    [contactosEmpresa]
  )

  // `cronograma.prospecto_id` es la columna real (FK); acá se resuelve a un
  // `prospecto_nombre` de solo lectura para el resto del componente (título
  // de eventos, filtros, saldo de horas). Las filas sin prospecto real
  // (categorías internas como "Consultora") traen la categoría codificada
  // como prefijo "[Categoría] " en la descripción — ver resolverActividades.
  const actividadesRangoResueltas = useMemo(
    () => resolverActividades(actividadesRango, prospectos),
    [actividadesRango, prospectos]
  )
  // Orden del panel "Saldo de Horas": se puede ordenar por Saldo o por Días
  // haciendo clic en el encabezado correspondiente. Cada columna arranca,
  // la primera vez que se clickea, mostrando arriba lo que más urge
  // revisar: saldo más negativo primero (ascendente), días desde la
  // última reunión más alto primero (descendente, "hace más que no lo
  // vemos"). Clics siguientes sobre la misma columna invierten el orden.
  // Los valores null (sin saldo/sin reuniones registradas) quedan siempre
  // al final, sin importar la columna o el sentido elegido.
  const [ordenColumna, setOrdenColumna] = useState('saldo')
  const [ordenAsc, setOrdenAsc] = useState(true)

  function ordenarPor(campo, ascendentePorDefecto) {
    if (ordenColumna === campo) {
      setOrdenAsc(prev => !prev)
    } else {
      setOrdenColumna(campo)
      setOrdenAsc(ascendentePorDefecto)
    }
  }

  const prospectosConSaldo = useMemo(() => {
    return prospectosProduccion
      .map(p => ({
        prospecto: p,
        saldo: calcularSaldoHoras(p, horasDedicadasPorProspecto.get(p.id)),
        dias: calcularDiasDesde(reunionesPorProspecto.get(p.id), p.inicio_servicio)
      }))
      .sort((a, b) => {
        const va = a[ordenColumna]
        const vb = b[ordenColumna]
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        return ordenAsc ? va - vb : vb - va
      })
  }, [prospectosProduccion, horasDedicadasPorProspecto, reunionesPorProspecto, ordenColumna, ordenAsc])

  // Color por prospecto: estable y distinto para cada nombre, así se nota
  // el corte entre un bloque y el siguiente en el calendario (ver
  // colorDeProspecto en services/cronograma).
  const getColor = colorDeProspecto

  // FIX Bug #2 + #3: Los filtros de personal/prospecto conectados a los
  // eventos del calendario. El rango de fechas ya lo acota el servidor
  // (actividadesRango), no hace falta re-filtrarlo acá.
  const eventsApp = actividadesRangoResueltas
    .filter(act => {
      if (selectedColab.length > 0) {
        if (!act.responsable_id) return false
        if (!selectedColab.includes(act.responsable_id)) return false
      }

      if (selectedProspectos.length > 0) {
        const prospecto = prospectos.find(p => p.nombre === act.prospecto_nombre)
        if (!prospecto || !selectedProspectos.includes(prospecto.id)) return false
      }

      return true
    })
    .map(act => {
      const respName = act.responsable_nombre || (act.responsable?.usuarios?.nombre ? `${act.responsable.usuarios.nombre} ${act.responsable.usuarios.apellido || ''}` : '')
      // Bloque "Ocupado": reunión de un admin que este usuario no puede ver
      // en detalle (la RPC ya la redactó). Solo muestra que la franja está tomada.
      const ocupado = esActividadOcupada(act)
      return {
        id: act.id,
        title: ocupado ? 'Ocupado' : `${act.prospecto_nombre}${respName ? ' - ' + respName : ''}`,
        start: new Date(act.inicio),
        end: new Date(act.fin),
        resource: act,
        ocupado
      }
    })

  // Eventos del Google Calendar (Calendly, agendados a mano) — solo lectura.
  // Solo el administrador los ve, y solo con el toggle "Agenda externa"
  // activo. No tienen prospecto: se ocultan también si hay filtro de
  // prospectos aplicado.
  const mostrarAgendaExterna = !esColaborador && verAgendaExterna
  const eventosDeCalendar = (mostrarAgendaExterna
    ? fusionarEventosCalendar(eventosCalendar, actividadesRangoResueltas)
    : [])
    .filter(() => selectedProspectos.length === 0)
    .map(ev => ({
      id: ev.id,
      title: `📅 ${ev.prospecto_nombre}`,
      start: new Date(ev.inicio),
      end: new Date(ev.fin),
      resource: ev,
      origenCalendar: true
    }))

  const events = [...eventsApp, ...eventosDeCalendar]

  const eventPropGetter = (event) => {
    if (event.origenCalendar) {
      return {
        className: 'rbc-event-premium rbc-event-gcal',
        style: {
          backgroundColor: '#475569',
          borderLeft: '4px solid #1e293b',
          opacity: 0.92,
        }
      }
    }
    return {
      className: `rbc-event-premium${event.ocupado ? ' rbc-event-ocupado' : ''}`,
      style: event.ocupado
        ? { backgroundColor: '#94a3b8', borderLeft: '4px solid rgba(0,0,0,0.2)', opacity: 0.85, cursor: 'default' }
        : {
            backgroundColor: getColor(event.resource.prospecto_nombre),
            borderLeft: `4px solid rgba(0,0,0,0.2)`
          }
    }
  }

  // FIX Bug #5: Navegación respeta la vista activa
  const unidadNavegacion = view === Views.DAY ? 'day' : view === Views.MONTH ? 'month' : 'week'

  // FIX Bug #5: Etiqueta de fecha correcta según la vista activa
  const labelFechaActual = () => {
    if (view === Views.DAY) return moment(date).format('dddd D [de] MMMM YYYY')
    if (view === Views.MONTH) return moment(date).format('MMMM YYYY')
    const inicio = moment(date).startOf('week')
    const fin = moment(date).endOf('week')
    if (inicio.month() === fin.month()) {
      return `${inicio.format('D')} - ${fin.format('D [de] MMMM YYYY')}`
    }
    return `${inicio.format('D MMM')} - ${fin.format('D MMM YYYY')}`
  }

  const handleSelectSlot = ({ start, end }) => {
    setFormData({
      ...FORM_VACÍO,
      inicio: moment(start).format('YYYY-MM-DDTHH:mm'),
      fin: moment(end).format('YYYY-MM-DDTHH:mm'),
      // Un colaborador siempre se agenda a sí mismo.
      responsable_id: esColaborador && miColaborador ? miColaborador.id : ''
    })
    setSelectedEvent(null)
    setSoloLectura(false)
    setShowModal(true)
  }

  function abrirModalNuevo() {
    setFormData(FORM_VACÍO)
    setSelectedEvent(null)
    setSoloLectura(false)
    setShowModal(true)
  }

  const handleSelectEvent = (event) => {
    const act = event.resource
    // Evento traído del Google Calendar: solo lectura, se abre en Google.
    if (event.origenCalendar) {
      if (act?.htmlLink) window.open(act.htmlLink, '_blank', 'noopener')
      return
    }
    // Un bloque "Ocupado" (reunión de un admin sin permiso de ver detalle) no
    // se abre: no hay nada que mostrar ni editar.
    if (esActividadOcupada(act)) {
      mostrarToast('Esa franja está ocupada. No tenés permiso para ver el detalle.', 'info')
      return
    }
    setFormData({
      id: act.id,
      prospecto_nombre: act.prospecto_nombre,
      inicio: moment(act.inicio).format('YYYY-MM-DDTHH:mm'),
      fin: moment(act.fin).format('YYYY-MM-DDTHH:mm'),
      descripcion: act.descripcion || '',
      responsable_id: act.responsable_id || '',
      reunion_cliente: act.reunion_cliente || false,
      link_reunion: act.link_reunion || '',
      comentarios_reunion: act.comentarios_reunion || '',
      participantes_ids: Array.isArray(act.participantes_ids) ? act.participantes_ids : [],
      herramientas: Array.isArray(act.herramientas) ? act.herramientas : [],
      multiplicador: act.multiplicador ?? 1,
      notas_multiplicador: act.notas_multiplicador || '',
      invitados_externos: Array.isArray(act.invitados_externos) ? act.invitados_externos : [],
      google_calendar_id: act.google_calendar_id || null
    })
    // Un Colaborador no puede tocar un evento que terminó hace más de 2 días
    // hábiles: se abre igual pero en solo lectura.
    const bloqueado = esColaborador && !colaboradorPuedeEditarActividad(act.fin)
    if (bloqueado) {
      mostrarToast('Ese evento terminó hace más de 2 días hábiles. Solo un admin puede editarlo.', 'info')
    }
    setSoloLectura(bloqueado)
    setSelectedEvent(event)
    setShowModal(true)
  }

  // Todas las escrituras de acá para abajo son OPTIMISTAS: lo que se ve en
  // el calendario (actividadesRango) se actualiza al toque, antes de que el
  // servidor responda, para que la UI nunca quede esperando un round-trip.
  // Guardó bien o falló, al final siempre se resincroniza en segundo plano
  // contra el servidor (cargarCronograma).
  //
  // El saldo de horas NO se parchea acá a propósito: es un acumulado
  // histórico agregado server-side (getHorasDedicadasPorProspecto), no una
  // lista local — ajustarlo bien optimistamente implicaría recalcular la
  // duración vieja y nueva de la actividad para no contar de más/de menos.
  // Como cargarCronograma() ya se dispara siempre en el finally, el panel
  // de saldo se pone al día en el mismo round-trip que reconcilia todo lo
  // demás — la demora es de un instante, no vale la complejidad extra.

  function perteneceARango(act) {
    return moment(act.inicio).isBetween(moment(fechaDesde).startOf('day'), moment(fechaHasta).endOf('day'), null, '[]')
  }

  function patchLista(setLista, act, id, pertenece) {
    setLista(prev => {
      const yaEstaba = prev.some(a => a.id === id)
      if (pertenece(act)) {
        return yaEstaba ? prev.map(a => a.id === id ? act : a) : [act, ...prev]
      }
      return yaEstaba ? prev.filter(a => a.id !== id) : prev
    })
  }

  function aplicarOptimista(act, id) {
    patchLista(setActividadesRango, act, id, perteneceARango)
    if (act.reunion_cliente && act.prospecto_id) {
      setReunionesPorProspecto(prev => {
        const actual = prev.get(act.prospecto_id)
        if (!actual || act.inicio > actual) {
          const copia = new Map(prev)
          copia.set(act.prospecto_id, act.inicio)
          return copia
        }
        return prev
      })
    }
  }

  function quitarOptimista(id) {
    setActividadesRango(prev => prev.filter(a => a.id !== id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (soloLectura) return
    if (!(formData.prospecto_nombre || '').trim()) {
      mostrarToast('Elegí un prospecto o una categoría.')
      return
    }
    if (moment(formData.fin).isBefore(moment(formData.inicio))) {
      mostrarToast('La fecha y hora de fin no puede ser anterior a la de inicio.')
      return
    }
    if (!descripcionCumpleMinimo(formData.descripcion)) {
      mostrarToast(`La descripción del trabajo necesita al menos ${DESCRIPCION_MIN_CARACTERES} caracteres.`)
      return
    }

    const { prospecto_nombre, descripcion, ...resto } = formData
    const resuelto = resolverProspectoParaGuardar(prospecto_nombre, descripcion, prospectos)
    // Un colaborador siempre queda de responsable y con 1 invitado como máximo.
    const { responsable_id, participantes_ids } = normalizarResponsableEInvitados(
      { responsable_id: resto.responsable_id, participantes_ids: resto.participantes_ids },
      { esColaborador, miColaboradorId: miColaborador?.id }
    )
    const payload = { ...resto, ...resuelto, responsable_id, participantes_ids }

    // Herramientas: lista de strings (o null si no se marcó ninguna).
    payload.herramientas = Array.isArray(payload.herramientas) && payload.herramientas.length
      ? payload.herramientas
      : null

    // Multiplicador y sus notas son SOLO del administrador. Un colaborador
    // que crea deja el default (1); si edita, no se tocan los que ya están.
    if (esColaborador) {
      if (payload.id) {
        delete payload.multiplicador
        delete payload.notas_multiplicador
      } else {
        payload.multiplicador = 1
        payload.notas_multiplicador = null
      }
    } else {
      payload.multiplicador = normalizarMultiplicador(payload.multiplicador)
      payload.notas_multiplicador = (payload.notas_multiplicador || '').trim() || null
    }

    const idOptimista = payload.id || `optimista-${Date.now()}`

    setShowModal(false)
    aplicarOptimista({ ...payload, id: idOptimista }, idOptimista)

    try {
      const guardada = await saveActividad(payload)
      await sincronizarCalendario(payload, guardada)
    } catch (err) {
      // FIX Bug #10: Toast en lugar de alert()
      mostrarToast('No se pudo guardar la actividad. Intentá de nuevo.')
    } finally {
      cargarCronograma()
    }
  }

  // Crea / actualiza / borra el evento de Google Calendar de una "reunión con
  // cliente". Es best-effort: si falla (o la Edge Function no está deployada
  // todavía) avisa con un toast pero NO tira abajo el guardado de la actividad.
  async function sincronizarCalendario(payload, guardada) {
    const idFila = guardada?.id
    const teniaEvento = !!payload.google_calendar_id
    if (!payload.reunion_cliente && !teniaEvento) return
    try {
      if (!payload.reunion_cliente) {
        await sincronizarEventoReunion('borrar', { googleCalendarId: payload.google_calendar_id })
        if (idFila) await saveActividad({ id: idFila, google_calendar_id: null })
        return
      }
      const evento = construirEventoReunion(payload, payload.invitados_externos || [])
      const res = await sincronizarEventoReunion(
        teniaEvento ? 'actualizar' : 'crear',
        { googleCalendarId: payload.google_calendar_id, evento }
      )
      if (res?.id && res.id !== payload.google_calendar_id && idFila) {
        await saveActividad({ id: idFila, google_calendar_id: res.id })
      }
      if (res?.attendeesOmitted) {
        mostrarToast('El evento quedó en el calendario de APSOL, pero Google no dejó agregar a los invitados automáticamente. Los emails quedaron en la descripción del evento — compartiles el link vos.', 'info')
      }
    } catch (err) {
      mostrarToast('La actividad se guardó, pero no se pudo sincronizar el evento en Google Calendar.', 'info')
    }
  }

  // FIX Bug #7: Nueva función para eliminar la actividad
  async function handleDelete() {
    if (soloLectura) return
    if (!confirm('¿Seguro que querés eliminar esta actividad?')) return
    const idBorrado = formData.id
    const eventoCalendar = formData.google_calendar_id

    setShowModal(false)
    quitarOptimista(idBorrado)

    try {
      await deleteActividad(idBorrado)
      if (eventoCalendar) {
        try {
          await sincronizarEventoReunion('borrar', { googleCalendarId: eventoCalendar })
        } catch (err) {
          mostrarToast('Se borró la actividad, pero no el evento en Google Calendar.', 'info')
        }
      }
    } catch (err) {
      mostrarToast('No se pudo eliminar la actividad. Intentá de nuevo.')
    } finally {
      cargarCronograma()
    }
  }

  const moveEvent = async ({ event, start, end }) => {
    if (event.ocupado || event.origenCalendar) return
    const anterior = event.resource
    const resuelto = resolverProspectoParaGuardar(anterior.prospecto_nombre, anterior.descripcion, prospectos)
    const updatedAct = {
      ...anterior,
      ...resuelto,
      inicio: moment(start).toISOString(),
      fin: moment(end).toISOString()
    }

    aplicarOptimista(updatedAct, anterior.id)

    try {
      await saveActividad(updatedAct)
    } catch (err) {
      // FIX Bug #10: Toast en lugar de alert()
      mostrarToast('No se pudo mover la actividad. Intentá de nuevo.')
    } finally {
      cargarCronograma()
    }
  }

  const resizeEvent = async ({ event, start, end }) => {
    if (event.ocupado || event.origenCalendar) return
    const anterior = event.resource
    const resuelto = resolverProspectoParaGuardar(anterior.prospecto_nombre, anterior.descripcion, prospectos)
    const updatedAct = {
      ...anterior,
      ...resuelto,
      inicio: moment(start).toISOString(),
      fin: moment(end).toISOString()
    }

    aplicarOptimista(updatedAct, anterior.id)

    try {
      await saveActividad(updatedAct)
    } catch (err) {
      // FIX Bug #10: Toast en lugar de alert()
      mostrarToast('No se pudo redimensionar la actividad. Intentá de nuevo.')
    } finally {
      cargarCronograma()
    }
  }

  return (
    <div className="cronograma-layout" style={{ '--ancho-panel-saldo': `${anchoPanelSaldo}px` }}>
      {/* Divisor arrastrable del panel de saldo completo (no solo sus
          columnas internas): abarca todo el alto del layout, pegado al
          borde izquierdo del panel derecho. */}
      <div
        className="panel-resize-handle"
        style={{ right: `${anchoPanelSaldo}px` }}
        onMouseDown={iniciarResizePanelSaldo}
        title="Arrastrá para ajustar el ancho del panel de saldo"
      />

      {/* FIX Bug #10: Sistema de notificaciones */}
      {toast && (
        <div
          role="alert"
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
            background: toast.tipo === 'error' ? '#ef4444' : '#22c55e',
            color: 'white', padding: '12px 20px', borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '14px',
            maxWidth: '320px', lineHeight: '1.4'
          }}
        >
          {toast.mensaje}
        </div>
      )}

      {/* CENTRO: CALENDARIO */}
      <main className="cronograma-main">
        {/* BARRA DE FILTROS (fecha, personal, prospectos) */}
        <header className="cronograma-filtros-bar">
          <div className="filtro-fechas">
            {/* FIX Bug #1: Filtros de fecha conectados a estado */}
            <div className="filter-group">
              <label className="label-plain" htmlFor="filtro-desde">Desde</label>
              <input
                id="filtro-desde"
                type="date"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="label-plain" htmlFor="filtro-hasta">Hasta</label>
              <input
                id="filtro-hasta"
                type="date"
                value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="filtro-multi-group">
            <FiltroMultiSelect
              icon={<Users size={14} />}
              label="Personal"
              options={colaboradores}
              selectedIds={selectedColab}
              onChange={setSelectedColab}
              getLabel={c => `${c.nombre} ${c.apellido || ''}`.trim()}
              emptyMessage="No hay colaboradores para asignar"
            />

            {/* FIX Bug #2: El picker de prospectos existía pero no conectaba al filtro — ahora sí */}
            <FiltroMultiSelect
              icon={<Target size={14} />}
              label="Prospectos"
              options={prospectosProduccion}
              selectedIds={selectedProspectos}
              onChange={setSelectedProspectos}
              emptyMessage="No hay prospectos en producción"
            />

            {/* Solo administrador: mostrar/ocultar los agendamientos externos
                (Google Calendar de APSOL: Calendly, cargados desde otro
                dispositivo, etc.). */}
            {!esColaborador && (
              <button
                type="button"
                className={`filtro-trigger ${verAgendaExterna ? 'active' : ''}`}
                onClick={() => setVerAgendaExterna(v => !v)}
                title="Mostrar u ocultar los eventos que vienen del Google Calendar de APSOL"
              >
                {verAgendaExterna ? <CheckSquare size={14} /> : <Square size={14} />}
                Agenda externa
              </button>
            )}
          </div>
        </header>

        <div className="calendar-container giant">
          <div className="calendar-toolbar">
            <div className="view-switcher">
              <button className={view === Views.DAY ? 'active' : ''} onClick={() => setView(Views.DAY)}>Día</button>
              <button className={view === Views.WEEK ? 'active' : ''} onClick={() => setView(Views.WEEK)}>Semana</button>
              <button className={view === Views.MONTH ? 'active' : ''} onClick={() => setView(Views.MONTH)}>Mes</button>
            </div>

            {/* FIX Bug #5: Navegación respeta la vista activa */}
            <div className="calendar-nav">
              <button className="nav-btn" onClick={() => setDate(moment(date).subtract(1, unidadNavegacion).toDate())}>
                <ChevronLeft size={20} />
              </button>
              <span className="current-range">
                {labelFechaActual()}
              </span>
              <button className="nav-btn" onClick={() => setDate(moment(date).add(1, unidadNavegacion).toDate())}>
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="action-buttons">
              {/* FIX Bug #11: Botón Teams abre teams.microsoft.com */}
              <button
                className="btn-teams"
                title="Ir a Microsoft Teams"
                onClick={() => window.open('https://teams.microsoft.com', '_blank')}
              >
                <Video size={16} /> Teams
              </button>
              {/* FIX Bug #6: Botón + limpia el formulario antes de abrir el modal */}
              <button
                className="btn-add-event"
                onClick={abrirModalNuevo}
                title="Nueva Actividad"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className="rbc-wrapper">
            <DnDCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              toolbar={false}
              messages={messages}
              date={date}
              onNavigate={setDate}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventPropGetter}
              draggableAccessor={(event) => !event.ocupado && !event.origenCalendar}
              resizableAccessor={(event) => !event.ocupado && !event.origenCalendar}
              onEventDrop={moveEvent}
              onEventResize={resizeEvent}
              min={new Date(0, 0, 0, 5, 0, 0)}
              max={new Date(0, 0, 0, 22, 0, 0)}
              formats={{ timeGutterFormat: 'H:mm' }}
            />
          </div>
        </div>
      </main>

      {/* PANEL DERECHO: SALDO DE HORAS POR CLIENTE */}
      <aside className="cronograma-sidebar right">
        <div className="sidebar-section">
          <div className="section-header">
            <h3>Saldo de Horas — Mes Actual</h3>
          </div>

          <div className="compliance-list" style={{ '--ancho-col-nombre': `${anchoColNombreAplicado}px` }}>
            <div
              className="col-resize-handle"
              style={{ left: `${anchoColNombreAplicado}px` }}
              onMouseDown={iniciarResizeColNombre}
              title="Arrastrá para ajustar el ancho de la columna Prospecto"
            />
            <div className="list-header">
              <span>Prospecto</span>
              <button
                type="button"
                className="th-sortable"
                onClick={() => ordenarPor('saldo', true)}
                title={ordenColumna === 'saldo' && !ordenAsc ? 'Ordenando por saldo, de mayor a menor. Clic para invertir.' : 'Ordenando por saldo, de más negativo a más alto. Clic para invertir.'}
              >
                Saldo {ordenColumna === 'saldo' && (ordenAsc ? '▲' : '▼')}
              </button>
              <button
                type="button"
                className="th-sortable"
                onClick={() => ordenarPor('dias', false)}
                title={ordenColumna === 'dias' && ordenAsc ? 'Ordenando por días, de menor a mayor. Clic para invertir.' : 'Ordenando por días desde la última reunión, de más a menos. Clic para invertir.'}
              >
                Días {ordenColumna === 'dias' && (ordenAsc ? '▲' : '▼')}
              </button>
            </div>
            {prospectosConSaldo.length === 0 && (
              <div className="picker-empty">No hay prospectos en producción</div>
            )}
            {prospectosConSaldo.map(({ prospecto: p, saldo, dias }) => {
              return (
                <div key={p.id} className="compliance-item">
                  <span className="p-name">{p.nombre}</span>
                  <span className={`p-saldo ${saldo != null && saldo < 0 ? 'negative' : ''}`}>
                    {saldo != null ? `${saldo.toFixed(2)}h` : '—'}
                  </span>
                  <span className="p-days" title={dias == null ? 'Sin reuniones registradas' : `Hace ${dias} día(s)`}>
                    {dias != null ? `${dias}d` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="details-panel-empty">
          <div className="empty-state-card">
            <Edit3 size={32} strokeWidth={1} />
            <p>Seleccioná una actividad para ver detalles o realizar cambios</p>
          </div>
        </div>
      </aside>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content premium" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedEvent ? 'Editar Actividad' : 'Nueva Actividad'}</h2>
                <p className="modal-subtitle">
                  {soloLectura
                    ? 'Solo lectura — este evento terminó hace más de 2 días hábiles'
                    : 'Completá los datos para agendar en el cronograma'}
                </p>
              </div>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <fieldset className="modal-fieldset" disabled={soloLectura}>
              <div className="form-group">
                <label htmlFor="sel-prospecto">Prospecto / Cliente</label>
                {/* Mismo estilo que Responsable e Invitados. Es "creatable":
                    además de los prospectos en producción y las categorías
                    fijas, se puede tipear una categoría suelta. */}
                <CreatableSelect
                  {...rsProps}
                  inputId="sel-prospecto"
                  isClearable
                  isDisabled={soloLectura}
                  placeholder="Elegí o escribí un prospecto / categoría…"
                  formatCreateLabel={v => `Usar "${v}"`}
                  noOptionsMessage={() => 'Sin coincidencias'}
                  options={opcionesProspecto}
                  value={formData.prospecto_nombre
                    ? { value: formData.prospecto_nombre, label: formData.prospecto_nombre }
                    : null}
                  onChange={sel => setFormData({ ...formData, prospecto_nombre: sel ? sel.value : '' })}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="modal-desde">Desde</label>
                  <input id="modal-desde" type="datetime-local" value={formData.inicio} onChange={e => setFormData({ ...formData, inicio: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="modal-hasta">Hasta</label>
                  <input id="modal-hasta" type="datetime-local" value={formData.fin} onChange={e => setFormData({ ...formData, fin: e.target.value })} />
                </div>
              </div>
              {/* Duración rápida: fija "Hasta" = "Desde" + N horas. */}
              <div className="dur-chips" role="group" aria-label="Duración rápida">
                <span className="dur-chips-label">Duración</span>
                {DURACIONES_RAPIDAS.map(h => (
                  <button
                    key={h}
                    type="button"
                    className="dur-chip"
                    onClick={() => setFormData({ ...formData, fin: calcularHastaConDuracion(formData.inicio, h) })}
                  >
                    {h}h
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label>Descripción del Trabajo</label>
                <textarea
                  value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  rows="3"
                  placeholder="¿Qué se va a realizar?"
                />
                <div className={`desc-counter ${descripcionCumpleMinimo(formData.descripcion) ? '' : 'short'}`}>
                  {formData.descripcion.trim().length} / {DESCRIPCION_MIN_CARACTERES} caracteres · mínimo {DESCRIPCION_MIN_CARACTERES}
                </div>
              </div>

              {/* Herramienta(s) utilizada(s): selección múltiple, mismo estilo
                  que el resto de los selects del modal. */}
              <div className="form-group">
                <label htmlFor="sel-herramientas">Herramienta(s) utilizada(s)</label>
                <Select
                  {...rsProps}
                  inputId="sel-herramientas"
                  isMulti
                  isClearable
                  isDisabled={soloLectura}
                  placeholder="Elegí una o más herramientas…"
                  noOptionsMessage={() => 'Sin más herramientas'}
                  options={opcionesHerramientas}
                  value={opcionesHerramientas.filter(o => (formData.herramientas || []).includes(o.value))}
                  onChange={sel => {
                    const arr = Array.isArray(sel) ? sel : (sel ? [sel] : [])
                    setFormData({ ...formData, herramientas: arr.map(o => o.value) })
                  }}
                />
              </div>

              {/* Multiplicador de horas para el saldo — SOLO administrador.
                  Por defecto 1. Un colaborador ni lo ve. */}
              {!esColaborador && (
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="modal-multiplicador">Multiplicador</label>
                    <input
                      id="modal-multiplicador"
                      type="number"
                      step="0.05"
                      value={formData.multiplicador}
                      onChange={e => setFormData({ ...formData, multiplicador: e.target.value })}
                      onBlur={e => setFormData({ ...formData, multiplicador: normalizarMultiplicador(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="modal-notas-multiplicador">Notas del multiplicador (opcional)</label>
                    <input
                      id="modal-notas-multiplicador"
                      type="text"
                      value={formData.notas_multiplicador}
                      onChange={e => setFormData({ ...formData, notas_multiplicador: e.target.value })}
                      placeholder="Por qué este multiplicador…"
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="sel-responsable">Responsable Asignado</label>
                {esColaborador ? (
                  <input
                    type="text"
                    className="rs-readonly-input"
                    readOnly
                    value={`${miColaborador?.nombre || ''} ${miColaborador?.apellido || ''}`.trim() || 'Vos'}
                    title="Un colaborador solo puede agendarse a sí mismo"
                  />
                ) : (
                  <Select
                    {...rsProps}
                    inputId="sel-responsable"
                    isDisabled={soloLectura}
                    placeholder="Seleccionar responsable…"
                    noOptionsMessage={() => 'Sin colaboradores'}
                    options={opcionesResponsable}
                    value={opcionesResponsable.find(o => o.value === formData.responsable_id) || null}
                    onChange={sel => setFormData({ ...formData, responsable_id: sel ? sel.value : '' })}
                  />
                )}
              </div>

              {/* Invitados: desplegable de búsqueda con SOLO usuarios activos del
                  sistema. Un colaborador puede invitar a 1 (isMulti off); un
                  admin, a varios. */}
              <div className="form-group">
                <label htmlFor="sel-invitados">{esColaborador ? 'Invitado (opcional)' : 'Invitados (opcional)'}</label>
                <Select
                  {...rsProps}
                  inputId="sel-invitados"
                  isMulti={!esColaborador}
                  isClearable
                  isDisabled={soloLectura}
                  placeholder={esColaborador ? 'Elegí un invitado…' : 'Elegí uno o más invitados…'}
                  noOptionsMessage={() => 'No hay usuarios activos para invitar'}
                  options={opcionesInvitados}
                  value={opcionesInvitados.filter(o => formData.participantes_ids.includes(o.value))}
                  onChange={sel => {
                    const arr = Array.isArray(sel) ? sel : (sel ? [sel] : [])
                    setFormData({ ...formData, participantes_ids: arr.map(o => o.value) })
                  }}
                />
              </div>

              {/* FIX Bug #8: Campos de reunión que existían en formData pero nunca se mostraban */}
              <div className="form-group">
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setFormData({ ...formData, reunion_cliente: !formData.reunion_cliente })}
                >
                  {formData.reunion_cliente
                    ? <CheckSquare size={18} style={{ color: 'var(--color-accent, #6366f1)', flexShrink: 0 }} />
                    : <Square size={18} style={{ flexShrink: 0 }} />
                  }
                  ¿Es reunión con el cliente?
                </label>
              </div>

              {formData.reunion_cliente && (
                <>
                  <div className="form-group">
                    <label htmlFor="sel-contactos-cliente">Invitados del cliente (para la reunión)</label>
                    <Select
                      {...rsProps}
                      inputId="sel-contactos-cliente"
                      isMulti
                      isClearable
                      isDisabled={soloLectura || !empresaIdReunion}
                      placeholder={
                        !formData.prospecto_nombre ? 'Elegí primero el prospecto…'
                          : !empresaIdReunion ? 'El prospecto no tiene empresa asociada'
                          : 'Elegí contactos del cliente…'
                      }
                      noOptionsMessage={() => 'Esa empresa no tiene contactos con email'}
                      options={opcionesContactosCliente}
                      value={opcionesContactosCliente.filter(o => formData.invitados_externos.includes(o.value))}
                      onChange={sel => {
                        const arr = Array.isArray(sel) ? sel : (sel ? [sel] : [])
                        setFormData({ ...formData, invitados_externos: arr.map(o => o.value) })
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Link de la Reunión</label>
                    <div className="input-with-icon">
                      <Video size={16} />
                      <input
                        type="url"
                        value={formData.link_reunion}
                        onChange={e => setFormData({ ...formData, link_reunion: e.target.value })}
                        placeholder="https://teams.microsoft.com/..."
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Comentarios de la Reunión</label>
                    <textarea
                      value={formData.comentarios_reunion}
                      onChange={e => setFormData({ ...formData, comentarios_reunion: e.target.value })}
                      rows="2"
                      placeholder="Temas tratados, acuerdos, próximos pasos..."
                    />
                  </div>
                </>
              )}

              </fieldset>

              <div className="modal-footer">
                {/* Botón Eliminar solo en edición y si NO es solo lectura */}
                {selectedEvent && !soloLectura && (
                  <button type="button" className="btn-danger-ghost" onClick={handleDelete}>
                    <Trash2 size={15} /> Eliminar
                  </button>
                )}
                <button type="button" className="btn-sec" onClick={() => setShowModal(false)}>
                  {soloLectura ? 'Cerrar' : 'Cancelar'}
                </button>
                {!soloLectura && (
                  <button type="submit" className="btn-pri">Confirmar</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

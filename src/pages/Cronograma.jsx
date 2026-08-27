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
import {
  saveActividad, deleteActividad, calcularSaldoHoras, calcularDiasDesde,
  resolverProspectoParaGuardar, resolverActividades,
  getActividadesEnRango, getActividadesDelMes, getUltimasReunionesPorProspecto
} from '../services/cronograma'
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
  comentarios_reunion: ''
}

export default function Cronograma() {
  const {
    prospectos, loadingProspectos, refreshProspectos,
    colaboradores, loadingColaboradores, refreshColaboradores
  } = useData()
  const [view, setView] = useState(Views.WEEK)
  const [date, setDate] = useState(new Date())

  // FIX Bug #1: Estados para los filtros de fecha
  const [fechaDesde, setFechaDesde] = useState(moment().startOf('month').format('YYYY-MM-DD'))
  const [fechaHasta, setFechaHasta] = useState(moment().endOf('month').format('YYYY-MM-DD'))

  // El Cronograma maneja su propio estado de actividades (no el global de
  // DataContext): antes se precargaban TODAS las filas de la tabla (4400+
  // y creciendo) en cada login. Ahora se piden 3 recortes chicos y
  // puntuales, acotados a lo que la pantalla realmente necesita:
  //   - actividadesRango: lo que se ve en el calendario (el filtro Desde/Hasta)
  //   - actividadesMes: el mes actual, para el saldo de horas
  //   - reunionesPorProspecto: la última reunión de cada cliente (Map id -> fecha)
  const [actividadesRango, setActividadesRango] = useState([])
  const [actividadesMes, setActividadesMes] = useState([])
  const [reunionesPorProspecto, setReunionesPorProspecto] = useState(new Map())

  const [selectedColab, setSelectedColab] = useState([])
  const [selectedProspectos, setSelectedProspectos] = useState([])

  const [showModal, setShowModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [formData, setFormData] = useState(FORM_VACÍO)

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
    const esSilencioso = prospectos.length > 0 && colaboradores.length > 0
    refreshProspectos(esSilencioso)
    refreshColaboradores(esSilencioso)
  }, [])

  // Recarga las 3 consultas acotadas. `silencioso` no cambia nada visible
  // hoy (no hay spinner propio del calendario), pero se mantiene el patrón
  // para no bloquear la UI durante la reconciliación en segundo plano tras
  // guardar/borrar/mover una actividad.
  async function cargarCronograma() {
    try {
      const desde = moment(fechaDesde).startOf('day').toISOString()
      const hasta = moment(fechaHasta).endOf('day').toISOString()
      const [rango, mes, reuniones] = await Promise.all([
        getActividadesEnRango(desde, hasta),
        getActividadesDelMes(),
        getUltimasReunionesPorProspecto()
      ])
      setActividadesRango(rango)
      setActividadesMes(mes)
      setReunionesPorProspecto(reuniones)
    } catch (err) {
      console.error('Error al cargar el cronograma:', err)
    }
  }

  useEffect(() => {
    cargarCronograma()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta])

  function mostrarToast(mensaje, tipo = 'error') {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // Filtrar prospectos en producción
  const prospectosProduccion = prospectos.filter(p => p.estado === '6A - En producción')

  // `cronograma.prospecto_id` es la columna real (FK); acá se resuelve a un
  // `prospecto_nombre` de solo lectura para el resto del componente (título
  // de eventos, filtros, saldo de horas). Las filas sin prospecto real
  // (categorías internas como "Consultora") traen la categoría codificada
  // como prefijo "[Categoría] " en la descripción — ver resolverActividades.
  const actividadesRangoResueltas = useMemo(
    () => resolverActividades(actividadesRango, prospectos),
    [actividadesRango, prospectos]
  )
  const actividadesMesResueltas = useMemo(
    () => resolverActividades(actividadesMes, prospectos),
    [actividadesMes, prospectos]
  )

  const getColor = (name) => {
    const colors = {
      'Consultora': '#ef4444',
      'Mantenimiento': '#f59e0b',
      'Conexion Market': '#06b6d4',
      'Escobar': '#ec4899',
      'Norte 2025': '#3b82f6',
      'DG 2026': '#8b5cf6',
      'Dia Libre': '#22c55e',
      'Open Pack': '#f43f5e'
    }
    return colors[name] || '#6366f1'
  }

  // FIX Bug #2 + #3: Los filtros de personal/prospecto conectados a los
  // eventos del calendario. El rango de fechas ya lo acota el servidor
  // (actividadesRango), no hace falta re-filtrarlo acá.
  const events = actividadesRangoResueltas
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
      return {
        id: act.id,
        title: `${act.prospecto_nombre}${respName ? ' - ' + respName : ''}`,
        start: new Date(act.inicio),
        end: new Date(act.fin),
        resource: act
      }
    })

  const eventPropGetter = (event) => ({
    className: 'rbc-event-premium',
    style: {
      backgroundColor: getColor(event.resource.prospecto_nombre),
      borderLeft: `4px solid rgba(0,0,0,0.2)`
    }
  })

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
      fin: moment(end).format('YYYY-MM-DDTHH:mm')
    })
    setSelectedEvent(null)
    setShowModal(true)
  }

  const handleSelectEvent = (event) => {
    const act = event.resource
    setFormData({
      id: act.id,
      prospecto_nombre: act.prospecto_nombre,
      inicio: moment(act.inicio).format('YYYY-MM-DDTHH:mm'),
      fin: moment(act.fin).format('YYYY-MM-DDTHH:mm'),
      descripcion: act.descripcion || '',
      responsable_id: act.responsable_id || '',
      reunion_cliente: act.reunion_cliente || false,
      link_reunion: act.link_reunion || '',
      comentarios_reunion: act.comentarios_reunion || ''
    })
    setSelectedEvent(event)
    setShowModal(true)
  }

  // Todas las escrituras de acá para abajo son OPTIMISTAS: los 3 recortes
  // locales se actualizan al toque, antes de que el servidor responda, para
  // que la UI nunca quede esperando un round-trip. Guardó bien o falló, al
  // final siempre se resincroniza en segundo plano contra el servidor
  // (cargarCronograma) — como las 3 consultas ahora son chicas y puntuales
  // (no toda la tabla), hacerlo después de cada cambio sale gratis y evita
  // tener que llevar a mano la lógica de "revertir" ante un error.

  function perteneceARango(act) {
    return moment(act.inicio).isBetween(moment(fechaDesde).startOf('day'), moment(fechaHasta).endOf('day'), null, '[]')
  }
  function perteneceAlMesActual(act) {
    return moment(act.inicio).isBetween(moment().startOf('month'), moment().endOf('month'), null, '[]')
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
    patchLista(setActividadesMes, act, id, perteneceAlMesActual)
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
    setActividadesMes(prev => prev.filter(a => a.id !== id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (moment(formData.fin).isBefore(moment(formData.inicio))) {
      mostrarToast('La fecha y hora de fin no puede ser anterior a la de inicio.')
      return
    }

    const { prospecto_nombre, descripcion, ...resto } = formData
    const resuelto = resolverProspectoParaGuardar(prospecto_nombre, descripcion, prospectos)
    const payload = { ...resto, ...resuelto }
    const idOptimista = payload.id || `optimista-${Date.now()}`

    setShowModal(false)
    aplicarOptimista({ ...payload, id: idOptimista }, idOptimista)

    try {
      await saveActividad(payload)
    } catch (err) {
      // FIX Bug #10: Toast en lugar de alert()
      mostrarToast('No se pudo guardar la actividad. Intentá de nuevo.')
    } finally {
      cargarCronograma()
    }
  }

  // FIX Bug #7: Nueva función para eliminar la actividad
  async function handleDelete() {
    if (!confirm('¿Seguro que querés eliminar esta actividad?')) return
    const idBorrado = formData.id

    setShowModal(false)
    quitarOptimista(idBorrado)

    try {
      await deleteActividad(idBorrado)
    } catch (err) {
      mostrarToast('No se pudo eliminar la actividad. Intentá de nuevo.')
    } finally {
      cargarCronograma()
    }
  }

  const moveEvent = async ({ event, start, end }) => {
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
                onClick={() => { setFormData(FORM_VACÍO); setSelectedEvent(null); setShowModal(true) }}
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
              <span>Saldo</span>
              <span>Días</span>
            </div>
            {prospectosProduccion.length === 0 && (
              <div className="picker-empty">No hay prospectos en producción</div>
            )}
            {prospectosProduccion.map(p => {
              const saldo = calcularSaldoHoras(p, actividadesMesResueltas)
              const dias = calcularDiasDesde(reunionesPorProspecto.get(p.id))
              return (
                <div key={p.id} className="compliance-item">
                  <span className="p-name">{p.nombre}</span>
                  <span className={`p-saldo ${saldo != null && saldo < 0 ? 'negative' : ''}`}>
                    {saldo != null ? `${saldo}h` : '—'}
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
                <p className="modal-subtitle">Completá los datos para agendar en el cronograma</p>
              </div>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Prospecto / Cliente</label>
                <div className="input-with-icon">
                  <Target size={16} />
                  <input
                    list="pros-list"
                    value={formData.prospecto_nombre}
                    onChange={e => setFormData({ ...formData, prospecto_nombre: e.target.value })}
                    placeholder="Escribí para buscar..."
                    required
                  />
                </div>
                <datalist id="pros-list">
                  {prospectosProduccion.map(p => <option key={p.id} value={p.nombre} />)}
                </datalist>
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
              <div className="form-group">
                <label>Descripción del Trabajo</label>
                <textarea
                  value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  rows="3"
                  placeholder="¿Qué se va a realizar?"
                />
              </div>
              <div className="form-group">
                <label>Responsable Asignado</label>
                <div className="input-with-icon">
                  <Users size={16} />
                  <select value={formData.responsable_id} onChange={e => setFormData({ ...formData, responsable_id: e.target.value })} required>
                    <option value="">Seleccionar responsable...</option>
                    {colaboradores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                    ))}
                  </select>
                </div>
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

              <div className="modal-footer">
                {/* FIX Bug #7: Botón Eliminar en modal de edición */}
                {selectedEvent && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    style={{
                      color: '#ef4444', border: '1px solid #ef4444', background: 'transparent',
                      borderRadius: '6px', padding: '8px 14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px',
                      marginRight: 'auto'
                    }}
                  >
                    <Trash2 size={15} /> Eliminar
                  </button>
                )}
                <button type="button" className="btn-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-pri">Confirmar y Agendar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

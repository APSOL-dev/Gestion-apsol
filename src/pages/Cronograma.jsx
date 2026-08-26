import { useState, useEffect, useMemo } from 'react'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import moment from 'moment'
import 'moment/dist/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { 
  Plus, Search, ChevronLeft, ChevronRight, 
  Users, Target, Edit3, X, Video, Trash2, CheckSquare, Square
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { saveActividad, deleteActividad } from '../services/cronograma'

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
    actividades, loadingActividades, refreshActividades, 
    prospectos, loadingProspectos, refreshProspectos, 
    colaboradores, loadingColaboradores, refreshColaboradores 
  } = useData()
  const [view, setView] = useState(Views.WEEK)
  const [date, setDate] = useState(new Date())

  // FIX Bug #1: Estados para los filtros de fecha
  const [fechaDesde, setFechaDesde] = useState(moment().startOf('month').format('YYYY-MM-DD'))
  const [fechaHasta, setFechaHasta] = useState(moment().endOf('month').format('YYYY-MM-DD'))

  // FIX Bug #3: Estado para el buscador
  const [textoBusqueda, setTextoBusqueda] = useState('')

  const [selectedColab, setSelectedColab] = useState([])
  const [selectedProspectos, setSelectedProspectos] = useState([])

  const [showColabPicker, setShowColabPicker] = useState(false)
  const [showProsPicker, setShowProsPicker] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [formData, setFormData] = useState(FORM_VACÍO)

  // FIX Bug #10: Sistema de notificaciones (reemplaza alert)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const esSilencioso = actividades.length > 0 && prospectos.length > 0 && colaboradores.length > 0
    Promise.all([
      refreshActividades(esSilencioso),
      refreshProspectos(esSilencioso),
      refreshColaboradores(esSilencioso)
    ])
  }, [])

  async function loadData() {
    try {
      await Promise.all([
        refreshActividades(true),
        refreshProspectos(true),
        refreshColaboradores(true)
      ])
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
  }

  function mostrarToast(mensaje, tipo = 'error') {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // Filtrar prospectos en producción
  const prospectosProduccion = prospectos.filter(p => p.estado === '6A - En producción')

  // FIX Bug #4: Calcular horas reales por prospecto en el mes actual (reemplaza Math.random)
  const horasPorProspecto = useMemo(() => {
    const desde = moment().startOf('month')
    const hasta = moment().endOf('month')
    const map = {}
    actividades.forEach(act => {
      const inicio = moment(act.inicio)
      if (inicio.isBetween(desde, hasta, null, '[]')) {
        const horas = parseFloat(moment(act.fin).diff(moment(act.inicio), 'hours', true).toFixed(1))
        map[act.prospecto_nombre] = (map[act.prospecto_nombre] || 0) + horas
      }
    })
    return map
  }, [actividades])

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

  // FIX Bug #1 + #2 + #3: Los tres filtros conectados a los eventos del calendario
  const events = actividades
    .filter(act => {
      // Filtro por rango de fechas
      if (fechaDesde && moment(act.inicio).isBefore(moment(fechaDesde).startOf('day'))) return false
      if (fechaHasta && moment(act.fin).isAfter(moment(fechaHasta).endOf('day'))) return false

      // Filtro por colaborador seleccionado
      if (selectedColab.length > 0) {
        if (!act.responsable_id) return false
        if (!selectedColab.includes(act.responsable_id)) return false
      }

      // FIX Bug #2: Filtro por prospecto seleccionado (antes no se usaba)
      if (selectedProspectos.length > 0) {
        const prospecto = prospectos.find(p => p.nombre === act.prospecto_nombre)
        if (!prospecto || !selectedProspectos.includes(prospecto.id)) return false
      }

      // FIX Bug #3: Filtro por texto de búsqueda (antes no existía)
      if (textoBusqueda) {
        const texto = textoBusqueda.toLowerCase()
        const coincide =
          act.prospecto_nombre?.toLowerCase().includes(texto) ||
          act.descripcion?.toLowerCase().includes(texto)
        if (!coincide) return false
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (moment(formData.fin).isBefore(moment(formData.inicio))) {
      mostrarToast('La fecha y hora de fin no puede ser anterior a la de inicio.')
      return
    }
    try {
      await saveActividad(formData)
      setShowModal(false)
      loadData()
    } catch (err) {
      // FIX Bug #10: Toast en lugar de alert()
      mostrarToast('No se pudo guardar la actividad. Intentá de nuevo.')
    }
  }

  // FIX Bug #7: Nueva función para eliminar la actividad
  async function handleDelete() {
    if (!confirm('¿Seguro que querés eliminar esta actividad?')) return
    try {
      await deleteActividad(formData.id)
      setShowModal(false)
      loadData()
    } catch (err) {
      mostrarToast('No se pudo eliminar la actividad. Intentá de nuevo.')
    }
  }

  const moveEvent = async ({ event, start, end }) => {
    try {
      const updatedAct = {
        ...event.resource,
        inicio: moment(start).toISOString(),
        fin: moment(end).toISOString()
      }
      await saveActividad(updatedAct)
      loadData()
    } catch (err) {
      // FIX Bug #10: Toast en lugar de alert()
      mostrarToast('No se pudo mover la actividad. Intentá de nuevo.')
    }
  }

  const resizeEvent = async ({ event, start, end }) => {
    try {
      const updatedAct = {
        ...event.resource,
        inicio: moment(start).toISOString(),
        fin: moment(end).toISOString()
      }
      await saveActividad(updatedAct)
      loadData()
    } catch (err) {
      // FIX Bug #10: Toast en lugar de alert()
      mostrarToast('No se pudo redimensionar la actividad. Intentá de nuevo.')
    }
  }

  return (
    <div className="cronograma-layout">
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

      {/* PANEL IZQUIERDO: FILTROS */}
      <aside className="cronograma-sidebar left">
        <div className="sidebar-section-refined">
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
          <div className="filter-group" style={{ marginTop: '16px' }}>
            <label className="label-plain" htmlFor="filtro-hasta">Hasta</label>
            <input
              id="filtro-hasta"
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
            />
          </div>

          <div className="filter-group" style={{ marginTop: '32px' }}>
            <div className="section-header">
              <label className="label-with-icon"><Users size={14} /> Personal</label>
              <button className="btn-add-tag" onClick={() => setShowColabPicker(!showColabPicker)}>
                <Plus size={14} />
              </button>
            </div>
            <div className="tags-container">
              {colaboradores.filter(c => selectedColab.includes(c.id)).map(c => (
                <div key={c.id} className="tag active" onClick={() => setSelectedColab(prev => prev.filter(id => id !== c.id))}>
                  {c.usuarios?.nombre} <X size={12} />
                </div>
              ))}
            </div>
            {showColabPicker && (
              <div className="picker-dropdown">
                {colaboradores.length === 0 ? (
                  <div className="picker-empty">No hay colaboradores para asignar</div>
                ) : (
                  colaboradores.map(c => (
                    <div key={c.id} className="picker-option" onClick={() => {
                      if (!selectedColab.includes(c.id)) setSelectedColab([...selectedColab, c.id])
                      setShowColabPicker(false)
                    }}>
                      {c.usuarios?.nombre} {c.usuarios?.apellido}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* FIX Bug #2: El picker de prospectos existía pero no conectaba al filtro — ahora sí */}
          <div className="filter-group" style={{ marginTop: '24px' }}>
            <div className="section-header">
              <label className="label-with-icon"><Target size={14} /> Prospectos</label>
              <button className="btn-add-tag" onClick={() => setShowProsPicker(!showProsPicker)}>
                <Plus size={14} />
              </button>
            </div>
            <div className="tags-container">
              {prospectos.filter(p => selectedProspectos.includes(p.id)).map(p => (
                <div key={p.id} className="tag active" onClick={() => setSelectedProspectos(prev => prev.filter(id => id !== p.id))}>
                  {p.nombre} <X size={12} />
                </div>
              ))}
            </div>
            {showProsPicker && (
              <div className="picker-dropdown">
                {prospectosProduccion.length === 0 ? (
                  <div className="picker-empty">No hay prospectos en producción</div>
                ) : (
                  prospectosProduccion.map(p => (
                    <div key={p.id} className="picker-option" onClick={() => {
                      if (!selectedProspectos.includes(p.id)) setSelectedProspectos([...selectedProspectos, p.id])
                      setShowProsPicker(false)
                    }}>
                      {p.nombre}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* CENTRO: CALENDARIO */}
      <main className="cronograma-main">
        <header className="calendar-header">
          {/* FIX Bug #3: Buscador conectado a estado */}
          <div className="search-minimal">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar Cronograma..."
              value={textoBusqueda}
              onChange={e => setTextoBusqueda(e.target.value)}
            />
          </div>
          <div className="header-actions">
            {/* FIX Bug #9: Eliminado el "Productividad: 92%" hardcodeado */}
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

      {/* PANEL DERECHO: CUMPLIMIENTO */}
      <aside className="cronograma-sidebar right">
        <div className="sidebar-section">
          <div className="section-header">
            {/* FIX Bug #4: Título honesto — horas reales del mes, no "cumplimiento" inventado */}
            <h3>Hs. Agendadas — Mes Actual</h3>
          </div>

          <div className="compliance-list">
            <div className="list-header">
              <span>Prospecto</span>
              <span>Horas</span>
            </div>
            {/* FIX Bug #4: Reemplaza Math.random() con horas reales calculadas */}
            {prospectos.slice(0, 8).map(p => {
              const horas = horasPorProspecto[p.nombre] || 0
              return (
                <div key={p.id} className="compliance-item">
                  <span className="p-name">{p.nombre}</span>
                  <div className="p-saldo-wrapper">
                    <span className={`p-saldo ${horas === 0 ? 'negative' : ''}`}>
                      {horas > 0 ? `${horas}h` : '0h'}
                    </span>
                    <div className="mini-progress">
                      <div className="bar" style={{ width: `${Math.min((horas / 40) * 100, 100)}%` }}></div>
                    </div>
                  </div>
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
                      <option key={c.id} value={c.id}>{c.usuarios?.nombre} {c.usuarios?.apellido}</option>
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

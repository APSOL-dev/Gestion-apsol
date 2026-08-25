import { useState, useEffect } from 'react'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import 'moment/dist/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { 
  Plus, Search, ChevronLeft, ChevronRight, 
  Users, Target, Clock, Edit3, X, Video, Filter, BarChart3
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { saveActividad, deleteActividad } from '../services/cronograma'

moment.locale('es')
const localizer = momentLocalizer(moment)

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

export default function Cronograma() {
  const { 
    actividades, loadingActividades, refreshActividades, 
    prospectos, loadingProspectos, refreshProspectos, 
    colaboradores, loadingColaboradores, refreshColaboradores 
  } = useData()
  const [view, setView] = useState(Views.WEEK)
  const [date, setDate] = useState(new Date())
  
  const [selectedColab, setSelectedColab] = useState([])
  const [selectedProspectos, setSelectedProspectos] = useState([])
  
  const [showColabPicker, setShowColabPicker] = useState(false)
  const [showProsPicker, setShowProsPicker] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [formData, setFormData] = useState({
    prospecto_nombre: '',
    inicio: moment().format('YYYY-MM-DDTHH:mm'),
    fin: moment().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
    descripcion: '',
    responsable_id: '',
    reunion_cliente: false,
    link_reunion: '',
    comentarios_reunion: '',
    multiplicador: 1
  })

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

  // Filtrar prospectos en producción
  const prospectosProduccion = prospectos.filter(p => p.estado === '6A - En producción')

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

  const events = actividades
    .filter(act => {
      // Si hay colaboradores seleccionados, filtramos por ID
      // Si la actividad es histórica (solo tiene nombre), la mostramos si no hay filtros o si el nombre coincide (opcional)
      if (selectedColab.length > 0) {
        if (!act.responsable_id) return false // Ocultar históricas si hay filtro de personal activo
        if (!selectedColab.includes(act.responsable_id)) return false
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

  const handleSelectSlot = ({ start, end }) => {
    setFormData({
      ...formData,
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
      descripcion: act.descripcion,
      responsable_id: act.responsable_id,
      reunion_cliente: act.reunion_cliente,
      link_reunion: act.link_reunion,
      comentarios_reunion: act.comentarios_reunion,
      multiplicador: act.multiplicador
    })
    setSelectedEvent(event)
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await saveActividad(formData)
      setShowModal(false)
      loadData()
    } catch (err) {
      alert('Error al guardar')
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
      alert('Error al mover la actividad')
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
      alert('Error al redimensionar la actividad')
    }
  }

  return (
    <div className="cronograma-layout">
      {/* PANEL IZQUIERDO: FILTROS */}
      <aside className="cronograma-sidebar left">
        <div className="sidebar-section-refined">
          <div className="filter-group">
            <label className="label-plain">Desde*</label>
            <input type="date" defaultValue={moment().startOf('month').format('YYYY-MM-DD')} />
          </div>
          <div className="filter-group" style={{ marginTop: '16px' }}>
            <label className="label-plain">Hasta</label>
            <input type="date" defaultValue={moment().endOf('month').format('YYYY-MM-DD')} />
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
                      if(!selectedColab.includes(c.id)) setSelectedColab([...selectedColab, c.id])
                      setShowColabPicker(false)
                    }}>
                      {c.usuarios?.nombre} {c.usuarios?.apellido}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

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
                      if(!selectedProspectos.includes(p.id)) setSelectedProspectos([...selectedProspectos, p.id])
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

      {/* CENTRO: CALENDARIO GIGANTE */}
      <main className="cronograma-main">
        <header className="calendar-header">
          <div className="search-minimal">
            <Search size={16} />
            <input type="text" placeholder="Buscar Cronograma..." />
          </div>
          <div className="header-actions">
             <div className="header-stats">
                <BarChart3 size={18} />
                <span>Productividad: 92%</span>
             </div>
          </div>
        </header>

        <div className="calendar-container giant">
          <div className="calendar-toolbar">
            <div className="view-switcher">
              <button className={view === Views.DAY ? 'active' : ''} onClick={() => setView(Views.DAY)}>Día</button>
              <button className={view === Views.WEEK ? 'active' : ''} onClick={() => setView(Views.WEEK)}>Semana</button>
              <button className={view === Views.MONTH ? 'active' : ''} onClick={() => setView(Views.MONTH)}>Mes</button>
            </div>
            
            <div className="calendar-nav">
              <button className="nav-btn" onClick={() => setDate(moment(date).subtract(1, 'week').toDate())}><ChevronLeft size={20} /></button>
              <span className="current-range">
                {moment(date).format('MMMM YYYY')}
              </span>
              <button className="nav-btn" onClick={() => setDate(moment(date).add(1, 'week').toDate())}><ChevronRight size={20} /></button>
            </div>

            <div className="action-buttons">
              <button className="btn-teams" title="Ir a Microsoft Teams"><Video size={16} /> Teams</button>
              <button className="btn-add-event" onClick={() => setShowModal(true)} title="Nueva Actividad"><Plus size={18} /></button>
            </div>
          </div>

          <div className="rbc-wrapper">
            <Calendar
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
            <h3>Cumplimiento De Hs</h3>
          </div>
          
          <div className="compliance-list">
            <div className="list-header">
              <span>Nombre Prospecto</span>
              <span>Saldo</span>
              <span>Días</span>
            </div>
            {prospectos.slice(0, 8).map(p => (
              <div key={p.id} className="compliance-item">
                <span className="p-name">{p.nombre}</span>
                <div className="p-saldo-wrapper">
                   <span className="p-saldo negative">-{Math.floor(Math.random() * 15 + 5)}h</span>
                   <div className="mini-progress"><div className="bar" style={{width: '70%'}}></div></div>
                </div>
                <span className="p-days">{Math.floor(Math.random() * 60)}d</span>
              </div>
            ))}
          </div>
        </div>

        <div className="details-panel-empty">
          <div className="empty-state-card">
            <Edit3 size={32} strokeWidth={1} />
            <p>Seleccioná una actividad para ver detalles o realizar cambios</p>
          </div>
        </div>
      </aside>

      {/* MODAL REDISEÑADO */}
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
                    onChange={e => setFormData({...formData, prospecto_nombre: e.target.value})}
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
                  <label>Desde</label>
                  <input type="datetime-local" value={formData.inicio} onChange={e => setFormData({...formData, inicio: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Hasta</label>
                  <input type="datetime-local" value={formData.fin} onChange={e => setFormData({...formData, fin: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Descripción del Trabajo</label>
                <textarea 
                  value={formData.descripcion} 
                  onChange={e => setFormData({...formData, descripcion: e.target.value})} 
                  rows="3" 
                  placeholder="¿Qué se va a realizar?"
                />
              </div>
              <div className="form-group">
                <label>Responsable Asignado</label>
                <div className="input-with-icon">
                  <Users size={16} />
                  <select value={formData.responsable_id} onChange={e => setFormData({...formData, responsable_id: e.target.value})} required>
                    <option value="">Seleccionar responsable...</option>
                    {colaboradores.map(c => (
                      <option key={c.id} value={c.id}>{c.usuarios?.nombre} {c.usuarios?.apellido}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
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

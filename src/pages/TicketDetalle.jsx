import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Activity } from 'lucide-react'
import { getTicketById, saveTicket, deleteTicket } from '../services/operaciones'
import { getProyectos } from '../services/proyectos'
import { getColaboradores } from '../services/colaboradores'

export default function TicketDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nuevo'

  const [ticket, setTicket] = useState({
    titulo: '',
    descripcion: '',
    proyecto_id: '',
    tipo: 'Correctivo',
    prioridad: 'Media',
    estado: 'Abierto',
    colaborador_id: '',
    fecha_resolucion: ''
  })
  
  const [proyectos, setProyectos] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  
  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDependencias()
    if (!esNuevo) cargarTicket()
  }, [id])

  async function cargarDependencias() {
    try {
      const [pData, cData] = await Promise.all([
        getProyectos(),
        getColaboradores()
      ])
      // Filtramos proyectos activos (aunque a veces hay tickets para inactivos)
      setProyectos(pData.filter(p => p.estado === 'Activo' || p.estado === 'Completado'))
      setColaboradores(cData.filter(c => c.activo !== false))
    } catch (err) {
      console.error(err)
    }
  }

  async function cargarTicket() {
    setLoading(true)
    try {
      const data = await getTicketById(id)
      setTicket({
        ...data,
        fecha_resolucion: data.fecha_resolucion ? data.fecha_resolucion.split('T')[0] : ''
      })
      
      // Asegurar que el proyecto esté en la lista si es viejo
      if (data.proyectos && !proyectos.some(p => p.id === data.proyecto_id)) {
        setProyectos(prev => [...prev, data.proyectos])
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos del ticket.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const dataToSave = { ...ticket }
      if (!dataToSave.proyecto_id) dataToSave.proyecto_id = null
      if (!dataToSave.colaborador_id) dataToSave.colaborador_id = null
      if (!dataToSave.fecha_resolucion) dataToSave.fecha_resolucion = null

      // Si pasa a Resuelto o Cerrado sin fecha, le ponemos la de hoy
      if ((dataToSave.estado === 'Resuelto' || dataToSave.estado === 'Cerrado') && !dataToSave.fecha_resolucion) {
        dataToSave.fecha_resolucion = new Date().toISOString().split('T')[0]
      }

      const saved = await saveTicket(dataToSave)
      if (esNuevo) {
        navigate(`/tickets/${saved.id}`, { replace: true })
      } else {
        setTicket(dataToSave)
      }
    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Estás seguro de eliminar este ticket?')) return
    try {
      await deleteTicket(id)
      navigate('/tickets')
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando ticket...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '1000px' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/tickets')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="page-title">{esNuevo ? 'Nuevo Ticket' : ticket.titulo}</h1>
              {!esNuevo && (
                <span className={`badge ${
                  ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado' ? 'badge-green' : 
                  ticket.estado === 'En Progreso' ? 'badge-blue' : 'badge-gray'
                }`}>
                  {ticket.estado}
                </span>
              )}
            </div>
            <p className="page-subtitle">{esNuevo ? 'Reportar incidencia o solicitar tarea' : 'Detalles de la operación'}</p>
          </div>
        </div>
        {!esNuevo && (
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={18} />
            Eliminar
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* COLUMNA PRINCIPAL */}
        <div className="card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} className="text-primary" />
            Datos del Ticket
          </h3>
          <form id="ticketForm" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Título / Asunto *</label>
              <input type="text" required value={ticket.titulo} onChange={e => setTicket({...ticket, titulo: e.target.value})} />
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Descripción detallada</label>
              <textarea rows="6" value={ticket.descripcion || ''} onChange={e => setTicket({...ticket, descripcion: e.target.value})} />
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Proyecto Vinculado</label>
              <select value={ticket.proyecto_id} onChange={e => setTicket({...ticket, proyecto_id: e.target.value})}>
                <option value="">-- Sin Proyecto (Global) --</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.prospectos?.empresas?.nombre || 'Sin Empresa'})</option>
                ))}
              </select>
            </div>
          </form>
        </div>

        {/* COLUMNA LATERAL: CLASIFICACIÓN Y ESTADO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card" style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '15px' }}>Clasificación</h3>
            
            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Estado</label>
              <select value={ticket.estado} onChange={e => setTicket({...ticket, estado: e.target.value})} form="ticketForm">
                <option value="Abierto">Abierto</option>
                <option value="En Progreso">En Progreso</option>
                <option value="Esperando Cliente">Esperando Cliente</option>
                <option value="Resuelto">Resuelto</option>
                <option value="Cerrado">Cerrado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Prioridad</label>
              <select value={ticket.prioridad} onChange={e => setTicket({...ticket, prioridad: e.target.value})} form="ticketForm">
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Tipo</label>
              <select value={ticket.tipo} onChange={e => setTicket({...ticket, tipo: e.target.value})} form="ticketForm">
                <option value="Correctivo">Mantenimiento Correctivo (Falla)</option>
                <option value="Evolutivo">Mantenimiento Evolutivo (Mejora)</option>
                <option value="Soporte">Soporte a Usuario</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Responsable</label>
              <select value={ticket.colaborador_id} onChange={e => setTicket({...ticket, colaborador_id: e.target.value})} form="ticketForm">
                <option value="">-- Sin Asignar --</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                ))}
              </select>
            </div>

            {(ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado') && (
              <div className="field" style={{ marginBottom: '16px' }}>
                <label>Fecha de Resolución</label>
                <input 
                  type="date" 
                  value={ticket.fecha_resolucion} 
                  onChange={e => setTicket({...ticket, fecha_resolucion: e.target.value})} 
                  form="ticketForm"
                />
              </div>
            )}

            <button type="submit" form="ticketForm" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={saving}>
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Ticket'}
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}

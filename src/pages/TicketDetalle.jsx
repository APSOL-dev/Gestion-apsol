import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Activity } from 'lucide-react'
import { getTicketById, saveTicket, deleteTicket } from '../services/operaciones'
import { getProyectos } from '../services/proyectos'
import { getColaboradoresLista } from '../services/colaboradores'
import { colaboradoresAsignables, responsablePorDefecto } from '../utils/tickets'

export default function TicketDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const esNuevo = id === 'nuevo'

  const [ticket, setTicket] = useState({
    titulo: '',
    descripcion: '',
    proyecto_id: '',
    tipo_ticket: 'Correctivo',
    prioridad: 'Media',
    estado: 'Abierto',
    responsable_id: '',
    fecha_resolucion: ''
  })

  const [proyectos, setProyectos] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  // Estado tal como está GUARDADO: el cartel de arriba no debe adelantarse a
  // lo que se ve en el desplegable sin guardar.
  const [estadoGuardado, setEstadoGuardado] = useState('Abierto')
  // Proyecto del ticket abierto: puede no estar entre los activos (ticket viejo).
  const [proyectoDelTicket, setProyectoDelTicket] = useState(null)
  // true mientras el responsable sea el que se propuso solo (líder del
  // proyecto); si la persona lo elige a mano deja de tocarse.
  const [responsableAutomatico, setResponsableAutomatico] = useState(false)
  const [aviso, setAviso] = useState(location.state?.creado ? 'Ticket creado' : '')

  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDependencias()
    if (!esNuevo) cargarTicket()
    // Al crear, la ruta pasa de /tickets/nuevo a /tickets/:id sin remontar
    // el componente: el aviso hay que fijarlo acá, no solo en el useState.
    setAviso(location.state?.creado ? 'Ticket creado' : '')
    setResponsableAutomatico(false)
  }, [id])

  async function cargarDependencias() {
    try {
      const [pData, cData] = await Promise.all([
        getProyectos(),
        // Lista liviana visible para cualquier usuario (getColaboradores le
        // devuelve solo su propia ficha a un no-admin). Se piden también los
        // inactivos para poder mostrar un responsable viejo tal cual estaba.
        getColaboradoresLista({ soloActivos: false })
      ])
      // Filtramos proyectos activos (aunque a veces hay tickets para inactivos)
      setProyectos(pData.filter(p => p.estado === 'Activo' || p.estado === 'Completado'))
      setColaboradores(cData)
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
        proyecto_id: data.proyecto_id || '',
        responsable_id: data.responsable_id || '',
        fecha_resolucion: data.fecha_resolucion ? data.fecha_resolucion.split('T')[0] : ''
      })
      setEstadoGuardado(data.estado)
      setProyectoDelTicket(data.proyectos || null)
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
    setAviso('')
    try {
      const dataToSave = { ...ticket }
      if (!dataToSave.proyecto_id) dataToSave.proyecto_id = null
      if (!dataToSave.responsable_id) dataToSave.responsable_id = null
      if (!dataToSave.fecha_resolucion) dataToSave.fecha_resolucion = null

      // Si pasa a Resuelto o Cerrado sin fecha, le ponemos la de hoy
      if ((dataToSave.estado === 'Resuelto' || dataToSave.estado === 'Cerrado') && !dataToSave.fecha_resolucion) {
        dataToSave.fecha_resolucion = new Date().toISOString().split('T')[0]
      }

      const saved = await saveTicket(dataToSave)
      if (esNuevo) {
        navigate(`/tickets/${saved.id}`, { replace: true, state: { creado: true } })
      } else {
        setTicket({
          ...dataToSave,
          proyecto_id: dataToSave.proyecto_id || '',
          responsable_id: dataToSave.responsable_id || '',
          fecha_resolucion: dataToSave.fecha_resolucion || ''
        })
        setEstadoGuardado(dataToSave.estado)
        setAviso('Ticket guardado')
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

  const opcionesProyecto = useMemo(() => (
    proyectoDelTicket && !proyectos.some(p => p.id === proyectoDelTicket.id)
      ? [...proyectos, proyectoDelTicket]
      : proyectos
  ), [proyectos, proyectoDelTicket])

  const asignables = useMemo(
    () => colaboradoresAsignables(colaboradores, ticket.responsable_id),
    [colaboradores, ticket.responsable_id]
  )

  // Cualquier edición borra el aviso "guardado/creado" para no dejarlo
  // colgado sobre datos que ya cambiaron.
  function editar(cambios) {
    setAviso('')
    setTicket(t => ({ ...t, ...cambios }))
  }

  function elegirProyecto(proyectoId) {
    const cambios = { proyecto_id: proyectoId }
    // Solo en tickets nuevos: se propone el líder del proyecto, salvo que la
    // persona ya haya elegido responsable a mano.
    if (esNuevo && (responsableAutomatico || !ticket.responsable_id)) {
      const proyecto = proyectos.find(p => p.id === proyectoId)
      const lider = responsablePorDefecto(proyecto, colaboradoresAsignables(colaboradores))
      cambios.responsable_id = lider
      setResponsableAutomatico(!!lider)
    }
    editar(cambios)
  }

  function elegirResponsable(responsableId) {
    setResponsableAutomatico(false)
    editar({ responsable_id: responsableId })
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
                  estadoGuardado === 'Resuelto' || estadoGuardado === 'Cerrado' ? 'badge-green' :
                  estadoGuardado === 'En Progreso' ? 'badge-blue' : 'badge-gray'
                }`}>
                  {estadoGuardado}
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
      {aviso && !error && <div className="alert alert-success" role="status" style={{ marginBottom: '20px' }}>{aviso}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* COLUMNA PRINCIPAL */}
        <div className="card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} className="text-primary" />
            Datos del Ticket
          </h3>
          <form id="ticketForm" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="ticket-titulo">Título / Asunto *</label>
              <input id="ticket-titulo" type="text" required value={ticket.titulo} onChange={e => editar({ titulo: e.target.value })} />
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Descripción detallada</label>
              <textarea rows="6" value={ticket.descripcion || ''} onChange={e => editar({ descripcion: e.target.value })} />
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Proyecto Vinculado</label>
              <select value={ticket.proyecto_id || ''} onChange={e => elegirProyecto(e.target.value)}>
                <option value="">-- Sin Proyecto (Global) --</option>
                {opcionesProyecto.map(p => (
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
              <select value={ticket.estado} onChange={e => editar({ estado: e.target.value })} form="ticketForm">
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
              <select value={ticket.prioridad} onChange={e => editar({ prioridad: e.target.value })} form="ticketForm">
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Tipo</label>
              <select value={ticket.tipo_ticket} onChange={e => editar({ tipo_ticket: e.target.value })} form="ticketForm">
                <option value="Correctivo">Mantenimiento Correctivo (Falla)</option>
                <option value="Evolutivo">Mantenimiento Evolutivo (Mejora)</option>
                <option value="Soporte">Soporte a Usuario</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Responsable</label>
              <select value={ticket.responsable_id || ''} onChange={e => elegirResponsable(e.target.value)} form="ticketForm">
                <option value="">-- Sin Asignar --</option>
                {asignables.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido}{c.noAsignable ? ' (sin usuario o inactivo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {(ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado') && (
              <div className="field" style={{ marginBottom: '16px' }}>
                <label>Fecha de Resolución</label>
                <input
                  type="date"
                  value={ticket.fecha_resolucion}
                  onChange={e => editar({ fecha_resolucion: e.target.value })}
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

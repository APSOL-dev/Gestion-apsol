import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, FileText, Target, Activity, Wrench } from 'lucide-react'
import { getProyectoById, saveProyecto, deleteProyecto } from '../services/proyectos'
import { getProspectos } from '../services/prospectos'
import { getColaboradores } from '../services/colaboradores'

export default function ProyectoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nuevo'

  const [proyecto, setProyecto] = useState({
    nombre: '',
    prospecto_id: '',
    lider_colaborador_id: '',
    fecha_inicio: '',
    fecha_fin_estimada: '',
    estado: 'Planificación',
    porcentaje_avance: 0,
    descripcion: ''
  })
  
  const [prospectos, setProspectos] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [tickets, setTickets] = useState([])
  const [preventivos, setPreventivos] = useState([])
  
  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDependencias()
    if (!esNuevo) cargarProyecto()
  }, [id])

  async function cargarDependencias() {
    try {
      const [pData, cData] = await Promise.all([
        getProspectos(), // Deberíamos filtrar por "Ganado" idealmente
        getColaboradores()
      ])
      // Filtramos solo prospectos ganados si es posible
      setProspectos(pData.filter(p => p.estado === 'Ganado' || p.estado === 'Vendido/Ganado' || p.estado === 'Activo'))
      setColaboradores(cData.filter(c => c.activo !== false))
    } catch (err) {
      console.error(err)
    }
  }

  async function cargarProyecto() {
    setLoading(true)
    try {
      const data = await getProyectoById(id)
      setProyecto({
        ...data,
        fecha_inicio: data.fecha_inicio ? data.fecha_inicio.split('T')[0] : '',
        fecha_fin_estimada: data.fecha_fin_estimada ? data.fecha_fin_estimada.split('T')[0] : ''
      })
      setTickets(data.tickets || [])
      setPreventivos(data.preventivos || [])
      
      // Si el prospecto del proyecto no está en los filtrados ganados, lo agregamos para que el select funcione
      if (data.prospectos && !prospectos.some(p => p.id === data.prospecto_id)) {
        setProspectos(prev => [...prev, data.prospectos])
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos del proyecto.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const dataToSave = { ...proyecto }
      if (!dataToSave.fecha_fin_estimada) dataToSave.fecha_fin_estimada = null
      if (!dataToSave.fecha_inicio) dataToSave.fecha_inicio = null
      if (!dataToSave.lider_colaborador_id) dataToSave.lider_colaborador_id = null
      if (!dataToSave.prospecto_id) dataToSave.prospecto_id = null

      const saved = await saveProyecto(dataToSave)
      if (esNuevo) {
        navigate(`/proyectos/${saved.id}`, { replace: true })
      }
    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Estás seguro de eliminar este proyecto? Los tickets y preventivos asociados también podrían verse afectados.')) return
    try {
      await deleteProyecto(id)
      navigate('/proyectos')
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando proyecto...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '1000px' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/proyectos')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="page-title">{esNuevo ? 'Nuevo Proyecto' : proyecto.nombre}</h1>
              {!esNuevo && (
                <span className={`badge ${
                  proyecto.estado === 'Activo' ? 'badge-blue' : 
                  proyecto.estado === 'Completado' ? 'badge-green' : 'badge-gray'
                }`}>
                  {proyecto.estado}
                </span>
              )}
            </div>
            <p className="page-subtitle">{esNuevo ? 'Crea un nuevo proyecto operativo' : 'Gestión y seguimiento'}</p>
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
        <div style={{ display: 'grid', gap: '24px' }}>
          
          <div className="card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} className="text-primary" />
              Datos del Proyecto
            </h3>
            <form id="proyectoForm" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Nombre del Proyecto *</label>
                <input type="text" required value={proyecto.nombre} onChange={e => setProyecto({...proyecto, nombre: e.target.value})} />
              </div>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Oportunidad Vinculada (Prospecto) *</label>
                <select required value={proyecto.prospecto_id} onChange={e => setProyecto({...proyecto, prospecto_id: e.target.value})}>
                  <option value="">-- Seleccionar Prospecto Ganado --</option>
                  {prospectos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.empresas?.nombre || 'Sin Empresa'})</option>
                  ))}
                </select>
                <small style={{ color: 'var(--color-text-muted)' }}>Solo se muestran prospectos Ganados o Activos</small>
              </div>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Descripción / Objetivos</label>
                <textarea rows="3" value={proyecto.descripcion || ''} onChange={e => setProyecto({...proyecto, descripcion: e.target.value})} />
              </div>

              <div className="field">
                <label>Líder del Proyecto</label>
                <select value={proyecto.lider_colaborador_id} onChange={e => setProyecto({...proyecto, lider_colaborador_id: e.target.value})}>
                  <option value="">-- Seleccionar Colaborador --</option>
                  {colaboradores.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Estado</label>
                <select value={proyecto.estado} onChange={e => setProyecto({...proyecto, estado: e.target.value})}>
                  <option value="Planificación">En Planificación</option>
                  <option value="Activo">Activo / En Ejecución</option>
                  <option value="Pausado">Pausado</option>
                  <option value="Completado">Completado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>

              <div className="field">
                <label>Fecha de Inicio</label>
                <input type="date" value={proyecto.fecha_inicio} onChange={e => setProyecto({...proyecto, fecha_inicio: e.target.value})} />
              </div>
              <div className="field">
                <label>Fecha Fin Estimada</label>
                <input type="date" value={proyecto.fecha_fin_estimada} onChange={e => setProyecto({...proyecto, fecha_fin_estimada: e.target.value})} />
              </div>
            </form>
          </div>

          {/* TAREAS / TICKETS */}
          {!esNuevo && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={20} className="text-primary" />
                  Tickets y Tareas Activas
                </h3>
                <Link to="/tickets/nuevo" className="btn btn-secondary">Crear Ticket</Link>
              </div>
              {tickets.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No hay tickets en este proyecto.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Prioridad</th>
                        <th>Estado</th>
                        <th>Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map(t => (
                        <tr key={t.id}>
                          <td><Link to={`/tickets/${t.id}`} style={{ fontWeight: '500', color: 'inherit', textDecoration: 'none' }}>{t.titulo}</Link></td>
                          <td>
                            <span style={{ fontSize: '12px', color: t.prioridad === 'Alta' ? 'var(--color-danger)' : t.prioridad === 'Media' ? 'var(--color-orange)' : 'var(--color-text-muted)' }}>
                              {t.prioridad}
                            </span>
                          </td>
                          <td><span className="badge badge-gray">{t.estado}</span></td>
                          <td>{t.colaboradores ? `${t.colaboradores.nombre} ${t.colaboradores.apellido}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PREVENTIVOS */}
          {!esNuevo && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wrench size={20} className="text-primary" />
                  Mantenimientos Preventivos
                </h3>
                <Link to="/preventivos/nuevo" className="btn btn-secondary">Programar</Link>
              </div>
              {preventivos.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No hay preventivos programados para este proyecto.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Plan / Equipo</th>
                        <th>Frecuencia</th>
                        <th>Próxima Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preventivos.map(p => {
                        const vencido = p.proxima_realizacion && new Date(p.proxima_realizacion) < new Date()
                        return (
                          <tr key={p.id}>
                            <td><Link to={`/preventivos/${p.id}`} style={{ fontWeight: '500', color: 'inherit', textDecoration: 'none' }}>{p.equipo_sistema}</Link></td>
                            <td>{p.frecuencia_dias} días</td>
                            <td style={{ color: vencido ? 'var(--color-danger)' : 'inherit', fontWeight: vencido ? '600' : 'normal' }}>
                              {p.proxima_realizacion ? new Date(p.proxima_realizacion).toLocaleDateString('es-AR') : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* COLUMNA LATERAL: AVANCE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card" style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '15px' }}>Avance del Proyecto</h3>
            
            <div className="field" style={{ marginBottom: '24px' }}>
              <label>Porcentaje Estimado (%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={proyecto.porcentaje_avance} 
                  onChange={e => setProyecto({...proyecto, porcentaje_avance: parseInt(e.target.value)})} 
                  form="proyectoForm"
                  style={{ flex: 1, accentColor: 'var(--color-primary)' }}
                />
                <span style={{ fontWeight: '600', fontSize: '18px', width: '40px', textAlign: 'right', color: 'var(--color-primary)' }}>
                  {proyecto.porcentaje_avance}%
                </span>
              </div>
            </div>

            <button type="submit" form="proyectoForm" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}

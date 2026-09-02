import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Wrench, Calendar, FileText } from 'lucide-react'
import { getPreventivoById, savePreventivo, deletePreventivo } from '../services/operaciones'
import { getProyectos } from '../services/proyectos'

export default function PreventivoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nuevo'

  const [preventivo, setPreventivo] = useState({
    nombre: '',
    proyecto_id: '',
    frecuencia_dias: 30,
    ultima_realizacion: '',
    proxima_realizacion: '',
    notas: ''
  })
  
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDependencias()
    if (!esNuevo) cargarPreventivo()
  }, [id])

  // Calcular próxima realización automáticamente cuando cambia la última o la frecuencia
  useEffect(() => {
    if (preventivo.ultima_realizacion && preventivo.frecuencia_dias) {
      const ultima = new Date(preventivo.ultima_realizacion)
      ultima.setDate(ultima.getDate() + Number(preventivo.frecuencia_dias))
      const prox = ultima.toISOString().split('T')[0]
      setPreventivo(prev => ({ ...prev, proxima_realizacion: prox }))
    }
  }, [preventivo.ultima_realizacion, preventivo.frecuencia_dias])

  async function cargarDependencias() {
    try {
      const pData = await getProyectos()
      setProyectos(pData.filter(p => p.estado === 'Activo' || p.estado === 'Completado'))
    } catch (err) {
      console.error(err)
    }
  }

  async function cargarPreventivo() {
    setLoading(true)
    try {
      const data = await getPreventivoById(id)
      setPreventivo({
        ...data,
        ultima_realizacion: data.ultima_realizacion ? data.ultima_realizacion.split('T')[0] : '',
        proxima_realizacion: data.proxima_realizacion ? data.proxima_realizacion.split('T')[0] : ''
      })
      
      if (data.proyectos && !proyectos.some(p => p.id === data.proyecto_id)) {
        setProyectos(prev => [...prev, data.proyectos])
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos del preventivo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const dataToSave = { ...preventivo }
      if (!dataToSave.proyecto_id) dataToSave.proyecto_id = null
      if (!dataToSave.ultima_realizacion) dataToSave.ultima_realizacion = null
      if (!dataToSave.proxima_realizacion) dataToSave.proxima_realizacion = null

      const saved = await savePreventivo(dataToSave)
      if (esNuevo) {
        navigate(`/preventivos/${saved.id}`, { replace: true })
      }
    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Estás seguro de eliminar este plan preventivo?')) return
    try {
      await deletePreventivo(id)
      navigate('/preventivos')
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando preventivo...</p>
      </div>
    )
  }

  const vencido = preventivo.proxima_realizacion && new Date(preventivo.proxima_realizacion) < new Date()

  return (
    <div className="page" style={{ maxWidth: '800px' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/preventivos')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="page-title">{esNuevo ? 'Nuevo Plan Preventivo' : preventivo.nombre}</h1>
              {!esNuevo && vencido && (
                <span className="badge badge-orange">Vencido</span>
              )}
            </div>
            <p className="page-subtitle">Programación de mantenimiento periódico</p>
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

      <div className="card">
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wrench size={20} className="text-primary" />
          Detalles del Mantenimiento
        </h3>
        
        <form id="preventivoForm" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Equipo o Sistema a Mantener *</label>
            <input 
              type="text" 
              required 
              placeholder="Ej. Servidor principal, Tablero Eléctrico T1..."
              value={preventivo.nombre}
              onChange={e => setPreventivo({...preventivo, nombre: e.target.value})}
            />
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Proyecto Vinculado *</label>
            <select required value={preventivo.proyecto_id} onChange={e => setPreventivo({...preventivo, proyecto_id: e.target.value})}>
              <option value="">-- Seleccionar Proyecto --</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.prospectos?.empresas?.nombre || 'Sin Empresa'})</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Frecuencia de mantenimiento (días) *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="number" 
                required 
                min="1"
                value={preventivo.frecuencia_dias} 
                onChange={e => setPreventivo({...preventivo, frecuencia_dias: e.target.value})} 
              />
              <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>días</span>
            </div>
            <small style={{ color: 'var(--color-text-muted)' }}>
              Aprox: 30 = mensual, 90 = trimestral, 365 = anual.
            </small>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="field">
              <label>Última Realización</label>
              <input 
                type="date" 
                value={preventivo.ultima_realizacion} 
                onChange={e => setPreventivo({...preventivo, ultima_realizacion: e.target.value})} 
              />
            </div>
            
            <div className="field">
              <label>Próxima Realización (Calculada)</label>
              <input 
                type="date" 
                required
                value={preventivo.proxima_realizacion} 
                onChange={e => setPreventivo({...preventivo, proxima_realizacion: e.target.value})} 
                style={{ 
                  borderColor: vencido ? 'var(--color-orange)' : 'var(--color-border)',
                  color: vencido ? 'var(--color-orange)' : 'inherit',
                  fontWeight: vencido ? '600' : 'normal'
                }}
              />
            </div>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Checklist / Tareas a realizar</label>
            <textarea 
              rows="5" 
              placeholder="1. Revisión de temperatura...&#10;2. Limpieza de filtros...&#10;3. Backup de base de datos..."
              value={preventivo.notas || ''} 
              onChange={e => setPreventivo({...preventivo, notas: e.target.value})} 
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Plan'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}

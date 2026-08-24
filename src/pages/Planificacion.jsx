import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Calendar, Trash2, X, FolderKanban } from 'lucide-react'
import { getPlanes, crearPlan, eliminarPlan } from '../services/planificacion'

export default function Planificacion() {
  const [planes, setPlanes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  // Formulario de nuevo plan
  const [formData, setFormData] = useState({
    nombre: '',
    fecha_inicio: '',
    fecha_fin: ''
  })

  useEffect(() => {
    cargarPlanes()
  }, [])

  async function cargarPlanes() {
    setLoading(true)
    try {
      const data = await getPlanes()
      setPlanes(data)
    } catch (err) {
      console.error('Error al cargar planes:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!formData.nombre.trim() || !formData.fecha_inicio || !formData.fecha_fin) {
      setError('Por favor completa todos los campos')
      return
    }

    if (new Date(formData.fecha_fin) < new Date(formData.fecha_inicio)) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio')
      return
    }

    setCreando(true)
    setError('')
    try {
      const nuevoPlan = await crearPlan(formData)
      setPlanes([nuevoPlan, ...planes])
      setShowModal(false)
      setFormData({ nombre: '', fecha_inicio: '', fecha_fin: '' })
    } catch (err) {
      console.error('Error al crear plan:', err)
      setError('Error al crear el plan. Intenta de nuevo.')
    } finally {
      setCreando(false)
    }
  }

  async function handleDelete(e, id, nombre) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`¿Estás seguro de que deseas eliminar el plan "${nombre}" y todos sus objetivos, subobjetivos y tareas asociadas?`)) {
      return
    }

    try {
      await eliminarPlan(id)
      setPlanes(planes.filter(p => p.id !== id))
    } catch (err) {
      console.error('Error al eliminar plan:', err)
      alert('No se pudo eliminar el plan. Intenta nuevamente.')
    }
  }

  const planesFiltrados = planes.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchEstado = filtroEstado === 'Todos' || p.estado === filtroEstado.toLowerCase().replace(' ', '_')
    return matchSearch && matchEstado
  })

  function getEstadoBadgeClass(estado) {
    switch (estado) {
      case 'en_curso':
        return 'badge-green'
      case 'finalizado':
        return 'badge-gray'
      case 'borrador':
      default:
        return 'badge-orange'
    }
  }

  function getEstadoLabel(estado) {
    switch (estado) {
      case 'en_curso':
        return 'En curso'
      case 'finalizado':
        return 'Finalizado'
      case 'borrador':
      default:
        return 'Borrador'
    }
  }

  return (
    <div className="page" style={{ maxWidth: '1200px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Planificación</h1>
          <p className="page-subtitle">Gestión de planes estratégicos cuatrimestrales y trimestrales con Gantt</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Nuevo Plan
        </button>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre de plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Todos', 'Borrador', 'En curso', 'Finalizado'].map(estado => (
            <button 
              key={estado}
              className={`btn ${filtroEstado === estado ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setFiltroEstado(estado)}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              {estado}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando planes...</p>
        </div>
      ) : planesFiltrados.length === 0 ? (
        <div className="placeholder-card">
          <FolderKanban className="placeholder-icon" size={48} style={{ color: 'var(--color-text-subtle)', marginBottom: '16px' }} />
          <h3>No se encontraron planes</h3>
          <p>{search || filtroEstado !== 'Todos' ? 'Intenta con otros filtros.' : 'No hay planes creados aún.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {planesFiltrados.map((p) => {
            const inicio = new Date(p.fecha_inicio).toLocaleDateString('es-AR')
            const fin = new Date(p.fecha_fin).toLocaleDateString('es-AR')
            return (
              <Link 
                to={`/planificacion/${p.id}`} 
                key={p.id} 
                className="card" 
                style={{ 
                  textDecoration: 'none', 
                  color: 'inherit', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  minHeight: '160px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                  borderLeft: '4px solid var(--color-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--shadow)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span className={`badge ${getEstadoBadgeClass(p.estado)}`}>
                      {getEstadoLabel(p.estado)}
                    </span>
                    <button 
                      className="btn-close" 
                      onClick={(e) => handleDelete(e, p.id, p.nombre)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: '4px' }}
                      title="Eliminar Plan"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--color-text)' }}>
                    {p.nombre}
                  </h3>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  <Calendar size={16} />
                  <span>{inicio} – {fin}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* MODAL CREAR PLAN */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Nuevo Plan de Trabajo</h2>
              <button 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }} 
                onClick={() => setShowModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && <div className="alert alert-error">{error}</div>}
              
              <div className="form-group">
                <label htmlFor="nombrePlan">Nombre del Plan</label>
                <input
                  id="nombrePlan"
                  type="text"
                  placeholder="Ej: Planificación Q4 2026, Semestre I 2027"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="fechaInicio">Fecha Inicio</label>
                  <input
                    id="fechaInicio"
                    type="date"
                    value={formData.fecha_inicio}
                    onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="fechaFin">Fecha Fin</label>
                  <input
                    id="fechaFin"
                    type="date"
                    value={formData.fecha_fin}
                    onChange={e => setFormData({ ...formData, fecha_fin: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '16px', padding: 0, border: 'none' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={creando}>
                  {creando ? 'Creando...' : 'Crear Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, GraduationCap, Video } from 'lucide-react'
import { getCapacitaciones } from '../services/capacitacion'

export default function Capacitacion() {
  const [capacitaciones, setCapacitaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroClasificacion, setFiltroClasificacion] = useState('Todas')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getCapacitaciones()
      setCapacitaciones(data)
    } catch (error) {
      console.error('Error al cargar capacitaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  const capacitacionesFiltradas = capacitaciones.filter(c => {
    const matchSearch = 
      (c.titulo && c.titulo.toLowerCase().includes(search.toLowerCase())) ||
      (c.descripcion && c.descripcion.toLowerCase().includes(search.toLowerCase()))
      
    const matchClasif = filtroClasificacion === 'Todas' || c.clasificacion === filtroClasificacion

    return matchSearch && matchClasif
  })

  // Obtener clasificaciones únicas para los filtros
  const clasificaciones = ['Todas', ...new Set(capacitaciones.map(c => c.clasificacion).filter(Boolean))]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Centro de Capacitación</h1>
          <p className="page-subtitle">Videos, manuales y cursos de formación SGI</p>
        </div>
        <Link to="/capacitacion/nueva" className="btn btn-primary">
          <Plus size={18} />
          Nueva Capacitación
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por título o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {clasificaciones.map(clasif => (
            <button 
              key={clasif}
              className={`btn ${filtroClasificacion === clasif ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setFiltroClasificacion(clasif)}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              {clasif}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando capacitaciones...</p>
        </div>
      ) : capacitacionesFiltradas.length === 0 ? (
        <div className="placeholder-card">
          <GraduationCap className="placeholder-icon" />
          <h3>No hay capacitaciones</h3>
          <p>{search || filtroClasificacion !== 'Todas' ? 'Intenta con otros filtros.' : 'No hay módulos creados aún.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
          {capacitacionesFiltradas.map((c) => (
            <Link key={c.id} to={`/capacitacion/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card hoverable" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="badge badge-purple" style={{ fontSize: '11px' }}>
                    {c.clasificacion || 'General'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {c.fecha_publicacion ? new Date(c.fecha_publicacion).toLocaleDateString('es-AR') : ''}
                  </span>
                </div>
                
                <h3 style={{ marginBottom: '8px', lineHeight: '1.4' }}>{c.titulo}</h3>
                
                <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '20px', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c.descripcion || 'Sin descripción...'}
                </p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--color-border)', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)' }}>
                    <Video size={16} /> Ver Contenido
                  </div>
                  {c.destinatarios && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      Para: {c.destinatarios}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

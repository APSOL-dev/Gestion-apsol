import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FileText, Target, Calendar } from 'lucide-react'
import { getProyectos } from '../services/proyectos'

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Activo')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getProyectos()
      setProyectos(data)
    } catch (error) {
      console.error('Error al cargar proyectos:', error)
    } finally {
      setLoading(false)
    }
  }

  const proyectosFiltrados = proyectos.filter(p => {
    const matchSearch = 
      (p.nombre && p.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (p.prospectos?.nombre && p.prospectos.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (p.prospectos?.empresas?.nombre && p.prospectos.empresas.nombre.toLowerCase().includes(search.toLowerCase()))
      
    const matchEstado = filtroEstado === 'Todos' || p.estado === filtroEstado

    return matchSearch && matchEstado
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Proyectos</h1>
          <p className="page-subtitle">Gestión de implementaciones y servicios activos</p>
        </div>
        <Link to="/proyectos/nuevo" className="btn btn-primary">
          <Plus size={18} />
          Nuevo Proyecto
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, oportunidad o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Todos', 'Planificación', 'Activo', 'Pausado', 'Completado', 'Cancelado'].map(estado => (
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
          <p>Cargando proyectos...</p>
        </div>
      ) : proyectosFiltrados.length === 0 ? (
        <div className="placeholder-card">
          <FileText className="placeholder-icon" />
          <h3>No se encontraron proyectos</h3>
          <p>{search || filtroEstado !== 'Todos' ? 'Intenta con otros filtros.' : 'No hay proyectos creados aún.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Oportunidad / Cliente</th>
                <th>Progreso</th>
                <th>Líder</th>
                <th>Fecha Inicio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {proyectosFiltrados.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/proyectos/${p.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: '500' }}>
                      {p.nombre}
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{p.prospectos?.empresas?.nombre || '-'}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{p.prospectos?.nombre || '-'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${p.porcentaje_avance || 0}%`, height: '100%', background: 'var(--color-primary)' }}></div>
                      </div>
                      <span style={{ fontSize: '12px', width: '35px', textAlign: 'right' }}>{p.porcentaje_avance || 0}%</span>
                    </div>
                  </td>
                  <td>
                    {p.colaboradores ? `${p.colaboradores.nombre} ${p.colaboradores.apellido}` : '-'}
                  </td>
                  <td>
                    {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString('es-AR') : '-'}
                  </td>
                  <td>
                    <span className={`badge ${
                      p.estado === 'Activo' ? 'badge-blue' : 
                      p.estado === 'Completado' ? 'badge-green' : 
                      p.estado === 'Planificación' ? 'badge-gray' : 'badge-orange'
                    }`}>
                      {p.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

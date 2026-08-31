import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, GraduationCap, Eye } from 'lucide-react'
import { useData } from '../context/DataContext'
import { getUsuarios, nombreUsuario, vistoPorDeTema, agruparPorClasificacion } from '../services/capacitacion'
import CapacitacionChat from '../components/CapacitacionChat'

export default function Capacitacion() {
  const { capacitaciones, loadingCapacitaciones, refreshCapacitaciones } = useData()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filtroClasificacion, setFiltroClasificacion] = useState('Todas')
  const [usuarios, setUsuarios] = useState([])

  useEffect(() => {
    const esSilencioso = capacitaciones.length > 0
    refreshCapacitaciones(esSilencioso)
    getUsuarios().then(setUsuarios).catch(err => console.error('Error al cargar usuarios:', err))
  }, [])

  const capacitacionesFiltradas = capacitaciones.filter(c => {
    const matchSearch =
      (c.titulo && c.titulo.toLowerCase().includes(search.toLowerCase())) ||
      (c.descripcion && c.descripcion.toLowerCase().includes(search.toLowerCase()))

    const clave = c.clasificacion || 'Sin clasificar'
    const matchClasif = filtroClasificacion === 'Todas' || clave === filtroClasificacion

    return matchSearch && matchClasif
  })

  // Clasificaciones con su cantidad de temas, para la barra lateral (sobre el
  // total sin filtrar, para que los contadores no cambien al elegir una).
  const clasificacionesConCantidad = useMemo(() => {
    const counts = new Map()
    for (const c of capacitaciones) {
      const clave = c.clasificacion || 'Sin clasificar'
      counts.set(clave, (counts.get(clave) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [capacitaciones])

  const grupos = useMemo(() => agruparPorClasificacion(capacitacionesFiltradas), [capacitacionesFiltradas])

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

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* SIDEBAR DE CLASIFICACIONES */}
        <div className="card" style={{ width: '230px', flexShrink: 0, padding: '10px' }}>
          <button
            onClick={() => setFiltroClasificacion('Todas')}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
              textAlign: 'left', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
              cursor: 'pointer', fontSize: '13.5px', fontWeight: 600, marginBottom: '4px',
              background: filtroClasificacion === 'Todas' ? 'var(--color-primary-light)' : 'transparent',
              color: filtroClasificacion === 'Todas' ? 'var(--color-primary)' : 'var(--color-text)'
            }}
          >
            Todas
            <span className="badge badge-gray">{capacitaciones.length}</span>
          </button>
          {clasificacionesConCantidad.map(([clave, count]) => (
            <button
              key={clave}
              onClick={() => setFiltroClasificacion(clave)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                textAlign: 'left', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                cursor: 'pointer', fontSize: '13.5px',
                background: filtroClasificacion === clave ? 'var(--color-primary-light)' : 'transparent',
                color: filtroClasificacion === clave ? 'var(--color-primary)' : 'var(--color-text)',
                fontWeight: filtroClasificacion === clave ? 600 : 400
              }}
            >
              {clave}
              <span className="badge badge-gray">{count}</span>
            </button>
          ))}
        </div>

        {/* CONTENIDO */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
            <div className="search-bar">
              <Search size={18} className="search-bar-icon" />
              <input
                type="text"
                placeholder="Buscar por título o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loadingCapacitaciones ? (
            <div className="loading-screen" style={{ minHeight: '300px' }}>
              <div className="loading-spinner" />
              <p>Cargando capacitaciones...</p>
            </div>
          ) : grupos.length === 0 ? (
            <div className="placeholder-card">
              <GraduationCap className="placeholder-icon" />
              <h3>No hay capacitaciones</h3>
              <p>{search || filtroClasificacion !== 'Todas' ? 'Intenta con otros filtros.' : 'No hay módulos creados aún.'}</p>
            </div>
          ) : (
            grupos.map(([clave, lista]) => (
              <div key={clave} style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-primary)' }}>{clave}</h2>
                  <span className="badge badge-gray">{lista.length}</span>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>Fecha creación</th>
                        <th>Título tema</th>
                        <th>Visto por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(c => {
                        const vistoPor = vistoPorDeTema(c)
                        return (
                          <tr key={c.id} onClick={() => navigate(`/capacitacion/${c.id}`)}>
                            <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                              {c.fecha_creacion ? new Date(c.fecha_creacion).toLocaleDateString('es-AR') : '-'}
                            </td>
                            <td style={{ fontWeight: 500 }}>{c.titulo}</td>
                            <td>
                              {vistoPor.length === 0 ? (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>—</span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                                  <Eye size={13} />
                                  {vistoPor.map(id => nombreUsuario(usuarios, id)).join(', ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CapacitacionChat />
    </div>
  )
}

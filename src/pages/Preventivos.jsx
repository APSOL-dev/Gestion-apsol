import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Wrench, Calendar, AlertTriangle } from 'lucide-react'
import { useData } from '../context/DataContext'

export default function Preventivos() {
  const { preventivos, loadingPreventivos, refreshPreventivos } = useData()
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')

  useEffect(() => {
    const esSilencioso = preventivos.length > 0
    refreshPreventivos(esSilencioso)
  }, [])

  const estaVencido = (fecha) => {
    if (!fecha) return false
    return new Date(fecha) < new Date()
  }

  const preventivosFiltrados = preventivos.filter(p => {
    const matchSearch = 
      (p.equipo_sistema && p.equipo_sistema.toLowerCase().includes(search.toLowerCase())) ||
      (p.proyectos?.nombre && p.proyectos.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (p.proyectos?.prospectos?.empresas?.nombre && p.proyectos.prospectos.empresas.nombre.toLowerCase().includes(search.toLowerCase()))
      
    const vencido = estaVencido(p.proxima_realizacion)
    let matchEstado = true
    if (filtroEstado === 'Vencidos') matchEstado = vencido
    else if (filtroEstado === 'Programados') matchEstado = !vencido && p.proxima_realizacion

    return matchSearch && matchEstado
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mantenimientos Preventivos</h1>
          <p className="page-subtitle">Planes de revisión y tareas periódicas</p>
        </div>
        <Link to="/preventivos/nuevo" className="btn btn-primary">
          <Plus size={18} />
          Nuevo Plan
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por equipo, proyecto o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Todos', 'Vencidos', 'Programados'].map(estado => (
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

      {loadingPreventivos ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando planes preventivos...</p>
        </div>
      ) : preventivosFiltrados.length === 0 ? (
        <div className="placeholder-card">
          <Wrench className="placeholder-icon" />
          <h3>No hay preventivos</h3>
          <p>{search || filtroEstado !== 'Todos' ? 'Intenta con otros filtros.' : 'No hay planes registrados.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Equipo / Sistema</th>
                <th>Proyecto Vinculado</th>
                <th>Última Rev.</th>
                <th>Próxima Rev.</th>
                <th>Estado</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {preventivosFiltrados.map((p) => {
                const vencido = estaVencido(p.proxima_realizacion)
                return (
                  <tr key={p.id} style={{ backgroundColor: vencido ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td>
                      <Link to={`/preventivos/${p.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: '500' }}>
                        {p.equipo_sistema}
                      </Link>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>{p.proyectos?.nombre || '-'}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{p.proyectos?.prospectos?.empresas?.nombre || '-'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {p.ultima_realizacion ? new Date(p.ultima_realizacion).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td>
                      <span style={{ color: vencido ? 'var(--color-danger)' : 'inherit', fontWeight: vencido ? '600' : 'normal', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {vencido && <AlertTriangle size={14} />}
                        {p.proxima_realizacion ? new Date(p.proxima_realizacion).toLocaleDateString('es-AR') : '-'}
                      </span>
                    </td>
                    <td>
                      {vencido ? (
                        <span className="badge badge-orange">Vencido</span>
                      ) : p.proxima_realizacion ? (
                        <span className="badge badge-green">Al día</span>
                      ) : (
                        <span className="badge badge-gray">Sin Programar</span>
                      )}
                    </td>
                    <td>
                      {/* Botón rápido para generar un ticket para este preventivo.
                          En una versión completa esto navegaría a `/tickets/nuevo?preventivo_id=X` 
                          Para simplificar la Demo solo redirige a Tickets Nuevo. */}
                      <Link to={`/tickets/nuevo?proyecto=${p.proyecto_id}&titulo=Preventivo:%20${encodeURIComponent(p.equipo_sistema)}`} className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }}>
                        Crear Tarea
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

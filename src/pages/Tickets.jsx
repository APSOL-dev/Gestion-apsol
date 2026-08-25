import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Activity, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useData } from '../context/DataContext'

export default function Tickets() {
  const { tickets, loadingTickets, refreshTickets } = useData()
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Abiertos')

  useEffect(() => {
    const esSilencioso = tickets.length > 0
    refreshTickets(esSilencioso)
  }, [])

  const ticketsFiltrados = tickets.filter(t => {
    const matchSearch = 
      (t.titulo && t.titulo.toLowerCase().includes(search.toLowerCase())) ||
      (t.proyectos?.nombre && t.proyectos.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (t.proyectos?.prospectos?.empresas?.nombre && t.proyectos.prospectos.empresas.nombre.toLowerCase().includes(search.toLowerCase()))
      
    let matchEstado = true
    if (filtroEstado === 'Abiertos') {
      matchEstado = t.estado !== 'Resuelto' && t.estado !== 'Cerrado' && t.estado !== 'Cancelado'
    } else if (filtroEstado === 'Cerrados') {
      matchEstado = t.estado === 'Resuelto' || t.estado === 'Cerrado' || t.estado === 'Cancelado'
    }

    return matchSearch && matchEstado
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tickets de Operación</h1>
          <p className="page-subtitle">Gestión de incidencias y tareas correctivas</p>
        </div>
        <Link to="/tickets/nuevo" className="btn btn-primary">
          <Plus size={18} />
          Nuevo Ticket
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por título, proyecto o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Todos', 'Abiertos', 'Cerrados'].map(estado => (
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

      {loadingTickets ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando tickets...</p>
        </div>
      ) : ticketsFiltrados.length === 0 ? (
        <div className="placeholder-card">
          <Activity className="placeholder-icon" />
          <h3>No hay tickets {filtroEstado.toLowerCase()}</h3>
          <p>{search ? 'Intenta con otra búsqueda.' : 'No se encontraron registros.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Título / Asunto</th>
                <th>Proyecto / Empresa</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {ticketsFiltrados.map((t) => (
                <tr key={t.id} style={{ opacity: t.estado === 'Resuelto' || t.estado === 'Cerrado' ? 0.6 : 1 }}>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                    #{t.id.slice(0, 6)}
                  </td>
                  <td>
                    <Link to={`/tickets/${t.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: '500' }}>
                      {t.titulo}
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{t.proyectos?.nombre || '-'}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{t.proyectos?.prospectos?.empresas?.nombre || '-'}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ 
                      fontSize: '12px', fontWeight: '600',
                      color: t.prioridad === 'Alta' ? 'var(--color-danger)' : t.prioridad === 'Media' ? 'var(--color-orange)' : 'var(--color-text-muted)' 
                    }}>
                      {t.prioridad}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      t.estado === 'Resuelto' || t.estado === 'Cerrado' ? 'badge-green' : 
                      t.estado === 'En Progreso' ? 'badge-blue' : 'badge-gray'
                    }`}>
                      {t.estado}
                    </span>
                  </td>
                  <td>
                    {t.colaboradores ? `${t.colaboradores.nombre} ${t.colaboradores.apellido}` : '-'}
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {new Date(t.fecha_creacion).toLocaleDateString('es-AR')}
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

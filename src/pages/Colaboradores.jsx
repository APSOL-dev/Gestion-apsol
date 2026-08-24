import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users, Phone, Mail, Award } from 'lucide-react'
import { getColaboradores } from '../services/colaboradores'

export default function Colaboradores() {
  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getColaboradores()
      setColaboradores(data)
    } catch (error) {
      console.error('Error al cargar colaboradores:', error)
    } finally {
      setLoading(false)
    }
  }

  const colaboradoresFiltrados = colaboradores.filter(c => 
    `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase().includes(search.toLowerCase()) ||
    (c.puesto && c.puesto.toLowerCase().includes(search.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Colaboradores</h1>
          <p className="page-subtitle">Gestión de recursos humanos, roles y tarifas base</p>
        </div>
        <Link to="/colaboradores/nuevo" className="btn btn-primary">
          <Plus size={18} />
          Nuevo Colaborador
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="search-bar" style={{ maxWidth: '100%' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, puesto o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando colaboradores...</p>
        </div>
      ) : colaboradoresFiltrados.length === 0 ? (
        <div className="placeholder-card">
          <Users className="placeholder-icon" />
          <h3>No se encontraron colaboradores</h3>
          <p>{search ? 'Intenta con otro término de búsqueda.' : 'Comienza agregando personal a tu equipo.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Puesto / Rol</th>
                <th>Contacto</th>
                <th>Tarifa Base (Hora)</th>
                <th>Dedicación Mensual</th>
              </tr>
            </thead>
            <tbody>
              {colaboradoresFiltrados.map((c) => (
                <tr key={c.id} style={{ opacity: c.activo === false ? 0.6 : 1 }}>
                  <td>
                    <Link to={`/colaboradores/${c.id}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                      <div className="sidebar-avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
                        {(c.nombre || c.apellido || 'C').charAt(0)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{c.nombre} {c.apellido}</span>
                        {c.activo === false && <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>Inactivo</span>}
                      </div>
                    </Link>
                  </td>
                  <td>
                    {c.puesto ? (
                      <span className="badge badge-purple" style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                        <Award size={12} /> {c.puesto}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {c.email && (
                        <a href={`mailto:${c.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '12px' }}>
                          <Mail size={12} /> {c.email}
                        </a>
                      )}
                      {c.telefono && (
                        <a href={`tel:${c.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '12px' }}>
                          <Phone size={12} /> {c.telefono}
                        </a>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: '500' }}>
                    {c.tarifa_base_hora ? `$${Number(c.tarifa_base_hora).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td>
                    {c.dedicacion_mensual_horas ? `${c.dedicacion_mensual_horas} hs` : '-'}
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

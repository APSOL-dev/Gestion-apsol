import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, KeyRound, ExternalLink, ShieldAlert } from 'lucide-react'
import { getCredenciales } from '../services/credenciales'

export default function Credenciales() {
  const [credenciales, setCredenciales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroAmbito, setFiltroAmbito] = useState('Todos')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getCredenciales()
      setCredenciales(data)
    } catch (error) {
      console.error('Error al cargar credenciales:', error)
    } finally {
      setLoading(false)
    }
  }

  const credencialesFiltradas = credenciales.filter(c => {
    const matchSearch = 
      (c.sistema_plataforma && c.sistema_plataforma.toLowerCase().includes(search.toLowerCase())) ||
      (c.usuario && c.usuario.toLowerCase().includes(search.toLowerCase())) ||
      (c.empresas?.nombre && c.empresas.nombre.toLowerCase().includes(search.toLowerCase()))
      
    let matchAmbito = true
    if (filtroAmbito === 'Interno APSOL') matchAmbito = c.ambito === 'Interno APSOL'
    else if (filtroAmbito === 'Cliente') matchAmbito = c.ambito === 'Cliente'

    return matchSearch && matchAmbito
  })

  // Agrupar credenciales filtradas por ámbito para la vista
  const credencialesInternas = credencialesFiltradas.filter(c => c.ambito === 'Interno APSOL')
  const credencialesClientes = credencialesFiltradas.filter(c => c.ambito === 'Cliente')

  const renderTable = (creds, titulo) => {
    if (creds.length === 0) return null
    
    return (
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--color-primary)' }}>{titulo}</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Sistema / Plataforma</th>
                {titulo === 'Clientes' && <th>Empresa</th>}
                <th>Usuario / Email</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th style={{ width: '80px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {creds.map((c) => (
                <tr key={c.id} style={{ opacity: c.estado === 'Inactivo' ? 0.6 : 1 }}>
                  <td>
                    <Link to={`/credenciales/${c.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: '500' }}>
                      {c.sistema_plataforma}
                    </Link>
                  </td>
                  {titulo === 'Clientes' && <td>{c.empresas?.nombre || '-'}</td>}
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{c.usuario}</td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{c.tipo_acceso}</span>
                  </td>
                  <td>
                    <span className={`badge ${c.estado === 'Activo' ? 'badge-green' : 'badge-gray'}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td>
                    {c.link_acceso && (
                      <a href={c.link_acceso.startsWith('http') ? c.link_acceso : `https://${c.link_acceso}`} target="_blank" rel="noreferrer" title="Abrir Plataforma" style={{ color: 'var(--color-text-muted)' }}>
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bóveda de Credenciales</h1>
          <p className="page-subtitle">Gestión segura de accesos y contraseñas</p>
        </div>
        <Link to="/credenciales/nueva" className="btn btn-primary">
          <Plus size={18} />
          Nueva Credencial
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por sistema, usuario o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Todos', 'Interno APSOL', 'Cliente'].map(ambito => (
            <button 
              key={ambito}
              className={`btn ${filtroAmbito === ambito ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setFiltroAmbito(ambito)}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              {ambito}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando credenciales...</p>
        </div>
      ) : credencialesFiltradas.length === 0 ? (
        <div className="placeholder-card">
          <ShieldAlert className="placeholder-icon" />
          <h3>No hay credenciales</h3>
          <p>{search ? 'Intenta con otra búsqueda.' : 'No se encontraron registros.'}</p>
        </div>
      ) : (
        <div>
          {renderTable(credencialesInternas, 'Interno APSOL')}
          {renderTable(credencialesClientes, 'Clientes')}
        </div>
      )}
    </div>
  )
}

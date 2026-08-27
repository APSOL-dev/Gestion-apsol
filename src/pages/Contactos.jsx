import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users, Building2, Phone, Mail } from 'lucide-react'
import { useData } from '../context/DataContext'
import ContactoDrawer from '../components/ContactoDrawer'

export default function Contactos() {
  const { contactos, loadingContactos, refreshContactos } = useData()
  const [search, setSearch] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [contactoSeleccionadoId, setContactoSeleccionadoId] = useState(null)

  useEffect(() => {
    const esSilencioso = contactos.length > 0
    refreshContactos(esSilencioso)
  }, [])

  const contactosFiltrados = contactos.filter(contacto => {
    if (!mostrarInactivos && contacto.activo === false) return false
    return (
      `${contacto.nombre || ''} ${contacto.apellido || ''}`.toLowerCase().includes(search.toLowerCase()) ||
      (contacto.empresas?.nombre && contacto.empresas.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (contacto.email && contacto.email.toLowerCase().includes(search.toLowerCase()))
    )
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contactos</h1>
          <p className="page-subtitle">Gestiona las personas de las empresas cliente</p>
        </div>
        <Link to="/contactos/nuevo" className="btn btn-primary">
          <Plus size={18} />
          Nuevo Contacto
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <Search size={18} className="search-bar-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre, empresa o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setMostrarInactivos(v => !v)}
            className={mostrarInactivos ? 'btn btn-secondary' : 'btn btn-secondary'}
            style={{ whiteSpace: 'nowrap', opacity: mostrarInactivos ? 1 : 0.65, fontSize: '13px' }}
          >
            {mostrarInactivos ? 'Ocultar inactivos' : 'Mostrar inactivos'}
          </button>
        </div>
      </div>

      {loadingContactos ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando contactos...</p>
        </div>
      ) : contactosFiltrados.length === 0 ? (
        <div className="placeholder-card">
          <Users className="placeholder-icon" />
          <h3>No se encontraron contactos</h3>
          <p>{search ? 'Intenta con otro término de búsqueda.' : 'Comienza creando tu primer contacto.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>Cargo / Área</th>
                <th>Contacto</th>
                <th>Prospectos</th>
              </tr>
            </thead>
            <tbody>
              {contactosFiltrados.map((contacto) => (
                <tr
                  key={contacto.id}
                  onClick={() => setContactoSeleccionadoId(contacto.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ color: contacto.activo === false ? 'var(--color-text-muted)' : 'inherit', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                      <div className="sidebar-avatar" style={{ width: '28px', height: '28px', fontSize: '12px', opacity: contacto.activo === false ? 0.5 : 1 }}>
                        {(contacto.nombre || contacto.apellido || 'C').charAt(0)}
                      </div>
                      {contacto.nombre} {contacto.apellido}
                      {contacto.activo === false && (
                        <span style={{ fontSize: '11px', fontWeight: 500, background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', borderRadius: '999px', padding: '1px 7px' }}>Inactivo</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {contacto.empresas ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={14} className="text-primary" />
                        {contacto.empresas.nombre}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    {contacto.cargo || contacto.area ? (
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {[contacto.cargo, contacto.area].filter(Boolean).join(' / ')}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={e => e.stopPropagation()}>
                      {contacto.email && (
                        <a href={`mailto:${contacto.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '12px' }}>
                          <Mail size={12} /> {contacto.email}
                        </a>
                      )}
                      {contacto.telefono && (
                        <a href={`tel:${contacto.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '12px' }}>
                          <Phone size={12} /> {contacto.telefono}
                        </a>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-blue">
                      {contacto.prospectos?.[0]?.count || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contactoSeleccionadoId && (
        <ContactoDrawer
          id={contactoSeleccionadoId}
          onClose={() => setContactoSeleccionadoId(null)}
          onChanged={() => refreshContactos()}
        />
      )}
    </div>
  )
}

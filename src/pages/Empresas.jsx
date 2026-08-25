import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Building2, MapPin, Briefcase, Trash2, CheckSquare, Square } from 'lucide-react'
import { useData } from '../context/DataContext'
import { deleteEmpresa } from '../services/empresas'

export default function Empresas() {
  const { empresas, loadingEmpresas, refreshEmpresas } = useData()
  const [search, setSearch] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const esSilencioso = empresas.length > 0
    refreshEmpresas(esSilencioso)
  }, [])

  async function handleDelete(id, nombre) {
    const msg = `¿ESTÁS SEGURO? \n\nEliminar "${nombre}" también borrará permanentemente sus contactos y proyectos asociados. \n\nEsta acción no se puede deshacer.`
    if (!window.confirm(msg)) return

    setSaving(true)
    try {
      await deleteEmpresa(id)
      await refreshEmpresas()
      setSeleccionados(prev => prev.filter(sid => sid !== id))
    } catch (error) {
      console.error(error)
      alert(`No se pudo eliminar: ${error.message || 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteMultiple() {
    const msg = `¿ESTÁS SEGURO? \n\nVas a eliminar ${seleccionados.length} empresas y TODO su historial relacionado (contactos, proyectos, facturas, etc.). \n\nEsta acción es irreversible.`
    if (!window.confirm(msg)) return

    setSaving(true)
    try {
      // Borramos una por una para asegurar que el borrado profundo se ejecute bien
      for (const id of seleccionados) {
        await deleteEmpresa(id)
      }
      setSeleccionados([])
      await refreshEmpresas()
      alert('Empresas eliminadas correctamente')
    } catch (error) {
      console.error('Error en borrado múltiple:', error)
      alert(`Error al eliminar: ${error.message || 'Verifique su conexión'}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    )
  }

  const empresasFiltradas = empresas.filter(empresa => 
    empresa.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (empresa.industria && empresa.industria.toLowerCase().includes(search.toLowerCase()))
  )

  const estadosActivos = ['6A - En producción', '3A - Seguimiento', 'Nuevo']

  const conProspectosActivos = empresasFiltradas.filter(e => 
    e.prospectos?.some(p => estadosActivos.includes(p.estado))
  )
  const sinProspectosActivos = empresasFiltradas.filter(e => 
    !e.prospectos?.some(p => estadosActivos.includes(p.estado))
  )

  const renderTabla = (lista, titulo) => (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text)' }}>{titulo}</h2>
        <span className="badge badge-gray">{lista.length}</span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Empresa</th>
              <th>Industria</th>
              <th>Ubicación</th>
              <th>Tamaño</th>
              <th>Estado Prospectos</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((empresa) => {
              const activos = empresa.prospectos?.filter(p => estadosActivos.includes(p.estado)) || []
              const isSelected = seleccionados.includes(empresa.id)
              return (
                <tr key={empresa.id} style={{ background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                  <td>
                    <button 
                      type="button" 
                      onClick={() => toggleSeleccion(empresa.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                    >
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </td>
                  <td>
                    <Link to={`/empresas/${empresa.id}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                      <div className="sidebar-avatar" style={{ width: '28px', height: '28px', fontSize: '12px' }}>
                        {empresa.nombre.charAt(0)}
                      </div>
                      {empresa.nombre}
                    </Link>
                  </td>
                  <td>
                    {empresa.industria ? (
                      <span className="badge badge-gray" style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                        <Briefcase size={12} /> {empresa.industria}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {(empresa.provincia || empresa.pais) ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
                        <MapPin size={14} /> 
                        {[empresa.provincia, empresa.pais].filter(Boolean).join(', ')}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{empresa.tamaño_personas ? `${empresa.tamaño_personas} emp.` : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {activos.length > 0 ? (
                        activos.map((p, idx) => (
                          <span key={idx} className="badge badge-blue" style={{ fontSize: '10px' }}>
                            {p.estado.split('-')[1]?.trim() || p.estado}
                          </span>
                        ))
                      ) : (
                        <span style={{ opacity: 0.3, fontSize: '11px' }}>Sin prospectos activos</span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn btn-icon text-danger" 
                      onClick={() => handleDelete(empresa.id, empresa.nombre)}
                      title="Eliminar Empresa"
                      disabled={saving}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Empresas</h1>
          <p className="page-subtitle">Gestión de clientes y actividad comercial</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {seleccionados.length > 0 && (
            <button className="btn btn-danger" onClick={deleteMultiple} disabled={saving}>
              <Trash2 size={18} />
              Eliminar ({seleccionados.length})
            </button>
          )}
          <Link to="/empresas/nueva" className="btn btn-primary">
            <Plus size={18} />
            Nueva Empresa
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="search-bar" style={{ maxWidth: '100%' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre o industria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loadingEmpresas ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando empresas...</p>
        </div>
      ) : empresasFiltradas.length === 0 ? (
        <div className="placeholder-card">
          <Building2 className="placeholder-icon" />
          <h3>No se encontraron empresas</h3>
          <p>{search ? 'Intenta con otro término de búsqueda.' : 'Comienza creando tu primera empresa.'}</p>
        </div>
      ) : (
        <>
          {conProspectosActivos.length > 0 && renderTabla(conProspectosActivos, 'Empresas con Prospectos Activos')}
          {sinProspectosActivos.length > 0 && renderTabla(sinProspectosActivos, conProspectosActivos.length > 0 ? 'Otras Empresas' : 'Listado de Empresas')}
        </>
      )}
    </div>
  )
}

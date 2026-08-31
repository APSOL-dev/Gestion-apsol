import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FolderKanban, Building2, User, ChevronRight, ChevronDown } from 'lucide-react'
import { useData } from '../context/DataContext'
import { getEstadoProspectoStyle } from '../utils/formateo'
import { useNavegacionLista } from '../hooks/useNavegacionLista'
import ProspectoDrawer from '../components/ProspectoDrawer'

export default function Prospectos() {
  const { prospectos, loadingProspectos, refreshProspectos } = useData()
  const [search, setSearch] = useState('')
  const [filtroActivos, setFiltroActivos] = useState(true) // true = activos, false = historicos
  const [expandidos, setExpandidos] = useState({}) // { [estado]: boolean }
  const [prospectoSeleccionadoId, setProspectoSeleccionadoId] = useState(null)

  useEffect(() => {
    // Si ya hay prospectos en la caché global, hacemos un re-fetch silencioso (sin loader molesto)
    // De lo contrario (primera carga), mostramos el spinner normal.
    const esSilencioso = prospectos.length > 0
    refreshProspectos(esSilencioso)
    // Resetear expandidos al cambiar filtro
    setExpandidos({})
  }, [filtroActivos])

  const toggleExpandir = (estado) => {
    setExpandidos(prev => ({
      ...prev,
      [estado]: !prev[estado]
    }))
  }

  const prospectosFiltrados = prospectos.filter(prospecto => 
    prospecto.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (prospecto.empresas?.nombre && prospecto.empresas.nombre.toLowerCase().includes(search.toLowerCase())) ||
    (prospecto.estado && prospecto.estado.toLowerCase().includes(search.toLowerCase()))
  )

  // Agrupar prospectos por estado real
  const prospectosPorEstado = prospectosFiltrados.reduce((acc, p) => {
    const estado = p.estado || 'Nuevo'
    if (!acc[estado]) acc[estado] = []
    acc[estado].push(p)
    return acc
  }, {})

  // Orden lógico de los estados
  const ORDEN_ESTADOS = [
    'nuevo',
    '3a - seguimiento',
    '6a - en producción',
    '1h - caido previo reunión',
    '2h - caido en reunión',
    '3h - caido luego del presupuesto',
    '4h - no califica',
    '5h - finalizados'
  ]

  const todosLosEstados = Object.keys(prospectosPorEstado).sort((a, b) => {
    const indexA = ORDEN_ESTADOS.findIndex(e => a.toLowerCase().includes(e))
    const indexB = ORDEN_ESTADOS.findIndex(e => b.toLowerCase().includes(e))
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
  
  const estadosAMostrar = todosLosEstados.filter(estado => {
    const e = estado.toLowerCase()
    const esHistorico = e.includes('h -') || e.includes('finalizado')
    return filtroActivos ? !esHistorico : esHistorico
  })

  // ─── Navegación por teclado (↑↓ entre filas, Enter abre, Esc cierra) ────────
  // Solo son "navegables" las filas de las secciones expandidas, en el orden
  // en que se ven.
  const filasVisibles = estadosAMostrar.flatMap(estado =>
    expandidos[estado] ? (prospectosPorEstado[estado] || []) : []
  )
  const indicePorId = new Map(filasVisibles.map((p, i) => [p.id, i]))

  const { activo: filaActiva } = useNavegacionLista({
    total: filasVisibles.length,
    onActivar: (i) => setProspectoSeleccionadoId(filasVisibles[i]?.id ?? null),
    global: !prospectoSeleccionadoId,
  })

  const filaActivaRef = useRef(null)
  useEffect(() => {
    filaActivaRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [filaActiva])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Prospectos</h1>
          <p className="page-subtitle">Oportunidades de negocio y pipeline</p>
        </div>
        <Link to="/prospectos/nuevo" className="btn btn-primary">
          <Plus size={18} />
          Nuevo Prospecto
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, empresa o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${filtroActivos ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setFiltroActivos(true)}
          >
            Activos
          </button>
          <button 
            className={`btn ${!filtroActivos ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setFiltroActivos(false)}
          >
            Históricos (Cerrados)
          </button>
        </div>
      </div>

      {loadingProspectos ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando prospectos...</p>
        </div>
      ) : prospectosFiltrados.length === 0 ? (
        <div className="placeholder-card">
          <FolderKanban className="placeholder-icon" />
          <h3>No se encontraron prospectos</h3>
          <p>{search ? 'Intenta con otro término de búsqueda.' : 'Comienza creando tu primer prospecto.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {estadosAMostrar.map(estado => {
            const items = prospectosPorEstado[estado] || []
            const esExpandido = expandidos[estado] || false
            if (items.length === 0 && search) return null // No mostrar estados vacíos si hay búsqueda
            
            return (
              <div key={estado} className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                {/* Encabezado de la Tarjeta de Estado (Clickable) */}
                <div 
                  onClick={() => toggleExpandir(estado)}
                  className={`section-header ${esExpandido ? 'active' : ''}`}
                  style={{ 
                    padding: '16px 20px', 
                    background: esExpandido ? 'var(--color-surface2)' : 'white',
                    borderBottom: esExpandido ? '1px solid var(--color-border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      background: getEstadoProspectoStyle(estado).text 
                    }} />
                    <div style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '14px' }}>
                      {estado}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
                      {items.length}
                    </span>
                  </div>
                  <ChevronDown 
                    size={18} 
                    style={{ 
                      opacity: 0.4, 
                      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: esExpandido ? 'rotate(180deg)' : 'rotate(0)'
                    }} 
                  />
                </div>

                {esExpandido && (
                  <>
                    {items.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                    <p style={{ opacity: 0.6 }}>No hay prospectos en esta etapa.</p>
                  </div>
                ) : (
                  <div className="table-container" style={{ margin: '0', border: 'none', borderRadius: '0' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
                      <thead style={{ background: 'transparent' }}>
                        <tr>
                          <th style={{ paddingLeft: '20px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Prospecto</th>
                          <th style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Empresa / Contacto</th>
                          <th style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Estado</th>
                          <th style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Próx. Tarea</th>
                          <th style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Fecha</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((prospecto) => {
                          const idxFila = indicePorId.get(prospecto.id)
                          const filaSeleccionada = idxFila === filaActiva
                          return (
                          <tr
                            key={prospecto.id}
                            ref={filaSeleccionada ? filaActivaRef : null}
                            aria-selected={filaSeleccionada}
                            onClick={() => setProspectoSeleccionadoId(prospecto.id)}
                            style={{ cursor: 'pointer', background: filaSeleccionada ? 'var(--color-surface2, #eef2ff)' : undefined }}
                          >
                            <td style={{ paddingLeft: '20px' }}>
                              <div style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '14px' }}>
                                {prospecto.nombre}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {prospecto.empresas && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-text)' }}>
                                    <Building2 size={12} className="text-primary" style={{ opacity: 0.8 }} /> {prospecto.empresas.nombre}
                                  </span>
                                )}
                                {prospecto.contactos && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                                    <User size={12} style={{ opacity: 0.6 }} /> {prospecto.contactos.nombre} {prospecto.contactos.apellido}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span style={{ 
                                padding: '4px 10px', 
                                borderRadius: '12px', 
                                fontSize: '11px', 
                                fontWeight: '700', 
                                textTransform: 'uppercase',
                                background: getEstadoProspectoStyle(prospecto.estado).bg,
                                color: getEstadoProspectoStyle(prospecto.estado).text,
                                border: `1px solid ${getEstadoProspectoStyle(prospecto.estado).text}20`
                              }}>
                                {prospecto.estado || 'Nuevo'}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                                {prospecto.proxima_tarea || '-'}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: '13px' }}>
                                {prospecto.fecha_proxima_tarea ? (
                                  <span style={{ 
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: new Date(prospecto.fecha_proxima_tarea) < new Date() && !['ganado', 'perdido'].includes(prospecto.estado?.toLowerCase()) 
                                      ? '#fee2e2' 
                                      : 'transparent',
                                    color: new Date(prospecto.fecha_proxima_tarea) < new Date() && !['ganado', 'perdido'].includes(prospecto.estado?.toLowerCase()) 
                                      ? '#b91c1c' 
                                      : 'inherit',
                                    fontWeight: new Date(prospecto.fecha_proxima_tarea) < new Date() ? '600' : 'normal'
                                  }}>
                                    {new Date(prospecto.fecha_proxima_tarea).toLocaleDateString('es-AR')}
                                  </span>
                                ) : '-'}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                              <ChevronRight size={16} style={{ opacity: 0.2 }} />
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
            )
          })}
        </div>
      )}

      {prospectoSeleccionadoId && (
        <ProspectoDrawer
          id={prospectoSeleccionadoId}
          onClose={() => setProspectoSeleccionadoId(null)}
          onChanged={() => refreshProspectos()}
        />
      )}
    </div>
  )
}

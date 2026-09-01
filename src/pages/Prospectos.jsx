import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FolderKanban, Building2, User, ChevronRight, ChevronDown } from 'lucide-react'
import { useData } from '../context/DataContext'
import { getEstadoProspectoStyle, ordenarEstadosProspecto, tareaVencida, debeFacturarse } from '../utils/formateo'
import { useNavegacionLista } from '../hooks/useNavegacionLista'
import ProspectoDrawer from '../components/ProspectoDrawer'

export default function Prospectos() {
  const { prospectos, loadingProspectos, refreshProspectos, facturas } = useData()
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

  // Por defecto, toda sección arranca DESPLEGADA (no colapsada): un estado sin
  // entrada en `expandidos` (undefined) cuenta como expandido.
  const estaExpandido = (estado) => expandidos[estado] ?? true

  const toggleExpandir = (estado) => {
    setExpandidos(prev => ({
      ...prev,
      [estado]: !estaExpandido(estado)
    }))
  }

  const prospectosFiltrados = prospectos.filter(prospecto =>
    prospecto.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (prospecto.empresas?.nombre && prospecto.empresas.nombre.toLowerCase().includes(search.toLowerCase())) ||
    (prospecto.estado && prospecto.estado.toLowerCase().includes(search.toLowerCase()))
  )

  // Facturas agrupadas por prospecto, para saber si a un prospecto "en
  // producción" ya se le facturó desde su "Próxima Factura" o no.
  const facturasPorProspecto = (facturas || []).reduce((acc, f) => {
    if (!f.prospecto_id) return acc
    if (!acc[f.prospecto_id]) acc[f.prospecto_id] = []
    acc[f.prospecto_id].push(f)
    return acc
  }, {})

  // Agrupar prospectos por estado real
  const prospectosPorEstado = prospectosFiltrados.reduce((acc, p) => {
    const estado = p.estado || 'Nuevo'
    if (!acc[estado]) acc[estado] = []
    acc[estado].push(p)
    return acc
  }, {})

  // Orden lógico de los estados: 1A, 2A, ... 6A y después 1H...5H (ver
  // ordenarEstadosProspecto). BUG real: la lista hardcodeada de acá no tenía
  // "1A - Pendiente de contactar" (ni 2A/4A/5A), así que ese estado caía al
  // final en vez de ir arriba de todo.
  const todosLosEstados = ordenarEstadosProspecto(Object.keys(prospectosPorEstado))

  const estadosAMostrar = todosLosEstados.filter(estado => {
    const e = estado.toLowerCase()
    const esHistorico = e.includes('h -') || e.includes('finalizado')
    return filtroActivos ? !esHistorico : esHistorico
  })

  // ─── Navegación por teclado (↑↓ entre filas, Enter abre, Esc cierra) ────────
  // Solo son "navegables" las filas de las secciones expandidas, en el orden
  // en que se ven.
  const filasVisibles = estadosAMostrar.flatMap(estado =>
    estaExpandido(estado) ? (prospectosPorEstado[estado] || []) : []
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
            const esExpandido = estaExpandido(estado)
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
                          // Alerta: la próxima tarea (contactar, enviar presupuesto,
                          // facturar, lo que sea) ya venció -> se remarca en rojo.
                          const vencida = tareaVencida(prospecto.fecha_proxima_tarea)
                          // Alerta de facturación: solo aplica a "en producción" —
                          // próxima factura hoy o vencida y todavía no facturada.
                          const enProduccion = (prospecto.estado || '').toLowerCase().includes('6a')
                          const hayQueFacturar = enProduccion && debeFacturarse(prospecto, facturasPorProspecto[prospecto.id])
                          return (
                          <tr
                            key={prospecto.id}
                            ref={filaSeleccionada ? filaActivaRef : null}
                            aria-selected={filaSeleccionada}
                            onClick={() => setProspectoSeleccionadoId(prospecto.id)}
                            style={{ cursor: 'pointer', background: filaSeleccionada ? 'var(--color-surface2, #eef2ff)' : undefined }}
                          >
                            <td style={{ paddingLeft: '20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '14px' }}>
                                  {prospecto.nombre}
                                </div>
                                {hayQueFacturar && (
                                  <span
                                    title="La próxima factura de este prospecto es hoy o ya venció y todavía no se emitió"
                                    style={{
                                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                                      padding: '2px 8px', borderRadius: '10px',
                                      background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca'
                                    }}
                                  >
                                    Facturar
                                  </span>
                                )}
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
                              <span style={{ color: vencida ? '#b91c1c' : 'var(--color-text-muted)', fontSize: '13px', fontWeight: vencida ? '600' : 'normal' }}>
                                {prospecto.proxima_tarea || '-'}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: '13px' }}>
                                {prospecto.fecha_proxima_tarea ? (
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: vencida ? '#fee2e2' : 'transparent',
                                    color: vencida ? '#b91c1c' : 'inherit',
                                    fontWeight: vencida ? '600' : 'normal'
                                  }}>
                                    {String(prospecto.fecha_proxima_tarea).split('T')[0].split('-').reverse().join('/')}
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

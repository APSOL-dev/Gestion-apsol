import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Pencil, Trash2, Building2, User, Mail, Phone, Clock, Receipt, MessageSquare, ChevronDown, Briefcase, Paperclip } from 'lucide-react'
import { getProspectoById, saveProspecto, deleteProspecto, saveObservacion } from '../services/prospectos'
import { getEstadoProspectoStyle, ESTADOS_PROSPECTO } from '../utils/formateo'

function parseAdjuntos(adjuntosStr) {
  try {
    return JSON.parse(adjuntosStr || '[]')
  } catch {
    return []
  }
}

export default function ProspectoDrawer({ id, onClose, onChanged }) {
  const navigate = useNavigate()
  const [prospecto, setProspecto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [mostrarSelectorEstado, setMostrarSelectorEstado] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [nuevaObs, setNuevaObs] = useState('')
  const [savingObs, setSavingObs] = useState(false)

  async function cargarDetalle() {
    setLoading(true)
    setError('')
    try {
      const data = await getProspectoById(id)
      setProspecto(data)
    } catch (err) {
      console.error('Error al cargar detalle de prospecto:', err)
      setError('No se pudo cargar la información del prospecto.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) cargarDetalle()
  }, [id])

  async function handleEliminar() {
    if (!window.confirm('¿Estás seguro de eliminar este prospecto?')) return
    setEliminando(true)
    try {
      await deleteProspecto(id)
      onClose()
      if (onChanged) onChanged()
    } catch (err) {
      console.error('Error al eliminar el prospecto:', err)
      alert('No se pudo eliminar: ' + (err.message || 'Error desconocido'))
    } finally {
      setEliminando(false)
    }
  }

  // Cambio rápido de estado sin salir del panel. Pasar a "6A - En producción"
  // requiere completar datos operativos (tarifa, cuenta, frecuencia, etc.)
  // que no entran en esta vista rápida, así que para esa transición se abre
  // la ficha completa (misma lógica que el modal de cambio de estado allí).
  async function handleCambiarEstado(nuevoEstado) {
    setMostrarSelectorEstado(false)
    if (!nuevoEstado || nuevoEstado === prospecto.estado) return

    if (nuevoEstado.includes('6A')) {
      navigate(`/prospectos/${id}`)
      return
    }

    setCambiandoEstado(true)
    try {
      const saved = await saveProspecto({
        id,
        estado: nuevoEstado,
        fecha_ultimo_cambio_estado: new Date().toISOString()
      })
      setProspecto(prev => ({ ...prev, ...saved }))
      await saveObservacion({ prospecto_id: id, observacion: `Cambio de estado: ${saved.estado}` })
      await cargarDetalle()
      if (onChanged) onChanged()
    } catch (err) {
      console.error('Error al cambiar el estado:', err)
      alert('No se pudo cambiar el estado.')
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function handleAgregarObservacion(e) {
    e.preventDefault()
    if (!nuevaObs.trim()) return
    setSavingObs(true)
    try {
      const creada = await saveObservacion({ prospecto_id: id, observacion: nuevaObs.trim() })
      setProspecto(prev => ({ ...prev, observaciones: [creada, ...(prev.observaciones || [])] }))
      setNuevaObs('')
    } catch (err) {
      console.error('Error al agregar observación:', err)
      alert('No se pudo guardar la observación.')
    } finally {
      setSavingObs(false)
    }
  }

  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '-'
    const parts = fechaStr.split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    return new Date(fechaStr).toLocaleDateString('es-AR')
  }

  if (!id) return null

  const tieneDatosProduccion = prospecto && (
    prospecto.inicio_servicio || prospecto.tarifa_base || prospecto.hs_mensuales ||
    prospecto.mensualidad_vigente_actual || prospecto.proxima_factura
  )
  const adjuntosList = prospecto ? parseAdjuntos(prospecto.adjuntos) : []
  const estadoStyle = prospecto ? getEstadoProspectoStyle(prospecto.estado) : { bg: '#f1f5f9', text: '#475569' }

  // Portal a <body>: evita que un ancestro con `transform` (p.ej. `.page` con
  // su animación de entrada) se vuelva containing block y recorte el overlay.
  return createPortal(
    <>
      <div
        data-testid="drawer-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.25)', zIndex: 999,
          backdropFilter: 'blur(1px)', animation: 'fadeIn 0.2s ease-out'
        }}
      />

      <div
        data-testid="drawer-panel"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '460px',
          backgroundColor: '#fff', boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>
              {prospecto?.nombre || 'Cargando...'}
            </h2>
            <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0', fontWeight: '500' }}>
              {prospecto?.empresas?.nombre || 'Sin empresa asociada'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {!loading && prospecto && (
              <>
                <button
                  onClick={() => navigate(`/prospectos/${id}`)}
                  title="Editar Prospecto"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#385723', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  className="btn-hover-circle"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={handleEliminar}
                  disabled={eliminando}
                  title="Eliminar Prospecto"
                  style={{ border: 'none', background: 'transparent', cursor: eliminando ? 'default' : 'pointer', color: '#d9534f', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: eliminando ? 0.5 : 1 }}
                  className="btn-hover-circle"
                >
                  <Trash2 size={18} />
                </button>
                <div style={{ width: '1px', height: '20px', background: '#eee', margin: '0 4px' }} />
              </>
            )}
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#888', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              className="btn-hover-circle"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '12px' }}>
              <div className="loading-spinner" style={{ width: '28px', height: '28px', border: '3px solid #ccc', borderTopColor: '#385723', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Cargando detalles...</p>
            </div>
          ) : error ? (
            <div style={{ color: '#d9534f', textAlign: 'center', padding: '20px' }}>{error}</div>
          ) : !prospecto ? (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No se pudo encontrar la información del prospecto.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Estado (acción rápida de cambio) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {mostrarSelectorEstado ? (
                  <select
                    autoFocus
                    value={prospecto.estado || 'Nuevo'}
                    onChange={e => handleCambiarEstado(e.target.value)}
                    onBlur={() => setMostrarSelectorEstado(false)}
                    disabled={cambiandoEstado}
                    style={{
                      padding: '6px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold',
                      border: `1px solid ${estadoStyle.text}`, background: estadoStyle.bg, color: estadoStyle.text
                    }}
                  >
                    {ESTADOS_PROSPECTO.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMostrarSelectorEstado(true)}
                    title="Cambiar estado"
                    style={{
                      padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                      border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: estadoStyle.bg, color: estadoStyle.text
                    }}
                  >
                    {prospecto.estado || 'Nuevo'} <ChevronDown size={12} />
                  </button>
                )}
                {cambiandoEstado && <span style={{ fontSize: '11px', color: '#999' }}>Guardando...</span>}
              </div>

              {/* Empresa y Contacto */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Building2 size={13} /> Empresa</span>
                  <span style={{ fontWeight: '500', color: '#333' }}>{prospecto.empresas?.nombre || '-'}</span>
                </div>
                {prospecto.canal_contacto && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#777' }}>Canal de Contacto</span>
                    <span style={{ fontWeight: '500', color: '#333' }}>{prospecto.canal_contacto}</span>
                  </div>
                )}
                {prospecto.contactos && (
                  <>
                    <div style={{ borderTop: '1px dashed #eee', margin: '2px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={13} /> Contacto</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>{prospecto.contactos.nombre} {prospecto.contactos.apellido}</span>
                    </div>
                    {prospecto.contactos.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} /> Email</span>
                        <span style={{ color: '#333' }}>{prospecto.contactos.email}</span>
                      </div>
                    )}
                    {prospecto.contactos.telefono && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} /> Teléfono</span>
                        <span style={{ color: '#333' }}>{prospecto.contactos.telefono}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Próxima Tarea */}
              {(prospecto.proxima_tarea || prospecto.fecha_proxima_tarea) && (
                <div style={{ backgroundColor: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: '6px', padding: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a56db', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> Próxima Tarea
                  </h3>
                  <div style={{ fontSize: '13px', color: '#333', marginBottom: '6px' }}>{prospecto.proxima_tarea || '-'}</div>
                  <div style={{ fontSize: '12px', color: '#555' }}>{formatFecha(prospecto.fecha_proxima_tarea)}</div>
                </div>
              )}

              {/* Comercial: necesidad, presupuesto, servicios requeridos */}
              {(prospecto.necesidad || prospecto.presupuesto || (prospecto.servicios_requeridos || []).length > 0) && (
                <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {prospecto.necesidad && (
                    <div style={{ fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Necesidad</span>
                      <p style={{ margin: '4px 0 0 0', color: '#333' }}>{prospecto.necesidad}</p>
                    </div>
                  )}
                  {prospecto.presupuesto && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Presupuesto</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>{prospecto.presupuesto}</span>
                    </div>
                  )}
                  {(prospecto.servicios_requeridos || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {prospecto.servicios_requeridos.map(s => (
                        <span key={s} className="badge badge-gray" style={{ fontSize: '11px' }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Datos de Producción */}
              {tieneDatosProduccion && (
                <div style={{ backgroundColor: '#f4f9f4', border: '1px solid #c5e0b4', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#385723', margin: '0 0 4px 0' }}>Producción</h3>
                  {prospecto.inicio_servicio && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Inicio de Servicio</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>{formatFecha(prospecto.inicio_servicio)}</span>
                    </div>
                  )}
                  {prospecto.tarifa_base != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Tarifa Base</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>{prospecto.tarifa_base} {prospecto.indice_cobro || ''}</span>
                    </div>
                  )}
                  {prospecto.mensualidad_vigente_actual != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Mensualidad Vigente</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>{prospecto.mensualidad_vigente_actual} {prospecto.moneda_cobro || ''}</span>
                    </div>
                  )}
                  {prospecto.hs_mensuales != null && Number(prospecto.hs_mensuales) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Horas Mensuales</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>{prospecto.hs_mensuales}</span>
                    </div>
                  )}
                  {prospecto.proxima_factura && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Próxima Factura</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>{formatFecha(prospecto.proxima_factura)}</span>
                    </div>
                  )}
                  {prospecto.ultima_actualizacion_tarifa && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Última Act. Tarifa</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>{formatFecha(prospecto.ultima_actualizacion_tarifa)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Facturación asociada */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Receipt size={15} /> Facturación ({(prospecto.facturacion || []).length})
                </h3>
                {(prospecto.facturacion || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>Sin facturas registradas.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {prospecto.facturacion.map(f => (
                      <div
                        key={f.id}
                        onClick={() => navigate(`/facturacion/${f.id}`)}
                        style={{ padding: '10px 12px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}>
                          {f.numero_factura ? `#${f.numero_factura}` : 'Sin número'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#777' }}>{f.estado}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Proyectos asociados */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={15} /> Proyectos ({(prospecto.proyectos || []).length})
                </h3>
                {(prospecto.proyectos || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>Sin proyectos registrados.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {prospecto.proyectos.map(pr => (
                      <div
                        key={pr.id}
                        onClick={() => navigate(`/proyectos/${pr.id}`)}
                        style={{ padding: '10px 12px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}>{pr.nombre}</span>
                        <span style={{ fontSize: '11px', color: '#777' }}>{pr.estado}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Adjuntos */}
              {adjuntosList.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={15} /> Adjuntos ({adjuntosList.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {adjuntosList.map((adj, idx) => (
                      <a
                        key={idx}
                        href={adj.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: '8px 12px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '6px', fontSize: '13px', color: '#385723', fontWeight: '600', textDecoration: 'none' }}
                      >
                        {adj.titulo || 'Ver adjunto'}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={15} /> Observaciones ({(prospecto.observaciones || []).length})
                </h3>

                <form onSubmit={handleAgregarObservacion} style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder="Agregar una observación..."
                    value={nuevaObs}
                    onChange={e => setNuevaObs(e.target.value)}
                    style={{ flex: 1, border: '1px solid #ddd', borderRadius: '4px', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    type="submit"
                    disabled={savingObs || !nuevaObs.trim()}
                    style={{ background: '#385723', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {savingObs ? '...' : 'Agregar'}
                  </button>
                </form>

                {(prospecto.observaciones || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>Sin observaciones registradas.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {prospecto.observaciones
                      .slice()
                      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                      .map(o => (
                        <div key={o.id} style={{ padding: '10px 12px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '6px', fontSize: '12px' }}>
                          <p style={{ margin: '0 0 4px 0', color: '#333' }}>{o.observacion}</p>
                          <div style={{ color: '#999', fontSize: '11px' }}>
                            {o.usuarios ? `${o.usuarios.nombre} ${o.usuarios.apellido || ''} · ` : ''}{formatFecha(o.fecha?.split('T')[0])}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      <style>{`
        .btn-hover-circle:hover {
          background-color: #f0f0f0 !important;
          color: #333 !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>,
    document.body
  )
}

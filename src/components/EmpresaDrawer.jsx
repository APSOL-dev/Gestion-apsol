import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Pencil, Trash2, MapPin, Briefcase, Users, Target, FileText, Mail, Phone, ChevronDown, ChevronRight } from 'lucide-react'
import { getEmpresaById, deleteEmpresa } from '../services/empresas'
import { getEstadoProspectoStyle } from '../utils/formateo'
import { useDrawerTeclado } from '../hooks/useDrawerTeclado'

export default function EmpresaDrawer({ id, onClose, onChanged }) {
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [contactoExpandidoId, setContactoExpandidoId] = useState(null)
  const panelRef = useRef(null)

  // Esc cierra, Tab queda atrapado dentro del panel, y el foco vuelve al
  // disparador al cerrar. Ver src/hooks/useDrawerTeclado.js
  useDrawerTeclado({ onClose, panelRef, activo: !!id })

  async function cargarDetalle() {
    setLoading(true)
    setError('')
    try {
      const data = await getEmpresaById(id)
      setEmpresa(data)
    } catch (err) {
      console.error('Error al cargar detalle de empresa:', err)
      setError('No se pudo cargar la información de la empresa.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) cargarDetalle()
  }, [id])

  async function handleEliminar() {
    const confirmar = window.confirm(
      `¿ESTÁS SEGURO?\n\nEliminar "${empresa.nombre}" también borrará permanentemente sus contactos y proyectos asociados.\n\nEsta acción no se puede deshacer.`
    )
    if (!confirmar) return

    setEliminando(true)
    try {
      await deleteEmpresa(id)
      onClose()
      if (onChanged) onChanged()
    } catch (err) {
      console.error('Error al eliminar la empresa:', err)
      alert('No se pudo eliminar: ' + (err.message || 'Error desconocido'))
    } finally {
      setEliminando(false)
    }
  }

  if (!id) return null

  // Portal a <body>: evita que un ancestro con `transform` (p.ej. `.page` con
  // su animación de entrada) se vuelva containing block y recorte el overlay.
  return createPortal(
    <>
      {/* Overlay translúcido de fondo */}
      <div
        data-testid="drawer-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.25)', zIndex: 999,
          backdropFilter: 'blur(1px)', animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* Panel lateral */}
      <div
        data-testid="drawer-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '460px',
          backgroundColor: '#fff', boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Cabecera */}
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>
              {empresa?.nombre || 'Cargando...'}
            </h2>
            <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0', fontWeight: '500' }}>
              {empresa?.industria || 'Sin industria asignada'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {!loading && empresa && (
              <>
                <button
                  onClick={() => navigate(`/empresas/${id}`)}
                  title="Editar Empresa"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#385723', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  className="btn-hover-circle"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={handleEliminar}
                  disabled={eliminando}
                  title="Eliminar Empresa"
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

        {/* Contenido con scroll */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '12px' }}>
              <div className="loading-spinner" style={{ width: '28px', height: '28px', border: '3px solid #ccc', borderTopColor: '#385723', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Cargando detalles...</p>
            </div>
          ) : error ? (
            <div style={{ color: '#d9534f', textAlign: 'center', padding: '20px' }}>{error}</div>
          ) : !empresa ? (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No se pudo encontrar la información de la empresa.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Datos institucionales */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> Ubicación</span>
                  <span style={{ fontWeight: '500', color: '#333' }}>
                    {[empresa.provincia, empresa.pais].filter(Boolean).join(', ') || '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Briefcase size={13} /> Tamaño</span>
                  <span style={{ fontWeight: '500', color: '#333' }}>
                    {empresa.tamanio ? `${empresa.tamanio} empleados` : '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#777' }}>Días espera facturación</span>
                  <span style={{ fontWeight: '500', color: '#333' }}>{empresa.dias_espera_facturacion ?? '-'}</span>
                </div>
              </div>

              {/* Razones Sociales */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={15} /> Razones Sociales
                </h3>
                {(empresa.razones_sociales || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>Sin razones sociales cargadas.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {empresa.razones_sociales.map(rs => (
                      <div key={rs.id} style={{ padding: '10px 12px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '6px' }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}>{rs.razon_social}</div>
                        <div style={{ fontSize: '11px', color: '#777' }}>{rs.cuit || 'Sin CUIT'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contactos (vista previa, sin salir del panel) */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} /> Contactos ({(empresa.contactos || []).length})
                </h3>
                {(empresa.contactos || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>Sin contactos asociados.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {empresa.contactos.map(c => {
                      const expandido = contactoExpandidoId === c.id
                      return (
                        <div key={c.id} style={{ border: '1px solid #eee', borderRadius: '6px', overflow: 'hidden' }}>
                          <div
                            onClick={() => setContactoExpandidoId(expandido ? null : c.id)}
                            style={{ padding: '10px 12px', background: '#f9f9f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <span style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}>{c.nombre} {c.apellido}</span>
                            {expandido ? <ChevronDown size={14} opacity={0.5} /> : <ChevronRight size={14} opacity={0.5} />}
                          </div>
                          {expandido && (
                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#555' }}>
                                <Mail size={12} /> {c.email || 'Sin email'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#555' }}>
                                <Phone size={12} /> {c.telefono || 'Sin teléfono'}
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate(`/contactos/${c.id}`)}
                                style={{ alignSelf: 'flex-start', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #385723', color: '#385723', background: 'transparent', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                <Pencil size={11} /> Editar Contacto
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Prospectos / Proyectos */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={15} /> Prospectos / Proyectos ({(empresa.prospectos || []).length})
                </h3>
                {(empresa.prospectos || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>Sin proyectos registrados.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {empresa.prospectos.map(p => (
                      <div
                        key={p.id}
                        onClick={() => navigate(`/prospectos/${p.id}`)}
                        style={{ padding: '10px 12px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
                      >
                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}>{p.nombre}</span>
                        <span style={{
                          padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                          background: getEstadoProspectoStyle(p.estado).bg, color: getEstadoProspectoStyle(p.estado).text
                        }}>
                          {p.estado || 'Nuevo'}
                        </span>
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

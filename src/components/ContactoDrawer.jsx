import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Pencil, UserMinus, UserPlus, Building2, Mail, Phone, Briefcase, Target } from 'lucide-react'
import { getContactoById, desactivarContacto, activarContacto } from '../services/contactos'
import { getEstadoProspectoStyle } from '../utils/formateo'
import { useDrawerTeclado } from '../hooks/useDrawerTeclado'

export default function ContactoDrawer({ id, onClose, onChanged }) {
  const navigate = useNavigate()
  const [contacto, setContacto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const panelRef = useRef(null)

  // Esc cierra, Tab queda atrapado dentro del panel, y el foco vuelve al
  // disparador al cerrar. Ver src/hooks/useDrawerTeclado.js
  useDrawerTeclado({ onClose, panelRef, activo: !!id })

  async function cargarDetalle() {
    setLoading(true)
    setError('')
    try {
      const data = await getContactoById(id)
      setContacto(data)
    } catch (err) {
      console.error('Error al cargar detalle de contacto:', err)
      setError('No se pudo cargar la información del contacto.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) cargarDetalle()
  }, [id])

  async function handleToggleActivo() {
    const accion = contacto.activo ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Estás seguro de ${accion} este contacto?`)) return
    setCambiandoEstado(true)
    try {
      if (contacto.activo) {
        await desactivarContacto(id)
        setContacto(prev => ({ ...prev, activo: false }))
      } else {
        await activarContacto(id)
        setContacto(prev => ({ ...prev, activo: true }))
      }
      if (onChanged) onChanged()
    } catch (err) {
      console.error('Error al cambiar estado del contacto:', err)
      alert('No se pudo actualizar el contacto.')
    } finally {
      setCambiandoEstado(false)
    }
  }

  if (!id) return null

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
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>
              {contacto ? `${contacto.nombre} ${contacto.apellido || ''}` : 'Cargando...'}
            </h2>
            <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0', fontWeight: '500' }}>
              {contacto?.empresas?.nombre || 'Sin empresa asociada'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {!loading && contacto && (
              <>
                <button
                  onClick={() => navigate(`/contactos/${id}`)}
                  title="Editar Contacto"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#385723', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  className="btn-hover-circle"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={handleToggleActivo}
                  disabled={cambiandoEstado}
                  title={contacto.activo ? 'Desactivar Contacto' : 'Activar Contacto'}
                  style={{ border: 'none', background: 'transparent', cursor: cambiandoEstado ? 'default' : 'pointer', color: contacto.activo ? '#d9534f' : '#385723', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: cambiandoEstado ? 0.5 : 1 }}
                  className="btn-hover-circle"
                >
                  {contacto.activo ? <UserMinus size={18} /> : <UserPlus size={18} />}
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
          ) : !contacto ? (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No se pudo encontrar la información del contacto.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {contacto.activo === false && (
                <span style={{ alignSelf: 'flex-start', fontSize: '11px', fontWeight: 500, background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', borderRadius: '999px', padding: '3px 10px' }}>
                  Inactivo
                </span>
              )}

              {/* Datos de contacto */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Building2 size={13} /> Empresa</span>
                  <span style={{ fontWeight: '500', color: '#333' }}>{contacto.empresas?.nombre || '-'}</span>
                </div>
                {(contacto.cargo || contacto.area) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Briefcase size={13} /> Cargo / Área</span>
                    <span style={{ fontWeight: '500', color: '#333' }}>{[contacto.cargo, contacto.area].filter(Boolean).join(' / ')}</span>
                  </div>
                )}
                {contacto.email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={13} /> Email</span>
                    <a href={`mailto:${contacto.email}`} style={{ color: '#385723', fontWeight: '500', textDecoration: 'none' }}>{contacto.email}</a>
                  </div>
                )}
                {contacto.telefono && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={13} /> Teléfono</span>
                    <a href={`tel:${contacto.telefono}`} style={{ color: '#385723', fontWeight: '500', textDecoration: 'none' }}>{contacto.telefono}</a>
                  </div>
                )}
              </div>

              {/* Prospectos asociados */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={15} /> Prospectos ({(contacto.prospectos || []).length})
                </h3>
                {(contacto.prospectos || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>Sin prospectos asociados.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {contacto.prospectos.map(p => (
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

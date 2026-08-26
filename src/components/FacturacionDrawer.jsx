import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Calendar, DollarSign, MessageCircle, ArrowUpRight, Plus, Trash2 } from 'lucide-react'
import { getFacturaById, savePago, deletePago } from '../services/facturacion'

export default function FacturacionDrawer({ id, onClose, onPagoRegistrado }) {
  const navigate = useNavigate()
  const [factura, setFactura] = useState(null)
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingPago, setSavingPago] = useState(false)
  const [mostrandoFormPago, setMostrandoFormPago] = useState(false)
  const [nuevoPago, setNuevoPago] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: '',
    observaciones: ''
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      cargarDetalle()
    }
  }, [id])

  async function cargarDetalle() {
    setLoading(true)
    setError('')
    try {
      const data = await getFacturaById(id)
      if (!data || !data.id) {
        setError('La factura no existe o no tienes permisos para verla.')
        setFactura(null)
        setPagos([])
        return
      }
      setFactura(data)
      setPagos(data.pagos || [])
      // Pre-cargar el monto pendiente en el formulario de pago
      setNuevoPago(prev => ({
        ...prev,
        monto: data.saldo_pendiente > 0 ? data.saldo_pendiente : ''
      }))
    } catch (err) {
      console.error('Error al cargar detalle de factura:', err)
      setError('No se pudo cargar la información de la factura.')
    } finally {
      setLoading(false)
    }
  }

  // Formateo seguro de fecha DD/MM/AAAA
  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '-'
    const parts = fechaStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return new Date(fechaStr).toLocaleDateString('es-AR')
  }

  // Calcular retraso en días
  const getRetrasoDias = () => {
    if (!factura || factura.estado === 'Cobrada total') return 0
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const emision = new Date(factura.fecha_emision)
    emision.setHours(0, 0, 0, 0)
    const diffTime = hoy - emision
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
  }

  // Manejar guardado de pago rápido
  async function handleSubmitPago(e) {
    e.preventDefault()
    if (!nuevoPago.monto || Number(nuevoPago.monto) <= 0) return

    setSavingPago(true)
    try {
      await savePago({
        facturacion_id: id,
        fecha: nuevoPago.fecha,
        monto: Number(nuevoPago.monto),
        observaciones: nuevoPago.observaciones || 'Pago registrado desde panel rápido'
      })
      // Limpiar y ocultar form
      setNuevoPago({
        fecha: new Date().toISOString().split('T')[0],
        monto: '',
        observaciones: ''
      })
      setMostrandoFormPago(false)
      // Recargar datos locales
      await cargarDetalle()
      // Notificar al componente padre para que actualice la tabla principal
      if (onPagoRegistrado) onPagoRegistrado()
    } catch (err) {
      console.error('Error al registrar pago:', err)
      alert('Error al guardar el pago.')
    } finally {
      setSavingPago(false)
    }
  }

  // Manejar borrado de pago
  async function handleDeletePago(pagoId) {
    if (!window.confirm('¿Estás seguro de eliminar este pago?')) return
    try {
      await deletePago(pagoId)
      await cargarDetalle()
      if (onPagoRegistrado) onPagoRegistrado()
    } catch (err) {
      console.error('Error al eliminar pago:', err)
      alert('Error al eliminar el pago.')
    }
  }

  // Generar link de WhatsApp
  const handleEnviarWhatsApp = () => {
    if (!factura) return
    const whatsappContacto = factura.contactos?.whatsapp || factura.contactos?.telefono || ''
    if (!whatsappContacto) {
      alert('El contacto no tiene teléfono registrado.')
      return
    }

    const cleanPhone = whatsappContacto.replace(/[^0-9]/g, '')
    const totalFormateado = Number(factura.monto_bruto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })
    const saldoFormateado = Number(factura.saldo_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })
    const empresaNombre = factura.prospectos?.empresas?.nombre || 'APSOL'

    const mensaje = `Hola *${factura.contactos?.nombre || ''}*, te recordamos que el saldo pendiente de cobro para *${empresaNombre}* es de *\$${saldoFormateado}* (Monto factura: \$${totalFormateado}). Agradecemos tu gestión de pago. Saludos de APSOL.`
    
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  // Obtener estilo de badge de estado
  const getBadgeStyle = () => {
    if (!factura) return {}
    switch (factura.estado) {
      case 'Cobrada total':
        return { backgroundColor: '#e2f0d9', color: '#385723', border: '1px solid #c5e0b4' }
      case 'Cobrada parcial':
        return { backgroundColor: '#fff2cc', color: '#7f6000', border: '1px solid #ffe599' }
      default:
        return { backgroundColor: '#fce4d6', color: '#c55a11', border: '1px solid #f8cbad' }
    }
  }

  if (!id) return null

  return (
    <>
      {/* Overlay translúcido de fondo */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          zIndex: 999,
          backdropFilter: 'blur(1px)',
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* Panel lateral */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '460px',
          backgroundColor: '#fff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Cabecera del Drawer */}
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>
              Factura {factura?.numero_factura ? `#${factura.numero_factura}` : '-'}
            </h2>
            <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0', fontWeight: '500' }}>
              {factura?.prospectos?.empresas?.nombre || 'Cargando...'}
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#888', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className="btn-hover-circle"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '12px' }}>
              <div className="loading-spinner" style={{ width: '28px', height: '28px', border: '3px solid #ccc', borderTopColor: '#385723', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Cargando detalles...</p>
            </div>
          ) : error ? (
            <div style={{ color: '#d9534f', textAlign: 'center', padding: '20px' }}>{error}</div>
          ) : !factura ? (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No se pudo encontrar la información de la factura.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Badge de Estado y Botón WhatsApp */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ 
                  padding: '6px 12px', 
                  borderRadius: '16px', 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  ...getBadgeStyle()
                }}>
                  {factura.estado}
                </span>

                {(factura.contactos?.whatsapp || factura.contactos?.telefono) && (
                  <button 
                    onClick={handleEnviarWhatsApp}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#25D366',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                )}
              </div>

              {/* Tarjetas Financieras */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '6px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '11px', color: '#777', fontWeight: '500' }}>Monto Total</span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginTop: '4px' }}>
                    ${Number(factura.monto_bruto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ 
                  backgroundColor: factura.saldo_pendiente > 0 ? '#fdf2e9' : '#f4f9f4', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  border: factura.saldo_pendiente > 0 ? '1px solid #f8cbad' : '1px solid #c5e0b4' 
                }}>
                  <span style={{ fontSize: '11px', color: factura.saldo_pendiente > 0 ? '#c55a11' : '#385723', fontWeight: '500' }}>Saldo Pendiente</span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: factura.saldo_pendiente > 0 ? '#c55a11' : '#385723', marginTop: '4px' }}>
                    ${Number(factura.saldo_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Información General */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#777' }}>Fecha Emisión</span>
                  <span style={{ fontWeight: '500', color: '#333' }}>{formatFecha(factura.fecha_emision)}</span>
                </div>
                {factura.periodo_desde && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#777' }}>Período</span>
                    <span style={{ fontWeight: '500', color: '#333' }}>
                      {formatFecha(factura.periodo_desde)} - {formatFecha(factura.periodo_hasta)}
                    </span>
                  </div>
                )}
                {getRetrasoDias() > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#d9534f' }}>Retraso de Cobro</span>
                    <span style={{ fontWeight: 'bold', color: '#d9534f' }}>{getRetrasoDias()} días</span>
                  </div>
                )}
                <div style={{ borderTop: '1px dashed #eee', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#777' }}>Última Notificación</span>
                  <span style={{ fontWeight: '500', color: '#333' }}>{formatFecha(factura.ultima_notificacion)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#777' }}>Próxima Notificación</span>
                  <span style={{ fontWeight: '500', color: '#333' }}>{formatFecha(factura.proxima_notificacion)}</span>
                </div>
                {factura.contactos && (
                  <>
                    <div style={{ borderTop: '1px dashed #eee', margin: '6px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>Contacto Principal</span>
                      <span style={{ fontWeight: '500', color: '#333' }}>
                        {factura.contactos.nombre} {factura.contactos.apellido}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Sección de Cuenta Bancaria para Depósito */}
              {factura.cuenta_bancaria && (
                <div style={{ backgroundColor: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: '6px', padding: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a56db', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    💳 Cuenta para Depósito
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    {factura.cuenta_bancaria.banco && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>Banco</span>
                        <span style={{ fontWeight: '600', color: '#333' }}>{factura.cuenta_bancaria.banco}</span>
                      </div>
                    )}
                    {factura.cuenta_bancaria.titular && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>Titular</span>
                        <span style={{ fontWeight: '600', color: '#333' }}>{factura.cuenta_bancaria.titular}</span>
                      </div>
                    )}
                    {factura.cuenta_bancaria.cbu && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#555' }}>CBU</span>
                        <code style={{ fontSize: '12px', backgroundColor: '#e8f0fe', padding: '2px 6px', borderRadius: '3px', letterSpacing: '0.03em' }}>
                          {factura.cuenta_bancaria.cbu}
                        </code>
                      </div>
                    )}
                    {factura.cuenta_bancaria.alias && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#555' }}>Alias</span>
                        <code style={{ fontSize: '12px', backgroundColor: '#e8f0fe', padding: '2px 6px', borderRadius: '3px' }}>
                          {factura.cuenta_bancaria.alias}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sección de Historial de Pagos */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', margin: 0 }}>Historial de Pagos</h3>
                  {factura.saldo_pendiente > 0 && (
                    <button 
                      onClick={() => setMostrandoFormPago(!mostrandoFormPago)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'transparent',
                        color: '#385723',
                        border: '1px solid #385723',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      className="btn-pago-toggle"
                    >
                      <Plus size={12} />
                      Registrar Pago
                    </button>
                  )}
                </div>

                {/* Formulario de Pago Rápido */}
                {mostrandoFormPago && (
                  <form 
                    onSubmit={handleSubmitPago}
                    style={{
                      backgroundColor: '#f8faf8',
                      border: '1px solid #d0e1d0',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#555', fontWeight: '600' }}>Fecha</label>
                        <input 
                          type="date" 
                          required
                          value={nuevoPago.fecha}
                          onChange={e => setNuevoPago({...nuevoPago, fecha: e.target.value})}
                          style={{ border: '1px solid #ccc', padding: '6px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#555', fontWeight: '600' }}>Monto *</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          placeholder="Monto"
                          value={nuevoPago.monto}
                          onChange={e => setNuevoPago({...nuevoPago, monto: e.target.value})}
                          style={{ border: '1px solid #ccc', padding: '6px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#555', fontWeight: '600' }}>Observaciones</label>
                      <input 
                        type="text" 
                        placeholder="Notas/Referencia"
                        value={nuevoPago.observaciones}
                        onChange={e => setNuevoPago({...nuevoPago, observaciones: e.target.value})}
                        style={{ border: '1px solid #ccc', padding: '6px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button 
                        type="button" 
                        onClick={() => setMostrandoFormPago(false)}
                        style={{ border: 'none', background: 'transparent', padding: '6px 12px', fontSize: '12px', color: '#666', cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        disabled={savingPago}
                        style={{
                          backgroundColor: '#385723',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {savingPago ? 'Guardando...' : 'Guardar Pago'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Listado de Pagos */}
                {pagos.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                    No hay pagos registrados para esta factura.
                  </p>
                ) : (
                  <div style={{ border: '1px solid #eee', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                          <th style={{ padding: '8px 12px', color: '#666', fontWeight: '600' }}>Fecha</th>
                          <th style={{ padding: '8px 12px', color: '#666', fontWeight: '600' }}>Detalles</th>
                          <th style={{ padding: '8px 12px', color: '#666', fontWeight: '600', textAlign: 'right' }}>Monto</th>
                          <th style={{ padding: '8px 12px', width: '32px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagos.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px 12px', color: '#333' }}>{formatFecha(p.fecha)}</td>
                            <td style={{ padding: '8px 12px', color: '#666', fontSize: '11px' }}>{p.observaciones || '-'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#2e7d32' }}>
                              ${Number(p.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button 
                                onClick={() => handleDeletePago(p.id)}
                                style={{ border: 'none', background: 'transparent', color: '#d9534f', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Acciones al pie */}
        {!loading && factura && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #eee', backgroundColor: '#fcfcfc', display: 'flex', justifyContent: 'stretch' }}>
            <button
              onClick={() => navigate(`/facturacion/${id}`)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#385723',
                color: '#fff',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(56, 87, 35, 0.2)'
              }}
            >
              Ver expediente completo
              <ArrowUpRight size={16} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        .btn-hover-circle:hover {
          background-color: #f0f0f0 !important;
          color: #333 !important;
        }
        .btn-pago-toggle:hover {
          background-color: rgba(56, 87, 35, 0.05) !important;
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
    </>
  )
}

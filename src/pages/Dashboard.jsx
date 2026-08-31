import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, FileText, CheckCircle2, AlertCircle, TrendingUp, Building2, Calendar, Target, Wrench, UserCog } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { getPreventivos } from '../services/operaciones'
import { getEventosCronograma } from '../services/agenda'
import { facturasVencidas as calcularFacturasVencidas, prospectosConSeguimientoVencido, contratosPorVencer } from '../services/notificaciones-utils'

export default function Dashboard() {
  const { facturas, prospectos, colaboradores, refreshFacturas, refreshProspectos } = useData()
  const { esColaborador } = useAuth()
  const [preventivos, setPreventivos] = useState([])
  const [eventos, setEventos] = useState([])
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const esPrimeraCarga = facturas.length === 0 || prospectos.length === 0
    if (esPrimeraCarga) setLoading(true)
    try {
      const tareas = [getPreventivos(), getEventosCronograma()]
      // Un Colaborador no ve cobranzas ni CRM, así que no tiene sentido
      // pedir facturas/prospectos (además la RLS se los niega).
      if (!esColaborador) {
        tareas.push(refreshFacturas(true), refreshProspectos(true))
      }
      const [prevData, eData] = await Promise.all(tareas)
      setPreventivos(prevData)
      setEventos(eData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- 1. MÉTRICAS FACTURACIÓN ---
  const totalFacturado = facturas.reduce((acc, f) => acc + Number(f.monto_neto || 0), 0)
  const totalCobrado = facturas.reduce((acc, f) => acc + (Number(f.monto_neto || 0) - Number(f.saldo_pendiente || 0)), 0)
  const totalPendiente = facturas.reduce((acc, f) => acc + Number(f.saldo_pendiente || 0), 0)
  
  const facturasVencidasList = calcularFacturasVencidas(facturas)
  const totalVencido = facturasVencidasList.reduce((acc, f) => acc + Number(f.saldo_pendiente || 0), 0)

  // --- 2. PROSPECTOS CON SEGUIMIENTO VENCIDO ---
  const hoy = new Date()
  hoy.setHours(0,0,0,0)

  const prospectosActivos = prospectosConSeguimientoVencido(prospectos)

  // --- 2b. CONTRATOS DE COLABORADORES POR VENCER (próximos 30 días o ya vencidos) ---
  const contratosAlerta = contratosPorVencer(colaboradores, 30)

  // --- 3. PREVENTIVOS VENCIDOS O PRÓXIMOS ---
  const preventivosAlertas = preventivos.filter(p => {
    if (!p.proxima_realizacion) return false
    const fechaProx = new Date(p.proxima_realizacion)
    fechaProx.setHours(0,0,0,0)
    // Mostramos los que están vencidos o vencen en los próximos 7 días
    const diffTime = fechaProx - hoy
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 7
  }).sort((a,b) => new Date(a.proxima_realizacion) - new Date(b.proxima_realizacion))

  // --- 4. EVENTOS DEL DÍA ---
  const eventosHoy = eventos.filter(e => {
    if (!e.inicio) return false
    const fechaInicio = new Date(e.inicio)
    return fechaInicio.toDateString() === new Date().toDateString()
  }).sort((a,b) => new Date(a.inicio) - new Date(b.inicio))


  return (
    <div className="page" style={{ maxWidth: '1200px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard APSOL</h1>
          <p className="page-subtitle">
            {esColaborador ? 'Panel de control de operaciones' : 'Panel de control de operaciones y cobranzas'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando información del sistema...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* KPI FACTURACIÓN — solo para roles con acceso a cobranzas */}
          {!esColaborador && (
          <div className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>
                <TrendingUp size={24} />
              </div>
              <div className="stat-info">
                <h3>Total Facturado (Histórico)</h3>
                <div className="stat-value">${totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>
                <CheckCircle2 size={24} />
              </div>
              <div className="stat-info">
                <h3>Total Cobrado</h3>
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                  ${totalCobrado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-orange)' }}>
                <DollarSign size={24} />
              </div>
              <div className="stat-info">
                <h3>Saldo Pendiente</h3>
                <div className="stat-value" style={{ color: 'var(--color-orange)' }}>
                  ${totalPendiente.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            <div className="stat-card" style={{ borderColor: totalVencido > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border)' }}>
              <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
                <AlertCircle size={24} />
              </div>
              <div className="stat-info">
                <h3>Facturas Vencidas</h3>
                <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
                  ${totalVencido.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: esColaborador ? '1fr' : '1fr 1fr', gap: '24px' }}>

            {/* ALERTAS OPERATIVAS (Izquierda) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Eventos de Hoy */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={20} className="text-primary" />
                  Eventos de Hoy
                </h3>
                {eventosHoy.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No hay reuniones ni eventos para hoy.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {eventosHoy.map(e => (
                      <div key={e.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-primary)' }}>
                        <div style={{ minWidth: '45px', fontWeight: 'bold', fontSize: '14px', color: 'var(--color-primary)' }}>
                          {new Date(e.inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '14px' }}>{e.titulo}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {e.prospectos?.empresas?.nombre || 'Interno'} - Asignado a: {e.responsable || 'Todos'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '12px' }}>
                  <Link to="/cronograma" style={{ fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '500' }}>Ir al cronograma →</Link>
                </div>
              </div>

              {/* Preventivos */}
              <div className="card" style={{ borderColor: preventivosAlertas.some(p => new Date(p.proxima_realizacion) < new Date()) ? 'var(--color-danger)' : 'var(--color-border)' }}>
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wrench size={20} className="text-primary" />
                  Preventivos (Próx. 7 días)
                </h3>
                {preventivosAlertas.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Todo al día. No hay mantenimientos próximos.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {preventivosAlertas.map(p => {
                      const vencido = new Date(p.proxima_realizacion) < new Date()
                      return (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: `1px solid ${vencido ? 'var(--color-danger)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-sm)' }}>
                          <div>
                            <Link to={`/preventivos/${p.id}`} style={{ fontWeight: '500', fontSize: '14px', color: 'inherit', textDecoration: 'none' }}>{p.equipo_sistema}</Link>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{p.proyectos?.prospectos?.empresas?.nombre}</div>
                          </div>
                          <div>
                            <span className={`badge ${vencido ? 'badge-orange' : 'badge-blue'}`}>
                              {new Date(p.proxima_realizacion).toLocaleDateString('es-AR')}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* ALERTAS CRM & COBRANZAS (Derecha) — oculto para Colaborador */}
            {!esColaborador && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Prospectos */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={20} className="text-primary" />
                  CRM: Prospectos por Contactar
                </h3>
                {prospectosActivos.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No hay tareas de seguimiento pendientes para hoy.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {prospectosActivos.map(p => (
                      <div key={p.id} style={{ padding: '12px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <Link to={`/prospectos/${p.id}`} style={{ fontWeight: '500', fontSize: '14px', color: 'inherit', textDecoration: 'none' }}>
                            {p.nombre}
                          </Link>
                          <span className="badge badge-gray">{p.proxima_tarea}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {p.empresas?.nombre} - Agendado para: {new Date(p.fecha_proxima_tarea).toLocaleDateString('es-AR')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Facturas Vencidas Detalle */}
              <div className="card" style={{ borderColor: facturasVencidasList.length > 0 ? 'var(--color-danger)' : 'var(--color-border)' }}>
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: facturasVencidasList.length > 0 ? 'var(--color-danger)' : 'inherit' }}>
                  <AlertCircle size={20} />
                  Top Facturas Vencidas
                </h3>
                {facturasVencidasList.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>¡Excelente! No hay facturas vencidas.</p>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Factura</th>
                          <th>Vencimiento</th>
                          <th style={{ textAlign: 'right' }}>Deuda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facturasVencidasList.sort((a,b) => b.saldo_pendiente - a.saldo_pendiente).slice(0, 5).map(f => (
                          <tr key={f.id}>
                            <td>
                              <Link to={`/facturacion/${f.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: '500' }}>
                                {f.numero_factura || 'Borrador'}
                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{f.prospectos?.empresas?.nombre}</div>
                              </Link>
                            </td>
                            <td style={{ color: 'var(--color-danger)' }}>
                              {new Date(f.fecha_vencimiento).toLocaleDateString('es-AR')}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '600' }}>
                              ${Number(f.saldo_pendiente).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ marginTop: '12px' }}>
                  <Link to="/facturacion" style={{ fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '500' }}>Ver todas las facturas →</Link>
                </div>
              </div>

              {/* Contratos de colaboradores por vencer */}
              {contratosAlerta.length > 0 && (
                <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
                  <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
                    <UserCog size={20} />
                    Contratos por Vencer
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {contratosAlerta.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                        <Link to={`/colaboradores/${c.id}`} style={{ fontWeight: '500', fontSize: '14px', color: 'inherit', textDecoration: 'none' }}>
                          {c.nombre} {c.apellido}
                        </Link>
                        <span className="badge badge-orange">{new Date(c.renovacion_contrato).toLocaleDateString('es-AR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

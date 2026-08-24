import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Receipt, ChevronRight } from 'lucide-react'
import { getFacturas } from '../services/facturacion'

export default function Facturacion() {
  const navigate = useNavigate()
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todas')

  useEffect(() => {
    cargarFacturas()
  }, [])

  async function cargarFacturas() {
    setLoading(true)
    try {
      const data = await getFacturas()
      setFacturas(data)
    } catch (error) {
      console.error('Error al cargar facturas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar facturas según el término de búsqueda
  const facturasFiltradas = facturas.filter(f => {
    const matchSearch = 
      (f.numero_factura && f.numero_factura.toLowerCase().includes(search.toLowerCase())) ||
      (f.prospectos?.nombre && f.prospectos.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (f.prospectos?.empresas?.nombre && f.prospectos.empresas.nombre.toLowerCase().includes(search.toLowerCase()))
      
    return matchSearch
  })

  // Calcular totales acumulados de saldo_pendiente para los filtros del sidebar
  const totalPendiente = facturas
    .filter(f => f.estado === 'Pendiente' || f.estado === 'Enviada')
    .reduce((acc, f) => acc + Number(f.saldo_pendiente || 0), 0)

  const totalPagoParcial = facturas
    .filter(f => f.estado === 'Cobrada parcial')
    .reduce((acc, f) => acc + Number(f.saldo_pendiente || 0), 0)

  const totalCobrado = facturas
    .filter(f => f.estado === 'Cobrada total')
    .reduce((acc, f) => acc + Number(f.saldo_pendiente || 0), 0)

  const totalGeneral = totalPendiente + totalPagoParcial + totalCobrado

  // Formateo seguro de fecha DD/MM/AAAA
  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '-'
    const parts = fechaStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return new Date(fechaStr).toLocaleDateString('es-AR')
  }

  // Obtener Próxima Notificación y días de retraso desde emisión si sigue impaga
  const getProxNotificacionYRetraso = (factura) => {
    const prox = factura.proxima_notificacion ? formatFecha(factura.proxima_notificacion) : '-'
    if (factura.estado === 'Cobrada total') return prox

    const hoy = new Date()
    hoy.setHours(0,0,0,0)
    const emision = new Date(factura.fecha_emision)
    emision.setHours(0,0,0,0)
    const diffTime = hoy - emision
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
      return `${prox} - Retraso: ${diffDays} Días`
    }
    return prox
  }

  // Obtener fecha del cobro (último pago)
  const getFechaCobro = (factura) => {
    if (factura.estado !== 'Cobrada total' && factura.estado !== 'Cobrada parcial') return '-'
    if (!factura.pagos || factura.pagos.length === 0) return '-'
    const fechas = factura.pagos.map(p => new Date(p.fecha + 'T00:00:00'))
    const maxFecha = new Date(Math.max(...fechas))
    return maxFecha.toLocaleDateString('es-AR')
  }

  // Definición de los grupos de estados según AppSheet
  const grupos = [
    { keys: ['Pendiente', 'Enviada'], titulo: '1. Pendiente', color: '#c55a11', total: totalPendiente, filtroKey: 'Pendiente' },
    { keys: ['Cobrada parcial'], titulo: '2. Pago Parcial', color: '#7f6000', total: totalPagoParcial, filtroKey: 'Cobrada parcial' },
    { keys: ['Cobrada total'], titulo: '3. Cobrada', color: '#385723', total: totalCobrado, filtroKey: 'Cobrada total' }
  ]

  return (
    <div className="page" style={{ padding: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>Facturación</h1>
        </div>
        <Link to="/facturacion/nueva" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#385723', color: '#fff', padding: '10px 16px', borderRadius: '4px', textDecoration: 'none', fontWeight: '500' }}>
          <Plus size={18} />
          Agregar
        </Link>
      </div>

      {/* Caja de Búsqueda */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="search-bar" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '4px' }}>
          <Search size={18} className="search-bar-icon" style={{ color: '#888' }} />
          <input
            type="text"
            placeholder="Buscar por número, empresa o contacto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px' }}
          />
        </div>
      </div>

      <div className="facturacion-layout" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* Sidebar Lateral Izquierdo de Filtros */}
        <div className="facturacion-sidebar" style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Botón Todo */}
          <button 
            onClick={() => setFiltroEstado('Todas')}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderRadius: '6px',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: filtroEstado === 'Todas' ? '600' : 'normal',
              fontSize: '14px',
              backgroundColor: filtroEstado === 'Todas' ? '#e2f0d9' : '#f5f5f5',
              color: filtroEstado === 'Todas' ? '#385723' : '#555',
              boxShadow: filtroEstado === 'Todas' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              transition: 'background-color 0.2s'
            }}
          >
            <span>Todo</span>
          </button>

          {/* Botones de Grupos con sus Saldos Acumulados */}
          {grupos.map((grupo) => {
            const activo = filtroEstado === grupo.filtroKey
            return (
              <button
                key={grupo.filtroKey}
                onClick={() => setFiltroEstado(grupo.filtroKey)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activo ? '700' : '500',
                  backgroundColor: activo ? '#e2f0d9' : '#fff',
                  color: activo ? '#385723' : '#555',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  borderLeft: `4px solid ${grupo.color}`,
                  transition: 'background-color 0.2s'
                }}
              >
                <span style={{ color: activo ? '#385723' : grupo.color }}>{grupo.titulo}</span>
                <span style={{ 
                  fontSize: '11px', 
                  backgroundColor: activo ? 'rgba(56, 87, 35, 0.15)' : '#f0f0f0', 
                  padding: '3px 8px', 
                  borderRadius: '4px', 
                  color: '#333', 
                  fontWeight: '600' 
                }}>
                  ${grupo.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </button>
            )
          })}
        </div>

        {/* Listado Principal de Facturas a la Derecha */}
        <div className="facturacion-main" style={{ flex: 1, minWidth: 0, backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          
          {loading ? (
            <div className="loading-screen" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div className="loading-spinner" style={{ width: '32px', height: '32px', border: '3px solid #ccc', borderTopColor: '#385723', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#666', fontSize: '14px' }}>Cargando facturas...</p>
            </div>
          ) : facturasFiltradas.length === 0 ? (
            <div className="placeholder-card" style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#888' }}>
              <Receipt size={48} className="placeholder-icon" style={{ opacity: 0.5 }} />
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#555' }}>No se encontraron facturas</h3>
              <p style={{ fontSize: '14px' }}>Intenta con otros filtros o términos de búsqueda.</p>
            </div>
          ) : (
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Fecha</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Empresa</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Contacto 1</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Última notificación</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Prox. Notificación / Retraso</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Fecha de Cobro</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666', textAlign: 'right' }}>Monto</th>
                    <th style={{ padding: '12px 16px', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {grupos
                    .filter(g => filtroEstado === 'Todas' || g.filtroKey === filtroEstado)
                    .map(grupo => {
                      const facturasDelGrupo = facturasFiltradas.filter(f => grupo.keys.includes(f.estado))
                      if (facturasDelGrupo.length === 0) return null

                      return (
                        <React.Fragment key={grupo.filtroKey + '_group'}>
                          
                          {/* Fila de Encabezado del Grupo */}
                          <tr style={{ backgroundColor: '#f2f2f2', borderBottom: '1px solid #e0e0e0', borderTop: '1px solid #e0e0e0' }}>
                            <td colSpan={8} style={{ padding: '12px 16px', fontWeight: 'bold', color: grupo.color, fontSize: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{grupo.titulo}</span>
                                <span style={{ fontSize: '12px', fontWeight: 'normal', backgroundColor: '#e1e1e1', padding: '2px 8px', borderRadius: '4px', color: '#333' }}>
                                  ${grupo.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* Filas de datos de este grupo */}
                          {facturasDelGrupo.map((factura) => {
                            return (
                              <tr 
                                key={factura.id} 
                                onClick={() => navigate(`/facturacion/${factura.id}`)}
                                style={{ 
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #eee'
                                }}
                                className="hover-row-effect"
                              >
                                {/* Fecha de Emisión */}
                                <td style={{ padding: '14px 16px', color: '#333' }}>
                                  {formatFecha(factura.fecha_emision)}
                                </td>

                                {/* Empresa */}
                                <td style={{ padding: '14px 16px', fontWeight: '500', color: '#2c3e50' }}>
                                  {factura.prospectos?.empresas?.nombre || '-'}
                                </td>

                                {/* Contacto 1 */}
                                <td style={{ padding: '14px 16px', color: '#555' }}>
                                  {factura.contactos 
                                    ? `${factura.contactos.nombre} ${factura.contactos.apellido}` 
                                    : '-'
                                  }
                                </td>

                                {/* Última notificación */}
                                <td style={{ padding: '14px 16px', color: '#555' }}>
                                  {factura.ultima_notificacion 
                                    ? formatFecha(factura.ultima_notificacion) 
                                    : '-'
                                  }
                                </td>

                                {/* Prox. Notificación / Retraso */}
                                <td style={{ padding: '14px 16px', color: factura.estado !== 'Cobrada total' ? '#c55a11' : '#555', fontWeight: factura.estado !== 'Cobrada total' ? '500' : 'normal' }}>
                                  {getProxNotificacionYRetraso(factura)}
                                </td>

                                {/* Fecha de Cobro */}
                                <td style={{ padding: '14px 16px', color: '#555' }}>
                                  {getFechaCobro(factura)}
                                </td>

                                {/* Monto Bruto */}
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 'bold', color: '#333', fontSize: '13px' }}>
                                  ${Number(factura.monto_bruto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>

                                {/* Icono de navegación */}
                                <td style={{ padding: '14px 16px', textAlign: 'center', color: '#aaa' }}>
                                  <ChevronRight size={16} />
                                </td>
                              </tr>
                            )
                          })}

                        </React.Fragment>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

      {/* Inyección de estilos de hover sencillos */}
      <style>{`
        .hover-row-effect:hover {
          background-color: #f9fbfd !important;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

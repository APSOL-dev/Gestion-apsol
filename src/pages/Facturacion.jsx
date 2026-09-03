import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Receipt, ChevronRight, ChevronLeft } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useNavegacionLista } from '../hooks/useNavegacionLista'
import { diasDesde } from '../utils/fecha'
import FacturacionDrawer from '../components/FacturacionDrawer'

const FACTURAS_POR_PAGINA = 20

export default function Facturacion() {
  const navigate = useNavigate()
  const { facturas, loadingFacturas, refreshFacturas } = useData()
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroEmisionDesde, setFiltroEmisionDesde] = useState('')
  const [filtroEmisionHasta, setFiltroEmisionHasta] = useState('')
  const [filtroPagoDesde, setFiltroPagoDesde] = useState('')
  const [filtroPagoHasta, setFiltroPagoHasta] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todas')
  const [facturaSeleccionadaId, setFacturaSeleccionadaId] = useState(null)
  const [pagina, setPagina] = useState(1)

  const hayFiltrosActivos = filtroEmpresa ||
    filtroEmisionDesde || filtroEmisionHasta || filtroPagoDesde || filtroPagoHasta

  function limpiarFiltros() {
    setFiltroEmpresa('')
    setFiltroEmisionDesde('')
    setFiltroEmisionHasta('')
    setFiltroPagoDesde('')
    setFiltroPagoHasta('')
  }

  useEffect(() => {
    const esSilencioso = facturas.length > 0
    refreshFacturas(esSilencioso)
  }, [])

  // Volver a la primera página cada vez que cambia algún filtro
  useEffect(() => {
    setPagina(1)
  }, [filtroEmpresa, filtroEmisionDesde, filtroEmisionHasta, filtroPagoDesde, filtroPagoHasta, filtroEstado])

  // Formateo seguro de fecha DD/MM/AAAA
  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '-'
    const parts = fechaStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return new Date(fechaStr).toLocaleDateString('es-AR')
  }

  // Cada filtro es independiente y se combinan entre sí (AND cruzado): una
  // factura solo queda afuera si no cumple ALGUNO de los filtros con valor
  // cargado. Los de fecha comparan directo el string 'YYYY-MM-DD' (orden
  // lexicográfico = orden cronológico, sin necesidad de parsear a Date).
  const facturasFiltradas = facturas.filter(f => {
    if (filtroEmpresa.trim()) {
      const term = filtroEmpresa.trim().toLowerCase()
      const empresa = (f.prospectos?.empresas?.nombre || '').toLowerCase()
      const prospecto = (f.prospectos?.nombre || '').toLowerCase()
      const numero = (f.numero_factura || '').toLowerCase()
      if (!empresa.includes(term) && !prospecto.includes(term) && !numero.includes(term)) return false
    }

    if (filtroEmisionDesde && (!f.fecha_emision || f.fecha_emision < filtroEmisionDesde)) return false
    if (filtroEmisionHasta && (!f.fecha_emision || f.fecha_emision > filtroEmisionHasta)) return false

    if (filtroPagoDesde || filtroPagoHasta) {
      const tienePagoEnRango = (f.pagos || []).some(p => {
        if (filtroPagoDesde && p.fecha < filtroPagoDesde) return false
        if (filtroPagoHasta && p.fecha > filtroPagoHasta) return false
        return true
      })
      if (!tienePagoEnRango) return false
    }

    return true
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

  // Obtener Próxima Notificación y días de retraso desde emisión si sigue impaga.
  // OJO: diasDesde parsea la fecha en hora LOCAL; con `new Date('2026-08-31')`
  // (UTC) una factura emitida hoy figuraba con "Retraso: 1 Días" el mismo día.
  const getProxNotificacionYRetraso = (factura) => {
    const prox = factura.proxima_notificacion ? formatFecha(factura.proxima_notificacion) : '-'
    if (factura.estado === 'Cobrada total') return prox

    const diffDays = diasDesde(factura.fecha_emision)
    if (diffDays != null && diffDays > 0) {
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

  // Aplanamos los grupos visibles (según el filtro activo) a una sola lista
  // ordenada de facturas, para poder paginarla de a 20 sin romper el
  // agrupamiento visual por estado.
  const gruposVisibles = grupos.filter(g => filtroEstado === 'Todas' || g.filtroKey === filtroEstado)
  const filasPlanas = gruposVisibles.flatMap(grupo => {
    const facturasDelGrupo = facturasFiltradas.filter(f => grupo.keys.includes(f.estado))
    return facturasDelGrupo.map(factura => ({ grupo, factura }))
  })

  const totalPaginas = Math.max(1, Math.ceil(filasPlanas.length / FACTURAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaActual - 1) * FACTURAS_POR_PAGINA
  const filasPagina = filasPlanas.slice(inicioPagina, inicioPagina + FACTURAS_POR_PAGINA)

  // Insertamos el encabezado de grupo solo cuando cambia respecto a la fila
  // anterior, para que se siga viendo correctamente aunque un grupo quede
  // partido entre dos páginas.
  const filasARenderizar = []
  let grupoAnterior = null
  filasPagina.forEach(({ grupo, factura }) => {
    if (grupo.filtroKey !== grupoAnterior) {
      grupoAnterior = grupo.filtroKey
      filasARenderizar.push({ tipo: 'header', grupo })
    }
    filasARenderizar.push({ tipo: 'factura', grupo, factura })
  })

  // Navegación por teclado: ↑↓ recorren las facturas de la página (los
  // encabezados de grupo no cuentan), Enter abre el drawer, Esc lo cierra.
  const filasNavegables = filasPagina.map(f => f.factura)
  const indiceFacturaPorId = new Map(filasNavegables.map((f, i) => [f.id, i]))
  const { activo: filaActiva } = useNavegacionLista({
    total: filasNavegables.length,
    onActivar: (i) => setFacturaSeleccionadaId(filasNavegables[i]?.id ?? null),
    global: !facturaSeleccionadaId,
  })
  const filaActivaRef = useRef(null)
  useEffect(() => {
    filaActivaRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [filaActiva])

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

      {/* Barra de Filtros Independientes (se combinan entre sí) */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', flex: '1 1 200px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>Empresa / Prospecto / N° Factura</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #ddd', padding: '8px 10px', borderRadius: '4px' }}>
              <Search size={14} style={{ color: '#888', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Empresa, prospecto o N° de factura"
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>Fecha de emisión</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={filtroEmisionDesde}
                onChange={(e) => setFiltroEmisionDesde(e.target.value)}
                style={{ border: '1px solid #ddd', padding: '7px 8px', borderRadius: '4px', fontSize: '13px', colorScheme: 'light' }}
              />
              <span style={{ color: '#999', fontSize: '12px' }}>a</span>
              <input
                type="date"
                value={filtroEmisionHasta}
                onChange={(e) => setFiltroEmisionHasta(e.target.value)}
                style={{ border: '1px solid #ddd', padding: '7px 8px', borderRadius: '4px', fontSize: '13px', colorScheme: 'light' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>Fecha de pago</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={filtroPagoDesde}
                onChange={(e) => setFiltroPagoDesde(e.target.value)}
                style={{ border: '1px solid #ddd', padding: '7px 8px', borderRadius: '4px', fontSize: '13px', colorScheme: 'light' }}
              />
              <span style={{ color: '#999', fontSize: '12px' }}>a</span>
              <input
                type="date"
                value={filtroPagoHasta}
                onChange={(e) => setFiltroPagoHasta(e.target.value)}
                style={{ border: '1px solid #ddd', padding: '7px 8px', borderRadius: '4px', fontSize: '13px', colorScheme: 'light' }}
              />
            </div>
          </div>

          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: '#f5f5f5', color: '#555', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Limpiar filtros
            </button>
          )}
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
          
          {loadingFacturas ? (
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
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Prospecto</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Contacto 1</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Última notificación</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Prox. Notificación / Retraso</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666' }}>Fecha de Cobro</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', color: '#666', textAlign: 'right' }}>Monto</th>
                    <th style={{ padding: '12px 16px', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filasARenderizar.map((fila) => {
                    if (fila.tipo === 'header') {
                      return (
                        <tr key={`header-${fila.grupo.filtroKey}`} style={{ backgroundColor: '#f2f2f2', borderBottom: '1px solid #e0e0e0', borderTop: '1px solid #e0e0e0' }}>
                          <td colSpan={8} style={{ padding: '12px 16px', fontWeight: 'bold', color: fila.grupo.color, fontSize: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{fila.grupo.titulo}</span>
                              <span style={{ fontSize: '12px', fontWeight: 'normal', backgroundColor: '#e1e1e1', padding: '2px 8px', borderRadius: '4px', color: '#333' }}>
                                ${fila.grupo.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    const factura = fila.factura
                    const filaSeleccionada = indiceFacturaPorId.get(factura.id) === filaActiva
                    return (
                      <tr
                        key={factura.id}
                        ref={filaSeleccionada ? filaActivaRef : null}
                        aria-selected={filaSeleccionada}
                        onClick={() => setFacturaSeleccionadaId(factura.id)}
                        style={{
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          backgroundColor: filaSeleccionada ? 'var(--color-surface2, #eef2ff)' : undefined
                        }}
                        className="hover-row-effect"
                      >
                        {/* Fecha de Emisión */}
                        <td style={{ padding: '14px 16px', color: '#333' }}>
                          {formatFecha(factura.fecha_emision)}
                        </td>

                        {/* Prospecto */}
                        <td style={{ padding: '14px 16px', fontWeight: '500', color: '#2c3e50' }}>
                          {factura.prospectos?.nombre || '-'}
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
                </tbody>
              </table>

              {/* Controles de paginado */}
              {totalPaginas > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #eee' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>
                    Mostrando {inicioPagina + 1}–{Math.min(inicioPagina + FACTURAS_POR_PAGINA, filasPlanas.length)} de {filasPlanas.length} facturas
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => setPagina(p => Math.max(1, p - 1))}
                      disabled={paginaActual === 1}
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', opacity: paginaActual === 1 ? 0.5 : 1, cursor: paginaActual === 1 ? 'default' : 'pointer' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <button
                      onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaActual === totalPaginas}
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', opacity: paginaActual === totalPaginas ? 0.5 : 1, cursor: paginaActual === totalPaginas ? 'default' : 'pointer' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {facturaSeleccionadaId && (
        <FacturacionDrawer 
          id={facturaSeleccionadaId}
          onClose={() => setFacturaSeleccionadaId(null)}
          onPagoRegistrado={refreshFacturas}
        />
      )}

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

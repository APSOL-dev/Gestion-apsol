import React, { useState, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, User, FileSignature, Receipt, Plus, X, Target, UploadCloud, Briefcase, Calendar as CalendarIcon } from 'lucide-react'
import { getColaboradorById, saveColaborador, deleteColaborador, saveContrato, deleteContrato, saveFacturaColaborador, deleteFacturaColaborador, uploadFile } from '../services/colaboradores'
import { getProspectos } from '../services/prospectos'

export default function ColaboradorDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nuevo'

  const [colaborador, setColaborador] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    dni: '',
    cuit_cuil: '',
    fecha_nacimiento: '',
    direccion: '',
    nacionalidad: 'Argentina',
    estado_civil: '',
    puesto: 'Colaborador',
    tarifa_base_hora: 0,
    dedicacion_mensual_horas: 160,
    cbu_cvu: '',
    banco: '',
    alias: '',
    activo: true,
    fecha_inicio: '',
    frecuencia_pago: 30,
    proxima_fecha_pago: '',
    renovacion_contrato: '',
    prospectos_asignados: []
  })
  
  const [contratos, setContratos] = useState([])
  const [facturas, setFacturas] = useState([])
  const [expandedContrato, setExpandedContrato] = useState(null)
  
  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState('')

  // Modales
  const [modalContrato, setModalContrato] = useState({ open: false, data: null })
  const [modalFactura, setModalFactura] = useState({ open: false, data: null })
  const [modalProspectos, setModalProspectos] = useState(false)
  
  const [nuevoContrato, setNuevoContrato] = useState({ 
    fecha_inicio: new Date().toISOString().split('T')[0], 
    fecha_fin: '', 
    dias_libres_por_mes: '1,25', 
    tipo_honorarios: '$/mes', 
    honorarios: 0, 
    dedicacion_mensual_horas: 160,
    adjunto: '', 
    adjunto2: '', 
    estado: 'Activo' 
  })
  
  const [nuevaFactura, setNuevaFactura] = useState({ numero_factura: '', fecha_factura: new Date().toISOString().split('T')[0], monto: 0, archivo_factura: '' })

  // Prospectos selector
  const [prospectos, setProspectos] = useState([])

  useEffect(() => {
    cargarProspectos()
    if (!esNuevo) cargarDatos()
  }, [id])

  async function cargarProspectos() {
    try {
      const data = await getProspectos(false) // Traer todos para asegurar visibilidad
      const enProduccion = data.filter(p => p.estado === '6A - En producción')
      setProspectos(enProduccion)
    } catch (err) {
      console.error('Error al cargar prospectos', err)
    }
  }

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getColaboradorById(id)
      setColaborador({
        ...data,
        activo: data.estado !== 'Inactivo',
        fecha_nacimiento: data.fecha_nacimiento ? data.fecha_nacimiento.split('T')[0] : '',
        fecha_inicio: data.fecha_inicio ? data.fecha_inicio.split('T')[0] : '',
        proxima_fecha_pago: data.proxima_fecha_pago ? data.proxima_fecha_pago.split('T')[0] : '',
        renovacion_contrato: data.renovacion_contrato ? data.renovacion_contrato.split('T')[0] : '',
        prospectos_asignados: data.prospectos_asignados || []
      })
      setContratos(data.contratos || [])
      setFacturas(data.facturas_colaboradores || [])
      
      if (data.contratos && data.contratos.length > 0) {
        actualizarDatosDesdeContratos(data.contratos, data.facturas_colaboradores || [])
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos del colaborador.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const dataToSave = { ...colaborador }
      if (!dataToSave.fecha_nacimiento) dataToSave.fecha_nacimiento = null
      if (!dataToSave.fecha_inicio) dataToSave.fecha_inicio = null
      if (!dataToSave.proxima_fecha_pago) dataToSave.proxima_fecha_pago = null
      if (!dataToSave.renovacion_contrato) dataToSave.renovacion_contrato = null
      
      if (dataToSave.tarifa_base_hora === '') dataToSave.tarifa_base_hora = 0
      if (dataToSave.dedicacion_mensual_horas === '') dataToSave.dedicacion_mensual_horas = 0
      if (dataToSave.frecuencia_pago === '') dataToSave.frecuencia_pago = 30

      const saved = await saveColaborador(dataToSave)
      if (esNuevo) {
        navigate(`/colaboradores/${saved.id}`, { replace: true })
      } else {
        // success
      }
    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Estás seguro de eliminar este colaborador?')) return
    try {
      await deleteColaborador(id)
      navigate('/colaboradores')
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  // LÓGICA DE DERIVACIÓN DESDE CONTRATOS
  const calcularDiasDisponibles = () => {
    if (!colaborador.fecha_inicio || !contratos.length) return '0.00'
    const inicio = new Date(colaborador.fecha_inicio)
    const hoy = new Date()
    
    // Diferencia en meses (aproximada para gestión interna)
    let meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth())
    if (hoy.getDate() < inicio.getDate()) meses-- 
    
    // Usar el factor del último contrato
    const factorStr = String(contratos[contratos.length - 1].dias_libres_por_mes || '0').replace(',', '.');
    const factor = parseFloat(factorStr);
    
    return (Math.max(0, meses * factor)).toFixed(2).replace('.', ',');
  }

  function actualizarDatosDesdeContratos(listaContratos, listaFacturas = []) {
    if (listaContratos.length === 0) return

    // Ordenar por fecha de inicio para encontrar el primero y el último
    const ordenados = [...listaContratos].sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
    const primero = ordenados[0]
    const ultimo = ordenados[ordenados.length - 1]

    let nuevaTarifa = Number(colaborador.tarifa_base_hora || 0)
    const honorariosNum = Number(ultimo.honorarios || 0)
    const horasNum = Number(ultimo.dedicacion_mensual_horas || 160)

    if (ultimo.tipo_honorarios === '$/hs') {
      nuevaTarifa = honorariosNum
    } else if (ultimo.tipo_honorarios === '$/mes' && horasNum > 0) {
      nuevaTarifa = (honorariosNum / horasNum).toFixed(2)
    }

    setColaborador(prev => {
      const f_inicio_calc = primero.fecha_inicio?.split('T')[0] || prev.fecha_inicio
      
      const calcularProxima = (f_inicio, facturasRelacionadas) => {
        if (!f_inicio) return ''
        const inicio = new Date(f_inicio + 'T12:00:00')
        const diaPago = inicio.getDate()
        
        // Si hay facturas, la base es la fecha de la última factura
        if (facturasRelacionadas && facturasRelacionadas.length > 0) {
          const facturasOrdenadas = [...facturasRelacionadas].sort((a, b) => new Date(b.fecha_factura) - new Date(a.fecha_factura))
          const ultimaFecha = new Date(facturasOrdenadas[0].fecha_factura + 'T12:00:00')
          
          // La próxima fecha es exactamente un mes después del último pago, manteniendo el día habitual
          let proxima = new Date(ultimaFecha.getFullYear(), ultimaFecha.getMonth() + 1, diaPago)
          return proxima.toISOString().split('T')[0]
        }

        // Si no hay facturas, calculamos el próximo día de pago desde hoy
        const hoy = new Date()
        let proxima = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago)
        if (proxima < hoy) {
          proxima.setMonth(proxima.getMonth() + 1)
        }
        
        return proxima.toISOString().split('T')[0]
      }

      return {
        ...prev,
        fecha_inicio: f_inicio_calc,
        renovacion_contrato: ultimo.fecha_fin ? ultimo.fecha_fin.split('T')[0] : '',
        tarifa_base_hora: nuevaTarifa,
        dedicacion_mensual_horas: horasNum,
        proxima_fecha_pago: calcularProxima(f_inicio_calc, listaFacturas.length > 0 ? listaFacturas : facturas)
      }
    })
  }

  // CONTRATOS
  async function handleSaveContrato(e) {
    e.preventDefault()
    if (!nuevoContrato.fecha_inicio) return
    try {
      const dataToSave = {
        ...nuevoContrato,
        colaborador_id: id,
        fecha_fin: nuevoContrato.fecha_fin || null,
        dias_libres_por_mes: parseFloat(String(nuevoContrato.dias_libres_por_mes || '0').replace(',', '.')),
        honorarios: Number(nuevoContrato.honorarios) || 0,
        dedicacion_mensual_horas: Number(nuevoContrato.dedicacion_mensual_horas) || 160
      }
      const saved = await saveContrato(dataToSave)
      
      let nuevaLista
      if (nuevoContrato.id) {
        nuevaLista = contratos.map(c => c.id === saved.id ? saved : c)
      } else {
        nuevaLista = [...contratos, saved]
      }
      
      setContratos(nuevaLista)
      actualizarDatosDesdeContratos(nuevaLista)
      setModalContrato({ open: false, data: null })
      setNuevoContrato({ 
        fecha_inicio: new Date().toISOString().split('T')[0], 
        fecha_fin: '', 
        dias_libres_por_mes: '1,25', 
        tipo_honorarios: '$/mes', 
        honorarios: 0, 
        dedicacion_mensual_horas: 160,
        adjunto: '', 
        adjunto2: '', 
        estado: 'Activo' 
      })
    } catch (err) {
      console.error(err)
      alert('Error al guardar contrato')
    }
  }

  function openEditContrato(c) {
    setNuevoContrato({
      ...c,
      fecha_inicio: c.fecha_inicio ? c.fecha_inicio.split('T')[0] : '',
      fecha_fin: c.fecha_fin ? c.fecha_fin.split('T')[0] : ''
    })
    setModalContrato({ open: true, data: c })
  }

  async function handleDeleteContrato(contratoId) {
    if (!window.confirm('¿Eliminar este contrato?')) return
    try {
      await deleteContrato(contratoId)
      const nuevaLista = contratos.filter(c => c.id !== contratoId)
      setContratos(nuevaLista)
      actualizarDatosDesdeContratos(nuevaLista)
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  // FACTURAS
  async function handleSaveFactura(e) {
    e.preventDefault()
    if (!nuevaFactura.monto) return
    try {
      const dataToSave = { 
        ...nuevaFactura, 
        colaborador_id: id,
        monto: Number(nuevaFactura.monto)
      }
      const saved = await saveFacturaColaborador(dataToSave)
      
      let nuevaLista
      if (nuevaFactura.id) {
        nuevaLista = facturas.map(f => f.id === saved.id ? saved : f)
      } else {
        nuevaLista = [...facturas, saved]
      }
      
      setFacturas(nuevaLista)
      setModalFactura({ open: false, data: null })
      setNuevaFactura({ numero_factura: '', fecha_factura: new Date().toISOString().split('T')[0], monto: 0, archivo_factura: '' })
    } catch (err) {
      console.error(err)
      alert('Error al guardar factura')
    }
  }

  function openEditFactura(f) {
    setNuevaFactura({
      ...f,
      fecha_factura: f.fecha_factura ? f.fecha_factura.split('T')[0] : new Date().toISOString().split('T')[0]
    })
    setModalFactura({ open: true, data: f })
  }
  async function handleDeleteFactura(factId) {
    if (!window.confirm('¿Eliminar esta factura?')) return
    try {
      await deleteFacturaColaborador(factId)
      setFacturas(facturas.filter(f => f.id !== factId))
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  // UPLOAD HANDLER
  async function handleFileUpload(e, formSetter, currentForm, fieldName) {
    const file = e.target.files[0]
    if (!file) return
    try {
      setUploadingFile(true)
      const url = await uploadFile(file)
      formSetter({ ...currentForm, [fieldName]: url })
    } catch (err) {
      console.error(err)
      alert('Error al subir el archivo. Revisa que el tamaño o formato sea válido.')
    } finally {
      setUploadingFile(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando datos...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '1000px' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/colaboradores')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{esNuevo ? 'Nuevo Colaborador' : `${colaborador.nombre} ${colaborador.apellido}`}</h1>
            <p className="page-subtitle">{esNuevo ? 'Registra un nuevo miembro del equipo' : 'Expediente del Colaborador'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" form="colaboradorForm" className="btn btn-primary" disabled={saving}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          {!esNuevo && (
            <button className="btn btn-danger" type="button" onClick={handleDelete}>
              <Trash2 size={18} />
              Eliminar
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* COLUMNA PRINCIPAL */}
        <div style={{ display: 'grid', gap: '24px' }}>
          
          <div className="card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={20} className="text-primary" />
              Datos Personales y de Pago
            </h3>
            <form id="colaboradorForm" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="field">
                <label>Nombre *</label>
                <input type="text" required value={colaborador.nombre} onChange={e => setColaborador({...colaborador, nombre: e.target.value})} />
              </div>
              <div className="field">
                <label>Apellido *</label>
                <input type="text" required value={colaborador.apellido} onChange={e => setColaborador({...colaborador, apellido: e.target.value})} />
              </div>
              <div className="field">
                <label>Email *</label>
                <input type="email" required value={colaborador.email} onChange={e => setColaborador({...colaborador, email: e.target.value})} />
              </div>
              <div className="field">
                <label>Teléfono *</label>
                <input type="text" required value={colaborador.telefono} onChange={e => setColaborador({...colaborador, telefono: e.target.value})} />
              </div>
              <div className="field">
                <label>DNI *</label>
                <input type="text" required value={colaborador.dni} onChange={e => setColaborador({...colaborador, dni: e.target.value})} />
              </div>
              <div className="field">
                <label>CUIT / CUIL</label>
                <input type="text" value={colaborador.cuit_cuil} onChange={e => setColaborador({...colaborador, cuit_cuil: e.target.value})} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Dirección *</label>
                <input type="text" required value={colaborador.direccion} onChange={e => setColaborador({...colaborador, direccion: e.target.value})} />
              </div>

              <div style={{ gridColumn: '1 / -1', height: '1px', background: 'var(--color-border)', margin: '8px 0' }}></div>
              
              <div className="field">
                <label>Banco</label>
                <input type="text" value={colaborador.banco} onChange={e => setColaborador({...colaborador, banco: e.target.value})} />
              </div>
              <div className="field">
                <label>CBU / CVU</label>
                <input type="text" value={colaborador.cbu_cvu} onChange={e => setColaborador({...colaborador, cbu_cvu: e.target.value})} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Alias</label>
                <input type="text" value={colaborador.alias} onChange={e => setColaborador({...colaborador, alias: e.target.value})} />
              </div>
            </form>
          </div>

          {/* HISTÓRICO DE CONTRATOS */}
          {!esNuevo && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSignature size={20} className="text-primary" />
                  Contratos
                </h3>
                <button className="btn btn-secondary" onClick={() => {
                  setNuevoContrato({ 
                    fecha_inicio: new Date().toISOString().split('T')[0], 
                    fecha_fin: '', 
                    dias_libres_por_mes: '1,25', 
                    tipo_honorarios: '$/mes', 
                    honorarios: 0, 
                    dedicacion_mensual_horas: 160,
                    adjunto: '', 
                    adjunto2: '', 
                    estado: 'Activo' 
                  });
                  setModalContrato({ open: true, data: null });
                }}>
                  <Plus size={16} /> Agregar Contrato
                </button>
              </div>

              {contratos.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No hay contratos registrados.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Inicio</th>
                        <th>Fin</th>
                        <th>Honorarios</th>
                        <th>Tipo</th>
                        <th>Días Libres</th>
                        <th>Adjuntos</th>
                        <th style={{ width: '80px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contratos.map(c => (
                        <React.Fragment key={c.id}>
                          <tr onClick={() => openEditContrato(c)} style={{ cursor: 'pointer' }}>
                            <td>{new Date(c.fecha_inicio).toLocaleDateString('es-AR')}</td>
                            <td>{c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString('es-AR') : 'Indefinido'}</td>
                            <td style={{ fontWeight: '500' }}>${Number(c.honorarios || 0).toLocaleString('es-AR')}</td>
                            <td>{c.tipo_honorarios}</td>
                             <td>{Number(c.dias_libres_por_mes || 0).toFixed(2).replace('.', ',')}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                {c.adjunto && <UploadCloud size={14} className="text-primary" />}
                                {c.adjunto2 && <UploadCloud size={14} className="text-primary" />}
                              </div>
                            </td>
                            <td>
                              <button className="btn btn-secondary" style={{ padding: '4px', color: 'var(--color-danger)', borderColor: 'transparent', background: 'transparent' }} onClick={(e) => { e.stopPropagation(); handleDeleteContrato(c.id); }}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* FACTURAS RECIBIDAS (De Monotributistas, etc.) */}
          {!esNuevo && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={20} className="text-primary" />
                  Facturas Recibidas
                </h3>
                <button className="btn btn-secondary" onClick={() => {
                  setNuevaFactura({ numero_factura: '', fecha_factura: new Date().toISOString().split('T')[0], monto: 0, archivo_factura: '' });
                  setModalFactura({ open: true, data: null });
                }}>
                  <Plus size={16} /> Cargar Factura
                </button>
              </div>

              {facturas.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No hay facturas cargadas.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Nro Factura</th>
                        <th>Monto</th>
                        <th>Adjunto</th>
                        <th style={{ width: '80px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturas.map(f => (
                        <tr key={f.id} onClick={() => openEditFactura(f)} style={{ cursor: 'pointer' }}>
                          <td>{new Date(f.fecha_factura).toLocaleDateString('es-AR')}</td>
                          <td>{f.numero_factura || '-'}</td>
                          <td style={{ fontWeight: '500' }}>${Number(f.monto).toLocaleString('es-AR')}</td>
                          <td>
                            {f.archivo_factura ? (
                              <UploadCloud size={16} className="text-primary" />
                            ) : (
                              <span style={{color: 'var(--color-text-muted)', fontSize: '13px'}}>-</span>
                            )}
                          </td>
                          <td>
                            <button className="btn btn-secondary" style={{ padding: '4px', color: 'var(--color-danger)', borderColor: 'transparent', background: 'transparent' }} onClick={(e) => { e.stopPropagation(); handleDeleteFactura(f.id); }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* COLUMNA LATERAL: ROL Y CONDICIONES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card" style={{ background: 'var(--color-bg2)', border: '2px solid var(--color-primary-light)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '12px', borderRadius: '12px' }}>
                <Briefcase size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-subtle)' }}>Días Libres Disponibles</h4>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-secondary)' }}>
                  {calcularDiasDisponibles()}
                </div>
              </div>
            </div>
            <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
              Calculados automáticamente según fecha de ingreso ({colaborador.fecha_inicio || 'no definida'}) y la tasa de {contratos.length > 0 ? Number(contratos[contratos.length-1].dias_libres_por_mes).toFixed(2).replace('.', ',') : '1,25'} días por mes.
            </p>
          </div>
          
          <div className="card" style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '15px' }}>Rol y Configuración</h3>
            
            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Estado en la empresa</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  checked={colaborador.activo} 
                  onChange={e => setColaborador({...colaborador, activo: e.target.checked})} 
                  form="colaboradorForm"
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '14px', fontWeight: '500', color: colaborador.activo ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {colaborador.activo ? 'Colaborador Activo' : 'Inactivo / Ex-empleado'}
                </span>
              </div>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Puesto / Título *</label>
              <select 
                value={colaborador.puesto} 
                onChange={e => setColaborador({...colaborador, puesto: e.target.value})} 
                form="colaboradorForm"
                required
              >
                <option value="Colaborador">Colaborador</option>
                <option value="Project manager">Project manager</option>
                <option value="Consultor independiente">Consultor independiente</option>
                <option value="Freelancer programador">Freelancer programador</option>
              </select>
            </div>
            
            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Fecha de Inicio (Desde primer contrato)</label>
              <input 
                type="date" 
                value={colaborador.fecha_inicio} 
                readOnly
                disabled
                style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }}
                form="colaboradorForm"
              />
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Renovación de Contrato (Solo lectura)</label>
              <input 
                type="date" 
                value={colaborador.renovacion_contrato} 
                readOnly
                disabled
                style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }}
                form="colaboradorForm"
              />
              <small style={{ color: 'var(--color-text-muted)' }}>Se actualiza según la fecha fin del último contrato</small>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Próxima Fecha de Pago (Automática)</label>
              <input 
                type="date" 
                value={colaborador.proxima_fecha_pago} 
                readOnly
                disabled
                style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }}
                form="colaboradorForm"
              />
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Próxima Fecha de Pago</label>
              <input 
                type="date" 
                value={colaborador.proxima_fecha_pago} 
                onChange={e => setColaborador({...colaborador, proxima_fecha_pago: e.target.value})} 
                form="colaboradorForm"
              />
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Tarifa Base por Hora ($)</label>
              <input 
                type="number" 
                step="0.01"
                value={colaborador.tarifa_base_hora} 
                onChange={e => setColaborador({...colaborador, tarifa_base_hora: e.target.value})} 
                form="colaboradorForm"
              />
              <small style={{ color: 'var(--color-text-muted)' }}>Usado para presupuestar proyectos</small>
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Dedicación Mensual Esperada (Hs)</label>
              <input 
                type="number" 
                value={colaborador.dedicacion_mensual_horas} 
                onChange={e => setColaborador({...colaborador, dedicacion_mensual_horas: e.target.value})} 
                form="colaboradorForm"
              />
            </div>

            <div className="field" style={{ marginBottom: '16px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="label-with-icon" style={{ margin: 0 }}><Target size={14} /> Prospectos para trabajar</label>
                <button type="button" className="btn-add-tag" onClick={() => setModalProspectos(true)}>
                  <Plus size={14} />
                </button>
              </div>
              
              <div className="tags-container" style={{ minHeight: '38px', padding: '8px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                {colaborador.prospectos_asignados.length === 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Sin prospectos asignados</span>
                )}
                {prospectos.filter(p => colaborador.prospectos_asignados.includes(p.id)).map(p => (
                  <div key={p.id} className="tag active" onClick={() => setColaborador({...colaborador, prospectos_asignados: colaborador.prospectos_asignados.filter(id => id !== p.id)})}>
                    {p.nombre} <X size={12} />
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" form="colaboradorForm" className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }} disabled={saving}>
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Colaborador'}
            </button>
          </div>

        </div>

      </div>

      {/* MODAL CONTRATO */}
      {modalContrato.open && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{nuevoContrato.id ? 'Editar Contrato' : 'Nuevo Contrato'}</h3>
              <button className="btn-close" onClick={() => setModalContrato({ open: false, data: null })}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveContrato} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px' }}>
              <div className="field">
                <label>Fecha Inicio *</label>
                <input type="date" required value={nuevoContrato.fecha_inicio} onChange={e => setNuevoContrato({...nuevoContrato, fecha_inicio: e.target.value})} />
              </div>
              <div className="field">
                <label>Fecha Fin</label>
                <input type="date" value={nuevoContrato.fecha_fin} onChange={e => setNuevoContrato({...nuevoContrato, fecha_fin: e.target.value})} />
              </div>
              <div className="field">
                <label>Días libres por mes</label>
                <input type="text" value={nuevoContrato.dias_libres_por_mes} onChange={e => setNuevoContrato({...nuevoContrato, dias_libres_por_mes: e.target.value})} />
              </div>
              <div className="field">
                <label>Dedicación Mensual (Hs)</label>
                <input type="number" value={nuevoContrato.dedicacion_mensual_horas} onChange={e => setNuevoContrato({...nuevoContrato, dedicacion_mensual_horas: e.target.value})} />
              </div>
              <div className="field">
                <label>Tipo de Honorario *</label>
                <select required value={nuevoContrato.tipo_honorarios} onChange={e => setNuevoContrato({...nuevoContrato, tipo_honorarios: e.target.value})}>
                  <option value="$/mes">$/mes</option>
                  <option value="$/hs">$/hs</option>
                  <option value="$/proyecto">$/proyecto</option>
                </select>
              </div>
              <div className="field">
                <label>Honorarios *</label>
                <input type="number" step="0.01" required value={nuevoContrato.honorarios} onChange={e => setNuevoContrato({...nuevoContrato, honorarios: e.target.value})} />
              </div>
              
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Archivo 1 {nuevoContrato.adjunto && <a href={nuevoContrato.adjunto} target="_blank" rel="noreferrer" style={{marginLeft: '8px', color: 'var(--color-primary)'}}>(Ver actual)</a>}</label>
                <input type="file" onChange={e => handleFileUpload(e, setNuevoContrato, nuevoContrato, 'adjunto')} disabled={uploadingFile} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Archivo 2 {nuevoContrato.adjunto2 && <a href={nuevoContrato.adjunto2} target="_blank" rel="noreferrer" style={{marginLeft: '8px', color: 'var(--color-primary)'}}>(Ver actual)</a>}</label>
                <input type="file" onChange={e => handleFileUpload(e, setNuevoContrato, nuevoContrato, 'adjunto2')} disabled={uploadingFile} />
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploadingFile}>
                  {uploadingFile ? 'Subiendo...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL FACTURA */}
      {modalFactura.open && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{nuevaFactura.id ? 'Editar Factura' : 'Cargar Factura'}</h3>
              <button className="btn-close" onClick={() => setModalFactura({ open: false, data: null })}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveFactura} style={{ display: 'grid', gap: '20px', padding: '20px' }}>
              <div className="field">
                <label>Fecha Factura</label>
                <input type="date" value={nuevaFactura.fecha_factura} readOnly disabled style={{ background: 'var(--color-surface)' }} />
              </div>
              <div className="field">
                <label>Nro Factura *</label>
                <input type="text" required value={nuevaFactura.numero_factura} onChange={e => setNuevaFactura({...nuevaFactura, numero_factura: e.target.value})} />
              </div>
              <div className="field">
                <label>Monto *</label>
                <input type="number" step="0.01" required value={nuevaFactura.monto} onChange={e => setNuevaFactura({...nuevaFactura, monto: e.target.value})} />
              </div>
              <div className="field">
                <label>Archivo Factura {nuevaFactura.archivo_factura && <a href={nuevaFactura.archivo_factura} target="_blank" rel="noreferrer" style={{marginLeft: '8px', color: 'var(--color-primary)'}}>(Ver actual)</a>}</label>
                <input type="file" onChange={e => handleFileUpload(e, setNuevaFactura, nuevaFactura, 'archivo_factura')} disabled={uploadingFile} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploadingFile}>
                {uploadingFile ? 'Subiendo...' : 'Guardar Factura'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL PROSPECTOS */}
      {modalProspectos && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Asignar Prospectos</h3>
              <button className="btn-close" onClick={() => setModalProspectos(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '15px' }}>Selecciona los proyectos en producción en los que trabaja este colaborador:</p>
              {prospectos.length === 0 ? (
                <div className="picker-empty">No hay prospectos en producción</div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {prospectos.map(p => {
                    const estaAsignado = colaborador.prospectos_asignados.includes(p.id)
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => {
                          if(estaAsignado) {
                            setColaborador({...colaborador, prospectos_asignados: colaborador.prospectos_asignados.filter(id => id !== p.id)})
                          } else {
                            setColaborador({...colaborador, prospectos_asignados: [...colaborador.prospectos_asignados, p.id]})
                          }
                        }}
                        style={{ 
                          padding: '12px', 
                          border: '1px solid var(--color-border)', 
                          borderRadius: 'var(--radius-sm)', 
                          cursor: 'pointer',
                          background: estaAsignado ? 'var(--color-surface2)' : 'transparent',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontWeight: estaAsignado ? '600' : '400' }}>{p.nombre}</span>
                        {estaAsignado && <Target size={16} className="text-primary" />}
                      </div>
                    )
                  })}
                </div>
              )}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={() => setModalProspectos(false)}>Aceptar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

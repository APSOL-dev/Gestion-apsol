import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, FileSignature, Receipt, Plus, X, Target,
  Briefcase, Wallet, CalendarClock, FolderKanban, Mail, FileText, ChevronRight
} from 'lucide-react'
import {
  getColaboradorById, saveColaborador, deleteColaborador,
  saveContrato, deleteContrato,
  saveFacturaColaborador, deleteFacturaColaborador, uploadFile
} from '../services/colaboradores'
import { useData } from '../context/DataContext'
import { finDeContrato, calcularDiasDescanso, tasaDiasLibres, contratoVigente } from '../utils/colaboradores'

const HOY_ISO = new Date().toISOString().split('T')[0]

function fmt(valor) {
  if (!valor) return '—'
  const d = new Date(`${String(valor).split('T')[0]}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR')
}
function fmtMonto(n) {
  return `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}
function soloFecha(v) {
  return v ? String(v).split('T')[0] : ''
}
function primerInicio(contratos) {
  const conFecha = (contratos || []).filter(c => c.fecha_inicio)
  if (!conFecha.length) return ''
  return soloFecha(
    conFecha.slice().sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))[0].fecha_inicio
  )
}

const CONTRATO_VACIO = {
  fecha_inicio: HOY_ISO, fecha_fin: '', tipo_contrato: 'Colaborador',
  dias_libres_por_mes: '1,25', tipo_honorarios: '$/mensuales', honorarios: 0,
  adjunto: '', adjunto2: '', estado: 'Activo',
}
const FACTURA_VACIA = {
  numero_factura: '', fecha_factura: HOY_ISO, monto: 0,
  archivo_factura: '', fecha_pago: '', comprobante_pago: '',
}

export default function ColaboradorDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nuevo'
  const { prospectos = [], proyectos = [] } = useData()

  const [colaborador, setColaborador] = useState({
    nombre: '', apellido: '', email: '', puesto: 'Colaborador',
    activo: true, fecha_inicio: '', frecuencia_pago: 30,
    proxima_fecha_pago: '', renovacion_contrato: '',
    prospectos_asignados: [], dias_libres_tomados: 0,
    usuario_id: null,
  })
  const [contratos, setContratos] = useState([])
  const [facturas, setFacturas] = useState([])

  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState('')

  const [modalContrato, setModalContrato] = useState(false)
  const [modalFactura, setModalFactura] = useState(false)
  const [modalProspectos, setModalProspectos] = useState(false)
  const [nuevoContrato, setNuevoContrato] = useState(CONTRATO_VACIO)
  const [nuevaFactura, setNuevaFactura] = useState(FACTURA_VACIA)
  const [filtroProspectos, setFiltroProspectos] = useState('')

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getColaboradorById(id)
      const cts = data.contratos || []
      setContratos(cts)
      setFacturas(data.facturas_colaboradores || [])
      setColaborador({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        email: data.email || '',
        puesto: data.puesto || 'Colaborador',
        activo: data.estado !== 'Inactivo',
        fecha_inicio: primerInicio(cts) || soloFecha(data.fecha_inicio),
        frecuencia_pago: data.frecuencia_pago ?? 30,
        proxima_fecha_pago: soloFecha(data.proxima_fecha_pago),
        renovacion_contrato: finDeContrato(cts) || soloFecha(data.renovacion_contrato),
        prospectos_asignados: data.prospectos_asignados || [],
        dias_libres_tomados: data.dias_libres_tomados || 0,
        usuario_id: data.usuario_id || null,
        nombre_manual: data.nombre_manual,
        apellido_manual: data.apellido_manual,
        es_team_lead: data.es_team_lead === true,
      })
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos del colaborador.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!esNuevo) cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const dataToSave = {
        ...colaborador,
        id: esNuevo ? undefined : id,
        fecha_inicio: primerInicio(contratos) || colaborador.fecha_inicio || null,
        renovacion_contrato: finDeContrato(contratos) || colaborador.renovacion_contrato || null,
        proxima_fecha_pago: colaborador.proxima_fecha_pago || null,
        frecuencia_pago: colaborador.frecuencia_pago === '' ? 30 : Number(colaborador.frecuencia_pago),
      }
      const saved = await saveColaborador(dataToSave)
      if (esNuevo) navigate(`/colaboradores/${saved.id}`, { replace: true })
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

  // ---- Contratos ----
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
      }
      const saved = await saveContrato(dataToSave)
      setContratos(nuevoContrato.id
        ? contratos.map(c => (c.id === saved.id ? saved : c))
        : [...contratos, saved])
      setModalContrato(false)
      setNuevoContrato(CONTRATO_VACIO)
    } catch (err) {
      console.error(err)
      alert('Error al guardar contrato')
    }
  }
  function openEditContrato(c) {
    setNuevoContrato({
      ...c,
      fecha_inicio: soloFecha(c.fecha_inicio),
      fecha_fin: soloFecha(c.fecha_fin),
      dias_libres_por_mes: String(c.dias_libres_por_mes ?? '1,25').replace('.', ','),
    })
    setModalContrato(true)
  }
  async function handleDeleteContrato(contratoId) {
    if (!window.confirm('¿Eliminar este contrato?')) return
    try {
      await deleteContrato(contratoId)
      setContratos(contratos.filter(c => c.id !== contratoId))
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  // ---- Facturas ----
  async function handleSaveFactura(e) {
    e.preventDefault()
    if (!nuevaFactura.monto) return
    try {
      const dataToSave = {
        ...nuevaFactura,
        colaborador_id: id,
        monto: Number(nuevaFactura.monto),
        fecha_pago: nuevaFactura.fecha_pago || null,
      }
      const saved = await saveFacturaColaborador(dataToSave)
      setFacturas(nuevaFactura.id
        ? facturas.map(f => (f.id === saved.id ? saved : f))
        : [...facturas, saved])
      setModalFactura(false)
      setNuevaFactura(FACTURA_VACIA)
    } catch (err) {
      console.error(err)
      alert('Error al guardar factura')
    }
  }
  function openEditFactura(f) {
    setNuevaFactura({
      ...f,
      fecha_factura: soloFecha(f.fecha_factura) || HOY_ISO,
      fecha_pago: soloFecha(f.fecha_pago),
    })
    setModalFactura(true)
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

  async function handleFileUpload(e, formSetter, currentForm, fieldName) {
    const file = e.target.files[0]
    if (!file) return
    try {
      setUploadingFile(true)
      const url = await uploadFile(file)
      formSetter({ ...currentForm, [fieldName]: url })
    } catch (err) {
      console.error(err)
      alert('Error al subir el archivo.')
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

  const facturasOrdenadas = [...facturas].sort((a, b) => new Date(b.fecha_factura) - new Date(a.fecha_factura))
  // Más nuevo arriba, más viejo abajo.
  const contratosOrdenados = [...contratos].sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio))
  const contratoEnVigencia = contratoVigente(contratos)
  const descanso = calcularDiasDescanso({
    fechaInicio: colaborador.fecha_inicio,
    contratos,
    diasTomados: colaborador.dias_libres_tomados,
  })
  const proyectosDelColaborador = (proyectos || []).filter(
    p => p.colaborador_id === id && !/finaliz|cerrad|baja/i.test(p.estado || '')
  )
  const prospectosOrdenados = [...(prospectos || [])].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))

  return (
    <div className="page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/colaboradores')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="page-title" style={{ color: 'var(--color-primary)' }}>
            {esNuevo ? 'Nuevo Colaborador' : `${colaborador.nombre} ${colaborador.apellido}`}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" form="colaboradorForm" className="btn btn-primary" disabled={saving}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {!esNuevo && (
            <button className="btn btn-danger" type="button" onClick={handleDelete}>
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <form id="colaboradorForm" onSubmit={handleSave} className="colaborador-detalle-grid">

        {/* ---- Columna principal ---- */}
        <div className="cdg-col">

        {esNuevo && (
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Datos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label>Nombre *</label>
                <input required value={colaborador.nombre} onChange={e => setColaborador({ ...colaborador, nombre: e.target.value })} />
              </div>
              <div className="field">
                <label>Apellido *</label>
                <input required value={colaborador.apellido} onChange={e => setColaborador({ ...colaborador, apellido: e.target.value })} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={colaborador.email} onChange={e => setColaborador({ ...colaborador, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Puesto</label>
                <select value={colaborador.puesto} onChange={e => setColaborador({ ...colaborador, puesto: e.target.value })}>
                  <option>Colaborador</option>
                  <option>Project Manager</option>
                  <option>Consultor Independiente</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Facturas */}
        {!esNuevo && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} className="text-primary" /> Facturas
                <span className="badge badge-blue">{facturas.length}</span>
              </h3>
              <small style={{ color: 'var(--color-text-muted)' }}>Las sube el colaborador desde "Mi Perfil". Acá registrás el pago.</small>
            </div>
            {facturas.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Sin facturas cargadas.</p>
            ) : (
              <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha factura</th><th>Monto</th><th>Fecha de Pago</th><th>Adjuntos</th><th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasOrdenadas.map(f => (
                      <tr key={f.id} onClick={() => openEditFactura(f)} style={{ cursor: 'pointer' }}>
                        <td>{fmt(f.fecha_factura)}</td>
                        <td style={{ fontWeight: 500 }}>{fmtMonto(f.monto)}</td>
                        <td>{fmt(f.fecha_pago)}</td>
                        <td>
                          <span style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                            {f.archivo_factura && <a href={f.archivo_factura} target="_blank" rel="noreferrer" title="Factura"><FileText size={15} className="text-primary" /></a>}
                            {f.comprobante_pago && <a href={f.comprobante_pago} target="_blank" rel="noreferrer" title="Comprobante de pago"><Receipt size={15} className="text-primary" /></a>}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="btn btn-secondary" style={{ padding: 4, color: 'var(--color-danger)', border: 'none', background: 'transparent' }}
                            onClick={e => { e.stopPropagation(); handleDeleteFactura(f.id) }}>
                            <Trash2 size={15} />
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

        {/* Proyectos y Prospectos */}
        {!esNuevo && (
          <div className="card">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderKanban size={20} className="text-primary" /> Proyectos y Prospectos
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label className="label-with-icon" style={{ marginBottom: 8 }}>Proyectos activos Colaborador</label>
              {proyectosDelColaborador.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Sin proyectos activos.</p>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {proyectosDelColaborador.map(p => (
                    <Link key={p.id} to={`/proyectos/${p.id}`}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', color: 'inherit' }}>
                      <span>{p.nombre}</span>
                      <ChevronRight size={16} className="text-primary" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="field" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="label-with-icon" style={{ margin: 0 }}><Target size={14} /> Prospectos para trabajar</label>
                <button type="button" className="btn-add-tag" onClick={() => { setFiltroProspectos(''); setModalProspectos(true) }}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="tags-container" style={{ minHeight: 38, padding: 8, background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                {colaborador.prospectos_asignados.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sin prospectos asignados</span>
                )}
                {prospectosOrdenados
                  .filter(p => colaborador.prospectos_asignados.includes(p.id))
                  .map(p => (
                    <div key={p.id} className="tag active"
                      onClick={() => setColaborador({ ...colaborador, prospectos_asignados: colaborador.prospectos_asignados.filter(x => x !== p.id) })}>
                      {p.nombre} <X size={12} />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Contratos colaborador */}
        {!esNuevo && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSignature size={20} className="text-primary" /> Contratos colaborador
                <span className="badge badge-blue">{contratos.length}</span>
              </h3>
              <button type="button" className="btn btn-secondary" onClick={() => { setNuevoContrato(CONTRATO_VACIO); setModalContrato(true) }}>
                <Plus size={16} /> Agregar
              </button>
            </div>
            {contratos.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Sin contratos registrados.</p>
            ) : (
              <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha Inicio</th><th>Fecha Fin</th><th>Tipo de contrato</th><th>Días libres/mes</th><th>Honorarios</th><th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratosOrdenados.map(c => {
                      const esVigente = contratoEnVigencia && c.id === contratoEnVigencia.id
                      return (
                      <tr key={c.id} onClick={() => openEditContrato(c)} style={{ cursor: 'pointer', background: esVigente ? 'var(--color-success-light)' : undefined }}>
                        <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {fmt(c.fecha_inicio)}
                          {esVigente && <span className="badge badge-green" style={{ fontSize: 10 }}>Vigente</span>}
                        </td>
                        <td>{c.fecha_fin ? fmt(c.fecha_fin) : 'Indefinido'}</td>
                        <td>{c.tipo_contrato || '—'}</td>
                        <td>{c.dias_libres_por_mes != null ? String(c.dias_libres_por_mes).replace('.', ',') : '—'}</td>
                        <td style={{ fontWeight: 500 }}>{fmtMonto(c.honorarios)}</td>
                        <td>
                          <button type="button" className="btn btn-secondary" style={{ padding: 4, color: 'var(--color-danger)', border: 'none', background: 'transparent' }}
                            onClick={e => { e.stopPropagation(); handleDeleteContrato(c.id) }}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        </div>{/* ---- fin columna principal ---- */}

        {/* ---- Columna lateral ---- */}
        <div className="cdg-col">

        {/* Pago de honorarios */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={20} className="text-primary" /> Pago de honorarios
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="field">
              <label>Próxima Fecha de pago</label>
              <input
                type="date"
                value={colaborador.proxima_fecha_pago}
                onChange={e => setColaborador({ ...colaborador, proxima_fecha_pago: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Frecuencia de pago (días)</label>
              <input
                type="number"
                value={colaborador.frecuencia_pago}
                onChange={e => setColaborador({ ...colaborador, frecuencia_pago: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Días de descanso */}
        {!esNuevo && (
          <div className="card">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={20} className="text-primary" /> Días de descanso
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
              {[
                ['Acumulados', descanso.acumulados, 'var(--color-text)'],
                ['Tomados', descanso.tomados, 'var(--color-text)'],
                ['Disponibles', descanso.disponibles, 'var(--color-secondary)'],
              ].map(([lbl, val, color]) => (
                <div key={lbl} style={{ padding: '12px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-subtle)' }}>{lbl}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              Acumulados = meses desde el ingreso ({fmt(colaborador.fecha_inicio)}) × {tasaDiasLibres(contratos).toString().replace('.', ',')} días/mes.
              Tomados = entradas de "Día Libre" en el cronograma. Disponibles = acumulados − tomados.
            </p>
          </div>
        )}

        {/* Contractual */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarClock size={20} className="text-primary" /> Contractual
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="field">
              <label>Puesto</label>
              <select value={colaborador.puesto} onChange={e => setColaborador({ ...colaborador, puesto: e.target.value })}>
                <option>Colaborador</option>
                <option>Project Manager</option>
                <option>Consultor Independiente</option>
                <option>Freelancer programador</option>
              </select>
            </div>
            <div className="field">
              <label>Team Lead</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, fontSize: 14, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={colaborador.es_team_lead === true}
                  onChange={e => setColaborador({ ...colaborador, es_team_lead: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                Visión completa de Operaciones (recibe notificaciones de cualquier proyecto, no solo lo suyo)
              </label>
            </div>
            <div className="field">
              <label>Fecha Inicio</label>
              <input type="date" value={colaborador.fecha_inicio} disabled readOnly style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
            </div>
            <div className="field">
              <label>Fin de contrato</label>
              <input type="date" value={finDeContrato(contratos) || ''} disabled readOnly style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
            </div>
          </div>
          <small style={{ color: 'var(--color-text-muted)' }}>Fecha Inicio y Fin de contrato se derivan de los contratos cargados.</small>
        </div>

        {/* Estado */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{ margin: 0, fontWeight: 600 }}>Estado</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button"
                className={`btn ${colaborador.activo ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setColaborador({ ...colaborador, activo: true })}>Activo</button>
              <button type="button"
                className={`btn ${!colaborador.activo ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setColaborador({ ...colaborador, activo: false })}>No Activo</button>
            </div>
          </div>
        </div>

        {/* email */}
        <div className="card">
          <div className="field" style={{ margin: 0 }}>
            <label className="label-with-icon"><Mail size={14} /> email</label>
            <input
              type="email"
              value={colaborador.email}
              readOnly={!colaborador.usuario_id && !esNuevo}
              onChange={e => setColaborador({ ...colaborador, email: e.target.value })}
              style={(!colaborador.usuario_id && !esNuevo) ? { background: 'var(--color-surface)', cursor: 'not-allowed' } : undefined}
            />
            {!colaborador.usuario_id && !esNuevo && (
              <small style={{ color: 'var(--color-text-muted)' }}>Colaborador sin usuario vinculado.</small>
            )}
          </div>
        </div>

        </div>{/* ---- fin columna lateral ---- */}
      </form>

      {/* MODAL CONTRATO */}
      {modalContrato && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{nuevoContrato.id ? 'Editar Contrato' : 'Nuevo Contrato'}</h3>
              <button className="btn-close" onClick={() => setModalContrato(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveContrato} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '20px' }}>
              <div className="field">
                <label>Fecha Inicio *</label>
                <input type="date" required value={nuevoContrato.fecha_inicio} onChange={e => setNuevoContrato({ ...nuevoContrato, fecha_inicio: e.target.value })} />
              </div>
              <div className="field">
                <label>Fecha Fin</label>
                <input type="date" value={nuevoContrato.fecha_fin} onChange={e => setNuevoContrato({ ...nuevoContrato, fecha_fin: e.target.value })} />
              </div>
              <div className="field">
                <label>Tipo de contrato</label>
                <select value={nuevoContrato.tipo_contrato} onChange={e => setNuevoContrato({ ...nuevoContrato, tipo_contrato: e.target.value })}>
                  <option>Colaborador</option>
                  <option>Consultor Independiente</option>
                  <option>Freelancer</option>
                </select>
              </div>
              <div className="field">
                <label>Días libres por mes</label>
                <input type="text" value={nuevoContrato.dias_libres_por_mes} onChange={e => setNuevoContrato({ ...nuevoContrato, dias_libres_por_mes: e.target.value })} />
              </div>
              <div className="field">
                <label>Tipo de honorarios *</label>
                <select required value={nuevoContrato.tipo_honorarios} onChange={e => setNuevoContrato({ ...nuevoContrato, tipo_honorarios: e.target.value })}>
                  <option value="$/mensuales">$/mensuales</option>
                  <option value="$/hs">$/hs</option>
                  <option value="$/proyecto">$/proyecto</option>
                </select>
              </div>
              <div className="field">
                <label>Honorarios *</label>
                <input type="number" step="0.01" required value={nuevoContrato.honorarios} onChange={e => setNuevoContrato({ ...nuevoContrato, honorarios: e.target.value })} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Adjunto {nuevoContrato.adjunto && <a href={nuevoContrato.adjunto} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--color-primary)' }}>(ver actual)</a>}</label>
                <input type="file" onChange={e => handleFileUpload(e, setNuevoContrato, nuevoContrato, 'adjunto')} disabled={uploadingFile} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Adjunto 2 {nuevoContrato.adjunto2 && <a href={nuevoContrato.adjunto2} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--color-primary)' }}>(ver actual)</a>}</label>
                <input type="file" onChange={e => handleFileUpload(e, setNuevoContrato, nuevoContrato, 'adjunto2')} disabled={uploadingFile} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploadingFile}>
                  {uploadingFile ? 'Subiendo...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL FACTURA */}
      {modalFactura && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{nuevaFactura.id ? 'Editar Factura' : 'Agregar Factura'}</h3>
              <button className="btn-close" onClick={() => setModalFactura(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveFactura} style={{ display: 'grid', gap: '16px', padding: '20px' }}>
              <div className="field">
                <label>Fecha factura</label>
                <input type="date" value={nuevaFactura.fecha_factura} onChange={e => setNuevaFactura({ ...nuevaFactura, fecha_factura: e.target.value })} />
              </div>
              <div className="field">
                <label>Nro de Factura</label>
                <input type="text" value={nuevaFactura.numero_factura || ''} onChange={e => setNuevaFactura({ ...nuevaFactura, numero_factura: e.target.value })} />
              </div>
              <div className="field">
                <label>Monto *</label>
                <input type="number" step="0.01" required value={nuevaFactura.monto} onChange={e => setNuevaFactura({ ...nuevaFactura, monto: e.target.value })} />
              </div>
              <div className="field">
                <label>Fecha de Pago</label>
                <input type="date" value={nuevaFactura.fecha_pago || ''} onChange={e => setNuevaFactura({ ...nuevaFactura, fecha_pago: e.target.value })} />
              </div>
              <div className="field">
                <label>Factura {nuevaFactura.archivo_factura && <a href={nuevaFactura.archivo_factura} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--color-primary)' }}>(ver actual)</a>}</label>
                <input type="file" onChange={e => handleFileUpload(e, setNuevaFactura, nuevaFactura, 'archivo_factura')} disabled={uploadingFile} />
              </div>
              <div className="field">
                <label>Comprobante de pago {nuevaFactura.comprobante_pago && <a href={nuevaFactura.comprobante_pago} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--color-primary)' }}>(ver actual)</a>}</label>
                <input type="file" onChange={e => handleFileUpload(e, setNuevaFactura, nuevaFactura, 'comprobante_pago')} disabled={uploadingFile} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploadingFile}>
                {uploadingFile ? 'Subiendo...' : 'Guardar'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL PROSPECTOS */}
      {modalProspectos && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Prospectos para trabajar</h3>
              <button className="btn-close" onClick={() => setModalProspectos(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              <input
                type="text"
                placeholder="Filtrar..."
                value={filtroProspectos}
                onChange={e => setFiltroProspectos(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />
              <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {prospectosOrdenados
                  .filter(p => (p.nombre || '').toLowerCase().includes(filtroProspectos.toLowerCase()))
                  .map(p => {
                    const asignado = colaborador.prospectos_asignados.includes(p.id)
                    return (
                      <div key={p.id}
                        onClick={() => setColaborador({
                          ...colaborador,
                          prospectos_asignados: asignado
                            ? colaborador.prospectos_asignados.filter(x => x !== p.id)
                            : [...colaborador.prospectos_asignados, p.id],
                        })}
                        style={{
                          padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: asignado ? 'var(--color-surface2)' : 'transparent',
                        }}>
                        <span style={{ fontWeight: asignado ? 600 : 400 }}>{p.nombre}</span>
                        {asignado && <Target size={15} className="text-primary" />}
                      </div>
                    )
                  })}
              </div>
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setModalProspectos(false)}>
                Aceptar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

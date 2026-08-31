import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  User, KeyRound, Save, Eye, EyeOff, Wallet, Briefcase, CalendarClock,
  FileSignature, Receipt, Target, FileText, Plus, X, UploadCloud, Lock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { validarNuevaPassword } from '../utils/perfil'
import { getMiFichaColaborador, saveFacturaColaborador, uploadFile } from '../services/colaboradores'
import { calcularDiasDescanso, finDeContrato, tasaDiasLibres, contratoVigente } from '../utils/colaboradores'
import { ventanaFacturaAbierta, DIAS_HABILES_VENTANA } from '../utils/facturasColaborador'

function fmt(v) {
  if (!v) return '—'
  const d = new Date(`${String(v).split('T')[0]}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR')
}
function fmtMonto(n) {
  return `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}
function soloFecha(v) {
  return v ? String(v).split('T')[0] : ''
}
function primerInicio(contratos) {
  const conF = (contratos || []).filter(c => c.fecha_inicio)
  if (!conF.length) return ''
  return soloFecha(conF.slice().sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))[0].fecha_inicio)
}

const HOY_ISO = new Date().toISOString().split('T')[0]
const FACTURA_VACIA = { numero_factura: '', fecha_factura: HOY_ISO, monto: '', archivo_factura: '' }

export default function MiPerfil() {
  const { user } = useAuth()

  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', email_personal: '' })
  const [ficha, setFicha] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msgDatos, setMsgDatos] = useState(null)

  const [pass, setPass] = useState({ nueva: '', repetir: '' })
  const [verPass, setVerPass] = useState(false)
  const [cambiandoPass, setCambiandoPass] = useState(false)
  const [msgPass, setMsgPass] = useState(null)

  const [contratoVer, setContratoVer] = useState(null)
  const [modalFactura, setModalFactura] = useState(false)
  const [nuevaFactura, setNuevaFactura] = useState(FACTURA_VACIA)
  const [subiendo, setSubiendo] = useState(false)
  const [msgFactura, setMsgFactura] = useState(null)

  async function cargarFicha() {
    const f = await getMiFichaColaborador(user.id)
    setFicha(f)
    return f
  }

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const [perfilRes, fichaRes] = await Promise.allSettled([
          supabase.from('apsol_usuarios').select('nombre, apellido, email, email_personal').eq('id', user.id).single(),
          getMiFichaColaborador(user.id),
        ])
        if (!activo) return
        if (perfilRes.status === 'fulfilled' && !perfilRes.value.error) {
          const d = perfilRes.value.data || {}
          setDatos({
            nombre: d.nombre || '', apellido: d.apellido || '',
            email: d.email || user.email || '', email_personal: d.email_personal || '',
          })
        } else {
          setMsgDatos({ tipo: 'error', texto: 'No se pudieron cargar tus datos.' })
        }
        if (fichaRes.status === 'fulfilled') setFicha(fichaRes.value)
        else console.error('Error al cargar la ficha:', fichaRes.reason)
      } finally {
        if (activo) setLoading(false)
      }
    }
    if (user?.id) cargar()
    return () => { activo = false }
  }, [user?.id])

  async function guardarDatos(e) {
    e.preventDefault()
    setGuardando(true)
    setMsgDatos(null)
    try {
      const { error } = await supabase.from('apsol_usuarios').update({
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        email_personal: datos.email_personal.trim() || null,
      }).eq('id', user.id)
      if (error) throw error
      setMsgDatos({ tipo: 'ok', texto: 'Datos actualizados.' })
    } catch (err) {
      console.error(err)
      setMsgDatos({ tipo: 'error', texto: 'No se pudieron guardar los cambios.' })
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarPassword(e) {
    e.preventDefault()
    setMsgPass(null)
    const err = validarNuevaPassword(pass.nueva, pass.repetir)
    if (err) { setMsgPass({ tipo: 'error', texto: err }); return }
    setCambiandoPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pass.nueva })
      if (error) throw error
      setPass({ nueva: '', repetir: '' })
      setMsgPass({ tipo: 'ok', texto: 'Contraseña actualizada. Usá la nueva la próxima vez que inicies sesión.' })
    } catch (error) {
      console.error(error)
      setMsgPass({ tipo: 'error', texto: error?.message || 'No se pudo cambiar la contraseña.' })
    } finally {
      setCambiandoPass(false)
    }
  }

  async function subirArchivoFactura(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/\.pdf$/i.test(file.name)) {
      setMsgFactura({ tipo: 'error', texto: 'La factura tiene que ser un PDF.' })
      e.target.value = ''
      return
    }
    try {
      setSubiendo(true)
      setMsgFactura(null)
      const url = await uploadFile(file)
      setNuevaFactura(f => ({ ...f, archivo_factura: url }))
    } catch (err) {
      console.error(err)
      setMsgFactura({ tipo: 'error', texto: 'No se pudo subir el archivo.' })
    } finally {
      setSubiendo(false)
    }
  }

  async function guardarFactura(e) {
    e.preventDefault()
    setMsgFactura(null)
    if (!nuevaFactura.archivo_factura) {
      setMsgFactura({ tipo: 'error', texto: 'Adjuntá el PDF de la factura.' })
      return
    }
    if (!Number(nuevaFactura.monto)) {
      setMsgFactura({ tipo: 'error', texto: 'Ingresá el monto.' })
      return
    }
    try {
      setSubiendo(true)
      await saveFacturaColaborador({
        colaborador_id: ficha.id,
        fecha_factura: nuevaFactura.fecha_factura,
        numero_factura: nuevaFactura.numero_factura.trim() || null,
        monto: Number(nuevaFactura.monto),
        archivo_factura: nuevaFactura.archivo_factura,
      })
      await cargarFicha()
      setModalFactura(false)
      setNuevaFactura(FACTURA_VACIA)
    } catch (err) {
      console.error(err)
      setMsgFactura({ tipo: 'error', texto: err?.message || 'No se pudo registrar la factura.' })
    } finally {
      setSubiendo(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando tu perfil...</p>
      </div>
    )
  }

  const Mensaje = ({ msg }) => msg ? (
    <div className={`alert ${msg.tipo === 'ok' ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '12px' }}>{msg.texto}</div>
  ) : null

  const contratos = ficha?.contratos || []
  const facturas = [...(ficha?.facturas_colaboradores || [])].sort((a, b) => new Date(b.fecha_factura) - new Date(a.fecha_factura))
  // Más nuevo arriba, más viejo abajo.
  const contratosOrd = [...contratos].sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio))
  const vigente = contratoVigente(contratos)
  const fechaInicio = primerInicio(contratos) || soloFecha(ficha?.fecha_inicio)
  const descanso = calcularDiasDescanso({ fechaInicio, contratos, diasTomados: ficha?.dias_libres_tomados })
  const prospectos = (ficha?.prospectos_trabajar_nombres || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
  const ventana = ventanaFacturaAbierta({
    proximaFechaPago: ficha?.proxima_fecha_pago,
    facturas,
  })

  const textoVentana = {
    'sin-fecha': 'Todavía no hay una próxima fecha de pago definida.',
    'pendiente': 'Ya subiste tu factura. Vas a poder subir la próxima cuando se registre el pago de esta.',
    'espera': `Vas a poder subir tu factura a partir del ${fmt(ventana.desde)} (${DIAS_HABILES_VENTANA} días hábiles antes del pago).`,
    'abierta': 'Ventana abierta: subí tu factura del período.',
  }[ventana.motivo]

  const Seccion = ({ icon: Icon, titulo, extra, children }) => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Icon size={20} className="text-primary" /> {titulo}
        </h3>
        {extra}
      </div>
      {children}
    </div>
  )

  return (
    <div className="page" style={{ maxWidth: '980px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi Perfil</h1>
          <p className="page-subtitle">
            {ficha ? `${ficha.nombre} ${ficha.apellido} — colaborador de APSOL` : 'Tu cuenta de acceso'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '20px' }}>

        {ficha && (
          <>
            {/* 1. Prospectos para trabajar (los asigna el admin) */}
            <Seccion
              icon={Target}
              titulo="Prospectos para trabajar"
              extra={<span className="badge badge-blue">{prospectos.length}</span>}
            >
              {prospectos.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Todavía no tenés prospectos asignados.</p>
              ) : (
                <div className="tags-container" style={{ padding: 8, background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                  {prospectos.map(p => <div key={p.id} className="tag">{p.nombre}</div>)}
                </div>
              )}
              <small style={{ color: 'var(--color-text-muted)' }}>Los asigna el administrador.</small>
            </Seccion>

            {/* 2. ¿Cuándo cobro? */}
            <Seccion icon={Wallet} titulo="¿Cuándo cobro?">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="field">
                  <label>Próxima fecha de pago</label>
                  <input value={fmt(ficha.proxima_fecha_pago)} readOnly disabled style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
                </div>
                <div className="field">
                  <label>Frecuencia de pago (días)</label>
                  <input value={ficha.frecuencia_pago ?? '—'} readOnly disabled style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
                </div>
              </div>
            </Seccion>

            {/* 3. Días de descanso */}
            <Seccion icon={Briefcase} titulo="Días de descanso">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                {[
                  ['Acumulados', descanso.acumulados, 'var(--color-text)'],
                  ['Tomados', descanso.tomados, 'var(--color-text)'],
                  ['Disponibles', descanso.disponibles, 'var(--color-secondary)'],
                ].map(([lbl, val, color]) => (
                  <div key={lbl} style={{ padding: '14px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-subtle)' }}>{lbl}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color }}>{val}</div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Acumulados = meses desde el ingreso ({fmt(fechaInicio)}) × {tasaDiasLibres(contratos).toString().replace('.', ',')} días/mes.
                Tomados = tus días marcados como "Día Libre" en el cronograma.
              </p>
            </Seccion>

            {/* 4. Facturas — subir la del período */}
            <Seccion
              icon={Receipt}
              titulo="Mis facturas"
              extra={
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!ventana.abierta}
                  onClick={() => { setMsgFactura(null); setNuevaFactura(FACTURA_VACIA); setModalFactura(true) }}
                >
                  {ventana.abierta ? <Plus size={16} /> : <Lock size={16} />} Subir factura
                </button>
              }
            >
              <div className={`alert ${ventana.abierta ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '14px' }}>
                {textoVentana}
              </div>
              {facturas.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Todavía no subiste facturas.</p>
              ) : (
                <div className="table-container" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>Fecha factura</th><th>Monto</th><th>Fecha de pago</th><th>Adjuntos</th></tr>
                    </thead>
                    <tbody>
                      {facturas.map(f => (
                        <tr key={f.id}>
                          <td>{fmt(f.fecha_factura)}</td>
                          <td style={{ fontWeight: 500 }}>{fmtMonto(f.monto)}</td>
                          <td>{f.fecha_pago ? fmt(f.fecha_pago) : <span style={{ color: 'var(--color-text-muted)' }}>Pendiente</span>}</td>
                          <td>
                            <span style={{ display: 'flex', gap: 6 }}>
                              {f.archivo_factura && <a href={f.archivo_factura} target="_blank" rel="noreferrer" title="Factura"><FileText size={15} className="text-primary" /></a>}
                              {f.comprobante_pago && <a href={f.comprobante_pago} target="_blank" rel="noreferrer" title="Comprobante de pago"><Receipt size={15} className="text-primary" /></a>}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Seccion>

            {/* 5. Contratos */}
            <Seccion
              icon={FileSignature}
              titulo="Contratos"
              extra={<span className="badge badge-blue">{contratos.length}</span>}
            >
              {contratos.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Sin contratos registrados.</p>
              ) : (
                <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>Fecha inicio</th><th>Fecha fin</th><th>Tipo</th><th>Días libres/mes</th><th>Honorarios</th><th>Adjuntos</th></tr>
                    </thead>
                    <tbody>
                      {contratosOrd.map(c => {
                        const esVigente = vigente && c.id === vigente.id
                        return (
                        <tr key={c.id} onClick={() => setContratoVer(c)} style={{ cursor: 'pointer', background: esVigente ? 'var(--color-success-light)' : undefined }}>
                          <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {fmt(c.fecha_inicio)}
                            {esVigente && <span className="badge badge-green" style={{ fontSize: 10 }}>Vigente</span>}
                          </td>
                          <td>{c.fecha_fin ? fmt(c.fecha_fin) : 'Indefinido'}</td>
                          <td>{c.tipo_contrato || '—'}</td>
                          <td>{c.dias_libres_por_mes != null ? String(c.dias_libres_por_mes).replace('.', ',') : '—'}</td>
                          <td style={{ fontWeight: 500 }}>{fmtMonto(c.honorarios)}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <span style={{ display: 'flex', gap: 6 }}>
                              {c.adjunto && <a href={c.adjunto} target="_blank" rel="noreferrer" title="Contrato"><FileText size={15} className="text-primary" /></a>}
                              {c.adjunto2 && <a href={c.adjunto2} target="_blank" rel="noreferrer" title="Anexo"><FileText size={15} className="text-primary" /></a>}
                            </span>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <small style={{ color: 'var(--color-text-muted)' }}>Tocá un contrato para ver el detalle.</small>
            </Seccion>

            {/* 6. Contractual */}
            <Seccion icon={CalendarClock} titulo="Datos contractuales">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div className="field">
                  <label>Puesto</label>
                  <input value={ficha.puesto || '—'} readOnly disabled style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
                </div>
                <div className="field">
                  <label>Fecha de inicio</label>
                  <input value={fmt(fechaInicio)} readOnly disabled style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
                </div>
                <div className="field">
                  <label>Fin de contrato</label>
                  <input value={fmt(finDeContrato(contratos))} readOnly disabled style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
                </div>
              </div>
            </Seccion>
          </>
        )}

        {/* 7. Mis datos */}
        <Seccion icon={User} titulo="Mis datos">
          <form onSubmit={guardarDatos} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label>Nombre *</label>
                <input required value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
              </div>
              <div className="field">
                <label>Apellido</label>
                <input value={datos.apellido} onChange={e => setDatos({ ...datos, apellido: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label>Email de acceso</label>
                <input type="email" value={datos.email} readOnly disabled style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
                <small style={{ color: 'var(--color-text-muted)' }}>Con este email iniciás sesión. Para cambiarlo, pedíselo a un administrador.</small>
              </div>
              <div className="field">
                <label>Email personal</label>
                <input type="email" value={datos.email_personal} onChange={e => setDatos({ ...datos, email_personal: e.target.value })} />
              </div>
            </div>
            <div>
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                <Save size={18} /> {guardando ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
            <Mensaje msg={msgDatos} />
          </form>
        </Seccion>

        {/* 8. Cambiar contraseña */}
        <Seccion icon={KeyRound} titulo="Cambiar contraseña">
          <form onSubmit={cambiarPassword} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div className="field">
              <label>Contraseña nueva</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={verPass ? 'text' : 'password'}
                  value={pass.nueva}
                  autoComplete="new-password"
                  onChange={e => setPass({ ...pass, nueva: e.target.value })}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setVerPass(v => !v)}
                  aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
                >
                  {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small style={{ color: 'var(--color-text-muted)' }}>Al menos 8 caracteres.</small>
            </div>
            <div className="field">
              <label>Repetir contraseña nueva</label>
              <input
                type={verPass ? 'text' : 'password'}
                value={pass.repetir}
                autoComplete="new-password"
                onChange={e => setPass({ ...pass, repetir: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={cambiandoPass}>
                <KeyRound size={18} /> {cambiandoPass ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><Mensaje msg={msgPass} /></div>
          </form>
        </Seccion>
      </div>

      {/* MODAL VER CONTRATO (solo lectura) */}
      {contratoVer && createPortal(
        <div className="modal-overlay" onClick={() => setContratoVer(null)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Contrato
                {vigente && contratoVer.id === vigente.id && <span className="badge badge-green" style={{ fontSize: 11 }}>Vigente</span>}
              </h3>
              <button className="btn-close" onClick={() => setContratoVer(null)}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: '14px', padding: '20px' }}>
              {[
                ['Tipo de contrato', contratoVer.tipo_contrato || '—'],
                ['Estado', contratoVer.estado || '—'],
                ['Fecha de inicio', fmt(contratoVer.fecha_inicio)],
                ['Fecha de fin', contratoVer.fecha_fin ? fmt(contratoVer.fecha_fin) : 'Indefinido'],
                ['Días libres por mes', contratoVer.dias_libres_por_mes != null ? String(contratoVer.dias_libres_por_mes).replace('.', ',') : '—'],
                ['Tipo de honorarios', contratoVer.tipo_honorarios || '—'],
                ['Honorarios', fmtMonto(contratoVer.honorarios)],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{lbl}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right' }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {contratoVer.adjunto
                  ? <a href={contratoVer.adjunto} target="_blank" rel="noreferrer" className="btn btn-secondary"><FileText size={16} /> Ver contrato</a>
                  : <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Sin contrato adjunto</span>}
                {contratoVer.adjunto2 && (
                  <a href={contratoVer.adjunto2} target="_blank" rel="noreferrer" className="btn btn-secondary"><FileText size={16} /> Ver anexo</a>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL SUBIR FACTURA */}
      {modalFactura && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3>Subir factura del período</h3>
              <button className="btn-close" onClick={() => setModalFactura(false)}><X size={20} /></button>
            </div>
            <form onSubmit={guardarFactura} style={{ display: 'grid', gap: '16px', padding: '20px' }}>
              <div className="field">
                <label>Fecha de la factura</label>
                <input type="date" value={nuevaFactura.fecha_factura} onChange={e => setNuevaFactura({ ...nuevaFactura, fecha_factura: e.target.value })} />
              </div>
              <div className="field">
                <label>Nº de factura</label>
                <input type="text" value={nuevaFactura.numero_factura} onChange={e => setNuevaFactura({ ...nuevaFactura, numero_factura: e.target.value })} />
              </div>
              <div className="field">
                <label>Monto *</label>
                <input type="number" step="0.01" required value={nuevaFactura.monto} onChange={e => setNuevaFactura({ ...nuevaFactura, monto: e.target.value })} />
              </div>
              <div className="field">
                <label>
                  Archivo (PDF) *
                  {nuevaFactura.archivo_factura && (
                    <span style={{ marginLeft: 8, color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <UploadCloud size={14} /> cargado
                    </span>
                  )}
                </label>
                <input type="file" accept=".pdf,application/pdf" onChange={subirArchivoFactura} disabled={subiendo} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={subiendo}>
                {subiendo ? 'Subiendo...' : 'Enviar factura'}
              </button>
              <Mensaje msg={msgFactura} />
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

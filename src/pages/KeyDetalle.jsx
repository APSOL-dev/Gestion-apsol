import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, KeyRound, Eye, EyeOff, ExternalLink, Wand2,
  Paperclip, FileText, X, ShieldCheck, Database,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { getColaboradoresLista } from '../services/colaboradores'
import {
  getCredencialById, saveCredencial, deleteCredencial,
  subirArchivoKey, borrarArchivoKey, urlArchivoKey, getEmpresasParaKeys,
} from '../services/credenciales'
import {
  KEY_VACIA, TIPO_BD, CRITICIDADES, AMBITOS, validarKey, tiposDisponibles,
  linkDeKey, generarPassword, cadenaConexionBD, nombreColaborador,
  esAdminKeys, puedeEditarKey, validarArchivoKey, hayCambiosKey,
} from '../utils/keys'
import { BotonCopiar, BadgeCriticidad, Segmentado } from '../components/KeysUI'

// Los inputs trabajan con '' en vez de null.
function aFormulario(k) {
  const out = { ...KEY_VACIA, ...k }
  for (const c of ['nombre', 'tipo', 'servicio', 'usuario', 'password', 'url', 'puerto', 'nombre_bd', 'notas', 'empresa_id']) {
    if (out[c] == null) out[c] = ''
  }
  out.lectores = out.lectores || []
  return out
}

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '')

function ErrorCampo({ mensaje }) {
  return mensaje ? <span className="key-error" role="alert">{mensaje}</span> : null
}

function Dato({ label, children }) {
  return (
    <div className="keys-dato">
      <span className="keys-dato-label">{label}</span>
      <div className="keys-dato-valor">{children}</div>
    </div>
  )
}

// Se remonta al cambiar de key (key={id}): así cada ficha arranca con su
// estado limpio sin tener que resetearlo a mano en un efecto.
export default function KeyDetallePagina() {
  const { id } = useParams()
  return <KeyDetalle key={id} id={id} />
}

function KeyDetalle({ id }) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const esNuevo = id === 'nueva'
  const { perfil, user } = useAuth()
  const esAdmin = esAdminKeys(perfil?.cargo)
  const { credenciales, refreshCredenciales } = useData()

  const [inicial] = useState(() => {
    if (!esNuevo) return null
    const empresaId = searchParams.get('empresa')
    return aFormulario(empresaId ? { ambito: 'Cliente', empresa_id: empresaId } : {})
  })
  const [key, setKey] = useState(inicial)
  const [original, setOriginal] = useState(inicial)
  const [cargando, setCargando] = useState(!esNuevo)
  const [noEncontrada, setNoEncontrada] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [mensaje, setMensaje] = useState(location.state?.mensaje || '')
  const [guardando, setGuardando] = useState(false)
  const [mostrarPass, setMostrarPass] = useState(false)
  const [archivoPendiente, setArchivoPendiente] = useState(null)
  const [errorArchivo, setErrorArchivo] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [colaboradores, setColaboradores] = useState([])
  const [cargandoColaboradores, setCargandoColaboradores] = useState(true)
  const [empresas, setEmpresas] = useState([])
  const inputArchivo = useRef()

  // Carga de la key (o del formulario vacío)
  useEffect(() => {
    if (esNuevo) return
    let cancelado = false
    getCredencialById(id)
      .then(data => {
        if (cancelado) return
        if (!data) { setNoEncontrada(true); return }
        const f = aFormulario(data)
        setKey(f)
        setOriginal(f)
      })
      .catch(err => {
        console.error(err)
        if (!cancelado) setErrorGeneral('No se pudo cargar la key. Probá de nuevo.')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [id, esNuevo])

  // Colaboradores: para saber quién soy (mi ficha), quién la cargó y, si soy
  // admin, a quién compartirla. Empresas: para elegir el cliente (por una
  // función de la base, porque un colaborador no puede leer Empresas).
  useEffect(() => {
    getColaboradoresLista({ soloActivos: false })
      .then(setColaboradores)
      .catch(err => console.error(err))
      .finally(() => setCargandoColaboradores(false))
    getEmpresasParaKeys()
      .then(setEmpresas)
      .catch(err => console.error(err))
  }, [])

  const hayCambios = hayCambiosKey(original, key) || !!archivoPendiente

  useEffect(() => {
    if (!hayCambios) return
    const avisar = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  // Lectores posibles: colaboradores activos con usuario que no son admins
  // (los admins ya ven todo). Se suman los que ya estaban elegidos aunque
  // hoy estén inactivos, para poder sacarlos.
  const opcionesLectores = useMemo(() => {
    const elegidos = new Set(key?.lectores || [])
    return colaboradores
      .filter(c => elegidos.has(c.id) || (!c.es_admin && c.usuario_id && c.estado !== 'Inactivo'))
      .sort((a, b) => nombreColaborador(a).localeCompare(nombreColaborador(b), 'es'))
  }, [colaboradores, key?.lectores])

  const empresasOrdenadas = useMemo(
    () => [...(empresas || [])].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')),
    [empresas]
  )

  const miColaboradorId = colaboradores.find(c => c.usuario_id && c.usuario_id === user?.id)?.id || null
  const editable = !!key && puedeEditarKey(esNuevo ? {} : key, { esAdmin, miColaboradorId })
  const autor = key?.creado_por ? colaboradores.find(c => c.id === key.creado_por) : null

  function cambiar(campo, valor) {
    setKey(k => ({ ...k, [campo]: valor }))
    setMensaje('')
    if (errores[campo]) setErrores(e => { const n = { ...e }; delete n[campo]; return n })
  }

  function toggleLector(colabId) {
    const actuales = key.lectores || []
    cambiar('lectores', actuales.includes(colabId) ? actuales.filter(x => x !== colabId) : [...actuales, colabId])
  }

  function volver() {
    if (hayCambios && !window.confirm('Tenés cambios sin guardar. ¿Salir igual?')) return
    navigate('/keys')
  }

  async function guardar(e) {
    e.preventDefault()
    const errs = validarKey(key)
    setErrores(errs)
    if (Object.keys(errs).length) {
      setErrorGeneral('Revisá los campos marcados.')
      // Llevar al usuario al primer campo con error (en mobile el aviso
      // general queda fuera de la pantalla)
      setTimeout(() => document.querySelector('form [aria-invalid="true"]')?.focus(), 0)
      return
    }
    setGuardando(true)
    setErrorGeneral('')
    try {
      let guardada = await saveCredencial(key)
      if (archivoPendiente) {
        const adj = await subirArchivoKey(guardada.id, archivoPendiente)
        guardada = await saveCredencial({ ...guardada, ...adj })
        setArchivoPendiente(null)
      }
      refreshCredenciales?.({ silencioso: true, forzar: true })
      if (esNuevo) {
        navigate(`/keys/${guardada.id}`, { replace: true, state: { mensaje: 'Key guardada.' } })
      } else {
        setMensaje('Key guardada.')
        const f = aFormulario(guardada)
        setKey(f)
        setOriginal(f)
      }
    } catch (err) {
      console.error(err)
      setErrorGeneral(`No se pudo guardar la key: ${err.message || 'error desconocido'}`)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar la key "${original.nombre}"? Esta acción no se puede deshacer.`)) return
    setGuardando(true)
    try {
      await deleteCredencial({ id, archivo_path: original.archivo_path })
      refreshCredenciales?.({ silencioso: true, forzar: true })
      navigate('/keys')
    } catch (err) {
      console.error(err)
      setErrorGeneral(`No se pudo eliminar: ${err.message || 'error desconocido'}`)
      setGuardando(false)
    }
  }

  async function elegirArchivo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const motivo = validarArchivoKey(file)
    setErrorArchivo(motivo || '')
    if (motivo) return
    if (esNuevo) { setArchivoPendiente(file); return }
    // Key existente: se sube en el momento y queda guardado solo el adjunto
    setSubiendo(true)
    try {
      const adj = await subirArchivoKey(id, file)
      const guardada = await saveCredencial({ ...original, ...adj })
      if (original.archivo_path) await borrarArchivoKey(original.archivo_path).catch(console.error)
      setKey(k => ({ ...k, ...adj }))
      setOriginal(aFormulario(guardada))
      refreshCredenciales?.({ silencioso: true, forzar: true })
    } catch (err) {
      console.error(err)
      setErrorArchivo(`No se pudo subir el archivo: ${err.message || 'error desconocido'}`)
    } finally {
      setSubiendo(false)
    }
  }

  async function quitarArchivo() {
    if (archivoPendiente) { setArchivoPendiente(null); return }
    if (!window.confirm(`¿Quitar el adjunto "${key.archivo_nombre}"?`)) return
    setSubiendo(true)
    try {
      const guardada = await saveCredencial({ ...original, archivo_path: null, archivo_nombre: null })
      await borrarArchivoKey(original.archivo_path).catch(console.error)
      setKey(k => ({ ...k, archivo_path: null, archivo_nombre: null }))
      setOriginal(aFormulario(guardada))
      refreshCredenciales?.({ silencioso: true, forzar: true })
    } catch (err) {
      console.error(err)
      setErrorArchivo(`No se pudo quitar el adjunto: ${err.message || 'error desconocido'}`)
    } finally {
      setSubiendo(false)
    }
  }

  async function abrirArchivo() {
    try {
      const url = await urlArchivoKey(key.archivo_path)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      console.error(err)
      setErrorArchivo('No se pudo abrir el adjunto.')
    }
  }

  // Un colaborador que abre una key ajena no debe ver el formulario ni un
  // instante: se espera a saber quién es antes de decidir.
  if (cargando || (!esAdmin && !esNuevo && cargandoColaboradores)) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando key...</p>
      </div>
    )
  }

  if (noEncontrada || !key) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <div className="empty-state">
          <ShieldCheck size={40} />
          <h3>{noEncontrada ? 'La key no existe o no tenés permiso para verla' : 'No se pudo cargar la key'}</h3>
          {errorGeneral && <p>{errorGeneral}</p>}
          <button type="button" className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/keys')}>
            <ArrowLeft size={16} /> Volver a Keys
          </button>
        </div>
      </div>
    )
  }

  const link = linkDeKey(key)
  const cadena = cadenaConexionBD(key)
  const esBD = key.tipo === TIPO_BD || !!key.puerto || !!key.nombre_bd
  const nombreAdjunto = archivoPendiente?.name || key.archivo_nombre

  const cabecera = (
    <div className="page-header" style={{ alignItems: 'center' }}>
      <div className="keys-cabecera">
        <button type="button" className="btn btn-secondary keys-volver" onClick={volver} aria-label="Volver" title="Volver">
          <ArrowLeft size={18} />
        </button>
        <div className="keys-cabecera-texto">
          <h1 className="page-title keys-titulo">{esNuevo ? 'Nueva key' : original.nombre}</h1>
          {!esNuevo && (
            <p className="page-subtitle">
              <span>Creada el {fecha(key.created_at)}</span>
              {autor && <span> · Cargada por {nombreColaborador(autor)}</span>}
              {key.updated_at && <span> · Modificada el {fecha(key.updated_at)}</span>}
            </p>
          )}
        </div>
      </div>
      {esAdmin && !esNuevo && (
        <button type="button" className="btn btn-danger" onClick={eliminar} disabled={guardando}>
          <Trash2 size={18} /> Eliminar
        </button>
      )}
    </div>
  )

  const adjunto = (
    <div className="keys-adjunto">
      {nombreAdjunto ? (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={archivoPendiente ? undefined : abrirArchivo}
            disabled={!!archivoPendiente}
            title={archivoPendiente ? 'Se sube al guardar' : 'Abrir adjunto'}
          >
            <FileText size={16} /> {nombreAdjunto}
          </button>
          {archivoPendiente && <span className="keys-muted">Se sube al guardar</span>}
          {editable && (
            <button type="button" className="key-icon-btn" onClick={quitarArchivo} disabled={subiendo} aria-label="Quitar adjunto" title="Quitar adjunto">
              <X size={15} />
            </button>
          )}
        </>
      ) : (
        !editable && <span className="keys-muted">Sin adjunto</span>
      )}
      {editable && (
        <>
          <input
            ref={inputArchivo}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
            aria-label="Adjuntar archivo"
            onChange={elegirArchivo}
            style={{ display: 'none' }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => inputArchivo.current?.click()} disabled={subiendo}>
            <Paperclip size={16} /> {subiendo ? 'Subiendo...' : nombreAdjunto ? 'Reemplazar' : 'Adjuntar archivo'}
          </button>
        </>
      )}
      {errorArchivo && <span className="key-error" role="alert">{errorArchivo}</span>}
    </div>
  )

  // ---------- Solo lectura (colaborador lector de una key ajena) ----------
  if (!editable) {
    return (
      <div className="page" style={{ maxWidth: 820 }}>
        {cabecera}
        <div className="card keys-ficha" data-testid="ficha-lectura">
          <Dato label="Tipo">{key.tipo}</Dato>
          <Dato label="Ámbito">{key.ambito === 'Cliente' ? <span>Cliente: <strong>{key.empresa_nombre}</strong></span> : 'Propio'}</Dato>
          <Dato label="Servicio">{key.servicio}</Dato>
          <Dato label="Criticidad"><BadgeCriticidad criticidad={key.criticidad} /></Dato>
          <Dato label="Usuario">
            {key.usuario ? <><span className="keys-mono">{key.usuario}</span><BotonCopiar texto={key.usuario} etiqueta="Copiar usuario" /></> : <span className="keys-muted">—</span>}
          </Dato>
          <Dato label="Contraseña">
            <span className="keys-mono keys-pass-lectura">{mostrarPass ? key.password : '••••••••••'}</span>
            <button type="button" className="key-icon-btn" onClick={() => setMostrarPass(v => !v)} aria-label={mostrarPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={mostrarPass ? 'Ocultar' : 'Mostrar'}>
              {mostrarPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <BotonCopiar texto={key.password} etiqueta="Copiar contraseña" />
          </Dato>
          {key.url && (
            <Dato label="URL / Host">
              <span className="keys-mono keys-romper">{key.url}</span>
              <BotonCopiar texto={key.url} etiqueta="Copiar link" />
              {link && <a className="key-icon-btn" href={link} target="_blank" rel="noreferrer noopener" aria-label="Abrir link" title="Abrir"><ExternalLink size={15} /></a>}
            </Dato>
          )}
          {key.puerto && <Dato label="Puerto"><span className="keys-mono">{key.puerto}</span></Dato>}
          {key.nombre_bd && <Dato label="Base de datos"><span className="keys-mono">{key.nombre_bd}</span></Dato>}
          {cadena && (
            <Dato label="Conexión">
              <span className="keys-muted">postgresql://…</span>
              <BotonCopiar texto={cadena} etiqueta="Copiar cadena de conexión" />
            </Dato>
          )}
          {key.notas && <Dato label="Notas"><span className="keys-notas">{key.notas}</span></Dato>}
          <Dato label="Adjunto">{adjunto}</Dato>
        </div>
      </div>
    )
  }

  // ---------- Formulario (admin) ----------
  const tipos = tiposDisponibles(credenciales)

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      {cabecera}

      <form onSubmit={guardar} noValidate>
        <div className="card keys-seccion">
          <h3><KeyRound size={18} className="text-primary" /> Datos</h3>
          <div className="keys-grid">
            <div className="field">
              <label htmlFor="k-nombre">Nombre *</label>
              <input id="k-nombre" aria-label="Nombre" value={key.nombre} onChange={e => cambiar('nombre', e.target.value)} placeholder="Ej. Chat GPT, Email distribuidora Tori" aria-invalid={!!errores.nombre} />
              <ErrorCampo mensaje={errores.nombre} />
            </div>
            <div className="field">
              <label htmlFor="k-tipo">Tipo *</label>
              <input id="k-tipo" aria-label="Tipo" list="k-tipos" value={key.tipo} onChange={e => cambiar('tipo', e.target.value)} placeholder="Elegí o escribí uno nuevo" aria-invalid={!!errores.tipo} />
              <datalist id="k-tipos">{tipos.map(t => <option key={t} value={t} />)}</datalist>
              <ErrorCampo mensaje={errores.tipo} />
            </div>
            <div className="field">
              <label>Ámbito *</label>
              <Segmentado etiqueta="Ámbito" opciones={AMBITOS} valor={key.ambito} onChange={v => cambiar('ambito', v)} />
              <ErrorCampo mensaje={errores.ambito} />
            </div>
            {key.ambito === 'Cliente' ? (
              <div className="field">
                <label htmlFor="k-empresa">Empresa *</label>
                <select id="k-empresa" aria-label="Empresa" value={key.empresa_id} onChange={e => cambiar('empresa_id', e.target.value)} aria-invalid={!!errores.empresa_id}>
                  <option value="">-- Seleccionar empresa --</option>
                  {empresasOrdenadas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
                <ErrorCampo mensaje={errores.empresa_id} />
              </div>
            ) : <div className="keys-grid-vacio" />}
            <div className="field keys-grid-full">
              <label htmlFor="k-servicio">Servicio *</label>
              <input id="k-servicio" aria-label="Servicio" value={key.servicio} onChange={e => cambiar('servicio', e.target.value)} placeholder="Ej. Gmail, Supabase, Servicio OpenAI" aria-invalid={!!errores.servicio} />
              <ErrorCampo mensaje={errores.servicio} />
            </div>
          </div>
        </div>

        <div className="card keys-seccion">
          <h3><ShieldCheck size={18} className="text-primary" /> Acceso</h3>
          <div className="keys-grid">
            <div className="field">
              <label htmlFor="k-usuario">Usuario</label>
              <div className="keys-input-acciones">
                <input id="k-usuario" aria-label="Usuario" value={key.usuario} onChange={e => cambiar('usuario', e.target.value)} placeholder="Opcional (las API keys no tienen)" autoComplete="off" />
                <BotonCopiar texto={key.usuario} etiqueta="Copiar usuario" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="k-pass">Contraseña *</label>
              <div className="keys-input-acciones">
                <input
                  id="k-pass" aria-label="Contraseña"
                  type={mostrarPass ? 'text' : 'password'}
                  value={key.password}
                  onChange={e => cambiar('password', e.target.value)}
                  autoComplete="new-password"
                  className="keys-mono"
                  aria-invalid={!!errores.password}
                />
                <button type="button" className="key-icon-btn" onClick={() => setMostrarPass(v => !v)} aria-label={mostrarPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={mostrarPass ? 'Ocultar' : 'Mostrar'}>
                  {mostrarPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <BotonCopiar texto={key.password} etiqueta="Copiar contraseña" />
                <button type="button" className="key-icon-btn" onClick={() => { cambiar('password', generarPassword()); setMostrarPass(true) }} aria-label="Generar contraseña" title="Generar contraseña segura">
                  <Wand2 size={15} />
                </button>
              </div>
              <ErrorCampo mensaje={errores.password} />
            </div>
            <div className="field keys-grid-full">
              <label htmlFor="k-url">URL / Host</label>
              <div className="keys-input-acciones">
                <input id="k-url" aria-label="URL / Host" value={key.url} onChange={e => cambiar('url', e.target.value)} placeholder="https://... o el host de la base" autoComplete="off" />
                <BotonCopiar texto={key.url} etiqueta="Copiar link" />
                {link && (
                  <a className="key-icon-btn" href={link} target="_blank" rel="noreferrer noopener" aria-label="Abrir link" title="Abrir en otra pestaña">
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </div>
            {esBD && (
              <>
                <div className="field">
                  <label htmlFor="k-puerto">Puerto</label>
                  <input id="k-puerto" aria-label="Puerto" inputMode="numeric" value={key.puerto} onChange={e => cambiar('puerto', e.target.value)} placeholder="5432" aria-invalid={!!errores.puerto} />
                  <ErrorCampo mensaje={errores.puerto} />
                </div>
                <div className="field">
                  <label htmlFor="k-bd">Nombre de la base</label>
                  <input id="k-bd" aria-label="Nombre de la base" value={key.nombre_bd} onChange={e => cambiar('nombre_bd', e.target.value)} placeholder="postgres" />
                </div>
                {cadena && (
                  <div className="field keys-grid-full">
                    <label>Cadena de conexión</label>
                    <div className="keys-input-acciones">
                      <span className="keys-muted"><Database size={14} /> postgresql://{key.usuario}:••••@{cadena.split('@')[1]}</span>
                      <BotonCopiar texto={cadena} etiqueta="Copiar cadena de conexión" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card keys-seccion">
          <h3>Control</h3>
          <div className="keys-grid">
            <div className="field">
              <label>Criticidad</label>
              <Segmentado etiqueta="Criticidad" opciones={CRITICIDADES} valor={key.criticidad} onChange={v => cambiar('criticidad', v)} />
            </div>
            <div className="field">
              <label>Estado</label>
              <Segmentado etiqueta="Estado" opciones={['Activo', 'Inactivo']} valor={key.estado} onChange={v => cambiar('estado', v)} />
            </div>
            <div className="field keys-grid-full">
              <label>Lectores</label>
              {!esAdmin ? (
                <p className="keys-ayuda">La van a poder ver vos y los administradores. Si otro colaborador la necesita, pedile a un administrador que se la comparta.</p>
              ) : <>
              <p className="keys-ayuda">Los administradores ven todas las keys. Elegí qué colaboradores pueden ver esta (solo lectura, y solo mientras esté activa).</p>
              {opcionesLectores.length === 0 ? (
                <span className="keys-muted">No hay colaboradores con usuario para elegir.</span>
              ) : (
                <div className="keys-lectores-opciones">
                  {opcionesLectores.map(c => (
                    <label key={c.id} className={`keys-chip${key.lectores.includes(c.id) ? ' is-activo' : ''}`}>
                      <input type="checkbox" checked={key.lectores.includes(c.id)} onChange={() => toggleLector(c.id)} />
                      {nombreColaborador(c)}{c.estado === 'Inactivo' ? ' (inactivo)' : ''}
                    </label>
                  ))}
                </div>
              )}
              </>}
            </div>
            <div className="field keys-grid-full">
              <label htmlFor="k-notas">Notas</label>
              <textarea id="k-notas" aria-label="Notas" rows={3} value={key.notas} onChange={e => cambiar('notas', e.target.value)} placeholder="Ej. MFA, PIN, a quién pedirle el código..." />
            </div>
            <div className="field keys-grid-full">
              <label>Adjunto (PDF, imagen o .txt — hasta 10 MB)</label>
              {adjunto}
            </div>
          </div>
        </div>

        <div className="keys-acciones">
          {/* Junto al botón (y fijo abajo en mobile) para que siempre se vea */}
          {errorGeneral && <span className="keys-aviso is-error" role="alert">{errorGeneral}</span>}
          {mensaje && <span className="keys-aviso is-ok" role="status">{mensaje}</span>}
          <button type="button" className="btn btn-secondary" onClick={volver}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={guardando || subiendo}>
            <Save size={18} /> {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

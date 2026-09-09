import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Trash2, ChevronUp, ChevronDown, Lock, Unlock,
  Paperclip, Link2, X, Loader2, ListChecks, Plus, Download,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { uploadFile } from '../services/storage'
import {
  getSprintById, actualizarSprint, cerrarSprint, reabrirSprint,
  crearItem, actualizarItem, eliminarItem, guardarOrdenItems,
  agregarAdjunto, eliminarAdjunto, crearNotaSprint, eliminarNotaSprint,
  eliminarSprint,
} from '../services/sprints'
import {
  ESTADOS_ITEM, ORDEN_ESTADOS, contarEstados, porcentajeAvance,
  siguienteOrden, moverItemEnLista, renumerarOrden, puedeEditarSprint,
  puedeEliminarSprint, siguienteEstadoCiclo, esImagenUrl, dominioDeUrl,
  esArchivoStorage, urlDescargaAdjunto,
} from '../services/sprints-utils'

const ESTADO_SPRINT_BADGE = {
  planificado: 'badge-gray',
  activo: 'badge-blue',
  cerrado: 'badge-green',
}

export default function SprintDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, esDuenio } = useAuth()

  const [sprint, setSprint] = useState(null)
  const [items, setItems] = useState([])
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function cargar() {
    setLoading(true)
    try {
      const data = await getSprintById(id)
      setSprint(data)
      setItems(data.items || [])
      setNotas(data.notas_items || [])
      setError('')
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar el sprint.')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [id])

  const editable = sprint ? puedeEditarSprint(sprint) : false
  const conteo = contarEstados(items)
  const avance = porcentajeAvance(items)
  const puedeBorrar = puedeEliminarSprint(sprint, { userId: user?.id, esDuenio, items, notas })

  // ── Encabezado del sprint ──────────────────────────────────
  function patchSprintLocal(campos) {
    setSprint((s) => ({ ...s, ...campos }))
  }
  async function guardarCampoSprint(campos) {
    try {
      await actualizarSprint(id, campos)
    } catch (err) {
      console.error(err)
      alert('No se pudo guardar el cambio.')
      cargar()
    }
  }

  async function cambiarEstadoSprint(nuevo) {
    try {
      if (nuevo === 'cerrado') {
        const upd = await cerrarSprint(id)
        setSprint((s) => ({ ...s, ...upd }))
      } else if (nuevo === 'activo' && sprint.estado === 'cerrado') {
        const upd = await reabrirSprint(id)
        setSprint((s) => ({ ...s, ...upd }))
      } else {
        patchSprintLocal({ estado: nuevo })
        await guardarCampoSprint({ estado: nuevo })
      }
    } catch (err) {
      console.error(err)
      alert('No se pudo cambiar el estado del sprint.')
      cargar()
    }
  }

  async function borrarSprint() {
    if (!puedeBorrar) return
    if (!window.confirm(
      `¿Eliminar el Sprint ${sprint.numero}? El sprint está vacío y esta acción no se puede deshacer.`
    )) return
    try {
      await eliminarSprint(id)
      navigate(sprint.proyecto ? `/proyectos/${sprint.proyecto.id}` : '/sprints')
    } catch (err) {
      console.error(err)
      alert('No se pudo eliminar el sprint.')
    }
  }

  // ── Puntos ─────────────────────────────────────────────────
  // Alta rápida: escribir + Enter agrega el punto y deja el campo listo
  // para el siguiente, sin botones ni formularios de por medio.
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [agregando, setAgregando] = useState(false)
  const nuevoInputRef = useRef(null)

  async function agregarPunto(titulo) {
    const limpio = titulo.trim()
    if (!limpio || agregando) return
    setAgregando(true)
    try {
      const nuevo = await crearItem({ sprint_id: id, orden: siguienteOrden(items), titulo: limpio })
      setItems((prev) => [...prev, { ...nuevo, adjuntos: nuevo.adjuntos || [] }])
      setNuevoTitulo('')
      nuevoInputRef.current?.focus()
    } catch (err) {
      console.error(err)
      alert('No se pudo agregar el punto.')
    } finally {
      setAgregando(false)
    }
  }

  // Update optimista: pinta ya y persiste atrás; si falla, revierte.
  function actualizarPuntoLocal(itemId, campos) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...campos } : it)))
  }
  async function persistirPunto(itemId, campos) {
    const previo = items.find((it) => it.id === itemId)
    actualizarPuntoLocal(itemId, campos)
    try {
      await actualizarItem(itemId, campos, user?.id)
    } catch (err) {
      console.error(err)
      alert('No se pudo guardar el cambio del punto.')
      if (previo) actualizarPuntoLocal(itemId, previo)
    }
  }

  async function borrarPunto(itemId) {
    if (!window.confirm('¿Eliminar este punto del sprint?')) return
    const previo = items
    setItems((prev) => prev.filter((it) => it.id !== itemId))
    try {
      await eliminarItem(itemId)
    } catch (err) {
      console.error(err)
      alert('No se pudo eliminar el punto.')
      setItems(previo)
    }
  }

  async function mover(itemId, direccion) {
    const reordenado = moverItemEnLista(items, itemId, direccion)
    if (reordenado === items || reordenado.map((i) => i.id).join() === items.map((i) => i.id).join()) return
    const cambios = renumerarOrden(reordenado)
    const conOrden = reordenado.map((it, idx) => ({ ...it, orden: idx }))
    setItems(conOrden)
    try {
      await guardarOrdenItems(cambios)
    } catch (err) {
      console.error(err)
      alert('No se pudo reordenar.')
      cargar()
    }
  }

  // ── Notas ──────────────────────────────────────────────────
  const [nuevaNota, setNuevaNota] = useState('')
  const [agregandoNota, setAgregandoNota] = useState(false)

  async function agregarNota() {
    const limpia = nuevaNota.trim()
    if (!limpia || !user?.id || agregandoNota) return
    setAgregandoNota(true)
    try {
      const creada = await crearNotaSprint({ sprint_id: id, creado_por: user.id, nota: limpia })
      setNotas((prev) => [creada, ...prev])
      setNuevaNota('')
    } catch (err) {
      console.error(err)
      alert('No se pudo agregar la nota.')
    } finally {
      setAgregandoNota(false)
    }
  }

  async function borrarNota(notaId) {
    if (!window.confirm('¿Eliminar esta nota?')) return
    const previo = notas
    setNotas((prev) => prev.filter((n) => n.id !== notaId))
    try {
      await eliminarNotaSprint(notaId)
    } catch (err) {
      console.error(err)
      alert('No se pudo eliminar la nota.')
      setNotas(previo)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando sprint...</p>
      </div>
    )
  }

  if (error || !sprint) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <div className="alert alert-error">{error || 'Sprint no encontrado.'}</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: 16 }}>
          <ArrowLeft size={18} /> Volver
        </button>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            className="btn btn-secondary"
            style={{ padding: 8 }}
            onClick={() => navigate(sprint.proyecto ? `/proyectos/${sprint.proyecto.id}` : '/sprints')}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 className="page-title">
                Sprint {sprint.numero}{sprint.nombre ? ` · ${sprint.nombre}` : ''}
              </h1>
              <span className={`badge ${ESTADO_SPRINT_BADGE[sprint.estado] || 'badge-gray'}`}>
                {sprint.estado}
              </span>
            </div>
            <p className="page-subtitle">
              {sprint.proyecto ? (
                <Link to={`/proyectos/${sprint.proyecto.id}`} style={{ color: 'inherit' }}>
                  {sprint.proyecto.nombre}
                </Link>
              ) : 'Proyecto'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {sprint.estado === 'planificado' && (
            <button className="btn btn-primary" onClick={() => cambiarEstadoSprint('activo')}>
              Iniciar sprint
            </button>
          )}
          {sprint.estado === 'activo' && (
            <button className="btn btn-secondary" onClick={() => cambiarEstadoSprint('cerrado')}>
              <Lock size={16} /> Cerrar sprint
            </button>
          )}
          {sprint.estado === 'cerrado' && (
            <button className="btn btn-secondary" onClick={() => cambiarEstadoSprint('activo')}>
              <Unlock size={16} /> Reabrir
            </button>
          )}
          {puedeBorrar && (
            <button
              className="btn btn-secondary"
              onClick={borrarSprint}
              title="El sprint no tiene puntos ni notas: se puede eliminar"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 size={16} /> Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Semáforo en vivo */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' }}>
            {avance}%
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
              avance
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {ORDEN_ESTADOS.map((e) => (
              <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <span>{ESTADOS_ITEM[e].emoji}</span>
                <strong>{conteo[e]}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}>{ESTADOS_ITEM[e].label}</span>
              </span>
            ))}
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>· {conteo.total} en total</span>
          </div>
        </div>
        {sprint.estado === 'cerrado' && sprint.cerrado_en && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
            Cerrado el {new Date(sprint.cerrado_en).toLocaleDateString('es-AR')} · la foto de estados quedó congelada.
          </p>
        )}
      </div>

      {/* Objetivo + fechas */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Objetivo del sprint</label>
          <input
            type="text"
            placeholder="Ej: que el cliente pueda armar un pedido y que descuente stock"
            value={sprint.objetivo || ''}
            disabled={!editable}
            onChange={(e) => patchSprintLocal({ objetivo: e.target.value })}
            onBlur={(e) => guardarCampoSprint({ objetivo: e.target.value })}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="field">
            <label>Nombre corto</label>
            <input
              type="text"
              placeholder="Carrito y stock"
              value={sprint.nombre || ''}
              disabled={!editable}
              onChange={(e) => patchSprintLocal({ nombre: e.target.value })}
              onBlur={(e) => guardarCampoSprint({ nombre: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Desde</label>
            <input
              type="date"
              value={sprint.fecha_inicio || ''}
              disabled={!editable}
              onChange={(e) => { patchSprintLocal({ fecha_inicio: e.target.value }); guardarCampoSprint({ fecha_inicio: e.target.value || null }) }}
            />
          </div>
          <div className="field">
            <label>Hasta</label>
            <input
              type="date"
              value={sprint.fecha_fin || ''}
              disabled={!editable}
              onChange={(e) => { patchSprintLocal({ fecha_fin: e.target.value }); guardarCampoSprint({ fecha_fin: e.target.value || null }) }}
            />
          </div>
        </div>
      </div>

      {/* Puntos */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <ListChecks size={20} className="text-primary" /> Puntos del sprint
        </h3>

        {items.length === 0 && !editable && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Sin puntos.</p>
        )}

        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((it, idx) => (
              <PuntoRow
                key={it.id}
                item={it}
                editable={editable}
                primero={idx === 0}
                ultimo={idx === items.length - 1}
                userId={user?.id}
                onPatch={(campos) => actualizarPuntoLocal(it.id, campos)}
                onPersist={(campos) => persistirPunto(it.id, campos)}
                onMover={(dir) => mover(it.id, dir)}
                onBorrar={() => borrarPunto(it.id)}
                onAdjuntosChange={(adjuntos) => actualizarPuntoLocal(it.id, { adjuntos })}
              />
            ))}
          </div>
        )}

        {editable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', marginTop: items.length > 0 ? 4 : 0 }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1px dashed var(--color-border)', flexShrink: 0 }} />
            <input
              ref={nuevoInputRef}
              type="text"
              placeholder="Escribí un punto…"
              value={nuevoTitulo}
              disabled={agregando}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); agregarPunto(nuevoTitulo) }
              }}
              style={{
                flex: 1, minWidth: 0, fontSize: 14, padding: '6px 8px',
                border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)',
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flexShrink: 0, padding: '6px 12px' }}
              disabled={agregando || !nuevoTitulo.trim()}
              onClick={() => agregarPunto(nuevoTitulo)}
            >
              {agregando ? <Loader2 size={14} style={{ animation: 'spin 0.75s linear infinite' }} /> : <Plus size={16} />}
              Agregar
            </button>
          </div>
        )}
      </div>

      {/* Notas del sprint: lista con autor + fecha, no un textarea suelto */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Notas del sprint</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Minutas, links, decisiones sueltas — cada una queda con quién la escribió y cuándo.
        </p>

        {editable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <textarea
              rows={2}
              style={{ width: '100%', fontFamily: 'inherit' }}
              placeholder="Escribí una nota…"
              value={nuevaNota}
              disabled={agregandoNota}
              onChange={(e) => setNuevaNota(e.target.value)}
            />
            <button
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-end' }}
              disabled={agregandoNota || !nuevaNota.trim()}
              onClick={agregarNota}
            >
              {agregandoNota ? 'Agregando…' : 'Agregar nota'}
            </button>
          </div>
        )}

        {notas.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Todavía no hay notas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notas.map((n) => (
              <div
                key={n.id}
                data-testid="nota-item"
                style={{ background: 'var(--color-surface2)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {n.autor ? `${n.autor.nombre} ${n.autor.apellido}` : 'Usuario'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {n.fecha ? new Date(n.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </span>
                    {editable && user?.id === n.creado_por && (
                      <button
                        title="Eliminar nota"
                        onClick={() => borrarNota(n.id)}
                        style={{ ...iconBtnStyle(true), width: 20, height: 20 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.4, margin: 0, whiteSpace: 'pre-wrap' }}>{n.nota}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Fila de un punto: colorcito (click = siguiente estado), título
// editable, adjuntar (archivo o link) y mover arriba/abajo. El título
// muestra hasta 3 líneas; si hay más, una flechita lo despliega entero.
// ──────────────────────────────────────────────────────────────
function iconBtnStyle(danger) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, padding: 0, border: 'none', background: 'transparent',
    borderRadius: 6, cursor: 'pointer', flexShrink: 0,
    color: danger ? 'var(--color-danger)' : 'var(--color-text-muted)',
  }
}

// Título de un punto: <textarea> que autocrece. En reposo muestra como
// máximo 3 líneas; si el texto es más largo aparece ▾ para verlo
// completo (sin scroll) y ▴ para volver a colapsarlo. Enter guarda y no
// mete salto de línea (el punto sigue siendo "un renglón").
const TITULO_LINEA_PX = 20                      // ~fontSize 14 * line-height 1.4
const TITULO_MAX_COLAPSADO = TITULO_LINEA_PX * 3

function TituloPunto({ value, editable, tachado, onPatch, onPersist }) {
  const taRef = useRef(null)
  const [expandido, setExpandido] = useState(false)
  const [desborda, setDesborda] = useState(false)

  const ajustarAlto = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const completo = ta.scrollHeight
    setDesborda(completo > TITULO_MAX_COLAPSADO + 2)
    ta.style.height = (expandido ? completo : Math.min(completo, TITULO_MAX_COLAPSADO)) + 'px'
  }, [expandido])

  useEffect(() => { ajustarAlto() }, [value, ajustarAlto])

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
      <textarea
        ref={taRef}
        rows={1}
        value={value || ''}
        disabled={!editable}
        onChange={(e) => onPatch({ titulo: e.target.value })}
        onFocus={() => setExpandido(true)}
        onBlur={(e) => { onPersist({ titulo: e.target.value }); setExpandido(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
        style={{
          flex: 1, minWidth: 0, resize: 'none', overflow: 'hidden',
          border: 'none', background: 'transparent', fontSize: 14, lineHeight: 1.4,
          fontFamily: 'inherit', padding: '4px 0',
          color: tachado ? 'var(--color-text-muted)' : 'inherit',
          textDecoration: tachado ? 'line-through' : 'none',
        }}
      />
      {desborda && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setExpandido((v) => !v)}
          title={expandido ? 'Colapsar' : 'Ver todo'}
          style={{ ...iconBtnStyle(), width: 20, height: 22, marginTop: 2 }}
        >
          {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </div>
  )
}

function PuntoRow({
  item, editable, primero, ultimo, userId,
  onPatch, onPersist, onMover, onBorrar, onAdjuntosChange,
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [pidiendoLink, setPidiendoLink] = useState(false)
  const fileRef = useRef(null)
  const linkRef = useRef(null)
  const meta = ESTADOS_ITEM[item.estado] || ESTADOS_ITEM.pendiente
  const adjuntos = item.adjuntos || []

  async function subirArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    try {
      const url = await uploadFile(file, `sprints/${item.sprint_id}/${item.id}`)
      const adj = await agregarAdjunto({ item_id: item.id, url, nombre: file.name, subido_por: userId || null })
      onAdjuntosChange([...adjuntos, adj])
    } catch (err) {
      console.error(err)
      alert('No se pudo subir el archivo.')
    } finally {
      setSubiendo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function adjuntarLink(url) {
    const limpio = (url || '').trim()
    if (!limpio) { setPidiendoLink(false); return }
    try {
      const adj = await agregarAdjunto({ item_id: item.id, url: limpio, subido_por: userId || null })
      onAdjuntosChange([...adjuntos, adj])
      setPidiendoLink(false)
    } catch (err) {
      console.error(err)
      alert('No se pudo adjuntar el link.')
    }
  }

  async function quitarAdjunto(adjId) {
    try {
      await eliminarAdjunto(adjId)
      onAdjuntosChange(adjuntos.filter((a) => a.id !== adjId))
    } catch (err) {
      console.error(err)
      alert('No se pudo quitar el adjunto.')
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 2px' }}>
        {editable ? (
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginTop: 4 }}>
            <button style={{ ...iconBtnStyle(), width: 16, height: 14 }} disabled={primero} onClick={() => onMover('arriba')} title="Subir">
              <ChevronUp size={12} />
            </button>
            <button style={{ ...iconBtnStyle(), width: 16, height: 14 }} disabled={ultimo} onClick={() => onMover('abajo')} title="Bajar">
              <ChevronDown size={12} />
            </button>
          </div>
        ) : <span style={{ width: 16, flexShrink: 0 }} />}

        <button
          title={`${meta.label} — click para cambiar`}
          disabled={!editable}
          onClick={() => onPersist({ estado: siguienteEstadoCiclo(item.estado) })}
          style={{
            width: 16, height: 16, borderRadius: '50%', border: 'none', flexShrink: 0, marginTop: 7,
            background: meta.color, cursor: editable ? 'pointer' : 'default', padding: 0,
          }}
        />

        <TituloPunto
          value={item.titulo}
          editable={editable}
          tachado={item.estado === 'verde'}
          onPatch={onPatch}
          onPersist={onPersist}
        />

        {editable && (
          <>
            <input ref={fileRef} type="file" hidden onChange={subirArchivo} />
            <button style={{ ...iconBtnStyle(), marginTop: 2 }} title="Adjuntar archivo" disabled={subiendo} onClick={() => fileRef.current?.click()}>
              {subiendo ? <Loader2 size={14} style={{ animation: 'spin 0.75s linear infinite' }} /> : <Paperclip size={14} />}
            </button>
            <button
              style={{ ...iconBtnStyle(), marginTop: 2 }}
              title="Adjuntar link"
              onClick={() => { setPidiendoLink((v) => !v); setTimeout(() => linkRef.current?.focus(), 0) }}
            >
              <Link2 size={14} />
            </button>
            <button style={{ ...iconBtnStyle(true), marginTop: 2 }} title="Eliminar punto" onClick={onBorrar}>
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {pidiendoLink && (
        <div style={{ padding: '0 2px 8px 42px' }}>
          <input
            ref={linkRef}
            type="url"
            placeholder="Pegá el link y apretá Enter…"
            style={{ width: '100%', maxWidth: 340, fontSize: 13, padding: '4px 8px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); adjuntarLink(e.currentTarget.value) }
              if (e.key === 'Escape') setPidiendoLink(false)
            }}
            onBlur={(e) => adjuntarLink(e.target.value)}
          />
        </div>
      )}

      {adjuntos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 2px 8px 42px' }}>
          {adjuntos.map((a) => {
            if (esImagenUrl(a.url)) {
              return (
                <span key={a.id} style={{ position: 'relative', display: 'inline-flex' }}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    <img
                      src={a.url}
                      alt={a.nombre || 'adjunto'}
                      style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }}
                    />
                  </a>
                  {editable && (
                    <button
                      onClick={() => quitarAdjunto(a.id)}
                      title="Quitar"
                      style={{
                        position: 'absolute', top: -5, right: -5, width: 15, height: 15, borderRadius: '50%',
                        background: 'var(--color-danger)', color: '#fff', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                    >
                      <X size={9} />
                    </button>
                  )}
                </span>
              )
            }
            // Archivo subido (pdf, html, zip…): forzamos la descarga.
            // Link externo pegado a mano: se abre en pestaña.
            const esArchivo = esArchivoStorage(a.url)
            return (
              <span
                key={a.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
                  border: '1px solid var(--color-border)', borderRadius: 12, padding: '2px 8px',
                  background: 'var(--color-surface2)',
                }}
              >
                {esArchivo ? <Download size={11} /> : <Link2 size={11} />}
                <a
                  href={esArchivo ? urlDescargaAdjunto(a.url) : a.url}
                  target="_blank"
                  rel="noreferrer"
                  download={esArchivo ? (a.nombre || '') : undefined}
                  style={{ color: 'inherit' }}
                >
                  {a.nombre || dominioDeUrl(a.url)}
                </a>
                {editable && (
                  <button onClick={() => quitarAdjunto(a.id)} title="Quitar" style={{ ...iconBtnStyle(), width: 14, height: 14, padding: 0 }}>
                    <X size={10} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Trash2, ChevronUp, ChevronDown, Lock, Unlock,
  Paperclip, Link2, X, Loader2, ListChecks, Plus, Download,
  GripVertical, MessageSquare, UserPlus, List,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../context/AuthContext'
import { uploadFile } from '../services/storage'
import {
  getSprintById, actualizarSprint, cerrarSprint, reabrirSprint,
  crearItem, actualizarItem, eliminarItem, guardarOrdenItems,
  agregarAdjunto, eliminarAdjunto, crearNotaSprint, eliminarNotaSprint,
  eliminarSprint, crearComentarioItem, eliminarComentarioItem,
} from '../services/sprints'
import { getMiFichaColaborador, getColaboradoresLista } from '../services/colaboradores'
import {
  ESTADOS_ITEM, ORDEN_ESTADOS, contarEstados, porcentajeAvance,
  siguienteOrden, moverItemEnLista, moverItemAntesDe, renumerarOrden, puedeEditarSprint,
  puedeEliminarSprint, siguienteEstadoCiclo, esImagenUrl, dominioDeUrl,
  esArchivoStorage, urlDescargaAdjunto,
} from '../services/sprints-utils'
import { puedeVerTodo, sprintVisiblePara } from '../services/sprints-permisos'
import {
  autoformatearVineta, parsearItemFormato, insertarSalto, insertarVinetaEnLinea,
} from '../services/sprint-item-formato'

const ESTADO_SPRINT_BADGE = {
  planificado: 'badge-gray',
  activo: 'badge-blue',
  cerrado: 'badge-green',
}

export default function SprintDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, esDuenio, esTeamLead } = useAuth()
  const verTodo = puedeVerTodo({ esDuenio, esTeamLead })

  const [sprint, setSprint] = useState(null)
  const [items, setItems] = useState([])
  const [notas, setNotas] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sinAcceso, setSinAcceso] = useState(false)

  async function cargar() {
    setLoading(true)
    try {
      const data = await getSprintById(id)

      // Acceso: un colaborador solo ve sprints de sus prospectos asignados.
      if (!verTodo) {
        const ficha = user?.id ? await getMiFichaColaborador(user.id) : null
        const ok = sprintVisiblePara(data, {
          verTodo: false,
          prospectosAsignados: ficha?.prospectos_asignados || [],
        })
        if (!ok) {
          setSinAcceso(true)
          setSprint(null)
          setLoading(false)
          return
        }
      }
      setSinAcceso(false)

      setSprint(data)
      setItems(data.items || [])
      setNotas(data.notas_items || [])
      setError('')
      if (colaboradores.length === 0) {
        getColaboradoresLista().then(setColaboradores).catch((e) => console.error(e))
      }
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

  // Persiste un reordenamiento (viene de las flechitas ↑/↓ o del drag).
  async function persistirOrden(reordenado) {
    if (reordenado.map((i) => i.id).join() === items.map((i) => i.id).join()) return
    const cambios = renumerarOrden(reordenado)
    setItems(reordenado.map((it, idx) => ({ ...it, orden: idx })))
    try {
      await guardarOrdenItems(cambios)
    } catch (err) {
      console.error(err)
      alert('No se pudo reordenar.')
      cargar()
    }
  }

  async function mover(itemId, direccion) {
    await persistirOrden(moverItemEnLista(items, itemId, direccion))
  }

  async function onDragEnd(evento) {
    const { active, over } = evento
    if (!over || active.id === over.id) return
    await persistirOrden(moverItemAntesDe(items, active.id, over.id))
  }

  // ── Responsable + comentarios por punto ────────────────────
  function setResponsablePunto(itemId, colaboradorId) {
    persistirPunto(itemId, { responsable_id: colaboradorId || null })
  }

  async function agregarComentarioPunto(itemId, texto) {
    const limpio = (texto || '').trim()
    if (!limpio || !user?.id) return null
    try {
      const creado = await crearComentarioItem({ item_id: itemId, creado_por: user.id, texto: limpio })
      setItems((prev) => prev.map((it) => (
        it.id === itemId ? { ...it, comentarios: [...(it.comentarios || []), creado] } : it
      )))
      return creado
    } catch (err) {
      console.error(err)
      alert('No se pudo agregar el comentario.')
      return null
    }
  }

  async function borrarComentarioPunto(itemId, comentarioId) {
    const previo = items
    setItems((prev) => prev.map((it) => (
      it.id === itemId ? { ...it, comentarios: (it.comentarios || []).filter((c) => c.id !== comentarioId) } : it
    )))
    try {
      await eliminarComentarioItem(comentarioId)
    } catch (err) {
      console.error(err)
      alert('No se pudo eliminar el comentario.')
      setItems(previo)
    }
  }

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

  if (sinAcceso) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <div className="alert alert-error">
          No tenés acceso a este sprint. Pertenece a un prospecto que no tenés asignado.
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/sprints')} style={{ marginTop: 16 }}>
          <ArrowLeft size={18} /> Ir a Sprints
        </button>
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
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {items.map((it, idx) => (
                  <SortablePuntoRow
                    key={it.id}
                    item={it}
                    editable={editable}
                    primero={idx === 0}
                    ultimo={idx === items.length - 1}
                    userId={user?.id}
                    colaboradores={colaboradores}
                    onPatch={(campos) => actualizarPuntoLocal(it.id, campos)}
                    onPersist={(campos) => persistirPunto(it.id, campos)}
                    onMover={(dir) => mover(it.id, dir)}
                    onBorrar={() => borrarPunto(it.id)}
                    onAdjuntosChange={(adjuntos) => actualizarPuntoLocal(it.id, { adjuntos })}
                    onResponsable={(colId) => setResponsablePunto(it.id, colId)}
                    onComentar={(texto) => agregarComentarioPunto(it.id, texto)}
                    onBorrarComentario={(cId) => borrarComentarioPunto(it.id, cId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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

const LINEA_PX = 20                    // ~fontSize 14 * line-height 1.4
const MAX_COLAPSADO = LINEA_PX * 3

// Renderiza el texto ya con formato: **negrita** y viñetas con sangría.
function TextoFormateado({ value, tachado }) {
  const lineas = parsearItemFormato(value || '')
  return (
    <div style={{
      fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      color: tachado ? 'var(--color-text-muted)' : 'inherit',
      textDecoration: tachado ? 'line-through' : 'none',
    }}>
      {lineas.map((ln, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, paddingLeft: ln.sangria * 16 }}>
          {ln.vineta && <span style={{ flexShrink: 0 }}>•</span>}
          <span>
            {ln.partes.length === 0 ? ' ' : ln.partes.map((p, j) => (
              p.negrita ? <strong key={j}>{p.texto}</strong> : <span key={j}>{p.texto}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

// Texto de un punto. En reposo: se ve con formato, máx. 3 líneas y una
// flechita para expandir. Al tocarlo (si es editable): se abre un
// <textarea>. **x** = negrita, "- " = viñeta, botón • mete viñeta,
// Ctrl/⇧+Enter = renglón nuevo, Enter solo = confirma.
function TextoPunto({ value, editable, tachado, onPatch, onPersist }) {
  const taRef = useRef(null)
  const contRef = useRef(null)
  const [editando, setEditando] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [desborda, setDesborda] = useState(false)
  const cursorPendiente = useRef(null)

  const medir = useCallback(() => {
    const el = editando ? taRef.current : contRef.current
    if (!el) return
    if (editando) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    } else {
      setDesborda(el.scrollHeight > MAX_COLAPSADO + 2)
    }
  }, [editando])

  useEffect(() => { medir() }, [value, editando, medir])

  useEffect(() => {
    if (editando && cursorPendiente.current != null && taRef.current) {
      taRef.current.selectionStart = taRef.current.selectionEnd = cursorPendiente.current
      cursorPendiente.current = null
    }
  }, [editando, value])

  function cambiar(e) {
    onPatch({ titulo: autoformatearVineta(e.target.value) })
  }
  function teclado(e) {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
      return
    }
    if (e.key === 'Enter') { // Ctrl/Cmd/Shift + Enter
      e.preventDefault()
      const el = e.currentTarget
      const r = insertarSalto(el.value, el.selectionStart, el.selectionEnd)
      cursorPendiente.current = r.cursor
      onPatch({ titulo: r.texto })
    }
  }
  function meterVineta() {
    const el = taRef.current
    if (!el) return
    const r = insertarVinetaEnLinea(el.value, el.selectionStart, el.selectionEnd)
    cursorPendiente.current = r.cursor
    onPatch({ titulo: r.texto })
    el.focus()
  }

  if (!editable) {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          ref={contRef}
          style={{ overflow: 'hidden', maxHeight: expandido ? 'none' : MAX_COLAPSADO }}
        >
          <TextoFormateado value={value} tachado={tachado} />
        </div>
        {desborda && (
          <button type="button" onClick={() => setExpandido((v) => !v)}
            style={{ ...iconBtnStyle(), width: 'auto', height: 18, fontSize: 12, gap: 4 }}>
            {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expandido ? 'Menos' : 'Ver todo'}
          </button>
        )}
      </div>
    )
  }

  if (!editando) {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          ref={contRef}
          onClick={() => setEditando(true)}
          style={{ overflow: 'hidden', maxHeight: expandido ? 'none' : MAX_COLAPSADO, cursor: 'text', padding: '4px 0' }}
        >
          {value ? <TextoFormateado value={value} tachado={tachado} />
            : <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>—</span>}
        </div>
        {desborda && (
          <button type="button" onClick={() => setExpandido((v) => !v)}
            style={{ ...iconBtnStyle(), width: 'auto', height: 18, fontSize: 12, gap: 4 }}>
            {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expandido ? 'Menos' : 'Ver todo'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
      <textarea
        ref={taRef}
        autoFocus
        rows={1}
        value={value || ''}
        onChange={cambiar}
        onBlur={(e) => { onPersist({ titulo: e.target.value }); setEditando(false); setExpandido(false) }}
        onKeyDown={teclado}
        style={{
          flex: 1, minWidth: 0, resize: 'none', overflow: 'hidden',
          border: 'none', background: 'transparent', fontSize: 14, lineHeight: 1.4,
          fontFamily: 'inherit', padding: '4px 0',
        }}
      />
      <button type="button" title="Viñeta" onMouseDown={(e) => e.preventDefault()} onClick={meterVineta}
        style={{ ...iconBtnStyle(), width: 22, height: 22, marginTop: 2 }}>
        <List size={14} />
      </button>
    </div>
  )
}

// Envuelve la fila con el sortable de dnd-kit y le pasa el "handle" de
// arrastre (solo el ⠿; el resto de la fila no arrastra para no pelear con
// editar texto / tocar botones).
function SortablePuntoRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.item.id, disabled: !props.editable })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? 'var(--color-surface2)' : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <PuntoRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

function PuntoRow({
  item, editable, primero, ultimo, userId, colaboradores, dragHandleProps,
  onPatch, onPersist, onMover, onBorrar, onAdjuntosChange,
  onResponsable, onComentar, onBorrarComentario,
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [pidiendoLink, setPidiendoLink] = useState(false)
  const [mostrarComentarios, setMostrarComentarios] = useState(false)
  const fileRef = useRef(null)
  const linkRef = useRef(null)
  const meta = ESTADOS_ITEM[item.estado] || ESTADOS_ITEM.pendiente
  const adjuntos = item.adjuntos || []
  const comentarios = item.comentarios || []

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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginTop: 4 }}>
            <span
              {...dragHandleProps}
              title="Arrastrar para reordenar"
              style={{ ...iconBtnStyle(), width: 16, height: 16, cursor: 'grab', touchAction: 'none' }}
            >
              <GripVertical size={13} />
            </span>
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

        <TextoPunto
          value={item.titulo}
          editable={editable}
          tachado={item.estado === 'verde'}
          onPatch={onPatch}
          onPersist={onPersist}
        />

        <ResponsableChip
          responsableId={item.responsable_id}
          colaboradores={colaboradores}
          editable={editable}
          onChange={onResponsable}
        />

        <button
          style={{ ...iconBtnStyle(), marginTop: 2, width: 'auto', gap: 2, padding: '0 4px', color: comentarios.length ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
          title={comentarios.length ? `${comentarios.length} comentario(s)` : 'Comentarios'}
          onClick={() => setMostrarComentarios((v) => !v)}
        >
          <MessageSquare size={14} />
          {comentarios.length > 0 && <span style={{ fontSize: 11 }}>{comentarios.length}</span>}
        </button>

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

      {mostrarComentarios && (
        <ComentariosPanel
          comentarios={comentarios}
          userId={userId}
          editable={editable}
          onComentar={onComentar}
          onBorrar={onBorrarComentario}
        />
      )}

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

// ──────────────────────────────────────────────────────────────
// Responsable de un punto: chip con iniciales; al tocar, un menú para
// asignar/cambiar/quitar. Discreto — si no hay responsable es un
// ícono tenue.
// ──────────────────────────────────────────────────────────────
function iniciales(nombre = '', apellido = '') {
  return ((nombre.trim()[0] || '') + (apellido.trim()[0] || '')).toUpperCase() || '?'
}

function ResponsableChip({ responsableId, colaboradores, editable, onChange }) {
  const [abierto, setAbierto] = useState(false)
  const rootRef = useRef(null)
  const col = colaboradores.find((c) => c.id === responsableId)

  useEffect(() => {
    if (!abierto) return
    function fuera(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const chip = col ? (
    <span
      title={`Responsable: ${col.nombre} ${col.apellido}`}
      style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: 'var(--color-primary)', color: '#fff',
        fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {iniciales(col.nombre, col.apellido)}
    </span>
  ) : (
    <span style={{ ...iconBtnStyle(), width: 22, height: 22, opacity: 0.5 }} title="Sin responsable">
      <UserPlus size={13} />
    </span>
  )

  if (!editable) return <span style={{ marginTop: 3, flexShrink: 0 }}>{chip}</span>

  return (
    <div ref={rootRef} style={{ position: 'relative', marginTop: 3, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex' }}
      >
        {chip}
      </button>
      {abierto && (
        <div
          style={{
            position: 'absolute', top: 26, right: 0, zIndex: 20, minWidth: 200, maxHeight: 260, overflowY: 'auto',
            background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 8,
            boxShadow: '0 10px 28px rgba(0,0,0,0.25)', padding: 4,
          }}
        >
          <button
            type="button"
            onClick={() => { onChange(null); setAbierto(false) }}
            style={{ width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)' }}
          >
            Sin responsable
          </button>
          {colaboradores.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setAbierto(false) }}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', cursor: 'pointer', fontSize: 13,
                background: c.id === responsableId ? 'var(--color-surface2)' : 'transparent',
                borderRadius: 6,
              }}
            >
              {c.nombre} {c.apellido}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Hilo de comentarios de un punto: lista con autor + fecha + alta
// rápida. Se muestra debajo de la fila cuando se toca el 💬.
// ──────────────────────────────────────────────────────────────
function ComentariosPanel({ comentarios, userId, editable, onComentar, onBorrar }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    const limpio = texto.trim()
    if (!limpio || enviando) return
    setEnviando(true)
    const ok = await onComentar(limpio)
    setEnviando(false)
    if (ok) setTexto('')
  }

  return (
    <div style={{ padding: '4px 2px 10px 42px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {comentarios.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>Sin comentarios.</p>
      ) : (
        comentarios.map((c) => (
          <div key={c.id} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>
                {c.autor ? `${c.autor.nombre} ${c.autor.apellido}` : 'Usuario'}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, marginLeft: 6 }}>
                {c.fecha ? new Date(c.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
              </span>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.texto}</div>
            </div>
            {editable && userId === c.creado_por && (
              <button title="Borrar" onClick={() => onBorrar(c.id)} style={{ ...iconBtnStyle(true), width: 18, height: 18 }}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))
      )}
      {editable && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={texto}
            placeholder="Escribí un comentario…"
            disabled={enviando}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar() } }}
            style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 6 }}
          />
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={enviando || !texto.trim()} onClick={enviar}>
            {enviando ? '…' : 'Enviar'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Settings, ArrowLeft, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, suscribirseANotificaciones,
  actualizarPreferenciasNotificacion,
} from '../services/notificaciones'
import { linkDeNotificacion, URGENCIA_POR_TIPO, ETIQUETA_POR_TIPO, filtrarPorPreferencias } from '../services/notificaciones-utils'

const COLOR_URGENCIA = {
  alta: 'var(--color-danger)',
  media: 'var(--color-orange)',
  baja: 'var(--color-text-subtle)',
}

function ItemNotificacion({ n, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px',
        border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
        background: n.leido_en ? 'transparent' : 'var(--color-primary-light)',
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0,
        background: COLOR_URGENCIA[URGENCIA_POR_TIPO[n.tipo]] || 'var(--color-text-subtle)',
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: n.leido_en ? 400 : 600, color: 'var(--color-text)' }}>{n.titulo}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', marginTop: 2 }}>
          {n.creado_en ? new Date(n.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
        </div>
      </div>
    </button>
  )
}

// Campana de notificaciones internas (Fase 2 del plan). Vive en el pie
// del sidebar, junto al perfil. Lee apsol_notificaciones del usuario
// logueado y se suscribe en vivo a las nuevas (Realtime de Supabase).
export default function NotificacionesBell({ collapsed }) {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const [notificaciones, setNotificaciones] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [mostrarPrefs, setMostrarPrefs] = useState(false)
  const [mostrarCartel, setMostrarCartel] = useState(false)
  const [desactivados, setDesactivados] = useState(perfil?.notif_tipos_desactivados || [])
  const wrapRef = useRef(null)
  const yaMostroCartel = useRef(false)
  const abiertoRef = useRef(false)

  useEffect(() => {
    setDesactivados(perfil?.notif_tipos_desactivados || [])
  }, [perfil?.notif_tipos_desactivados])

  useEffect(() => {
    abiertoRef.current = abierto
  }, [abierto])

  async function cargar() {
    if (!user?.id) return
    try {
      const data = await getNotificaciones(user.id)
      setNotificaciones(data)
      // Cartel emergente: solo al cargar la página (una vez por carga), no
      // cada vez que llega algo nuevo por Realtime, y no si el usuario ya
      // abrió el panel manualmente mientras esto todavía cargaba.
      if (!yaMostroCartel.current) {
        yaMostroCartel.current = true
        const pendientes = filtrarPorPreferencias(data, perfil?.notif_tipos_desactivados).filter((n) => !n.leido_en)
        if (pendientes.length > 0 && !abiertoRef.current) setMostrarCartel(true)
      }
    } catch (err) {
      console.error('Error al cargar notificaciones:', err)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [user?.id])

  useEffect(() => {
    if (!user?.id) return undefined
    return suscribirseANotificaciones(user.id, (nueva) => {
      setNotificaciones((prev) => [nueva, ...prev])
    })
  }, [user?.id])

  useEffect(() => {
    if (!abierto) return undefined
    function onClickFuera(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [abierto])

  const visibles = filtrarPorPreferencias(notificaciones, desactivados)
  const noLeidas = visibles.filter((n) => !n.leido_en)

  async function togglePreferencia(tipo) {
    const previo = desactivados
    const nuevos = desactivados.includes(tipo) ? desactivados.filter((t) => t !== tipo) : [...desactivados, tipo]
    setDesactivados(nuevos)
    try {
      await actualizarPreferenciasNotificacion(user.id, nuevos)
    } catch (err) {
      console.error('No se pudo guardar la preferencia:', err)
      setDesactivados(previo)
    }
  }

  async function abrirNotificacion(n) {
    setAbierto(false)
    setMostrarCartel(false)
    navigate(linkDeNotificacion(n))
    if (n.leido_en) return
    setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leido_en: new Date().toISOString() } : x)))
    try {
      await marcarNotificacionLeida(n.id)
    } catch (err) {
      console.error('No se pudo marcar como leída:', err)
    }
  }

  async function marcarTodas(e) {
    e.stopPropagation()
    const previo = notificaciones
    setNotificaciones((prev) => prev.map((n) => (n.leido_en ? n : { ...n, leido_en: new Date().toISOString() })))
    try {
      await marcarTodasLeidas(user.id)
    } catch (err) {
      console.error('No se pudo marcar todo como leído:', err)
      setNotificaciones(previo)
    }
  }

  if (!user?.id) return null

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setAbierto((v) => !v); setMostrarCartel(false) }}
        style={{
          background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '12px',
          width: '100%', padding: '10px 12px', cursor: 'pointer', color: 'var(--color-text-subtle)', position: 'relative',
        }}
      >
        <span style={{ position: 'relative' }}>
          <Bell size={16} />
          {noLeidas.length > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -7, minWidth: 14, height: 14, borderRadius: 7,
              background: 'var(--color-danger)', color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            }}>
              {noLeidas.length > 9 ? '9+' : noLeidas.length}
            </span>
          )}
        </span>
        {!collapsed && <span>Notificaciones</span>}
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', bottom: '100%', left: collapsed ? '100%' : 8, marginBottom: 6,
          width: 320, maxHeight: 420, overflowY: 'auto',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 200,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)',
          }}>
            {mostrarPrefs ? (
              <button
                onClick={() => setMostrarPrefs(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', padding: 0 }}
              >
                <ArrowLeft size={14} /> Qué notificar
              </button>
            ) : (
              <strong style={{ fontSize: 13 }}>Notificaciones</strong>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!mostrarPrefs && noLeidas.length > 0 && (
                <button
                  onClick={marcarTodas}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600,
                    color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  <Check size={12} /> Marcar todas leídas
                </button>
              )}
              {!mostrarPrefs && (
                <button
                  onClick={() => setMostrarPrefs(true)}
                  title="Qué notificar"
                  style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: 0 }}
                >
                  <Settings size={14} />
                </button>
              )}
            </div>
          </div>

          {mostrarPrefs ? (
            <div style={{ padding: '6px 14px' }}>
              <p style={{ fontSize: 11.5, color: 'var(--color-text-subtle)', margin: '8px 0 10px' }}>
                Desmarcá lo que no te interesa que te avise.
              </p>
              {Object.keys(URGENCIA_POR_TIPO).map((tipo) => (
                <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '7px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!desactivados.includes(tipo)}
                    onChange={() => togglePreferencia(tipo)}
                    style={{ width: 'auto' }}
                  />
                  {ETIQUETA_POR_TIPO[tipo] || tipo}
                </label>
              ))}
            </div>
          ) : visibles.length === 0 ? (
            <p style={{ padding: '20px 14px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              No hay notificaciones.
            </p>
          ) : (
            visibles.map((n) => <ItemNotificacion key={n.id} n={n} onClick={() => abrirNotificacion(n)} />)
          )}
        </div>
      )}

      {mostrarCartel && createPortal(
        <div className="modal-overlay" onClick={() => setMostrarCartel(false)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} /> Notificaciones nuevas
              </h3>
              <button className="btn-close" aria-label="Cerrar" onClick={() => setMostrarCartel(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 0, maxHeight: '55vh', overflowY: 'auto' }}>
              {noLeidas.map((n) => <ItemNotificacion key={n.id} n={n} onClick={() => abrirNotificacion(n)} />)}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setMostrarCartel(false)}>Cerrar</button>
              <button className="btn btn-primary" onClick={(e) => { marcarTodas(e); setMostrarCartel(false) }}>
                Marcar todas leídas
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

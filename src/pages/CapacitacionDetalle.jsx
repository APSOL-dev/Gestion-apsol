import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Video, MessageSquare, Plus, FileText, Send, Eye, ExternalLink } from 'lucide-react'
import {
  getCapacitacionById, saveCapacitacion, deleteCapacitacion,
  saveVideo, deleteVideo, saveComentario, deleteComentario,
  getUsuarios, marcarVideoVisto, getVideoPlaybackInfo, buildDriveProxyUrl, nombreUsuario
} from '../services/capacitacion'
import { useAuth } from '../context/AuthContext'
import { supabase, supabaseUrl } from '../lib/supabase'
import CapacitacionChat from '../components/CapacitacionChat'

export default function CapacitacionDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth() // Para los comentarios
  const esNuevo = id === 'nueva'

  const [capacitacion, setCapacitacion] = useState({
    titulo: '',
    descripcion: '',
    clasificacion: 'SGI - Calidad',
    fecha_creacion: new Date().toISOString().split('T')[0],
  })

  const [videos, setVideos] = useState([])
  const [comentarios, setComentarios] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [accessToken, setAccessToken] = useState(null)

  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Formularios modales/inline
  const [mostrandoFormVideo, setMostrandoFormVideo] = useState(false)
  const [nuevoVideo, setNuevoVideo] = useState({ titulo: '', link_video: '', destinatarios: [] })

  const [nuevoComentarioText, setNuevoComentarioText] = useState('')

  useEffect(() => {
    if (!esNuevo) cargarCapacitacion()
    cargarUsuarios()
    supabase.auth.getSession().then(({ data }) => setAccessToken(data?.session?.access_token || null))
  }, [id])

  async function cargarUsuarios() {
    try {
      const data = await getUsuarios()
      setUsuarios(data)
    } catch (err) {
      console.error('Error al cargar usuarios:', err)
    }
  }

  async function cargarCapacitacion() {
    setLoading(true)
    try {
      const data = await getCapacitacionById(id)
      setCapacitacion({
        ...data,
        fecha_creacion: data.fecha_creacion ? data.fecha_creacion.split('T')[0] : ''
      })
      setVideos(data.videos || [])
      setComentarios(data.comentarios || [])
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos de capacitación.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const dataToSave = { ...capacitacion }
      if (!dataToSave.fecha_creacion) dataToSave.fecha_creacion = null

      const saved = await saveCapacitacion(dataToSave)
      if (esNuevo) {
        navigate(`/capacitacion/${saved.id}`, { replace: true })
      }
    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Estás seguro de eliminar esta capacitación? Se perderán todos sus videos y comentarios.')) return
    try {
      await deleteCapacitacion(id)
      navigate('/capacitacion')
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  // VIDEOS
  function toggleDestinatario(usuarioId) {
    setNuevoVideo(v => {
      const yaEsta = v.destinatarios.includes(usuarioId)
      return {
        ...v,
        destinatarios: yaEsta ? v.destinatarios.filter(id => id !== usuarioId) : [...v.destinatarios, usuarioId]
      }
    })
  }

  async function handleAddVideo(e) {
    e.preventDefault()
    if (!nuevoVideo.titulo || !nuevoVideo.link_video) return
    try {
      const saved = await saveVideo({
        capacitacion_id: id,
        resumen: nuevoVideo.titulo,
        link: nuevoVideo.link_video,
        es_link_externo: true,
        destinatarios: nuevoVideo.destinatarios,
        visto_por: [],
        autor: user?.email || null,
        fecha_subida: new Date().toISOString().split('T')[0],
      })
      setVideos([...videos, saved])
      setNuevoVideo({ titulo: '', link_video: '', destinatarios: [] })
      setMostrandoFormVideo(false)
    } catch (err) {
      console.error(err)
      alert('Error al guardar video')
    }
  }
  async function handleDeleteVideo(videoId) {
    if (!window.confirm('¿Eliminar este video?')) return
    try {
      await deleteVideo(videoId)
      setVideos(videos.filter(v => v.id !== videoId))
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  async function handleMarcarVisto(video) {
    if (!user) return
    try {
      const actualizado = await marcarVideoVisto(video, user.id)
      setVideos(videos.map(v => v.id === video.id ? actualizado : v))
    } catch (err) {
      console.error(err)
    }
  }

  // COMENTARIOS
  async function handleAddComentario(e) {
    e.preventDefault()
    if (!nuevoComentarioText.trim() || !user) return
    try {
      const saved = await saveComentario({
        capacitacion_id: id,
        creado_por: user.id,
        comentario: nuevoComentarioText.trim()
      })
      setComentarios([saved, ...comentarios])
      setNuevoComentarioText('')
    } catch (err) {
      console.error(err)
      alert('Error al enviar comentario')
    }
  }
  async function handleDeleteComentario(comId) {
    if (!window.confirm('¿Eliminar comentario?')) return
    try {
      await deleteComentario(comId)
      setComentarios(comentarios.filter(c => c.id !== comId))
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  function renderVideoPlayer(v) {
    const info = getVideoPlaybackInfo(v)
    switch (info.kind) {
      case 'youtube':
      case 'drive-embed':
        return (
          <iframe
            width="100%"
            height="100%"
            src={info.embedUrl}
            title={v.resumen || 'Video'}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        )
      case 'mp4':
        return (
          <video width="100%" height="100%" controls>
            <source src={info.url} type="video/mp4" />
            Tu navegador no soporta el tag de video.
          </video>
        )
      case 'drive-proxy':
        if (!accessToken) {
          return <div style={{ color: '#fff', padding: '20px', textAlign: 'center' }}>Iniciá sesión para ver este video.</div>
        }
        return (
          <video width="100%" height="100%" controls>
            <source src={buildDriveProxyUrl(supabaseUrl, v.id, accessToken)} type="video/mp4" />
            Tu navegador no soporta el tag de video.
          </video>
        )
      case 'external-link':
        return (
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '100%', color: '#fff', textDecoration: 'none' }}
          >
            <ExternalLink size={18} /> Abrir video en pestaña nueva
          </a>
        )
      default:
        return (
          <div style={{ color: 'var(--color-text-muted)', padding: '20px', textAlign: 'center' }}>
            Video pendiente de carga
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando capacitación...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '1000px' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/capacitacion')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{esNuevo ? 'Nueva Capacitación' : capacitacion.titulo}</h1>
            <p className="page-subtitle">{esNuevo ? 'Configura un nuevo módulo' : capacitacion.clasificacion}</p>
          </div>
        </div>
        {!esNuevo && (
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={18} />
            Eliminar
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

        {/* SECCIÓN DATOS */}
        <div className="card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} className="text-primary" />
            Información del Módulo
          </h3>
          <form id="capForm" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Título *</label>
              <input type="text" required value={capacitacion.titulo} onChange={e => setCapacitacion({...capacitacion, titulo: e.target.value})} />
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Descripción / Objetivos</label>
              <textarea rows="3" value={capacitacion.descripcion || ''} onChange={e => setCapacitacion({...capacitacion, descripcion: e.target.value})} />
            </div>

            <div className="field">
              <label>Clasificación</label>
              <select value={capacitacion.clasificacion} onChange={e => setCapacitacion({...capacitacion, clasificacion: e.target.value})}>
                <option value="SGI - Calidad">SGI - Calidad</option>
                <option value="SGI - Seguridad">SGI - Seguridad e Higiene</option>
                <option value="Técnico Operativo">Técnico Operativo</option>
                <option value="Comercial / Ventas">Comercial / Ventas</option>
                <option value="Administrativo">Administrativo / RRHH</option>
                <option value="Onboarding">Onboarding Nuevo Ingreso</option>
                <option value="Antigravity">Antigravity</option>
                <option value="N8N">N8N</option>
                <option value="Gestión Interna">Gestión Interna</option>
              </select>
            </div>

            <div className="field">
              <label>Fecha de Creación</label>
              <input type="date" value={capacitacion.fecha_creacion} onChange={e => setCapacitacion({...capacitacion, fecha_creacion: e.target.value})} />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={18} />
                {saving ? 'Guardando...' : 'Guardar Información'}
              </button>
            </div>
          </form>
        </div>

        {!esNuevo && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>

            {/* COLUMNA VIDEOS */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Video size={20} className="text-primary" />
                  Videos y Material
                </h3>
                <button className="btn btn-secondary" onClick={() => setMostrandoFormVideo(!mostrandoFormVideo)}>
                  <Plus size={16} /> Agregar Video
                </button>
              </div>

              {mostrandoFormVideo && (
                <form onSubmit={handleAddVideo} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px', padding: '16px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="field">
                    <label>Título / Resumen del Video *</label>
                    <input type="text" required value={nuevoVideo.titulo} onChange={e => setNuevoVideo({...nuevoVideo, titulo: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>URL (YouTube, Drive o Link Directo) *</label>
                    <input type="url" required value={nuevoVideo.link_video} onChange={e => setNuevoVideo({...nuevoVideo, link_video: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>¿Quién puede ver este video?</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                      {usuarios.map(u => (
                        <label key={u.id} className="badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: nuevoVideo.destinatarios.includes(u.id) ? 'var(--color-primary)' : 'var(--color-surface)', color: nuevoVideo.destinatarios.includes(u.id) ? '#fff' : 'inherit', border: '1px solid var(--color-border)' }}>
                          <input
                            type="checkbox"
                            checked={nuevoVideo.destinatarios.includes(u.id)}
                            onChange={() => toggleDestinatario(u.id)}
                            style={{ margin: 0 }}
                          />
                          {u.nombre} {u.apellido || ''}
                        </label>
                      ))}
                    </div>
                    {nuevoVideo.destinatarios.length === 0 && (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                        Sin nadie seleccionado, solo el Admin va a poder ver este video.
                      </p>
                    )}
                  </div>
                  <div>
                    <button type="submit" className="btn btn-primary">Guardar Video</button>
                  </div>
                </form>
              )}

              {videos.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', padding: '20px', textAlign: 'center' }}>
                  No hay videos subidos. Agrega el primer video para comenzar el curso.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {videos.map((v) => {
                    const yaVisto = user && (v.visto_por || []).includes(user.id)
                    return (
                      <div key={v.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)' }}>
                          <h4 style={{ margin: 0, fontSize: '15px' }}>{v.resumen || 'Video'}</h4>
                          <button className="btn btn-secondary" style={{ padding: '4px', color: 'var(--color-danger)', borderColor: 'transparent', background: 'transparent' }} onClick={() => handleDeleteVideo(v.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ background: '#000', width: '100%', aspectRatio: '16 / 9' }}>
                          {renderVideoPlayer(v)}
                        </div>
                        <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--color-text-muted)', flexWrap: 'wrap', gap: '8px' }}>
                          <span>
                            Visto por: {(v.visto_por || []).length === 0 ? 'nadie todavía' : (v.visto_por || []).map(uid => nombreUsuario(usuarios, uid)).join(', ')}
                          </span>
                          {!yaVisto && user && (
                            <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => handleMarcarVisto(v)}>
                              <Eye size={14} /> Marcar como visto
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* COLUMNA COMENTARIOS */}
            <div className="card" style={{ background: 'var(--color-surface2)' }}>
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={20} className="text-primary" />
                Foro / Dudas
              </h3>

              <form onSubmit={handleAddComentario} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <textarea
                  rows="3"
                  placeholder="Escribe un comentario o duda sobre la capacitación..."
                  value={nuevoComentarioText}
                  onChange={e => setNuevoComentarioText(e.target.value)}
                  style={{ width: '100%', resize: 'none' }}
                />
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
                  <Send size={16} /> Enviar
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {comentarios.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center' }}>No hay comentarios aún.</p>
                ) : (
                  comentarios.map(c => (
                    <div key={c.id} style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>
                          {c.usuarios ? `${c.usuarios.nombre} ${c.usuarios.apellido}` : 'Usuario'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {new Date(c.fecha).toLocaleDateString('es-AR')}
                          </span>
                          {(user?.id === c.creado_por) && (
                            <Trash2 size={14} style={{ cursor: 'pointer', color: 'var(--color-danger)' }} onClick={() => handleDeleteComentario(c.id)}/>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '14px', lineHeight: '1.4', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {c.comentario}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      <CapacitacionChat />
    </div>
  )
}

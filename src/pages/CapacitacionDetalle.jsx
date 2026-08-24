import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Video, MessageSquare, Plus, FileText, Send } from 'lucide-react'
import { 
  getCapacitacionById, saveCapacitacion, deleteCapacitacion, 
  saveVideo, deleteVideo, saveComentario, deleteComentario 
} from '../services/capacitacion'
import { useAuth } from '../context/AuthContext'

export default function CapacitacionDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth() // Para los comentarios
  const esNuevo = id === 'nueva'

  const [capacitacion, setCapacitacion] = useState({
    titulo: '',
    descripcion: '',
    clasificacion: 'SGI - Calidad',
    fecha_publicacion: new Date().toISOString().split('T')[0],
    destinatarios: 'Todos',
  })
  
  const [videos, setVideos] = useState([])
  const [comentarios, setComentarios] = useState([])
  
  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Formularios modales/inline
  const [mostrandoFormVideo, setMostrandoFormVideo] = useState(false)
  const [nuevoVideo, setNuevoVideo] = useState({ titulo: '', link_video: '', orden: 1 })
  
  const [nuevoComentarioText, setNuevoComentarioText] = useState('')

  useEffect(() => {
    if (!esNuevo) cargarCapacitacion()
  }, [id])

  async function cargarCapacitacion() {
    setLoading(true)
    try {
      const data = await getCapacitacionById(id)
      setCapacitacion({
        ...data,
        fecha_publicacion: data.fecha_publicacion ? data.fecha_publicacion.split('T')[0] : ''
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
      if (!dataToSave.fecha_publicacion) dataToSave.fecha_publicacion = null

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
  async function handleAddVideo(e) {
    e.preventDefault()
    if (!nuevoVideo.titulo || !nuevoVideo.link_video) return
    try {
      const saved = await saveVideo({ ...nuevoVideo, capacitacion_id: id })
      setVideos([...videos, saved].sort((a,b) => a.orden - b.orden))
      setNuevoVideo({ titulo: '', link_video: '', orden: videos.length + 2 })
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

  // COMENTARIOS
  async function handleAddComentario(e) {
    e.preventDefault()
    if (!nuevoComentarioText.trim() || !user) return
    try {
      const saved = await saveComentario({ 
        capacitacion_id: id,
        usuario_id: user.id,
        texto: nuevoComentarioText.trim()
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

  // Utilidad para extraer el ID de un video de YouTube para el embed (Simplificado)
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    let videoId = '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url; // Si no es youtube, asume que es una URL de MP4 directa (Supabase Storage, etc)
  };

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
              </select>
            </div>

            <div className="field">
              <label>Destinatarios</label>
              <input type="text" placeholder="Ej. Todos, Técnicos, Ventas..." value={capacitacion.destinatarios || ''} onChange={e => setCapacitacion({...capacitacion, destinatarios: e.target.value})} />
            </div>

            <div className="field">
              <label>Fecha de Publicación</label>
              <input type="date" value={capacitacion.fecha_publicacion} onChange={e => setCapacitacion({...capacitacion, fecha_publicacion: e.target.value})} />
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
                    <label>Título del Video *</label>
                    <input type="text" required value={nuevoVideo.titulo} onChange={e => setNuevoVideo({...nuevoVideo, titulo: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>URL (YouTube o Link Directo MP4) *</label>
                    <input type="url" required value={nuevoVideo.link_video} onChange={e => setNuevoVideo({...nuevoVideo, link_video: e.target.value})} />
                  </div>
                  <div className="field" style={{ maxWidth: '150px' }}>
                    <label>Orden</label>
                    <input type="number" required value={nuevoVideo.orden} onChange={e => setNuevoVideo({...nuevoVideo, orden: e.target.value})} />
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
                    const embedUrl = getYouTubeEmbedUrl(v.link_video)
                    const isYoutube = embedUrl && embedUrl.includes('youtube')
                    
                    return (
                      <div key={v.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)' }}>
                          <h4 style={{ margin: 0, fontSize: '15px' }}>{v.orden}. {v.titulo}</h4>
                          <button className="btn btn-secondary" style={{ padding: '4px', color: 'var(--color-danger)', borderColor: 'transparent', background: 'transparent' }} onClick={() => handleDeleteVideo(v.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ background: '#000', width: '100%', aspectRatio: '16 / 9' }}>
                          {isYoutube ? (
                            <iframe 
                              width="100%" 
                              height="100%" 
                              src={embedUrl} 
                              title={v.titulo} 
                              frameBorder="0" 
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                              allowFullScreen
                            ></iframe>
                          ) : (
                            <video width="100%" height="100%" controls>
                              <source src={v.link_video} type="video/mp4" />
                              Tu navegador no soporta el tag de video.
                            </video>
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
                            {new Date(c.fecha_creacion).toLocaleDateString('es-AR')}
                          </span>
                          {(user?.id === c.usuario_id) && ( // Si soy el dueño del comentario
                            <Trash2 size={14} style={{ cursor: 'pointer', color: 'var(--color-danger)' }} onClick={() => handleDeleteComentario(c.id)}/>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '14px', lineHeight: '1.4', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {c.texto}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}

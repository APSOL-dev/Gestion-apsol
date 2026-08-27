import { supabase } from '../lib/supabase'

export async function getCapacitaciones() {
  const { data, error } = await supabase
    .from('apsol_capacitacion')
    .select('*')
    .order('fecha_creacion', { ascending: false })

  if (error) throw error
  return data
}

export async function getCapacitacionById(id) {
  const { data, error } = await supabase
    .from('apsol_capacitacion')
    .select(`
      *,
      videos:apsol_videos(*),
      comentarios:apsol_comentarios(*, usuarios:apsol_usuarios(nombre, apellido))
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  if (data?.videos) data.videos.sort((a, b) => new Date(a.fecha_subida || 0) - new Date(b.fecha_subida || 0))
  return data
}

export async function saveCapacitacion(cap) {
  if (cap.id) {
    const { data, error } = await supabase
      .from('apsol_capacitacion')
      .update(cap)
      .eq('id', cap.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_capacitacion')
      .insert([cap])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteCapacitacion(id) {
  const { error } = await supabase
    .from('apsol_capacitacion')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// USUARIOS (para el selector de destinatarios y resolver nombres de "visto por")
export async function getUsuarios() {
  const { data, error } = await supabase
    .from('apsol_usuarios')
    .select('id, nombre, apellido, cargo')
    .order('nombre')
  if (error) throw error
  return data || []
}

// VIDEOS
export async function saveVideo(video) {
  if (video.id) {
    const { data, error } = await supabase
      .from('apsol_videos')
      .update(video)
      .eq('id', video.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_videos')
      .insert([video])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteVideo(id) {
  const { error } = await supabase
    .from('apsol_videos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function marcarVideoVisto(video, userId) {
  const nuevoVistoPor = addVistoPor(video.visto_por, userId)
  if (nuevoVistoPor === video.visto_por) return video
  const { data, error } = await supabase
    .from('apsol_videos')
    .update({ visto_por: nuevoVistoPor })
    .eq('id', video.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// COMENTARIOS
export async function saveComentario(comentario) {
  const { data, error } = await supabase
    .from('apsol_comentarios')
    .insert([comentario])
    .select(`*, usuarios:apsol_usuarios(nombre, apellido)`)
    .single()
  if (error) throw error
  return data
}

export async function deleteComentario(id) {
  const { error } = await supabase
    .from('apsol_comentarios')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ========================
// LÓGICA PURA (testeable sin red / DOM)
// ========================

// Extrae el ID de un video de YouTube a partir de distintas variantes de URL.
export function extractYouTubeId(url) {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  if (match && match[2] && match[2].length === 11) return match[2]
  return null
}

// Extrae el ID de archivo de un link "compartir" de Google Drive
// (https://drive.google.com/file/d/<ID>/view...).
export function extractDriveFileIdFromLink(url) {
  if (!url) return null
  const match = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
  return match ? match[1] : null
}

/**
 * Clasifica cómo debe reproducirse un video según los datos que trae de la DB,
 * para que el componente no tenga que repetir esta lógica.
 *
 * - youtube: se embebe con un iframe de YouTube.
 * - drive-embed: link de "compartir" de Drive -> iframe de preview de Drive.
 * - mp4: URL directa a un archivo .mp4 -> tag <video>.
 * - drive-proxy: archivo subido a Drive por APSOL -> se sirve vía la Edge
 *   Function drive-video (requiere accessToken de la sesión).
 * - external-link: cualquier otro link (ej. OneDrive) -> se abre en pestaña
 *   aparte, no se puede embeber de forma confiable.
 * - pending: no hay ningún video cargado todavía.
 */
export function getVideoPlaybackInfo(video) {
  if (!video) return { kind: 'pending' }

  if (video.es_link_externo && video.link && video.link.trim()) {
    const link = video.link.trim()
    const youtubeId = extractYouTubeId(link)
    if (youtubeId) {
      return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeId}` }
    }
    const driveFileId = extractDriveFileIdFromLink(link)
    if (driveFileId) {
      return { kind: 'drive-embed', embedUrl: `https://drive.google.com/file/d/${driveFileId}/preview` }
    }
    if (/\.mp4(\?.*)?$/i.test(link)) {
      return { kind: 'mp4', url: link }
    }
    return { kind: 'external-link', url: link }
  }

  if (!video.es_link_externo && video.archivo_video) {
    return { kind: 'drive-proxy', fileId: video.archivo_video }
  }

  return { kind: 'pending' }
}

// Construye la URL de la Edge Function que hace de proxy hacia Drive.
export function buildDriveProxyUrl(supabaseUrl, videoId, accessToken) {
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/functions/v1/drive-video?id=${encodeURIComponent(videoId)}&access_token=${encodeURIComponent(accessToken)}`
}

// Agrega un usuario a la lista de "visto por" sin duplicarlo. Devuelve la
// misma referencia si no hay cambios, para poder detectar no-ops fácilmente.
export function addVistoPor(vistoPor, userId) {
  const arr = Array.isArray(vistoPor) ? vistoPor : []
  if (!userId || arr.includes(userId)) return arr
  return [...arr, userId]
}

// Nombre completo de un usuario a partir de su id, buscando en una lista de
// usuarios ya cargada (evita otro round-trip por cada avatar a mostrar).
export function nombreUsuario(usuarios, userId) {
  const u = (usuarios || []).find(u => u.id === userId)
  if (!u) return 'Usuario'
  return [u.nombre, u.apellido].filter(Boolean).join(' ') || 'Usuario'
}

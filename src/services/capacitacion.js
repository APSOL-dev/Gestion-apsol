import { supabase } from '../lib/supabase'

export async function getCapacitaciones() {
  const { data, error } = await supabase
    .from('apsol_capacitacion')
    .select('*')
    .order('fecha_publicacion', { ascending: false })

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

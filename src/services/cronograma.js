import { supabase } from '../lib/supabase'

export async function getActividades() {
  const { data, error } = await supabase
    .from('apsol_cronograma')
    .select('*')
    .order('inicio', { ascending: false })

  if (error) throw error
  return data
}

export async function getActividadById(id) {
  const { data, error } = await supabase
    .from('apsol_cronograma')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function saveActividad(actividad) {
  if (actividad.id) {
    // Edición (UPDATE)
    const { data, error } = await supabase
      .from('apsol_cronograma')
      .update(actividad)
      .eq('id', actividad.id)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Creación (INSERT)
    const { id, ...payload } = actividad
    const { data, error } = await supabase
      .from('apsol_cronograma')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

export async function deleteActividad(id) {
  const { error } = await supabase
    .from('apsol_cronograma')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

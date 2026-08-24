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
  const { data: { user } } = await supabase.auth.getUser()
  
  const payload = {
    ...actividad,
    modificado_por: user?.id,
    modificado_at: new Date().toISOString()
  }

  if (!actividad.id) {
    payload.creado_por = user?.id
  }

  const { data, error } = await supabase
    .from('apsol_cronograma')
    .upsert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteActividad(id) {
  const { error } = await supabase
    .from('apsol_cronograma')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

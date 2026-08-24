import { supabase } from '../lib/supabase'

export async function getEventosCronograma() {
  const { data, error } = await supabase
    .from('apsol_cronograma')
    .select(`
      *,
      prospectos:apsol_prospectos(empresas:apsol_empresas(nombre))
    `)
    .order('inicio', { ascending: true })

  if (error) throw error
  return data
}

export async function saveEvento(evento) {
  if (evento.id) {
    const { data, error } = await supabase
      .from('apsol_cronograma')
      .update(evento)
      .eq('id', evento.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_cronograma')
      .insert([evento])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteEvento(id) {
  const { error } = await supabase
    .from('apsol_cronograma')
    .delete()
    .eq('id', id)
  if (error) throw error
}

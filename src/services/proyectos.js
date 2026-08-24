import { supabase } from '../lib/supabase'

export async function getProyectos() {
  const { data, error } = await supabase
    .from('apsol_proyectos')
    .select(`
      *,
      prospectos:apsol_prospectos(nombre, empresas:apsol_empresas(nombre)),
      colaboradores:apsol_colaboradores(nombre, apellido)
    `)
    .order('fecha_inicio', { ascending: false })

  if (error) throw error
  return data
}

export async function getProyectoById(id) {
  const { data, error } = await supabase
    .from('apsol_proyectos')
    .select(`
      *,
      prospectos:apsol_prospectos(id, nombre, empresas:apsol_empresas(nombre)),
      colaboradores:apsol_colaboradores(id, nombre, apellido),
      tickets:apsol_tickets(*, colaboradores:apsol_colaboradores(nombre, apellido)),
      preventivos:apsol_preventivos(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function saveProyecto(proyecto) {
  if (proyecto.id) {
    const { data, error } = await supabase
      .from('apsol_proyectos')
      .update(proyecto)
      .eq('id', proyecto.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_proyectos')
      .insert([proyecto])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteProyecto(id) {
  const { error } = await supabase
    .from('apsol_proyectos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

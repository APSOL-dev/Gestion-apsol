import { supabase } from '../lib/supabase'

export async function getEmpresas() {
  const { data, error } = await supabase
    .from('apsol_empresas')
    .select(`
      *,
      prospectos:apsol_prospectos(*)
    `)
    .order('nombre')

  if (error) throw error
  return data
}

export async function getEmpresaById(id) {
  const { data, error } = await supabase
    .from('apsol_empresas')
    .select(`
      *,
      razones_sociales:apsol_razones_sociales(*),
      contactos:apsol_contactos(*),
      prospectos:apsol_prospectos(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function saveEmpresa(empresa) {
  if (empresa.id) {
    const { data, error } = await supabase
      .from('apsol_empresas')
      .update(empresa)
      .eq('id', empresa.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_empresas')
      .insert([empresa])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteEmpresa(id) {
  // Llamamos a la función de la base de datos que borra todo en cascada con permisos de admin
  const { error } = await supabase.rpc('borrar_empresa_completa', {
    p_empresa_id: id
  })
  if (error) throw error
}

export async function saveRazonSocial(razon) {
  if (razon.id) {
    const { data, error } = await supabase
      .from('apsol_razones_sociales')
      .update(razon)
      .eq('id', razon.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_razones_sociales')
      .insert([razon])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteRazonSocial(id) {
  const { error } = await supabase
    .from('apsol_razones_sociales')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getRazonesSocialesByEmpresa(empresaId) {
  const { data, error } = await supabase
    .from('apsol_razones_sociales')
    .select('*')
    .eq('empresa_id', empresaId)
  
  if (error) throw error
  return data
}

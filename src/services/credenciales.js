import { supabase } from '../lib/supabase'

export async function getCredenciales() {
  const { data, error } = await supabase
    .from('apsol_credenciales')
    .select(`
      *,
      empresas:apsol_empresas(nombre)
    `)
    .order('sistema_plataforma', { ascending: true })

  if (error) throw error
  return data
}

export async function getCredencialById(id) {
  const { data, error } = await supabase
    .from('apsol_credenciales')
    .select(`
      *,
      empresas:apsol_empresas(id, nombre)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function saveCredencial(credencial) {
  if (credencial.id) {
    const { data, error } = await supabase
      .from('apsol_credenciales')
      .update(credencial)
      .eq('id', credencial.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_credenciales')
      .insert([credencial])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteCredencial(id) {
  const { error } = await supabase
    .from('apsol_credenciales')
    .delete()
    .eq('id', id)
  if (error) throw error
}

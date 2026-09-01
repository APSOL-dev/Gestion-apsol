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

// Payload para crear/actualizar una empresa a través de la vista
// public.apsol_empresas. La columna de tamaño en la base es `tamanio`
// (no `tamaño_personas`, que es como la nombra el form): mandar el nombre
// equivocado hace que PostgREST rechace todo el statement con
// "Could not find the 'tamaño_personas' column" -> "Error al crear la
// empresa". Este helper normaliza los nombres y descarta claves de más.
export function construirPayloadEmpresa(form = {}) {
  return {
    nombre: (form.nombre || '').trim(),
    pais: form.pais,
    provincia: form.provincia,
    industria: form.industria,
    tamanio: Number(form.tamanio ?? form.tamaño_personas) || 0,
    dias_espera_facturacion: Number(form.dias_espera_facturacion) || 4
  }
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

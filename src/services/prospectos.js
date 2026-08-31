import { supabase } from '../lib/supabase'

// El formulario ya no obliga a elegir un contacto único para el prospecto
// (se muestran todos los de la empresa como lista) - el estado del form
// arranca en '' para ese campo. La columna contacto_id sigue siendo UUID
// en la base, así que ese '' hay que convertirlo a null antes de guardar,
// o Postgres tira "invalid input syntax for type uuid".
export function normalizarContactoId(contactoId) {
  return contactoId || null
}

export async function uploadFile(file) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `prospectos/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('Bucket Publico')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('Bucket Publico')
    .getPublicUrl(filePath)
    
  return data.publicUrl
}

export async function getProspectos(opciones = { soloActivos: true }) {
  let query = supabase
    .from('apsol_prospectos')
    .select(`
      *,
      empresas:apsol_empresas(nombre),
      contactos:apsol_contactos(nombre, apellido)
    `)
    .order('fecha_creacion', { ascending: false })

  if (opciones.estadoExacto) {
    query = query.eq('estado', opciones.estadoExacto)
  } else if (opciones.soloActivos) {
    query = query.not('estado', 'in', '(Ganado,Perdido)')
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getProspectoById(id) {
  const { data, error } = await supabase
    .from('apsol_prospectos')
    .select(`
      *,
      empresas:apsol_empresas(id, nombre),
      contactos:apsol_contactos(id, nombre, apellido, email, telefono),
      observaciones:apsol_observaciones(*, usuarios:apsol_usuarios(nombre, apellido)),
      facturacion:apsol_facturacion(*),
      proyectos:apsol_proyectos(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function saveProspecto(prospecto) {
  if (prospecto.id) {
    const { id, ...dataToUpdate } = prospecto
    const { data, error } = await supabase
      .from('apsol_prospectos')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_prospectos')
      .insert([prospecto])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteProspecto(id) {
  const { error } = await supabase
    .from('apsol_prospectos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function saveObservacion(observacion) {
  const { data, error } = await supabase
    .from('apsol_observaciones')
    .insert([observacion])
    .select('*, usuarios:apsol_usuarios(nombre, apellido)')
    .single()
  if (error) throw error
  return data
}


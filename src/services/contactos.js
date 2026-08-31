import { supabase } from '../lib/supabase'

export async function getContactos() {
  const { data, error } = await supabase
    .from('apsol_contactos')
    .select(`
      *,
      empresas:apsol_empresas(nombre),
      prospectos:apsol_prospectos(count)
    `)
    .order('nombre')

  if (error) throw error
  return data
}

// Usado por ProspectoDrawer para mostrar "Contactos asociados" (todos los
// contactos de la empresa del prospecto). Filtra server-side en vez de
// reusar getContactos() + filtrar en el cliente, para no traer la tabla
// completa cada vez que se abre el panel lateral de un prospecto.
export async function getContactosPorEmpresa(empresaId) {
  if (!empresaId) return []

  const { data, error } = await supabase
    .from('apsol_contactos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre')

  if (error) throw error
  return data || []
}

export async function getContactoById(id) {
  const { data, error } = await supabase
    .from('apsol_contactos')
    .select(`
      *,
      empresas:apsol_empresas(id, nombre),
      prospectos:apsol_prospectos(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function saveContacto(contacto) {
  if (contacto.id) {
    const { data, error } = await supabase
      .from('apsol_contactos')
      .update(contacto)
      .eq('id', contacto.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_contactos')
      .insert([contacto])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function desactivarContacto(id) {
  const { data, error } = await supabase
    .from('apsol_contactos')
    .update({ activo: false })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function activarContacto(id) {
  const { data, error } = await supabase
    .from('apsol_contactos')
    .update({ activo: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

import { supabase } from '../lib/supabase'

// ========================
// TICKETS
// ========================
export async function getTickets() {
  const { data, error } = await supabase
    .from('apsol_tickets')
    .select(`
      *,
      proyectos:apsol_proyectos(nombre, prospectos:apsol_prospectos(empresas:apsol_empresas(nombre))),
      colaboradores:apsol_colaboradores(nombre, apellido)
    `)
    .order('fecha_creacion', { ascending: false })

  if (error) throw error
  return data
}

export async function getTicketById(id) {
  const { data, error } = await supabase
    .from('apsol_tickets')
    .select(`
      *,
      proyectos:apsol_proyectos(id, nombre, prospectos:apsol_prospectos(empresas:apsol_empresas(nombre))),
      colaboradores:apsol_colaboradores(id, nombre, apellido)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function saveTicket(ticket) {
  if (ticket.id) {
    const { data, error } = await supabase
      .from('apsol_tickets')
      .update(ticket)
      .eq('id', ticket.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_tickets')
      .insert([ticket])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteTicket(id) {
  const { error } = await supabase
    .from('apsol_tickets')
    .delete()
    .eq('id', id)
  if (error) throw error
}


// ========================
// PREVENTIVOS
// ========================
export async function getPreventivos() {
  const { data, error } = await supabase
    .from('apsol_preventivos')
    .select(`
      *,
      proyectos:apsol_proyectos(nombre, prospectos:apsol_prospectos(empresas:apsol_empresas(nombre)))
    `)
    .order('proxima_realizacion', { ascending: true })

  if (error) throw error
  return data
}

export async function getPreventivoById(id) {
  const { data, error } = await supabase
    .from('apsol_preventivos')
    .select(`
      *,
      proyectos:apsol_proyectos(id, nombre, prospectos:apsol_prospectos(empresas:apsol_empresas(nombre)))
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function savePreventivo(preventivo) {
  if (preventivo.id) {
    const { data, error } = await supabase
      .from('apsol_preventivos')
      .update(preventivo)
      .eq('id', preventivo.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_preventivos')
      .insert([preventivo])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deletePreventivo(id) {
  const { error } = await supabase
    .from('apsol_preventivos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

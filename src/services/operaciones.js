import { supabase } from '../lib/supabase'

// apsol_colaboradores no tiene columnas nombre/apellido (viven en
// apsol_usuarios, con nombre_manual/apellido_manual como respaldo si el
// colaborador no tiene usuario vinculado). Pedirlas directas en el embed
// rompe la consulta entera con "column ... does not exist" para cualquier
// usuario -> hay que traer usuarios y nombre_manual/apellido_manual y
// resolver acá el nombre a mostrar.
export function resolverNombreColaborador(colaborador) {
  if (!colaborador) return colaborador
  return {
    ...colaborador,
    nombre: colaborador.usuarios?.nombre || colaborador.nombre_manual || '',
    apellido: colaborador.usuarios?.apellido || colaborador.apellido_manual || '',
  }
}

const EMBED_COLABORADOR = 'apsol_colaboradores(nombre_manual, apellido_manual, usuarios:apsol_usuarios(nombre, apellido))'
const EMBED_COLABORADOR_CON_ID = 'apsol_colaboradores(id, nombre_manual, apellido_manual, usuarios:apsol_usuarios(nombre, apellido))'

// ========================
// TICKETS
// ========================
export async function getTickets() {
  const { data, error } = await supabase
    .from('apsol_tickets')
    .select(`
      *,
      proyectos:apsol_proyectos(nombre, prospectos:apsol_prospectos(empresas:apsol_empresas(nombre))),
      colaboradores:${EMBED_COLABORADOR}
    `)
    .order('fecha_creacion', { ascending: false })

  if (error) throw error
  return (data || []).map(t => ({ ...t, colaboradores: resolverNombreColaborador(t.colaboradores) }))
}

export async function getTicketById(id) {
  const { data, error } = await supabase
    .from('apsol_tickets')
    .select(`
      *,
      proyectos:apsol_proyectos(id, nombre, prospectos:apsol_prospectos(empresas:apsol_empresas(nombre))),
      colaboradores:${EMBED_COLABORADOR_CON_ID}
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return { ...data, colaboradores: resolverNombreColaborador(data.colaboradores) }
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

import { supabase } from '../lib/supabase'

// Columnas reales de la tabla proyectos (lo demás que traiga el form
// —joins, campos de UI— no se manda a guardar).
export const COLUMNAS_PROYECTO = [
  'id', 'prospecto_id', 'nombre', 'tipo', 'responsable_id', 'colaborador_id',
  'estado', 'descripcion', 'fecha_inicio', 'fecha_fin_estimada',
  'lider_colaborador_id', 'porcentaje_avance',
]

// FKs opcionales (uuid) y fechas: los <select>/<input> los devuelven como
// '' cuando están sin elegir, y la DB necesita NULL.
const CAMPOS_NULLABLE = [
  'prospecto_id', 'responsable_id', 'colaborador_id', 'lider_colaborador_id',
  'fecha_inicio', 'fecha_fin_estimada', 'tipo',
]

/**
 * Deja el objeto de proyecto listo para insert/update: solo columnas
 * reales, '' -> null en las opcionales, porcentaje_avance numérico.
 * No muta el original.
 */
export function prepararProyectoParaGuardar(proyecto = {}) {
  const out = {}
  for (const k of COLUMNAS_PROYECTO) {
    if (proyecto[k] !== undefined) out[k] = proyecto[k]
  }
  for (const k of CAMPOS_NULLABLE) {
    if (out[k] === '') out[k] = null
  }
  if ('porcentaje_avance' in out) {
    const n = Number(out.porcentaje_avance)
    out.porcentaje_avance = Number.isFinite(n) ? n : 0
  }
  return out
}

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

const EMBED_COLABORADOR_LIDER = 'apsol_colaboradores!proyectos_lider_colaborador_id_fkey(id, nombre_manual, apellido_manual, usuarios:apsol_usuarios(nombre, apellido))'
const EMBED_COLABORADOR_TICKET = 'apsol_colaboradores(nombre_manual, apellido_manual, usuarios:apsol_usuarios(nombre, apellido))'

export async function getProyectos() {
  const { data, error } = await supabase
    .from('apsol_proyectos')
    .select(`
      *,
      prospectos:apsol_prospectos(nombre, empresas:apsol_empresas(nombre)),
      colaboradores:${EMBED_COLABORADOR_LIDER}
    `)
    .order('fecha_inicio', { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data || []).map(p => ({ ...p, colaboradores: resolverNombreColaborador(p.colaboradores) }))
}

export async function getProyectoById(id) {
  const { data, error } = await supabase
    .from('apsol_proyectos')
    .select(`
      *,
      prospectos:apsol_prospectos(id, nombre, empresas:apsol_empresas(nombre)),
      colaboradores:${EMBED_COLABORADOR_LIDER},
      tickets:apsol_tickets(*, colaboradores:${EMBED_COLABORADOR_TICKET}),
      preventivos:apsol_preventivos(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return {
    ...data,
    colaboradores: resolverNombreColaborador(data.colaboradores),
    tickets: (data.tickets || []).map(t => ({ ...t, colaboradores: resolverNombreColaborador(t.colaboradores) })),
  }
}

export async function saveProyecto(proyecto) {
  const payload = prepararProyectoParaGuardar(proyecto)

  if (payload.id) {
    const { id, ...campos } = payload
    const { data, error } = await supabase
      .from('apsol_proyectos')
      .update(campos)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    delete payload.id
    const { data, error } = await supabase
      .from('apsol_proyectos')
      .insert([payload])
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

import { supabase } from '../lib/supabase'
import { resumenParaCierre } from './sprints-utils'

// ──────────────────────────────────────────────────────────────
// Acceso a datos del módulo Sprints. La lógica de conteos / orden /
// semáforo vive en sprints-utils.js (pura y testeada).
// ──────────────────────────────────────────────────────────────

const SELECT_ITEM_COMPLETO = `
  *,
  adjuntos:apsol_sprint_item_adjuntos(*)
`

// ── SPRINTS ───────────────────────────────────────────────────

// Lista para un proyecto, con lo justo para pintar el semáforo del encabezado.
export async function getSprintsDeProyecto(proyectoId) {
  const { data, error } = await supabase
    .from('apsol_sprints')
    .select('*, items:apsol_sprint_items(id, estado)')
    .eq('proyecto_id', proyectoId)
    .order('numero', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getSprintById(id) {
  const { data, error } = await supabase
    .from('apsol_sprints')
    .select(`
      *,
      proyecto:apsol_proyectos(id, nombre),
      items:apsol_sprint_items(${SELECT_ITEM_COMPLETO}),
      notas_items:apsol_sprint_notas(*, autor:apsol_usuarios(nombre, apellido))
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  if (data?.items) {
    data.items.sort((a, b) => (a.orden || 0) - (b.orden || 0))
    for (const it of data.items) {
      it.adjuntos?.sort((a, b) => new Date(a.creado_en || 0) - new Date(b.creado_en || 0))
    }
  }
  data?.notas_items?.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
  return data
}

export async function crearSprint({ proyecto_id, numero, nombre = '', objetivo = '', fecha_inicio = null, fecha_fin = null }) {
  const { data, error } = await supabase
    .from('apsol_sprints')
    .insert([{ proyecto_id, numero, nombre, objetivo, fecha_inicio, fecha_fin, estado: 'planificado' }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarSprint(id, campos) {
  const { data, error } = await supabase
    .from('apsol_sprints')
    .update({ ...campos, actualizado_en: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarSprint(id) {
  const { error } = await supabase.from('apsol_sprints').delete().eq('id', id)
  if (error) throw error
}

// Cierra el sprint y congela la "foto" de conteos por estado.
export async function cerrarSprint(id) {
  const { data: items, error: errItems } = await supabase
    .from('apsol_sprint_items')
    .select('estado')
    .eq('sprint_id', id)
  if (errItems) throw errItems

  return actualizarSprint(id, {
    estado: 'cerrado',
    cerrado_en: new Date().toISOString(),
    resumen_estados: resumenParaCierre(items || []),
  })
}

export async function reabrirSprint(id) {
  return actualizarSprint(id, { estado: 'activo', cerrado_en: null, resumen_estados: null })
}

// ── PUNTOS DEL SPRINT ─────────────────────────────────────────

export async function crearItem({ sprint_id, orden, titulo = 'Nuevo punto' }) {
  const { data, error } = await supabase
    .from('apsol_sprint_items')
    .insert([{ sprint_id, orden, titulo }])
    .select(SELECT_ITEM_COMPLETO)
    .single()

  if (error) throw error
  return data
}

export async function actualizarItem(id, campos, userId = null) {
  const patch = { ...campos, actualizado_en: new Date().toISOString() }
  if (userId) patch.actualizado_por = userId

  const { data, error } = await supabase
    .from('apsol_sprint_items')
    .update(patch)
    .eq('id', id)
    .select(SELECT_ITEM_COMPLETO)
    .single()

  if (error) throw error
  return data
}

export async function eliminarItem(id) {
  const { error } = await supabase.from('apsol_sprint_items').delete().eq('id', id)
  if (error) throw error
}

// Persiste el nuevo orden de varios puntos a la vez (tras mover ↑/↓).
export async function guardarOrdenItems(cambios) {
  for (const { id, orden } of cambios) {
    const { error } = await supabase
      .from('apsol_sprint_items')
      .update({ orden })
      .eq('id', id)
    if (error) throw error
  }
}

// ── ADJUNTOS ──────────────────────────────────────────────────

export async function agregarAdjunto({ item_id, url, nombre = '', subido_por = null }) {
  const { data, error } = await supabase
    .from('apsol_sprint_item_adjuntos')
    .insert([{ item_id, url, nombre, subido_por }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarAdjunto(id) {
  const { error } = await supabase.from('apsol_sprint_item_adjuntos').delete().eq('id', id)
  if (error) throw error
}

// ── NOTAS DEL SPRINT ──────────────────────────────────────────
// Lista con autor + fecha por nota (antes era un único textarea sin
// identificar quién ni cuándo). Mismo patrón que apsol_comentarios.

export async function crearNotaSprint({ sprint_id, creado_por, nota }) {
  const { data, error } = await supabase
    .from('apsol_sprint_notas')
    .insert([{ sprint_id, creado_por, nota }])
    .select('*, autor:apsol_usuarios(nombre, apellido)')
    .single()

  if (error) throw error
  return data
}

export async function eliminarNotaSprint(id) {
  const { error } = await supabase.from('apsol_sprint_notas').delete().eq('id', id)
  if (error) throw error
}

// ── VISTA GLOBAL (todos los proyectos) ────────────────────────

// Sprints activos de toda la operación, con sus puntos, para el tablero
// "qué está en rojo ahora mismo".
export async function getSprintsActivos() {
  const { data, error } = await supabase
    .from('apsol_sprints')
    .select(`
      *,
      proyecto:apsol_proyectos(id, nombre),
      items:apsol_sprint_items(id, titulo, estado, comentario)
    `)
    .eq('estado', 'activo')
    .order('actualizado_en', { ascending: false })

  if (error) throw error
  return data || []
}

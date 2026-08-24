import { supabase } from '../lib/supabase'

// ── PLANES ────────────────────────────────────────────────────────────────────

export async function getPlanes() {
  const { data, error } = await supabase
    .from('apsol_planes')
    .select('*')
    .order('fecha_inicio', { ascending: false })

  if (error) throw error
  return data
}

export async function getPlanById(id) {
  const { data, error } = await supabase
    .from('apsol_planes')
    .select(`
      *,
      objetivos:apsol_plan_objetivos(*),
      subobjetivos:apsol_plan_subobjetivos(*),
      tareas:apsol_plan_tareas(
        *,
        asignaciones:apsol_plan_asignaciones(
          colaborador_id,
          colaborador:apsol_colaboradores(
            id,
            usuario:apsol_usuarios(nombre, apellido)
          )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function crearPlan({ nombre, fecha_inicio, fecha_fin }) {
  const { data, error } = await supabase
    .from('apsol_planes')
    .insert([{ nombre, fecha_inicio, fecha_fin, estado: 'borrador' }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarPlan(id, campos) {
  const { data, error } = await supabase
    .from('apsol_planes')
    .update({ ...campos, actualizado_en: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarPlan(id) {
  const { error } = await supabase
    .from('apsol_planes')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── OBJETIVOS ─────────────────────────────────────────────────────────────────

export async function crearObjetivo({ plan_id, titulo, descripcion, color, orden }) {
  const { data, error } = await supabase
    .from('apsol_plan_objetivos')
    .insert([{ plan_id, titulo, descripcion, color, orden }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarObjetivo(id, campos) {
  const { data, error } = await supabase
    .from('apsol_plan_objetivos')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarObjetivo(id) {
  const { error } = await supabase
    .from('apsol_plan_objetivos')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── SUBOBJETIVOS ──────────────────────────────────────────────────────────────

export async function crearSubobjetivo({ plan_id, texto, orden }) {
  const { data, error } = await supabase
    .from('apsol_plan_subobjetivos')
    .insert([{ plan_id, texto, orden }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarSubobjetivo(id, campos) {
  const { data, error } = await supabase
    .from('apsol_plan_subobjetivos')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarSubobjetivo(id) {
  const { error } = await supabase
    .from('apsol_plan_subobjetivos')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── TAREAS ────────────────────────────────────────────────────────────────────

export async function crearTarea({ plan_id, objetivo_id, nombre, semana_inicio, duracion_semanas, orden }) {
  const { data, error } = await supabase
    .from('apsol_plan_tareas')
    .insert([{ plan_id, objetivo_id, nombre, semana_inicio, duracion_semanas, progreso: 0, orden }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarTarea(id, campos) {
  const { data, error } = await supabase
    .from('apsol_plan_tareas')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarTarea(id) {
  const { error } = await supabase
    .from('apsol_plan_tareas')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── ASIGNACIONES ──────────────────────────────────────────────────────────────

export async function setAsignaciones(tarea_id, colaborador_ids) {
  // Borramos todas las asignaciones previas de la tarea
  const { error: delError } = await supabase
    .from('apsol_plan_asignaciones')
    .delete()
    .eq('tarea_id', tarea_id)

  if (delError) throw delError

  if (!colaborador_ids || colaborador_ids.length === 0) return

  const rows = colaborador_ids.map(colaborador_id => ({ tarea_id, colaborador_id }))
  const { error } = await supabase
    .from('apsol_plan_asignaciones')
    .insert(rows)

  if (error) throw error
}

// ── COLABORADORES (para el selector de equipo) ────────────────────────────────

export async function getColaboradoresActivos() {
  const { data, error } = await supabase
    .from('apsol_colaboradores')
    .select('id, usuario:apsol_usuarios(nombre, apellido)')
    .eq('estado', 'Activo')

  if (error) throw error
  return data
}

import { supabase } from '../lib/supabase'
import moment from 'moment'
import { datetimeLocalAUtc } from './cronograma'
import {
  planificarMantenimientoMes,
  rangoDelMes,
  RESPONSABLE_MANTENIMIENTO_ID,
  ORIGEN_MANTENIMIENTO,
} from '../utils/mantenimiento'

// ────────────────────────────────────────────────────────────────
// Lista fija de mantenimiento (apsol_cronograma_mantenimiento)
// La vista es SELECT * plano -> se puede insertar/actualizar/borrar.
// RLS: solo admin (apsol_private.soy_admin()).
// ────────────────────────────────────────────────────────────────

/** Filas de config, ordenadas. El nombre del cliente lo resuelve la UI
 *  contra la lista de prospectos que ya tiene cargada. */
export async function getConfigMantenimiento() {
  const { data, error } = await supabase
    .from('apsol_cronograma_mantenimiento')
    .select('*')
    .order('orden')
  if (error) throw error
  return data || []
}

/** Alta o cambio de horas/estado de un cliente en la lista fija.
 *  UNIQUE(prospecto_id) -> upsert por ese conflicto. */
export async function guardarItemMantenimiento({ prospecto_id, horas, activo = true, orden = 0 }) {
  const { data, error } = await supabase
    .from('apsol_cronograma_mantenimiento')
    .upsert({ prospecto_id, horas: Number(horas), activo, orden }, { onConflict: 'prospecto_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Saca un cliente de la lista fija (no toca actividades ya cargadas). */
export async function borrarItemMantenimiento(id) {
  const { error } = await supabase
    .from('apsol_cronograma_mantenimiento')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ────────────────────────────────────────────────────────────────
// Actividades de mantenimiento en el cronograma
// ────────────────────────────────────────────────────────────────

/**
 * Qué mantenimiento ya está cargado, agrupado por mes.
 * @returns {Promise<Record<string, { total: number, porProspecto: Record<string, number> }>>}
 *          clave = 'YYYY-MM'
 */
export async function getMantenimientoPorMes() {
  const { data, error } = await supabase
    .from('apsol_cronograma')
    .select('prospecto_id, inicio, duracion_horas')
    .eq('origen', ORIGEN_MANTENIMIENTO)
  if (error) throw error

  const porMes = {}
  for (const fila of data || []) {
    const mes = moment(fila.inicio).format('YYYY-MM')
    const h = Number(fila.duracion_horas) || 0
    if (!porMes[mes]) porMes[mes] = { total: 0, porProspecto: {} }
    porMes[mes].total += h
    porMes[mes].porProspecto[fila.prospecto_id] =
      (porMes[mes].porProspecto[fila.prospecto_id] || 0) + h
  }
  return porMes
}

/**
 * Crea las actividades de mantenimiento del mes (una por cliente).
 * @param {{mes: string, items: Array<{prospecto_id: string, horas: number}>}} args
 * @returns {Promise<number>} cantidad de actividades creadas
 */
export async function crearMantenimientoMes({ mes, items }) {
  const plan = planificarMantenimientoMes({ mes, items })
  if (plan.length === 0) return 0

  const filas = plan.map(b => ({
    prospecto_id: b.prospecto_id,
    inicio: datetimeLocalAUtc(b.inicio),
    fin: datetimeLocalAUtc(b.fin),
    duracion_horas: b.duracion_horas,
    descripcion: b.descripcion,
    responsable_id: RESPONSABLE_MANTENIMIENTO_ID,
    reunion_cliente: false,
    multiplicador: 1,
    herramientas: null,
    origen: ORIGEN_MANTENIMIENTO,
  }))

  const { data, error } = await supabase
    .from('apsol_cronograma')
    .insert(filas)
    .select('id')
  if (error) throw error
  return (data || []).length
}

/**
 * Borra TODAS las actividades de mantenimiento de un mes (solo las que
 * creó el botón: filtra por origen + rango del mes por `inicio`).
 * @param {{mes: string}} args
 * @returns {Promise<number>} cantidad borrada
 */
export async function borrarMantenimientoMes({ mes }) {
  const rango = rangoDelMes(mes)
  if (!rango) return 0
  const { data, error } = await supabase
    .from('apsol_cronograma')
    .delete()
    .eq('origen', ORIGEN_MANTENIMIENTO)
    .gte('inicio', datetimeLocalAUtc(rango.desde))
    .lt('inicio', datetimeLocalAUtc(rango.hasta))
    .select('id')
  if (error) throw error
  return (data || []).length
}

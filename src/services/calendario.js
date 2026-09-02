import { supabase } from '../lib/supabase'

// Sincroniza una "reunión con cliente" del cronograma con el Google Calendar
// de APSOL, a través de la Edge Function `reunion-calendar` (la cuenta de
// servicio de Google y el ID del calendario viven en los secrets de
// Supabase, nunca acá).
//
// @param {'crear'|'actualizar'|'borrar'} accion
// @param {object} opts
// @param {string} [opts.googleCalendarId]  id del evento (para actualizar/borrar)
// @param {object} [opts.evento]            body del evento (ver construirEventoReunion)
// @returns {Promise<{id?: string, htmlLink?: string, ok?: boolean}>}
export async function sincronizarEventoReunion(accion, { googleCalendarId, evento } = {}) {
  const { data, error } = await supabase.functions.invoke('reunion-calendar', {
    body: { accion, google_calendar_id: googleCalendarId || null, evento: evento || null }
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data || {}
}

// Lista los eventos del Google Calendar de APSOL en un rango (ISO).
// Devuelve [{ id, summary, start, end, allDay, htmlLink, description }].
export async function listarEventosCalendar(desdeISO, hastaISO) {
  const { data, error } = await supabase.functions.invoke('reunion-calendar', {
    body: { accion: 'listar', desde: desdeISO, hasta: hastaISO }
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data?.eventos || []
}

// Edge Function: crea / actualiza / borra un evento en el Google Calendar de
// APSOL a partir de una "reunión con cliente" del cronograma.
//
// Autenticación: UNA cuenta de servicio de Google (no OAuth por usuario).
// La config (JSON de la cuenta de servicio + ID del calendario) se lee, en
// este orden:
//   1) de los secrets de la Edge Function: GCAL_SERVICE_ACCOUNT_JSON / GCAL_CALENDAR_ID
//   2) si no están, de Supabase Vault vía el RPC public.gcal_config()
//      (usando el service-role key que Supabase inyecta en la función).
// El calendario de APSOL tiene que estar COMPARTIDO con el email de la cuenta
// de servicio, permiso "Hacer cambios en los eventos".
//
// LIMITACIÓN conocida (calendario Gmail común, no Workspace): una cuenta de
// servicio NO puede invitar attendees sin Domain-Wide Delegation. Si Google
// rechaza por eso, la función reintenta SIN attendees (dejando los emails en
// la descripción del evento) y responde con attendeesOmitted: true.
//
// Body (POST):
//   { accion: "crear" | "actualizar" | "borrar",
//     google_calendar_id?: string,           // requerido para actualizar/borrar
//     evento?: { summary, start, end, attendees, description } }
// Respuesta: { id, htmlLink, attendeesOmitted? } | { ok: true }

import { JWT } from "npm:google-auth-library@9"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars"
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

async function getConfig(): Promise<{ serviceAccountJson: string; calendarId: string }> {
  const envJson = Deno.env.get("GCAL_SERVICE_ACCOUNT_JSON")
  const envCal = Deno.env.get("GCAL_CALENDAR_ID")
  if (envJson && envCal) return { serviceAccountJson: envJson, calendarId: envCal }

  const url = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !serviceKey) {
    throw new Error("Sin config: faltan los secrets GCAL_* y no hay SUPABASE_SERVICE_ROLE_KEY para leer Vault")
  }
  const r = await fetch(`${url}/rest/v1/rpc/gcal_config`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  })
  if (!r.ok) throw new Error(`No se pudo leer gcal_config (${r.status}): ${await r.text()}`)
  const cfg = await r.json()
  const serviceAccountJson = cfg?.service_account_json
  const calendarId = cfg?.calendar_id
  if (!serviceAccountJson || !calendarId) {
    throw new Error("gcal_config no devolvió service_account_json / calendar_id (¿faltan los secrets en Vault?)")
  }
  return { serviceAccountJson, calendarId }
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const key = JSON.parse(serviceAccountJson)
  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  })
  const { access_token } = await client.authorize()
  if (!access_token) throw new Error("No se pudo obtener el access token de Google")
  return access_token
}

// Quita attendees y los deja anotados en la descripción (para cuando Google
// no deja invitar con cuenta de servicio).
function sinAttendees(evento: Record<string, unknown>): Record<string, unknown> {
  const emails = Array.isArray(evento.attendees)
    ? (evento.attendees as Array<{ email?: string }>).map((a) => a?.email).filter(Boolean)
    : []
  const extra = emails.length ? `\n\nInvitados: ${emails.join(", ")}` : ""
  const { attendees: _omit, ...resto } = evento
  return { ...resto, description: `${(evento.description as string) || ""}${extra}`.trim() }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405)

  let payload: {
    accion?: string
    google_calendar_id?: string
    evento?: Record<string, unknown>
    desde?: string
    hasta?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: "Body inválido" }, 400)
  }

  const { accion, google_calendar_id, evento, desde, hasta } = payload
  if (!["crear", "actualizar", "borrar", "listar"].includes(accion || "")) {
    return json({ error: "accion debe ser crear | actualizar | borrar | listar" }, 400)
  }

  let calendarId: string, token: string
  try {
    const cfg = await getConfig()
    calendarId = cfg.calendarId
    token = await getAccessToken(cfg.serviceAccountJson)
  } catch (e) {
    return json({ error: errMsg(e) }, 500)
  }

  const encCal = encodeURIComponent(calendarId)
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  try {
    if (accion === "listar") {
      if (!desde || !hasta) return json({ error: "Faltan desde / hasta (ISO)" }, 400)
      const qs = new URLSearchParams({
        timeMin: desde,
        timeMax: hasta,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
      })
      const r = await fetch(`${CAL_BASE}/${encCal}/events?${qs}`, { headers: authHeaders })
      if (!r.ok) return json({ error: `Google Calendar ${r.status}: ${await r.text()}` }, 502)
      const data = await r.json()
      const eventos = (data.items || [])
        .filter((ev: Record<string, unknown>) => (ev as { status?: string }).status !== "cancelled")
        .map((ev: Record<string, unknown>) => {
          const s = ev.start as { dateTime?: string; date?: string } | undefined
          const e = ev.end as { dateTime?: string; date?: string } | undefined
          return {
            id: ev.id,
            summary: (ev.summary as string) || "(sin título)",
            start: s?.dateTime || s?.date || null,
            end: e?.dateTime || e?.date || null,
            allDay: !!(s && s.date && !s.dateTime),
            htmlLink: ev.htmlLink || null,
            description: (ev.description as string) || "",
          }
        })
      return json({ eventos })
    }

    if (accion === "borrar") {
      if (!google_calendar_id) return json({ error: "Falta google_calendar_id" }, 400)
      const r = await fetch(
        `${CAL_BASE}/${encCal}/events/${encodeURIComponent(google_calendar_id)}?sendUpdates=all`,
        { method: "DELETE", headers: authHeaders },
      )
      if (!r.ok && r.status !== 404 && r.status !== 410) {
        return json({ error: `Google Calendar ${r.status}: ${await r.text()}` }, 502)
      }
      return json({ ok: true })
    }

    if (!evento) return json({ error: "Falta evento" }, 400)
    const esCrear = accion === "crear"
    if (!esCrear && !google_calendar_id) return json({ error: "Falta google_calendar_id" }, 400)

    const url = esCrear
      ? `${CAL_BASE}/${encCal}/events?sendUpdates=all`
      : `${CAL_BASE}/${encCal}/events/${encodeURIComponent(google_calendar_id!)}?sendUpdates=all`
    const method = esCrear ? "POST" : "PATCH"

    let attendeesOmitted = false
    let r = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(evento) })

    if (!r.ok) {
      const txt = await r.text()
      // Cuenta de servicio + calendario no-Workspace: no puede invitar. Reintento sin attendees.
      if (r.status === 403 && txt.includes("forbiddenForServiceAccounts")) {
        attendeesOmitted = true
        r = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(sinAttendees(evento)) })
        if (!r.ok) return json({ error: `Google Calendar ${r.status}: ${await r.text()}` }, 502)
      } else {
        return json({ error: `Google Calendar ${r.status}: ${txt}` }, 502)
      }
    }

    const data = await r.json()
    return json({ id: data.id, htmlLink: data.htmlLink, attendeesOmitted })
  } catch (e) {
    return json({ error: errMsg(e) }, 500)
  }
})

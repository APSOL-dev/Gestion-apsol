# reunion-calendar — Edge Function

Crea / actualiza / borra el evento en el **Google Calendar de APSOL** cuando en
el cronograma se marca una actividad como "reunión con cliente".

La app (React) la invoca con `supabase.functions.invoke('reunion-calendar', …)`
(ver `src/services/calendario.js`). El secreto de Google **nunca** llega al
navegador: vive en los secrets de Supabase.

## Puesta en marcha (una sola vez)

### 1. Google Cloud
1. En el proyecto de Google Cloud → **APIs y servicios → Biblioteca** → habilitá
   **Google Calendar API**.
2. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio**
   (ej. `apsol-cronograma`). No hace falta darle roles de IAM.
3. En la cuenta de servicio → **Claves → Agregar clave → Crear clave nueva →
   JSON**. Se descarga un `.json`. Guardalo, es el secreto.
4. Anotá el **email** de la cuenta de servicio
   (`apsol-cronograma@<proyecto>.iam.gserviceaccount.com`).

### 2. Google Calendar
1. Abrí el calendario de APSOL → **Configuración y uso compartido**.
2. En **"Compartir con determinadas personas"** agregá el email de la cuenta de
   servicio con permiso **"Hacer cambios en los eventos"**.
3. En **"Integrar el calendario"** copiá el **ID del calendario**
   (`xxxxxxxx@group.calendar.google.com`).

### 3. Supabase — YA CONFIGURADO
- La función **está deployada** (`reunion-calendar`, `verify_jwt` on).
- La config (JSON de la cuenta de servicio + `GCAL_CALENDAR_ID`) está en
  **Supabase Vault** (`vault.secrets`), y la función la lee vía el RPC
  `public.gcal_config()` (SECURITY DEFINER, sólo `service_role`).
- Probado end-to-end: crea y borra eventos reales en el calendario de APSOL.

Para cambiar la clave / el calendario más adelante:
```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'GCAL_SERVICE_ACCOUNT_JSON'),
  '<nuevo json>'
);
select vault.update_secret(
  (select id from vault.secrets where name = 'GCAL_CALENDAR_ID'),
  '<nuevo calendar id>'
);
```
(o cargá los secrets `GCAL_SERVICE_ACCOUNT_JSON` / `GCAL_CALENDAR_ID` como
env vars de la Edge Function — tienen prioridad sobre Vault.)

### Limitación CONFIRMADA: no se pueden invitar attendees
`apatriarca.apsol@gmail.com` es una cuenta Gmail estándar (no Workspace). Google
devuelve `403 forbiddenForServiceAccounts` — *"Service accounts cannot invite
attendees without Domain-Wide Delegation of Authority"* — y la delegación
domain-wide **requiere Google Workspace**, así que con esta cuenta no se puede.

**Qué hace la función:** intenta crear el evento con los invitados; si Google lo
rechaza por eso, reintenta **sin attendees**, deja los emails en la descripción
del evento, y responde `attendeesOmitted: true`. El evento SIEMPRE queda en el
calendario de APSOL con toda la info; el front avisa con un toast para que el
link se comparta a mano.

**Para que la invitación llegue por mail de verdad**, hay que cambiar el modelo
de auth de la función: en vez de cuenta de servicio, usar **OAuth de la cuenta
`apatriarca.apsol@gmail.com`** (consentir una vez, guardar el refresh token en
Vault, la función lo usa). Actuando "como el usuario" sí puede invitar. Es
trabajo aparte.

Listo. A partir de ahí, guardar una "reunión con cliente" en el cronograma crea
el evento (con los contactos del cliente como invitados, `sendUpdates=all` →
les llega la invitación por mail). Editarla lo actualiza; borrarla lo borra.

## Contrato

`POST` body:
```jsonc
{
  "accion": "crear" | "actualizar" | "borrar",
  "google_calendar_id": "…",            // requerido para actualizar / borrar
  "evento": {                            // requerido para crear / actualizar
    "summary": "…",                      // = la descripción del trabajo
    "start": { "dateTime": "2026-09-02T15:00:00", "timeZone": "America/Argentina/Buenos_Aires" },
    "end":   { "dateTime": "2026-09-02T16:00:00", "timeZone": "America/Argentina/Buenos_Aires" },
    "attendees": [{ "email": "contacto@cliente.com" }],
    "description": "comentarios + link"
  }
}
```
Respuesta: `{ "id": "...", "htmlLink": "..." }` (crear/actualizar) · `{ "ok": true }` (borrar).

## Pendiente (opcional)
- **Persistir los invitados externos** en la fila del cronograma: hoy los emails
  se mandan al evento pero no se guardan en `apsol_cronograma`, así que al
  reabrir la reunión no se pre-cargan. Requiere columna `invitados_externos
  text[]` + recrear la vista `public.apsol_cronograma` (con `security_invoker`)
  + agregarla al RPC `apsol_cronograma_visible`.
- **Invitar también a los colaboradores internos**: hoy solo van los contactos
  del cliente; falta traer el email de cada colaborador (está en `apsol_usuarios`).

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kursvmadozcqxoaeaccd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cnN2bWFkb3pjcXhvYWVhY2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTY2NDgsImV4cCI6MjA5OTE5MjY0OH0.3dJfV8prVkgWqoGV1baJdBYTpPasWA1iidvMnRkBqXs'

// IMPORTANTE: NO desactivar `navigator.locks`.
//
// Acá había un parche que hacía `navigator.locks = undefined` para evitar
// "candados huérfanos en Chrome". Ese parche era la causa del cuelgue que
// obligaba a recargar la página con F5:
//
//   1. Cada consulta a la base pide el token de sesión (SupabaseClient
//      `_getAccessToken` -> `auth.getSession()` -> `_acquireLock`).
//   2. Sin `navigator.locks`, auth-js cae a `lockNoOp` (GoTrueClient.js:147),
//      que NO da exclusión mutua.
//   3. Cuando salen varias consultas en el mismo tick (la precarga del
//      login), todas ven `lockAcquired === false` y todas entran como
//      "dueñas del lock". Cada una queda esperando a las otras en el bucle
//      `while (this.pendingInLock.length)` (GoTrueClient.js:2273).
//   4. Se esperan entre sí: deadlock permanente. No es lento, está trabado;
//      esperar no sirve y solo un F5 (contexto JS nuevo) lo destraba.
//
// El problema que motivaba el parche ya lo resuelve la propia librería con
// `lockAcquireTimeout` (default 5000ms, "then steal orphaned lock"): si un
// candado quedó huérfano, a los 5s lo roba y sigue. Se deja explícito para
// que quede claro que ese caso está cubierto sin romper el lock.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    lockAcquireTimeout: 5000
  }
})

export { supabaseUrl }

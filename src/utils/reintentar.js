/**
 * Ejecuta `fn` (async) y, si lanza, la reintenta hasta `intentos` veces
 * dejando `esperaMs` de pausa entre intentos. Devuelve el resultado del
 * primer intento exitoso; si se agotan los intentos, relanza el ÚLTIMO
 * error.
 *
 * Sirve para llamadas de red que fallan de forma transitoria (el token de
 * Supabase que se está refrescando y devuelve 401, un hipo de conexión):
 * antes obligaban al usuario a recargar la página.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ intentos?: number, esperaMs?: number }} [opciones]
 * @returns {Promise<T>}
 */
export async function reintentar(fn, { intentos = 3, esperaMs = 800 } = {}) {
  const total = Math.max(1, Math.trunc(Number(intentos) || 0))
  let ultimoError
  for (let i = 0; i < total; i++) {
    try {
      return await fn()
    } catch (err) {
      ultimoError = err
      if (i < total - 1) await esperar(esperaMs)
    }
  }
  throw ultimoError
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)))
}

/**
 * Devuelve una promesa que resuelve con `promesa` si termina antes de
 * `ms`, o rechaza con un Error de timeout si no. Sirve para que una
 * llamada de red que se cuelga (fetch sin respuesta, cliente de Supabase
 * trabado en un refresh de token) no deje la UI esperando para siempre.
 *
 * OJO: no cancela la operación de fondo (no hay AbortController acá), solo
 * deja de esperarla. El caller decide qué hacer con el timeout.
 *
 * @template T
 * @param {Promise<T>} promesa
 * @param {number} ms
 * @param {string} [mensaje]
 * @returns {Promise<T>}
 */
export function conTimeout(promesa, ms, mensaje = 'La operación tardó demasiado') {
  let idTimer
  const limite = new Promise((_, reject) => {
    idTimer = setTimeout(() => reject(new Error(mensaje)), Math.max(0, ms))
  })
  return Promise.race([promesa, limite]).finally(() => clearTimeout(idTimer))
}

import { conTimeout } from './reintentar'
import { decidirFetch } from './cachePolitica'

/**
 * Crea el "refrescador" de un módulo de datos de DataContext, con:
 *  - TTL: si se trajo hace < ttlMs y no se fuerza, usa la caché (no red).
 *    Esto es lo que evita re-consultar tablas enteras en cada navegación.
 *  - single-flight: si ya hay una carga en curso, se adhiere a ella.
 *  - timeout: si la request se cuelga, corta y marca error (no spinner infinito).
 *
 * `meta` es un objeto mutable compartido ({ ultimaCargaOk, enVuelo }) que
 * el refrescador va actualizando. `setData/setLoading/setError` son los
 * setters de React (o cualquier callback). Todo inyectado => testeable sin
 * montar React.
 *
 * Argumento del refrescador devuelto:
 *   true                       -> refetch silencioso respetando TTL (navegación)
 *   false / undefined / evento -> refetch forzado con loader (post-mutación / 1ª carga)
 *   { silencioso?, forzar? }    -> control explícito
 */
export function crearRefrescador({
  clave, getter, meta, setData, setLoading, setError,
  ttlMs = 90_000, timeoutMs = 12_000
}) {
  return async function refrescar(arg) {
    let silencioso = false
    let forzar = true
    if (arg === true) {
      silencioso = true
      forzar = false
    } else if (arg && typeof arg === 'object' && !arg.nativeEvent && ('silencioso' in arg || 'forzar' in arg)) {
      silencioso = !!arg.silencioso
      forzar = !!arg.forzar
    }

    const decision = decidirFetch({
      ultimaCargaOk: meta.ultimaCargaOk,
      hayEnVuelo: !!meta.enVuelo,
      forzar,
      ttlMs
    })
    if (decision === 'en-vuelo') return meta.enVuelo
    if (decision === 'saltar-ttl') return

    if (!silencioso) setLoading(true)
    setError(false)
    const promesa = (async () => {
      try {
        const data = await conTimeout(getter(), timeoutMs, `Timeout al precargar "${clave}"`)
        setData(data || [])
        meta.ultimaCargaOk = Date.now()
      } catch (err) {
        console.error(`Error al precargar "${clave}":`, err)
        setError(true)
      } finally {
        setLoading(false)
        meta.enVuelo = null
      }
    })()
    meta.enVuelo = promesa
    return promesa
  }
}

/**
 * Decide qué hacer cuando una pantalla pide precargar un módulo de datos
 * (facturas, prospectos, etc.) desde DataContext:
 *
 *  - 'en-vuelo'   : ya hay una carga de ese módulo en curso -> adherirse a
 *                   ella en vez de disparar otra (single-flight).
 *  - 'saltar-ttl' : se trajo hace menos de `ttlMs` -> usar lo cacheado, no
 *                   ir a la red (esto es lo que evita re-consultar tablas
 *                   enteras en cada navegación).
 *  - 'ejecutar'   : hay que ir a la red.
 *
 * `forzar` ignora el TTL (ej. después de guardar algo), pero NUNCA lanza
 * una segunda carga si ya hay una en curso.
 *
 * @param {{ ultimaCargaOk?: number, hayEnVuelo?: boolean, forzar?: boolean, ttlMs?: number, ahora?: number }} opts
 * @returns {'en-vuelo' | 'saltar-ttl' | 'ejecutar'}
 */
export function decidirFetch({
  ultimaCargaOk = 0,
  hayEnVuelo = false,
  forzar = false,
  ttlMs = 90_000,
  ahora = Date.now()
} = {}) {
  if (hayEnVuelo) return 'en-vuelo'
  if (forzar) return 'ejecutar'
  if (ttlMs > 0 && ultimaCargaOk > 0 && (ahora - ultimaCargaOk) < ttlMs) return 'saltar-ttl'
  return 'ejecutar'
}

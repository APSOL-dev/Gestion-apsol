import { describe, it, expect } from 'vitest'
import { decidirFetch } from '../cachePolitica'

// decidirFetch: decide si una precarga de DataContext tiene que ir a la red,
// saltarse por TTL (ya se trajo hace poco) o adherirse a una carga en curso.
// Es la lógica que hoy falta y hace que la app re-consulte tablas enteras
// en cada navegación.

describe('decidirFetch', () => {
  const AHORA = 1_000_000

  it('ejecuta si nunca se cargó', () => {
    expect(decidirFetch({ ultimaCargaOk: 0, hayEnVuelo: false, ttlMs: 90_000, ahora: AHORA }))
      .toBe('ejecutar')
  })

  it('se adhiere a la carga en curso (single-flight) antes que nada', () => {
    expect(decidirFetch({ ultimaCargaOk: 0, hayEnVuelo: true, ttlMs: 90_000, ahora: AHORA }))
      .toBe('en-vuelo')
    // incluso con forzar: si ya hay una en curso, no lanzamos otra
    expect(decidirFetch({ ultimaCargaOk: 0, hayEnVuelo: true, forzar: true, ttlMs: 90_000, ahora: AHORA }))
      .toBe('en-vuelo')
  })

  it('salta por TTL si se cargó hace menos que ttlMs', () => {
    expect(decidirFetch({ ultimaCargaOk: AHORA - 10_000, hayEnVuelo: false, ttlMs: 90_000, ahora: AHORA }))
      .toBe('saltar-ttl')
  })

  it('ejecuta si el TTL ya venció', () => {
    expect(decidirFetch({ ultimaCargaOk: AHORA - 120_000, hayEnVuelo: false, ttlMs: 90_000, ahora: AHORA }))
      .toBe('ejecutar')
  })

  it('con forzar ignora el TTL (pero no un fetch en curso, ya cubierto arriba)', () => {
    expect(decidirFetch({ ultimaCargaOk: AHORA - 1_000, hayEnVuelo: false, forzar: true, ttlMs: 90_000, ahora: AHORA }))
      .toBe('ejecutar')
  })

  it('ttlMs = 0 desactiva la caché: siempre ejecuta', () => {
    expect(decidirFetch({ ultimaCargaOk: AHORA - 1, hayEnVuelo: false, ttlMs: 0, ahora: AHORA }))
      .toBe('ejecutar')
  })

  it('el borde exacto del TTL ya ejecuta (>=)', () => {
    expect(decidirFetch({ ultimaCargaOk: AHORA - 90_000, hayEnVuelo: false, ttlMs: 90_000, ahora: AHORA }))
      .toBe('ejecutar')
  })
})

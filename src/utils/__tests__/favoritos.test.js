import { describe, test, expect } from 'vitest'
import { normalizarFavoritos, alternarFavorito } from '../favoritos'

// ──────────────────────────────────────────────────────────────
// BUG real: los favoritos/pines del sidebar vivían solo en localStorage
// (clave 'apsol_favorites'), por lo que no persistían entre navegadores
// ni dispositivos, y además se compartían/pisaban entre distintos usuarios
// que usaran el mismo navegador. Ahora se guardan en apsol_usuarios.favoritos
// (por cuenta). normalizarFavoritos sanea lo que viene de la DB (puede ser
// null, no-array, o filas corruptas de antes de este fix); alternarFavorito
// es el toggle puro, extraído de App.jsx para poder testearlo.
// ──────────────────────────────────────────────────────────────
describe('normalizarFavoritos', () => {
  test('devuelve [] si viene null o undefined', () => {
    expect(normalizarFavoritos(null)).toEqual([])
    expect(normalizarFavoritos(undefined)).toEqual([])
  })

  test('devuelve [] si no es un array', () => {
    expect(normalizarFavoritos('no-array')).toEqual([])
    expect(normalizarFavoritos({})).toEqual([])
  })

  test('deja pasar items válidos con to/icon/label como string', () => {
    const items = [{ to: '/cronograma', icon: 'Calendar', label: 'Cronograma' }]
    expect(normalizarFavoritos(items)).toEqual(items)
  })

  test('descarta items corruptos (icon no es string, del bug anterior)', () => {
    const items = [
      { to: '/cronograma', icon: 'Calendar', label: 'Cronograma' },
      { to: '/proyectos', icon: { type: 'svg' }, label: 'Proyectos' },
    ]
    expect(normalizarFavoritos(items)).toEqual([items[0]])
  })
})

describe('alternarFavorito', () => {
  const item = { to: '/proyectos', icon: 'FileText', label: 'Proyectos' }

  test('agrega el item si no está pineado', () => {
    expect(alternarFavorito([], item)).toEqual([item])
  })

  test('quita el item si ya está pineado', () => {
    expect(alternarFavorito([item], item)).toEqual([])
  })

  test('no muta el array original', () => {
    const original = [item]
    alternarFavorito(original, { to: '/tickets', icon: 'Activity', label: 'Tickets' })
    expect(original).toEqual([item])
  })

  test('sanea la lista existente antes de togglear (favoritos corruptos previos)', () => {
    const corruptos = [{ to: '/x', icon: 123, label: 'X' }]
    expect(alternarFavorito(corruptos, item)).toEqual([item])
  })
})

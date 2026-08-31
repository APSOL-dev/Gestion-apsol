import { describe, test, expect } from 'vitest'
import { normalizarContactoId } from '../prospectos'

describe('normalizarContactoId', () => {
  // El campo contacto_id de prospectos dejó de ser obligatorio en el
  // formulario (ahora se muestran todos los contactos de la empresa como
  // lista, no se elige uno solo) - pero la columna en la base sigue siendo
  // UUID. Si se manda un '' (string vacío, lo que trae el estado inicial
  // del form) en vez de null, Postgres lo rechaza con "invalid input syntax
  // for type uuid". Esta función es la que evita que ese string vacío
  // llegue al insert/update.
  test('convierte string vacío a null', () => {
    expect(normalizarContactoId('')).toBe(null)
  })

  test('convierte undefined a null', () => {
    expect(normalizarContactoId(undefined)).toBe(null)
  })

  test('deja pasar un id real sin tocarlo', () => {
    expect(normalizarContactoId('38f7afa7-b708-48d6-99af-439ff6c0ba02')).toBe('38f7afa7-b708-48d6-99af-439ff6c0ba02')
  })
})

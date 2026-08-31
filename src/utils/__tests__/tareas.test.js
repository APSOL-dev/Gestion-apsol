import { describe, test, expect } from 'vitest'
import { TIPOS_TAREA, componerProximaTarea, descomponerProximaTarea } from '../tareas'

describe('componerProximaTarea', () => {
  test('combina tipo y comentario con guion', () => {
    expect(componerProximaTarea('Llamada Comercial', 'Preguntar por presupuesto')).toBe('Llamada Comercial - Preguntar por presupuesto')
  })

  test('solo tipo, sin comentario', () => {
    expect(componerProximaTarea('Llamada Comercial', '')).toBe('Llamada Comercial')
  })

  test('solo comentario, sin tipo', () => {
    expect(componerProximaTarea('', 'Recordar llamar el lunes')).toBe('Recordar llamar el lunes')
  })

  test('ninguno de los dos -> null', () => {
    expect(componerProximaTarea('', '')).toBe(null)
  })
})

describe('descomponerProximaTarea', () => {
  test('separa un texto "Tipo - comentario" en sus dos partes', () => {
    expect(descomponerProximaTarea('Llamada Comercial - Preguntar por presupuesto'))
      .toEqual({ tipo: 'Llamada Comercial', comentario: 'Preguntar por presupuesto' })
  })

  test('un texto que es exactamente un tipo, sin comentario', () => {
    expect(descomponerProximaTarea('Llamada Comercial')).toEqual({ tipo: 'Llamada Comercial', comentario: '' })
  })

  test('un texto libre que no matchea ningún tipo conocido queda todo como comentario', () => {
    expect(descomponerProximaTarea('Algo que el usuario escribió a mano')).toEqual({ tipo: '', comentario: 'Algo que el usuario escribió a mano' })
  })

  test('vacío o null da tipo y comentario vacíos', () => {
    expect(descomponerProximaTarea('')).toEqual({ tipo: '', comentario: '' })
    expect(descomponerProximaTarea(null)).toEqual({ tipo: '', comentario: '' })
  })

  test('es inversa de componerProximaTarea para cualquier tipo conocido', () => {
    for (const tipo of TIPOS_TAREA) {
      const compuesto = componerProximaTarea(tipo, 'un comentario')
      expect(descomponerProximaTarea(compuesto)).toEqual({ tipo, comentario: 'un comentario' })
    }
  })
})

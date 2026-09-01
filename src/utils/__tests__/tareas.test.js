import { describe, test, expect } from 'vitest'
import { TIPOS_TAREA, componerProximaTarea, descomponerProximaTarea } from '../tareas'

describe('TIPOS_TAREA', () => {
  // Los tipos de tarea son los del CRM real (AppSheet), no una lista
  // inventada: Contactar / Enviar Formulario / Enviar presupuesto / 1ra y
  // 2da consulta presupuesto / Ultimátum, más "Otro" para texto libre.
  test('es la lista de acciones comerciales de AppSheet + "Otro"', () => {
    expect(TIPOS_TAREA).toEqual([
      'Contactar',
      'Enviar Formulario',
      'Enviar presupuesto',
      '1ra consulta presupuesto',
      '2da consulta presupuesto',
      'Ultimátum',
      'Otro'
    ])
  })
})

describe('componerProximaTarea', () => {
  test('combina tipo y comentario con guion', () => {
    expect(componerProximaTarea('Contactar', 'Preguntar por presupuesto')).toBe('Contactar - Preguntar por presupuesto')
  })

  test('solo tipo, sin comentario', () => {
    expect(componerProximaTarea('Contactar', '')).toBe('Contactar')
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
    expect(descomponerProximaTarea('Enviar presupuesto - Preguntar por el número de cuenta'))
      .toEqual({ tipo: 'Enviar presupuesto', comentario: 'Preguntar por el número de cuenta' })
  })

  test('un texto que es exactamente un tipo, sin comentario', () => {
    expect(descomponerProximaTarea('2da consulta presupuesto')).toEqual({ tipo: '2da consulta presupuesto', comentario: '' })
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

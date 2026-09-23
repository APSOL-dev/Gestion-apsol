import { describe, test, expect } from 'vitest'
import {
  colaboradoresAsignables,
  responsablePorDefecto,
  formatearFechaTicket,
  colorPrioridadTicket,
} from '../tickets'

const adrian = { id: 'c-adrian', usuario_id: 'u-1', nombre: 'Adrian', apellido: 'Patriarca', activo: true }
const renata = { id: 'c-renata', usuario_id: 'u-2', nombre: 'Renata', apellido: 'Morano', activo: true }
const mantenimiento = { id: 'c-mant', usuario_id: null, nombre: 'Mantenimiento', apellido: '', activo: true }
const exColab = { id: 'c-ex', usuario_id: 'u-9', nombre: 'Felipe', apellido: 'Duarte', activo: false }

describe('colaboradoresAsignables', () => {
  test('solo deja activos que tienen usuario (los únicos que pueden recibir el aviso)', () => {
    const res = colaboradoresAsignables([adrian, mantenimiento, exColab, renata])
    expect(res.map(c => c.id)).toEqual(['c-adrian', 'c-renata'])
  })

  test('tolera lista vacía / undefined', () => {
    expect(colaboradoresAsignables(undefined)).toEqual([])
    expect(colaboradoresAsignables([])).toEqual([])
  })

  test('si el responsable actual ya no es asignable se conserva, marcado, para no mostrar el campo en blanco', () => {
    const res = colaboradoresAsignables([adrian, mantenimiento], 'c-mant')
    expect(res.map(c => c.id)).toEqual(['c-adrian', 'c-mant'])
    expect(res[1].noAsignable).toBe(true)
    expect(res[0].noAsignable).toBeUndefined()
  })

  test('si el responsable actual es asignable no se duplica ni se marca', () => {
    const res = colaboradoresAsignables([adrian, renata], 'c-adrian')
    expect(res).toHaveLength(2)
    expect(res.every(c => !c.noAsignable)).toBe(true)
  })

  test('un responsable actual inexistente en la lista se ignora', () => {
    expect(colaboradoresAsignables([adrian], 'no-existe').map(c => c.id)).toEqual(['c-adrian'])
  })
})

describe('responsablePorDefecto', () => {
  const asignables = colaboradoresAsignables([adrian, renata, mantenimiento])

  test('devuelve el líder del proyecto', () => {
    expect(responsablePorDefecto({ lider_colaborador_id: 'c-renata' }, asignables)).toBe('c-renata')
  })

  test('sin proyecto o sin líder devuelve vacío', () => {
    expect(responsablePorDefecto(null, asignables)).toBe('')
    expect(responsablePorDefecto({ lider_colaborador_id: null }, asignables)).toBe('')
  })

  test('si el líder no es asignable (inactivo o sin usuario) devuelve vacío en vez de asignarlo', () => {
    expect(responsablePorDefecto({ lider_colaborador_id: 'c-mant' }, asignables)).toBe('')
    expect(responsablePorDefecto({ lider_colaborador_id: 'c-ex' }, asignables)).toBe('')
  })
})

describe('formatearFechaTicket', () => {
  test('una fecha sola (YYYY-MM-DD) se muestra tal cual, sin correrse un día por zona horaria', () => {
    expect(formatearFechaTicket('2026-09-23')).toBe('23/9/2026')
    expect(formatearFechaTicket('2026-01-05')).toBe('5/1/2026')
  })

  test('acepta timestamps ISO y toma solo la parte de fecha', () => {
    expect(formatearFechaTicket('2026-09-23T01:00:00+00:00')).toBe('23/9/2026')
  })

  test('valores vacíos o inválidos devuelven guion', () => {
    expect(formatearFechaTicket(null)).toBe('-')
    expect(formatearFechaTicket('')).toBe('-')
    expect(formatearFechaTicket('basura')).toBe('-')
  })
})

describe('colorPrioridadTicket', () => {
  test('cada prioridad tiene su color y Urgente es el más fuerte', () => {
    expect(colorPrioridadTicket('Urgente')).toBe('var(--color-danger)')
    expect(colorPrioridadTicket('Alta')).toBe('var(--color-danger)')
    expect(colorPrioridadTicket('Media')).toBe('var(--color-orange)')
    expect(colorPrioridadTicket('Baja')).toBe('var(--color-text-muted)')
    expect(colorPrioridadTicket(undefined)).toBe('var(--color-text-muted)')
  })
})

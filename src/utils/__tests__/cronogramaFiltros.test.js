import { describe, test, expect } from 'vitest'
import {
  personalVisible,
  prospectosFiltrables,
  podarSeleccion,
  esColaboradorConciliacion
} from '../cronogramaFiltros'

// El tilde "Ver histórico" de la barra del Cronograma gobierna las DOS
// listas (Personal y Prospectos): apagado muestra solo lo vigente
// (colaboradores activos + prospectos en producción); encendido suma los
// ex-colaboradores de baja y los prospectos finalizados. Los stubs de
// conciliación de la migración de AppSheet ("(sheet id …)") nunca van.

const COLABS = [
  { id: 'a', nombre: 'Adrian', apellido: 'Patriarca', activo: true },
  { id: 'r', nombre: 'Renata', apellido: 'Morano', activo: true },
  { id: 'm', nombre: 'Mantenimiento', apellido: '', activo: true },
  { id: 'f', nombre: 'Felipe', apellido: 'Duarte', activo: false },
  { id: 'ro', nombre: 'Rocío', apellido: 'Franco', activo: false },
  { id: 's1', nombre: '(sheet id 3)', apellido: '', activo: false },
  { id: 's2', nombre: '(sheet id f927515a)', apellido: '', activo: false }
]

const PROSPECTOS = [
  { id: 'p1', nombre: 'DG 2026', estado: '6A - En producción' },
  { id: 'p2', nombre: 'DG', estado: '5H - Finalizados' },
  { id: 'p3', nombre: 'Un caído', estado: '3H - Caído luego del presupuesto' },
  { id: 'p4', nombre: 'Escobar', estado: '6A - En producción' }
]

describe('personalVisible', () => {
  test('por defecto (verHistorico=false): solo colaboradores activos, sin stubs de conciliación', () => {
    expect(personalVisible(COLABS, false).map(c => c.id)).toEqual(['a', 'r', 'm'])
  })

  test('con verHistorico=true: suma los de baja, pero NUNCA los stubs de conciliación', () => {
    expect(personalVisible(COLABS, true).map(c => c.id)).toEqual(['a', 'r', 'm', 'f', 'ro'])
  })

  test('oculta solo a quien está EXPLÍCITAMENTE de baja (activo === false); sin el dato, se muestra', () => {
    const sinDato = [
      { id: 'x', nombre: 'Sin', apellido: 'Dato' },        // activo undefined -> visible
      { id: 'y', nombre: 'De', apellido: 'Baja', activo: false }
    ]
    expect(personalVisible(sinDato, false).map(c => c.id)).toEqual(['x'])
  })

  test('tolera lista vacía / nula', () => {
    expect(personalVisible([], false)).toEqual([])
    expect(personalVisible(null, true)).toEqual([])
  })
})

describe('prospectosFiltrables', () => {
  test('por defecto: solo "6A - En producción"', () => {
    expect(prospectosFiltrables(PROSPECTOS, false).map(p => p.id)).toEqual(['p1', 'p4'])
  })

  test('con verHistorico: suma "5H - Finalizados" (nunca los caídos ni otros estados)', () => {
    expect(prospectosFiltrables(PROSPECTOS, true).map(p => p.id)).toEqual(['p1', 'p2', 'p4'])
  })

  test('tolera lista vacía / nula', () => {
    expect(prospectosFiltrables(null, true)).toEqual([])
  })
})

describe('podarSeleccion', () => {
  const visibles = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  test('quita los ids que ya no están entre las opciones visibles', () => {
    expect(podarSeleccion(['a', 'x', 'c'], visibles)).toEqual(['a', 'c'])
  })

  test('si no hay que podar nada, devuelve el MISMO array (evita re-render de gusto)', () => {
    const sel = ['a', 'b']
    expect(podarSeleccion(sel, visibles)).toBe(sel)
  })

  test('selección vacía queda vacía', () => {
    expect(podarSeleccion([], visibles)).toEqual([])
  })

  test('tolera opciones nulas', () => {
    expect(podarSeleccion(['a'], null)).toEqual([])
  })
})

describe('esColaboradorConciliacion', () => {
  test('detecta los stubs "(sheet id …)" y nada más', () => {
    expect(esColaboradorConciliacion({ nombre: '(sheet id b2e3d434)' })).toBe(true)
    expect(esColaboradorConciliacion({ nombre: 'Felipe' })).toBe(false)
    expect(esColaboradorConciliacion({ nombre: 'Mantenimiento' })).toBe(false)
    expect(esColaboradorConciliacion({})).toBe(false)
    expect(esColaboradorConciliacion(null)).toBe(false)
  })
})

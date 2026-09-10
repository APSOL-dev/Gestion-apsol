import { describe, test, expect } from 'vitest'
import { opcionesDeFiltro, filtrarSprints } from '../sprints-filtros'

// Sprints con la forma que devuelve getSprints* una vez que incluye
// proyecto -> prospecto -> empresa.
const SPRINTS = [
  {
    id: 's1', numero: 1,
    proyecto: { id: 'py1', nombre: 'Portal', prospecto: { id: 'pr1', nombre: 'Amipack', empresa: { id: 'e1', nombre: 'Amipack SA' } } },
  },
  {
    id: 's2', numero: 1,
    proyecto: { id: 'py2', nombre: 'Tablero', prospecto: { id: 'pr2', nombre: 'Norte', empresa: { id: 'e2', nombre: 'El Norte' } } },
  },
  {
    id: 's3', numero: 2,
    proyecto: { id: 'py1', nombre: 'Portal', prospecto: { id: 'pr1', nombre: 'Amipack', empresa: { id: 'e1', nombre: 'Amipack SA' } } },
  },
  // sprint sin prospecto/empresa cargada (proyecto interno o dato incompleto)
  {
    id: 's4', numero: 1,
    proyecto: { id: 'py3', nombre: 'Interno', prospecto: null },
  },
]

describe('opcionesDeFiltro', () => {
  test('devuelve proyectos, prospectos y empresas únicos y ordenados por nombre', () => {
    const o = opcionesDeFiltro(SPRINTS)
    expect(o.proyectos).toEqual([
      { id: 'py3', nombre: 'Interno' },
      { id: 'py1', nombre: 'Portal' },
      { id: 'py2', nombre: 'Tablero' },
    ])
    expect(o.prospectos).toEqual([
      { id: 'pr1', nombre: 'Amipack' },
      { id: 'pr2', nombre: 'Norte' },
    ])
    expect(o.empresas).toEqual([
      { id: 'e1', nombre: 'Amipack SA' },
      { id: 'e2', nombre: 'El Norte' },
    ])
  })

  test('lista vacía / no-array => opciones vacías', () => {
    expect(opcionesDeFiltro(null)).toEqual({ proyectos: [], prospectos: [], empresas: [] })
  })
})

describe('filtrarSprints', () => {
  test('sin filtros devuelve todo', () => {
    expect(filtrarSprints(SPRINTS, {}).map(s => s.id)).toEqual(['s1', 's2', 's3', 's4'])
  })

  test('filtra por proyecto (uno o varios)', () => {
    expect(filtrarSprints(SPRINTS, { proyectoIds: ['py1'] }).map(s => s.id)).toEqual(['s1', 's3'])
    expect(filtrarSprints(SPRINTS, { proyectoIds: ['py1', 'py2'] }).map(s => s.id)).toEqual(['s1', 's2', 's3'])
  })

  test('filtra por prospecto', () => {
    expect(filtrarSprints(SPRINTS, { prospectoIds: ['pr2'] }).map(s => s.id)).toEqual(['s2'])
  })

  test('filtra por empresa', () => {
    expect(filtrarSprints(SPRINTS, { empresaIds: ['e1'] }).map(s => s.id)).toEqual(['s1', 's3'])
  })

  test('varios filtros se combinan con AND', () => {
    expect(filtrarSprints(SPRINTS, { proyectoIds: ['py1'], empresaIds: ['e2'] })).toEqual([])
    expect(filtrarSprints(SPRINTS, { proyectoIds: ['py1'], prospectoIds: ['pr1'] }).map(s => s.id)).toEqual(['s1', 's3'])
  })

  test('un sprint sin prospecto queda fuera si hay filtro de prospecto o empresa', () => {
    expect(filtrarSprints(SPRINTS, { prospectoIds: ['pr1'] }).some(s => s.id === 's4')).toBe(false)
    expect(filtrarSprints(SPRINTS, { proyectoIds: ['py3'] }).map(s => s.id)).toEqual(['s4'])
  })
})

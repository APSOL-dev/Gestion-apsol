import { describe, test, expect } from 'vitest'
import {
  puedeVerTodo, proyectoVisiblePara, sprintVisiblePara, filtrarPorAsignacion,
} from '../sprints-permisos'

describe('puedeVerTodo', () => {
  test('Dueño/Admin y Team Lead ven todo', () => {
    expect(puedeVerTodo({ esDuenio: true, esTeamLead: false })).toBe(true)
    expect(puedeVerTodo({ esDuenio: false, esTeamLead: true })).toBe(true)
  })
  test('un colaborador raso no ve todo', () => {
    expect(puedeVerTodo({ esDuenio: false, esTeamLead: false })).toBe(false)
  })
})

describe('proyectoVisiblePara', () => {
  const asignados = ['pr1', 'pr2']

  test('si ve todo, cualquier proyecto es visible', () => {
    expect(proyectoVisiblePara({ prospecto_id: 'pr9' }, { verTodo: true, prospectosAsignados: [] })).toBe(true)
  })
  test('colaborador: visible solo si el prospecto del proyecto está entre los asignados', () => {
    expect(proyectoVisiblePara({ prospecto_id: 'pr1' }, { verTodo: false, prospectosAsignados: asignados })).toBe(true)
    expect(proyectoVisiblePara({ prospecto_id: 'pr9' }, { verTodo: false, prospectosAsignados: asignados })).toBe(false)
  })
  test('acepta el prospecto anidado (proyecto.prospecto.id o proyecto.prospectos.id)', () => {
    expect(proyectoVisiblePara({ prospecto: { id: 'pr2' } }, { verTodo: false, prospectosAsignados: asignados })).toBe(true)
    expect(proyectoVisiblePara({ prospectos: { id: 'pr2' } }, { verTodo: false, prospectosAsignados: asignados })).toBe(true)
  })
  test('proyecto sin prospecto: solo lo ve quien ve todo', () => {
    expect(proyectoVisiblePara({ prospecto_id: null }, { verTodo: false, prospectosAsignados: asignados })).toBe(false)
    expect(proyectoVisiblePara({ prospecto_id: null }, { verTodo: true, prospectosAsignados: [] })).toBe(true)
  })
})

describe('sprintVisiblePara', () => {
  const asignados = ['pr1']
  test('mira el prospecto del proyecto del sprint', () => {
    const sOk = { proyecto: { prospecto: { id: 'pr1' } } }
    const sNo = { proyecto: { prospecto: { id: 'pr2' } } }
    expect(sprintVisiblePara(sOk, { verTodo: false, prospectosAsignados: asignados })).toBe(true)
    expect(sprintVisiblePara(sNo, { verTodo: false, prospectosAsignados: asignados })).toBe(false)
    expect(sprintVisiblePara(sNo, { verTodo: true, prospectosAsignados: [] })).toBe(true)
  })
})

describe('filtrarPorAsignacion', () => {
  const sprints = [
    { id: 's1', proyecto: { prospecto: { id: 'pr1' } } },
    { id: 's2', proyecto: { prospecto: { id: 'pr2' } } },
    { id: 's3', proyecto: { prospecto: null } },
  ]
  test('ve todo => no filtra', () => {
    expect(filtrarPorAsignacion(sprints, { verTodo: true, prospectosAsignados: [] }).map(s => s.id))
      .toEqual(['s1', 's2', 's3'])
  })
  test('colaborador => solo los de sus prospectos', () => {
    expect(filtrarPorAsignacion(sprints, { verTodo: false, prospectosAsignados: ['pr2'] }).map(s => s.id))
      .toEqual(['s2'])
  })
})

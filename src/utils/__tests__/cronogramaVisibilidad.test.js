import { describe, it, expect } from 'vitest'
import {
  clasificarActividadCronograma, esReunionCronograma, redactarActividadOcupada,
  esActividadOcupada, filtrarCronogramaVisible, esCargoAdmin,
  normalizarResponsableEInvitados,
  diasHabilesEntre, colaboradorPuedeEditarActividad
} from '../cronogramaVisibilidad'

describe('colaboradorPuedeEditarActividad', () => {
  it('puede editar una actividad que todavía no terminó', () => {
    const ahora = new Date('2026-09-02T10:00:00')
    expect(colaboradorPuedeEditarActividad('2026-09-02T18:00:00', ahora)).toBe(true)
  })

  it('puede editar una actividad de hoy que ya terminó (0 días hábiles)', () => {
    const ahora = new Date('2026-09-02T20:00:00')
    expect(colaboradorPuedeEditarActividad('2026-09-02T18:00:00', ahora)).toBe(true)
  })

  it('puede editar hasta 2 días hábiles después de que terminó', () => {
    // terminó el miércoles 2026-09-02; "ahora" viernes 2026-09-04 -> 2 días hábiles
    expect(colaboradorPuedeEditarActividad('2026-09-02T18:00:00', new Date('2026-09-04T09:00:00'))).toBe(true)
  })

  it('NO puede editar pasados más de 2 días hábiles', () => {
    // terminó miércoles 2026-09-02; "ahora" lunes 2026-09-08 -> jue, vie, lun = 3 días hábiles
    expect(colaboradorPuedeEditarActividad('2026-09-02T18:00:00', new Date('2026-09-08T09:00:00'))).toBe(false)
  })

  it('el fin de semana no cuenta como días hábiles', () => {
    // terminó viernes 2026-09-04; "ahora" lunes 2026-09-07 -> solo el lunes = 1 día hábil
    expect(colaboradorPuedeEditarActividad('2026-09-04T18:00:00', new Date('2026-09-07T09:00:00'))).toBe(true)
  })

  it('fin inválido -> no bloquea', () => {
    expect(colaboradorPuedeEditarActividad('', new Date())).toBe(true)
  })
})

describe('diasHabilesEntre', () => {
  it('mismo día -> 0', () => {
    expect(diasHabilesEntre(new Date('2026-09-02T08:00'), new Date('2026-09-02T23:00'))).toBe(0)
  })
  it('miércoles a viernes -> 2', () => {
    expect(diasHabilesEntre(new Date('2026-09-02'), new Date('2026-09-04'))).toBe(2)
  })
  it('viernes a lunes -> 1 (salta sáb/dom)', () => {
    expect(diasHabilesEntre(new Date('2026-09-04'), new Date('2026-09-07'))).toBe(1)
  })
})

const ADMIN = 'colab-admin'
const YO = 'colab-mateo'
const OTRO = 'colab-renata'
const ctxColab = { miColaboradorId: YO, soyAdmin: false, adminColaboradorIds: [ADMIN] }

function act(over = {}) {
  return {
    id: 'a1', inicio: '2026-08-10T14:00:00Z', fin: '2026-08-10T15:00:00Z',
    responsable_id: ADMIN, participantes_ids: [], reunion_cliente: false,
    link_reunion: null, descripcion: 'Trabajo interno', prospecto_id: 'p1', ...over
  }
}

describe('esReunionCronograma', () => {
  it('true si reunion_cliente, o hay link, o hay participantes', () => {
    expect(esReunionCronograma(act({ reunion_cliente: true }))).toBe(true)
    expect(esReunionCronograma(act({ link_reunion: 'https://meet...' }))).toBe(true)
    expect(esReunionCronograma(act({ participantes_ids: [OTRO] }))).toBe(true)
  })
  it('false para un bloque de trabajo pelado', () => {
    expect(esReunionCronograma(act())).toBe(false)
    expect(esReunionCronograma(act({ link_reunion: '   ' }))).toBe(false)
  })
})

describe('clasificarActividadCronograma — Colaborador mirando al Admin', () => {
  it('reunión del Admin en la que NO participo -> "ocupado"', () => {
    expect(clasificarActividadCronograma(act({ reunion_cliente: true }), ctxColab)).toBe('ocupado')
    expect(clasificarActividadCronograma(act({ link_reunion: 'x' }), ctxColab)).toBe('ocupado')
    expect(clasificarActividadCronograma(act({ participantes_ids: [OTRO] }), ctxColab)).toBe('ocupado')
  })

  it('bloque de trabajo del Admin (no-reunión) en el que NO participo -> "oculta"', () => {
    expect(clasificarActividadCronograma(act(), ctxColab)).toBe('oculta')
  })

  it('actividad del Admin donde soy responsable -> "completa"', () => {
    expect(clasificarActividadCronograma(act({ responsable_id: YO }), ctxColab)).toBe('completa')
  })

  it('reunión del Admin donde estoy en participantes_ids -> "completa"', () => {
    expect(clasificarActividadCronograma(act({ reunion_cliente: true, participantes_ids: [YO] }), ctxColab)).toBe('completa')
  })
})

describe('clasificarActividadCronograma — otras combinaciones', () => {
  it('actividad de OTRO colaborador -> siempre "completa" (aunque sea trabajo interno)', () => {
    expect(clasificarActividadCronograma(act({ responsable_id: OTRO }), ctxColab)).toBe('completa')
    expect(clasificarActividadCronograma(act({ responsable_id: OTRO, reunion_cliente: true }), ctxColab)).toBe('completa')
  })

  it('un Admin ve todo "completa"', () => {
    const ctxAdmin = { miColaboradorId: ADMIN, soyAdmin: true, adminColaboradorIds: [ADMIN] }
    expect(clasificarActividadCronograma(act(), ctxAdmin)).toBe('completa')
    expect(clasificarActividadCronograma(act({ responsable_id: OTRO }), ctxAdmin)).toBe('completa')
  })

  it('Colaborador sin fila propia (miColaboradorId null): reunión Admin -> ocupado, trabajo Admin -> oculta', () => {
    const ctx = { miColaboradorId: null, soyAdmin: false, adminColaboradorIds: [ADMIN] }
    expect(clasificarActividadCronograma(act({ reunion_cliente: true }), ctx)).toBe('ocupado')
    expect(clasificarActividadCronograma(act(), ctx)).toBe('oculta')
    expect(clasificarActividadCronograma(act({ responsable_id: OTRO }), ctx)).toBe('completa')
  })

  it('acepta adminColaboradorIds como Set', () => {
    const ctx = { miColaboradorId: YO, soyAdmin: false, adminColaboradorIds: new Set([ADMIN]) }
    expect(clasificarActividadCronograma(act({ reunion_cliente: true }), ctx)).toBe('ocupado')
  })
})

describe('redactarActividadOcupada / esActividadOcupada', () => {
  it('deja solo tiempo + responsable, borra lo sensible', () => {
    const r = redactarActividadOcupada(act({ reunion_cliente: true, link_reunion: 'https://x', comentarios_reunion: 'secreto' }))
    expect(r).toMatchObject({
      id: 'a1', inicio: '2026-08-10T14:00:00Z', fin: '2026-08-10T15:00:00Z',
      responsable_id: ADMIN, descripcion: 'Ocupado', prospecto_id: null,
      link_reunion: null, comentarios_reunion: null, ocupado: true
    })
    expect(r).not.toHaveProperty('herramientas')
  })

  it('esActividadOcupada reconoce la marca', () => {
    expect(esActividadOcupada(redactarActividadOcupada(act()))).toBe(true)
    expect(esActividadOcupada(act())).toBe(false)
  })
})

describe('filtrarCronogramaVisible', () => {
  it('para un Colaborador: descarta trabajo del Admin, redacta reuniones del Admin, deja el resto', () => {
    const lista = [
      act({ id: 'trabajo-admin' }),                                   // oculta
      act({ id: 'reunion-admin', reunion_cliente: true }),            // ocupado
      act({ id: 'mia', responsable_id: YO }),                          // completa
      act({ id: 'de-renata', responsable_id: OTRO }),                  // completa
      act({ id: 'reunion-compartida', reunion_cliente: true, participantes_ids: [YO] }) // completa
    ]
    const out = filtrarCronogramaVisible(lista, ctxColab)
    expect(out.map(a => a.id)).toEqual(['reunion-admin', 'mia', 'de-renata', 'reunion-compartida'])
    const ocupado = out.find(a => a.id === 'reunion-admin')
    expect(ocupado.descripcion).toBe('Ocupado')
    expect(ocupado.prospecto_id).toBeNull()
    expect(out.find(a => a.id === 'mia').descripcion).toBe('Trabajo interno') // intacta
  })

  it('para un Admin: no toca nada', () => {
    const lista = [act(), act({ responsable_id: OTRO })]
    const out = filtrarCronogramaVisible(lista, { soyAdmin: true, adminColaboradorIds: [ADMIN] })
    expect(out).toHaveLength(2)
    expect(out[0].descripcion).toBe('Trabajo interno')
  })
})

describe('esCargoAdmin', () => {
  it('Admin y Dueño', () => {
    expect(esCargoAdmin('Admin')).toBe(true)
    expect(esCargoAdmin('Dueño')).toBe(true)
    expect(esCargoAdmin('Colaborador')).toBe(false)
    expect(esCargoAdmin(undefined)).toBe(false)
  })
})

describe('normalizarResponsableEInvitados', () => {
  it('Colaborador: siempre queda él de responsable, ignorando lo que haya elegido', () => {
    const r = normalizarResponsableEInvitados(
      { responsable_id: OTRO, participantes_ids: [] },
      { esColaborador: true, miColaboradorId: YO }
    )
    expect(r.responsable_id).toBe(YO)
  })

  it('Colaborador: a lo sumo 1 invitado, y nunca él mismo', () => {
    const r = normalizarResponsableEInvitados(
      { participantes_ids: [YO, OTRO, ADMIN] },
      { esColaborador: true, miColaboradorId: YO }
    )
    expect(r.participantes_ids).toEqual([OTRO]) // sacó a YO y cortó en 1
  })

  it('Admin: mantiene responsable elegido y varios invitados, sin el responsable ni duplicados', () => {
    const r = normalizarResponsableEInvitados(
      { responsable_id: ADMIN, participantes_ids: [OTRO, YO, OTRO, ADMIN] },
      { esColaborador: false, miColaboradorId: ADMIN }
    )
    expect(r.responsable_id).toBe(ADMIN)
    expect(r.participantes_ids).toEqual([OTRO, YO])
  })

  it('tolera participantes_ids ausente / no-array', () => {
    expect(normalizarResponsableEInvitados({ responsable_id: OTRO }, { esColaborador: false }).participantes_ids).toEqual([])
    expect(normalizarResponsableEInvitados({ participantes_ids: null }, { esColaborador: true, miColaboradorId: YO }).participantes_ids).toEqual([])
  })

  it('Colaborador sin fila propia (miColaboradorId null): deja el responsable como venía', () => {
    const r = normalizarResponsableEInvitados(
      { responsable_id: OTRO, participantes_ids: [ADMIN] },
      { esColaborador: true, miColaboradorId: null }
    )
    expect(r.responsable_id).toBe(OTRO)
    expect(r.participantes_ids).toEqual([ADMIN])
  })
})

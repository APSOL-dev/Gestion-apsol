import { describe, it, expect } from 'vitest'
import {
  planificarMantenimientoMes,
  rangoDelMes,
  mesActual,
  DESCRIPCION_MANTENIMIENTO,
  RESPONSABLE_MANTENIMIENTO_ID,
  ORIGEN_MANTENIMIENTO,
} from '../mantenimiento'

describe('constantes', () => {
  it('coinciden con lo que se venía cargando a mano', () => {
    expect(DESCRIPCION_MANTENIMIENTO).toBe('Mantenimiento Activos')
    expect(RESPONSABLE_MANTENIMIENTO_ID).toBe('77dd95fd-c818-4382-8f4b-5be453dd68f1')
    expect(ORIGEN_MANTENIMIENTO).toBe('mantenimiento_mensual')
  })
})

describe('mesActual', () => {
  it('devuelve YYYY-MM de la fecha dada', () => {
    expect(mesActual(new Date(2026, 2, 15))).toBe('2026-03')
    expect(mesActual(new Date(2026, 11, 1))).toBe('2026-12')
  })
})

describe('rangoDelMes', () => {
  it('desde = día 1 00:00, hasta = día 1 del mes siguiente 00:00', () => {
    expect(rangoDelMes('2026-10')).toEqual({ desde: '2026-10-01T00:00', hasta: '2026-11-01T00:00' })
    expect(rangoDelMes('2026-12')).toEqual({ desde: '2026-12-01T00:00', hasta: '2027-01-01T00:00' })
  })
  it('mes inválido -> null', () => {
    expect(rangoDelMes('')).toBeNull()
    expect(rangoDelMes('2026-13')).toBeNull()
    expect(rangoDelMes('octubre')).toBeNull()
  })
})

describe('planificarMantenimientoMes', () => {
  it('un bloque por cliente: día 1 a las 00:00, fin = +horas, todos se pisan', () => {
    const plan = planificarMantenimientoMes({
      mes: '2026-10',
      items: [
        { prospecto_id: 'norte', horas: 12 },
        { prospecto_id: 'dg', horas: 7 },
      ],
    })
    expect(plan).toEqual([
      {
        prospecto_id: 'norte',
        inicio: '2026-10-01T00:00',
        fin: '2026-10-01T12:00',
        duracion_horas: 12,
        descripcion: 'Mantenimiento Activos',
      },
      {
        prospecto_id: 'dg',
        inicio: '2026-10-01T00:00',
        fin: '2026-10-01T07:00',
        duracion_horas: 7,
        descripcion: 'Mantenimiento Activos',
      },
    ])
  })

  it('horas fraccionarias', () => {
    const [b] = planificarMantenimientoMes({ mes: '2026-10', items: [{ prospecto_id: 'x', horas: 2.5 }] })
    expect(b.fin).toBe('2026-10-01T02:30')
    expect(b.duracion_horas).toBe(2.5)
  })

  it('más de 24 h: el fin se pasa al día siguiente (no importa)', () => {
    const [b] = planificarMantenimientoMes({ mes: '2026-10', items: [{ prospecto_id: 'x', horas: 30 }] })
    expect(b.fin).toBe('2026-10-02T06:00')
  })

  it('el 1 puede caer domingo y va igual (sin lógica de día hábil)', () => {
    // 2026-11-01 es domingo
    const [b] = planificarMantenimientoMes({ mes: '2026-11', items: [{ prospecto_id: 'x', horas: 3 }] })
    expect(b.inicio).toBe('2026-11-01T00:00')
    expect(b.fin).toBe('2026-11-01T03:00')
  })

  it('descarta items sin cliente o con horas <= 0', () => {
    const plan = planificarMantenimientoMes({
      mes: '2026-10',
      items: [
        { prospecto_id: 'ok', horas: 4 },
        { prospecto_id: '', horas: 4 },
        { prospecto_id: 'cero', horas: 0 },
        { prospecto_id: 'neg', horas: -2 },
        { prospecto_id: 'nan', horas: 'x' },
      ],
    })
    expect(plan.map(p => p.prospecto_id)).toEqual(['ok'])
  })

  it('mes inválido o sin items -> []', () => {
    expect(planificarMantenimientoMes({ mes: 'nope', items: [{ prospecto_id: 'a', horas: 1 }] })).toEqual([])
    expect(planificarMantenimientoMes({ mes: '2026-10', items: [] })).toEqual([])
    expect(planificarMantenimientoMes({})).toEqual([])
  })
})

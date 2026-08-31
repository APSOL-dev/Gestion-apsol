import { describe, it, expect } from 'vitest'
import { restarDiasHabiles } from '../fecha'
import { ventanaFacturaAbierta } from '../facturasColaborador'

describe('restarDiasHabiles', () => {
  it('resta días hábiles salteando sábado y domingo', () => {
    // 2026-09-01 es martes -> -1 lunes 31/08 -> -2 viernes 28/08
    expect(restarDiasHabiles('2026-09-01', 2)).toBe('2026-08-28')
  })
  it('desde un lunes, -2 hábiles cae el jueves anterior', () => {
    // 2026-08-31 lunes -> -1 viernes 28 -> -2 jueves 27
    expect(restarDiasHabiles('2026-08-31', 2)).toBe('2026-08-27')
  })
  it('n <= 0 devuelve la misma fecha; fecha inválida devuelve ""', () => {
    expect(restarDiasHabiles('2026-09-01', 0)).toBe('2026-09-01')
    expect(restarDiasHabiles('', 2)).toBe('')
  })
})

describe('ventanaFacturaAbierta', () => {
  const base = { proximaFechaPago: '2026-09-01', facturas: [{ fecha_pago: '2026-08-01' }] }

  it('cerrada si no hay próxima fecha de pago', () => {
    const r = ventanaFacturaAbierta({ ...base, proximaFechaPago: null })
    expect(r).toMatchObject({ abierta: false, motivo: 'sin-fecha' })
  })

  it('cerrada (en espera) antes de los 2 días hábiles previos', () => {
    const r = ventanaFacturaAbierta({ ...base, hoy: '2026-08-27' })
    expect(r).toMatchObject({ abierta: false, motivo: 'espera', desde: '2026-08-28' })
  })

  it('abierta desde 2 días hábiles antes del pago', () => {
    const r = ventanaFacturaAbierta({ ...base, hoy: '2026-08-28' })
    expect(r).toMatchObject({ abierta: true, motivo: 'abierta', desde: '2026-08-28' })
  })

  it('cerrada si ya hay una factura sin fecha de pago (pendiente de cobro)', () => {
    const r = ventanaFacturaAbierta({
      proximaFechaPago: '2026-09-01',
      facturas: [{ fecha_pago: '2026-08-01' }, { fecha_pago: null }],
      hoy: '2026-08-31',
    })
    expect(r).toMatchObject({ abierta: false, motivo: 'pendiente' })
  })
})

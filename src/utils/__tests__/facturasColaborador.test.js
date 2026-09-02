import { describe, it, expect } from 'vitest'
import { restarDiasHabiles } from '../fecha'
import {
  ventanaFacturaAbierta, facturaPendientePago, prepararPagoFactura,
  debeNotificarPagoColaborador,
} from '../facturasColaborador'

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

describe('facturaPendientePago', () => {
  it('true cuando la factura todavía no tiene fecha de pago', () => {
    expect(facturaPendientePago({ monto: 1000, fecha_pago: null })).toBe(true)
    expect(facturaPendientePago({ monto: 1000 })).toBe(true)
    expect(facturaPendientePago({ monto: 1000, fecha_pago: '' })).toBe(true)
  })

  it('false cuando ya tiene fecha de pago (con o sin sufijo horario)', () => {
    expect(facturaPendientePago({ monto: 1000, fecha_pago: '2026-08-02' })).toBe(false)
    expect(facturaPendientePago({ monto: 1000, fecha_pago: '2026-08-02T00:00:00' })).toBe(false)
  })
})

describe('prepararPagoFactura', () => {
  const factura = {
    id: 'f1',
    monto: 560000,
    fecha_factura: '2026-07-30T00:00:00',
    fecha_pago: null,
    comprobante_pago: '',
  }

  it('propone la fecha de pago de HOY cuando la factura no tiene una', () => {
    expect(prepararPagoFactura(factura, '2026-09-02').fecha_pago).toBe('2026-09-02')
  })

  it('normaliza la fecha de factura a YYYY-MM-DD y conserva id y monto', () => {
    expect(prepararPagoFactura(factura, '2026-09-02')).toMatchObject({
      id: 'f1',
      monto: 560000,
      fecha_factura: '2026-07-30',
    })
  })

  it('respeta una fecha de pago ya cargada (no la pisa con hoy)', () => {
    const form = prepararPagoFactura({ ...factura, fecha_pago: '2026-08-02' }, '2026-09-02')
    expect(form.fecha_pago).toBe('2026-08-02')
  })

  it('usa la fecha local de hoy si no se pasa una fecha explícita', () => {
    expect(prepararPagoFactura(factura).fecha_pago).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('debeNotificarPagoColaborador', () => {
  it('true cuando la factura pasó de pendiente a tener fecha de pago', () => {
    expect(debeNotificarPagoColaborador(
      { id: 'f1', fecha_pago: null },
      { id: 'f1', fecha_pago: '2026-09-02' },
    )).toBe(true)
  })

  it('false si ya estaba pagada antes (no re-notifica al editar un dato)', () => {
    expect(debeNotificarPagoColaborador(
      { id: 'f1', fecha_pago: '2026-08-02' },
      { id: 'f1', fecha_pago: '2026-08-02', comprobante_pago: 'x.pdf' },
    )).toBe(false)
  })

  it('false si sigue sin fecha de pago después de guardar', () => {
    expect(debeNotificarPagoColaborador(
      { id: 'f1', fecha_pago: null },
      { id: 'f1', fecha_pago: null, monto: 999 },
    )).toBe(false)
  })

  it('false si no hay estado previo (alta de factura, no un pago)', () => {
    expect(debeNotificarPagoColaborador(undefined, { id: 'f1', fecha_pago: '2026-09-02' })).toBe(false)
  })
})

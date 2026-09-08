import { describe, it, expect } from 'vitest'
import { armarDatosInvoice, formatearMontoInvoice, fechaInvoice } from '../invoicePdf'

describe('fechaInvoice', () => {
  it('pasa YYYY-MM-DD (o ISO con hora) a DD/MM/YYYY', () => {
    expect(fechaInvoice('2026-07-08')).toBe('08/07/2026')
    expect(fechaInvoice('2026-07-08T00:00:00+00:00')).toBe('08/07/2026')
  })
  it('vacío o basura -> ""', () => {
    expect(fechaInvoice('')).toBe('')
    expect(fechaInvoice(null)).toBe('')
    expect(fechaInvoice('no es fecha')).toBe('')
  })
})

describe('formatearMontoInvoice', () => {
  it('formatea es-AR con 2 decimales y sufijo " $"', () => {
    expect(formatearMontoInvoice(110)).toBe('110,00 $')
    expect(formatearMontoInvoice(1234.5)).toBe('1.234,50 $')
    expect(formatearMontoInvoice('110')).toBe('110,00 $')
  })
  it('nulo / NaN -> "0,00 $"', () => {
    expect(formatearMontoInvoice(null)).toBe('0,00 $')
    expect(formatearMontoInvoice(undefined)).toBe('0,00 $')
    expect(formatearMontoInvoice('x')).toBe('0,00 $')
  })
})

describe('armarDatosInvoice', () => {
  const factura = {
    numero_factura: '355',
    fecha_emision: '2026-07-08',
    periodo_desde: '2026-06-06',
    periodo_hasta: '2026-07-06',
    fecha_vencimiento: '2026-07-14',
    leyenda: 'SERVICIO DE MANTENIMIENTO DE APP - 0 hs. Periodo: 06/06/26 - 06/07/26',
    notas: 'Sin observaciones particulares',
    monto_neto: 110,
  }
  const prospecto = { nombre: 'OTRV 2026', empresas: { nombre: 'OnTheRoad viajes' } }
  const cuenta = {
    titular: 'Adrian Carlos Patriarca',
    banco: 'Lead Bank',
    moneda: 'USD',
    direccion_banco: '1801 Main St, Kansas City, MO, 64108',
    numero_ruta_aba: '101019644',
    codigo_swift: '',
    numero_cuenta_intl: '212606055954',
    cbu: '000',
  }

  it('mapea el caso completo como el invoice de referencia', () => {
    expect(armarDatosInvoice({ factura, prospecto, cuenta })).toEqual({
      numero: '355',
      fecha: '08/07/2026',
      cliente: 'OnTheRoad viajes',
      periodoDesde: '06/06/2026',
      periodoHasta: '06/07/2026',
      vencimiento: '14/07/2026',
      detalle: 'SERVICIO DE MANTENIMIENTO DE APP - 0 hs. Periodo: 06/06/26 - 06/07/26',
      montoTotal: '110,00 $',
      observaciones: 'Sin observaciones particulares',
      cuenta: {
        titular: 'Adrian Carlos Patriarca',
        banco: 'Lead Bank',
        moneda: 'USD',
        direccionBanco: '1801 Main St, Kansas City, MO, 64108',
        aba: '101019644',
        swift: '-',
        numeroCuenta: '212606055954',
      },
    })
  })

  it('cliente: usa razón social de la empresa; si no hay, el nombre del prospecto; si no, "Cliente"', () => {
    expect(armarDatosInvoice({ factura, prospecto: { nombre: 'X' } }).cliente).toBe('X')
    expect(armarDatosInvoice({ factura, prospecto: null }).cliente).toBe('Cliente')
  })

  it('monto: toma monto_neto y si no monto', () => {
    expect(armarDatosInvoice({ factura: { monto: 200 } }).montoTotal).toBe('200,00 $')
    expect(armarDatosInvoice({ factura: { monto_neto: 50, monto: 999 } }).montoTotal).toBe('50,00 $')
  })

  it('sin cuenta seleccionada -> cuenta: null', () => {
    expect(armarDatosInvoice({ factura, prospecto }).cuenta).toBeNull()
  })

  it('campos de cuenta vacíos se muestran como "-" (nunca undefined)', () => {
    const r = armarDatosInvoice({ factura, prospecto, cuenta: { titular: 'A' } })
    expect(r.cuenta).toEqual({
      titular: 'A', banco: '-', moneda: '-', direccionBanco: '-',
      aba: '-', swift: '-', numeroCuenta: '-',
    })
  })

  it('numeroCuenta cae al CBU si no hay numero_cuenta_intl', () => {
    const r = armarDatosInvoice({ factura, prospecto, cuenta: { cbu: '2850590940090418135201' } })
    expect(r.cuenta.numeroCuenta).toBe('2850590940090418135201')
  })

  it('faltantes generales -> strings vacíos, no undefined', () => {
    const r = armarDatosInvoice({ factura: {}, prospecto: null, cuenta: null })
    expect(r).toEqual({
      numero: 'S/N', fecha: '', cliente: 'Cliente',
      periodoDesde: '', periodoHasta: '', vencimiento: '',
      detalle: '', montoTotal: '0,00 $', observaciones: '', cuenta: null,
    })
  })
})

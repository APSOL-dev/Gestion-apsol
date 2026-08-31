import { describe, it, expect, beforeEach, vi } from 'vitest'
import { guardarBorrador, leerBorrador, limpiarBorrador, CLAVE_BORRADOR_FACTURA } from '../borradorFactura'

beforeEach(() => {
  window.localStorage.clear()
})

describe('borradorFactura', () => {
  it('guarda un borrador y lo relee tal cual', () => {
    guardarBorrador({ prospecto_id: 'p1', leyenda: 'Mantenimiento', periodo_desde: '2026-08-01', periodo_hasta: '2026-09-01' })
    const b = leerBorrador()
    expect(b.prospecto_id).toBe('p1')
    expect(b.leyenda).toBe('Mantenimiento')
    expect(b.periodo_desde).toBe('2026-08-01')
  })

  it('NO persiste los campos volátiles (montos calculados y objetos de joins)', () => {
    guardarBorrador({
      prospecto_id: 'p1',
      monto_bruto: 1000, descuento: 50, monto_neto: 950, saldo_pendiente: 950,
      valor_uva_referencia: 1234,
      prospectos: { nombre: 'X' }, contactos: { nombre: 'Y' }, contacto2: null, pagos: [{ id: 'x' }],
    })
    const b = leerBorrador()
    for (const campo of ['monto_bruto', 'descuento', 'monto_neto', 'saldo_pendiente', 'valor_uva_referencia', 'prospectos', 'contactos', 'contacto2', 'pagos']) {
      expect(b).not.toHaveProperty(campo)
    }
    expect(b.prospecto_id).toBe('p1')
  })

  it('leerBorrador devuelve null cuando no hay nada guardado', () => {
    expect(leerBorrador()).toBeNull()
  })

  it('leerBorrador devuelve null si el contenido está corrupto (no es JSON)', () => {
    window.localStorage.setItem(CLAVE_BORRADOR_FACTURA, '{ esto no es json')
    expect(leerBorrador()).toBeNull()
  })

  it('leerBorrador devuelve null si el JSON no es un objeto', () => {
    window.localStorage.setItem(CLAVE_BORRADOR_FACTURA, '"soy un string"')
    expect(leerBorrador()).toBeNull()
  })

  it('limpiarBorrador elimina el borrador', () => {
    guardarBorrador({ prospecto_id: 'p1' })
    limpiarBorrador()
    expect(leerBorrador()).toBeNull()
  })

  it('guardarBorrador devuelve true cuando se guarda ok', () => {
    expect(guardarBorrador({ prospecto_id: 'p1' })).toBe(true)
  })

  it('si localStorage falla al escribir (cuota, modo privado), no rompe y devuelve false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    let resultado
    expect(() => { resultado = guardarBorrador({ prospecto_id: 'p1' }) }).not.toThrow()
    expect(resultado).toBe(false)
    spy.mockRestore()
    warn.mockRestore()
  })

  it('si localStorage falla al leer, devuelve null sin romper', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    expect(leerBorrador()).toBeNull()
    spy.mockRestore()
  })
})

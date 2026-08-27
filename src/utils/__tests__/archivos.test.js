import { describe, test, expect } from 'vitest'
import { esArchivoPDF } from '../archivos'

describe('esArchivoPDF', () => {
  test('acepta un archivo con extensión .pdf y tipo application/pdf', () => {
    expect(esArchivoPDF({ name: 'factura.pdf', type: 'application/pdf' })).toBe(true)
  })

  test('acepta la extensión en mayúsculas', () => {
    expect(esArchivoPDF({ name: 'FACTURA.PDF', type: 'application/pdf' })).toBe(true)
  })

  test('acepta un .pdf aunque el navegador no haya informado el tipo', () => {
    expect(esArchivoPDF({ name: 'factura.pdf', type: '' })).toBe(true)
  })

  test('rechaza una imagen jpg', () => {
    expect(esArchivoPDF({ name: 'foto.jpg', type: 'image/jpeg' })).toBe(false)
  })

  test('rechaza una imagen png', () => {
    expect(esArchivoPDF({ name: 'captura.png', type: 'image/png' })).toBe(false)
  })

  test('rechaza un archivo sin extensión .pdf aunque el navegador no informe el tipo', () => {
    expect(esArchivoPDF({ name: 'foto.jpeg', type: '' })).toBe(false)
  })

  test('rechaza si el tipo no coincide aunque el nombre termine en .pdf (extensión falseada)', () => {
    expect(esArchivoPDF({ name: 'imagen-renombrada.pdf', type: 'image/jpeg' })).toBe(false)
  })

  test('devuelve false si no se pasa ningún archivo', () => {
    expect(esArchivoPDF(null)).toBe(false)
    expect(esArchivoPDF(undefined)).toBe(false)
  })
})

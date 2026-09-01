import { describe, it, expect } from 'vitest'
import { ordenEstadoProspecto, ordenarEstadosProspecto, tareaVencida, debeFacturarse } from '../formateo'

// ──────────────────────────────────────────────────────────────
// ordenEstadoProspecto / ordenarEstadosProspecto: orden del pipeline de
// Prospectos. BUG real: la lista hardcodeada en Prospectos.jsx no tenía
// "1A - Pendiente de contactar" (ni 2A/4A/5A), así que ese estado caía al
// final en vez de ir primero.
// ──────────────────────────────────────────────────────────────
describe('ordenEstadoProspecto', () => {
  it('"Nuevo" va primero de todos', () => {
    expect(ordenEstadoProspecto('Nuevo')).toBe(0)
  })

  it('ordena los estados "A" por su número, sin importar el texto después', () => {
    expect(ordenEstadoProspecto('1A - Pendiente de contactar')).toBeLessThan(ordenEstadoProspecto('3A - Seguimiento'))
    expect(ordenEstadoProspecto('3A - Seguimiento')).toBeLessThan(ordenEstadoProspecto('6A - En producción'))
  })

  it('los estados "H" (históricos) van siempre después de los "A"', () => {
    expect(ordenEstadoProspecto('6A - En producción')).toBeLessThan(ordenEstadoProspecto('1H - Caido previo reunión'))
    expect(ordenEstadoProspecto('1H - Caido previo reunión')).toBeLessThan(ordenEstadoProspecto('5H - Finalizados'))
  })

  it('no distingue mayúsculas/minúsculas', () => {
    expect(ordenEstadoProspecto('1a - contactado')).toBe(ordenEstadoProspecto('1A - Contactado'))
  })

  it('un estado sin prefijo reconocible va al final (999)', () => {
    expect(ordenEstadoProspecto('Estado raro sin numero')).toBe(999)
    expect(ordenEstadoProspecto('')).toBe(999)
    expect(ordenEstadoProspecto(undefined)).toBe(999)
  })
})

describe('ordenarEstadosProspecto', () => {
  it('reordena la lista completa del pipeline', () => {
    const desordenado = ['3A - Seguimiento', '6A - En producción', '1A - Pendiente de contactar']
    expect(ordenarEstadosProspecto(desordenado)).toEqual([
      '1A - Pendiente de contactar',
      '3A - Seguimiento',
      '6A - En producción',
    ])
  })

  it('"Nuevo" queda antes que cualquier estado numerado', () => {
    expect(ordenarEstadosProspecto(['2A - Reunión Agendada', 'Nuevo'])).toEqual(['Nuevo', '2A - Reunión Agendada'])
  })

  it('los históricos quedan después de los activos aunque vengan primero en la lista', () => {
    expect(ordenarEstadosProspecto(['4H - No califica', '1A - Contactado'])).toEqual(['1A - Contactado', '4H - No califica'])
  })

  it('no muta el array original', () => {
    const original = ['6A - En producción', '1A - Contactado']
    const copia = [...original]
    ordenarEstadosProspecto(original)
    expect(original).toEqual(copia)
  })
})

// ──────────────────────────────────────────────────────────────
// tareaVencida: si la próxima tarea de un prospecto ya venció (para
// remarcarla en rojo en el listado). Reusa diasDesde (parseo en hora local).
// ──────────────────────────────────────────────────────────────
describe('tareaVencida', () => {
  it('una fecha de ayer está vencida', () => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    const iso = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`
    expect(tareaVencida(iso)).toBe(true)
  })

  it('hoy todavía NO cuenta como vencida', () => {
    const hoy = new Date()
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    expect(tareaVencida(iso)).toBe(false)
  })

  it('una fecha futura no está vencida', () => {
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    const iso = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, '0')}-${String(manana.getDate()).padStart(2, '0')}`
    expect(tareaVencida(iso)).toBe(false)
  })

  it('sin fecha cargada, no está vencida', () => {
    expect(tareaVencida('')).toBe(false)
    expect(tareaVencida(null)).toBe(false)
    expect(tareaVencida(undefined)).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────
// debeFacturarse: prospectos "en producción" a los que hay que facturarles —
// la próxima_factura es HOY, o ya pasó y todavía no se emitió ninguna
// factura desde esa fecha.
// ──────────────────────────────────────────────────────────────
describe('debeFacturarse', () => {
  const HOY = new Date(2026, 7, 31) // 2026-08-31 (medianoche local)

  it('true cuando la próxima factura es exactamente hoy', () => {
    expect(debeFacturarse({ proxima_factura: '2026-08-31' }, [], HOY)).toBe(true)
  })

  it('true cuando la próxima factura ya pasó y no hay ninguna factura posterior', () => {
    expect(debeFacturarse({ proxima_factura: '2026-08-01' }, [], HOY)).toBe(true)
  })

  it('false cuando la próxima factura ya pasó pero ya se emitió una factura desde esa fecha', () => {
    const facturas = [{ fecha_emision: '2026-08-05' }]
    expect(debeFacturarse({ proxima_factura: '2026-08-01' }, facturas, HOY)).toBe(false)
  })

  it('false cuando la próxima factura todavía es futura', () => {
    expect(debeFacturarse({ proxima_factura: '2026-09-15' }, [], HOY)).toBe(false)
  })

  it('false cuando el prospecto no tiene próxima_factura cargada', () => {
    expect(debeFacturarse({ proxima_factura: null }, [], HOY)).toBe(false)
    expect(debeFacturarse({}, [], HOY)).toBe(false)
  })

  it('una factura emitida el mismo día de la próxima_factura cuenta como ya facturado', () => {
    const facturas = [{ fecha_emision: '2026-08-01' }]
    expect(debeFacturarse({ proxima_factura: '2026-08-01' }, facturas, HOY)).toBe(false)
  })

  it('ignora facturas de otros prospectos si vienen mezcladas (el caller debe filtrar, pero no debe romper con fechas anteriores)', () => {
    const facturas = [{ fecha_emision: '2020-01-01' }]
    expect(debeFacturarse({ proxima_factura: '2026-08-01' }, facturas, HOY)).toBe(true)
  })
})

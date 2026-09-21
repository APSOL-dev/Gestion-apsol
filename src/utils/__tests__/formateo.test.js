import { describe, it, expect } from 'vitest'
import { ordenEstadoProspecto, ordenarEstadosProspecto, tareaVencida, debeFacturarse, textoAtrasoFacturar, resumenFacturasImpagas, textoDeuda } from '../formateo'

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
// la próxima_factura es HOY o ya pasó. Emitir una factura ya avanza esa
// fecha (un mes), así que si sigue vencida es que falta facturar un ciclo.
// No mira las facturas emitidas: una factura hecha después de la fecha
// vencida puede ser la del ciclo anterior (facturada tarde).
// ──────────────────────────────────────────────────────────────
describe('debeFacturarse', () => {
  const HOY = new Date(2026, 7, 31) // 2026-08-31 (medianoche local)

  it('true cuando la próxima factura es exactamente hoy', () => {
    expect(debeFacturarse({ proxima_factura: '2026-08-31' }, HOY)).toBe(true)
  })

  it('true cuando la próxima factura ya pasó', () => {
    expect(debeFacturarse({ proxima_factura: '2026-08-01' }, HOY)).toBe(true)
  })

  it('false cuando la próxima factura todavía es futura', () => {
    expect(debeFacturarse({ proxima_factura: '2026-09-15' }, HOY)).toBe(false)
  })

  it('false cuando el prospecto no tiene próxima_factura cargada', () => {
    expect(debeFacturarse({ proxima_factura: null }, HOY)).toBe(false)
    expect(debeFacturarse({}, HOY)).toBe(false)
  })

  it('false con una fecha inválida', () => {
    expect(debeFacturarse({ proxima_factura: 'no-es-fecha' }, HOY)).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────
// Avisos de la lista de Prospectos: cuánto hace que tocaba facturar y si el
// cliente debe facturas (impagas), para ver de un vistazo ambas cosas.
// ──────────────────────────────────────────────────────────────
describe('textoAtrasoFacturar', () => {
  const HOY = new Date(2026, 10, 12) // 2026-11-12

  it('hoy cuando la próxima factura es hoy', () => {
    expect(textoAtrasoFacturar({ proxima_factura: '2026-11-12' }, HOY)).toBe('hoy')
  })

  it('"hace 1 día" en singular', () => {
    expect(textoAtrasoFacturar({ proxima_factura: '2026-11-11' }, HOY)).toBe('hace 1 día')
  })

  it('"hace N días" cuando ya pasó (tocaba el 10/11, hoy 12/11)', () => {
    expect(textoAtrasoFacturar({ proxima_factura: '2026-11-10' }, HOY)).toBe('hace 2 días')
  })

  it('vacío si todavía no toca o no hay fecha', () => {
    expect(textoAtrasoFacturar({ proxima_factura: '2026-11-20' }, HOY)).toBe('')
    expect(textoAtrasoFacturar({}, HOY)).toBe('')
  })
})

describe('resumenFacturasImpagas', () => {
  it('null si no hay facturas o todas están cobradas', () => {
    expect(resumenFacturasImpagas([])).toBeNull()
    expect(resumenFacturasImpagas(undefined)).toBeNull()
    expect(resumenFacturasImpagas([{ estado: 'Cobrada total', fecha_emision: '2026-10-21' }])).toBeNull()
  })

  it('cuenta las pendientes y parciales, y devuelve la emisión más vieja', () => {
    const r = resumenFacturasImpagas([
      { estado: 'Pendiente', fecha_emision: '2026-10-21' },
      { estado: 'Cobrada parcial', fecha_emision: '2026-09-10' },
      { estado: 'Cobrada total', fecha_emision: '2026-08-01' },
    ])
    expect(r).toEqual({ cantidad: 2, desde: '2026-09-10' })
  })
})

describe('textoDeuda', () => {
  it('una factura: "Debe factura del 21/10"', () => {
    expect(textoDeuda({ cantidad: 1, desde: '2026-10-21' })).toBe('Debe factura del 21/10')
  })

  it('varias: "Debe 2 facturas · desde 10/09"', () => {
    expect(textoDeuda({ cantidad: 2, desde: '2026-09-10' })).toBe('Debe 2 facturas · desde 10/09')
  })

  it('vacío si no debe nada', () => {
    expect(textoDeuda(null)).toBe('')
  })
})

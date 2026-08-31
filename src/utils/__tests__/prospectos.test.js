import { describe, it, expect } from 'vitest'
import { prospectoElegibleParaProyecto, filtrarProspectosParaProyecto } from '../prospectos'

// ──────────────────────────────────────────────────────────────
// Qué prospectos se pueden vincular a un proyecto nuevo.
//
// BUG real: ProyectoDetalle filtraba por estado === 'Ganado' | 'Activo' |
// 'Vendido/Ganado', valores que NO existen en la taxonomía real de
// APSOL ('6A - En producción', '5H - Finalizados', etc.) -> el <select>
// quedaba vacío y no se podía crear ningún proyecto.
//
// Un prospecto ya es "cliente con proyecto" cuando llegó a producción
// (6A) o quedó finalizado (5H). El resto sigue en pipeline de venta o
// está caído.
// ──────────────────────────────────────────────────────────────
describe('prospectoElegibleParaProyecto', () => {
  it('acepta "6A - En producción" y "5H - Finalizados"', () => {
    expect(prospectoElegibleParaProyecto({ estado: '6A - En producción' })).toBe(true)
    expect(prospectoElegibleParaProyecto({ estado: '5H - Finalizados' })).toBe(true)
  })

  it('tolera espacios de más y diferencias de mayúsculas (datos sucios reales)', () => {
    expect(prospectoElegibleParaProyecto({ estado: '5H - Finalizados ' })).toBe(true)
    expect(prospectoElegibleParaProyecto({ estado: '  6a - en producción' })).toBe(true)
  })

  it('rechaza los estados de pipeline de venta y los caídos', () => {
    for (const estado of [
      'Nuevo', '1A - Contactado', '3A - Seguimiento', '4A - Presupuesto Enviado',
      '5A - Negociación', '1H - Caido previo reunión', '3H - Caido luego del presupuesto',
      '4H - No califica',
    ]) {
      expect(prospectoElegibleParaProyecto({ estado })).toBe(false)
    }
  })

  it('acepta los valores legacy por si quedan filas viejas', () => {
    expect(prospectoElegibleParaProyecto({ estado: 'Ganado' })).toBe(true)
    expect(prospectoElegibleParaProyecto({ estado: 'Vendido/Ganado' })).toBe(true)
  })

  it('sin estado / basura -> false', () => {
    expect(prospectoElegibleParaProyecto({ estado: null })).toBe(false)
    expect(prospectoElegibleParaProyecto({})).toBe(false)
    expect(prospectoElegibleParaProyecto(null)).toBe(false)
  })
})

describe('filtrarProspectosParaProyecto', () => {
  const lista = [
    { id: 'a', estado: '6A - En producción' },
    { id: 'b', estado: '3A - Seguimiento' },
    { id: 'c', estado: '5H - Finalizados' },
    { id: 'd', estado: '3H - Caido luego del presupuesto' },
  ]

  it('deja solo los elegibles', () => {
    expect(filtrarProspectosParaProyecto(lista).map(p => p.id)).toEqual(['a', 'c'])
  })

  it('siempre incluye el prospecto ya vinculado aunque no sea elegible (para no romper el select en edición)', () => {
    expect(filtrarProspectosParaProyecto(lista, 'b').map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('no duplica el vinculado si ya es elegible', () => {
    expect(filtrarProspectosParaProyecto(lista, 'a').map(p => p.id)).toEqual(['a', 'c'])
  })

  it('tolera no-array', () => {
    expect(filtrarProspectosParaProyecto(null)).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import {
  finDeContrato,
  contratoVigente,
  tasaDiasLibres,
  calcularDiasDescanso,
  agruparColaboradores,
  limpiarWhatsapp,
  parsearProspectosParaTrabajar,
} from '../colaboradores'

describe('finDeContrato', () => {
  it('devuelve la fecha_fin del contrato con fecha_inicio más reciente, sin importar el orden del array', () => {
    const contratos = [
      { fecha_inicio: '2025-08-01', fecha_fin: '2026-01-01' },
      { fecha_inicio: '2026-01-01', fecha_fin: '2027-01-01' }, // el más nuevo
      { fecha_inicio: '2024-08-01', fecha_fin: '2024-11-30' },
    ]
    expect(finDeContrato(contratos)).toBe('2027-01-01')
  })

  it('recorta la parte de hora si la fecha viene como timestamp', () => {
    expect(finDeContrato([{ fecha_inicio: '2026-01-01T00:00:00+00:00', fecha_fin: '2027-01-01T00:00:00+00:00' }]))
      .toBe('2027-01-01')
  })

  it('devuelve null si no hay contratos o el último no tiene fecha_fin', () => {
    expect(finDeContrato([])).toBeNull()
    expect(finDeContrato(null)).toBeNull()
    expect(finDeContrato([{ fecha_inicio: '2026-01-01', fecha_fin: null }])).toBeNull()
  })
})

describe('contratoVigente', () => {
  const hoy = new Date(2026, 7, 29) // 2026-08-29
  const contratos = [
    { id: 'viejo', fecha_inicio: '2025-08-01', fecha_fin: '2026-01-01' },
    { id: 'actual', fecha_inicio: '2026-01-01', fecha_fin: '2026-07-01' },
    { id: 'en-curso', fecha_inicio: '2026-07-01', fecha_fin: '2027-01-01' },
  ]

  it('devuelve el contrato cuyo período cubre hoy', () => {
    expect(contratoVigente(contratos, hoy)?.id).toBe('en-curso')
  })

  it('un contrato futuro (todavía no arrancó) no es vigente', () => {
    expect(contratoVigente([{ id: 'f', fecha_inicio: '2027-01-01', fecha_fin: '2027-06-01' }], hoy)).toBeNull()
  })

  it('fecha_fin vacía = indefinido: vigente si ya arrancó', () => {
    expect(contratoVigente([{ id: 'x', fecha_inicio: '2020-01-01', fecha_fin: null }], hoy)?.id).toBe('x')
  })

  it('todos vencidos -> null; lista vacía -> null', () => {
    expect(contratoVigente([{ id: 'v', fecha_inicio: '2020-01-01', fecha_fin: '2021-01-01' }], hoy)).toBeNull()
    expect(contratoVigente([], hoy)).toBeNull()
  })
})

describe('tasaDiasLibres', () => {
  it('toma dias_libres_por_mes del último contrato', () => {
    expect(tasaDiasLibres([
      { fecha_inicio: '2024-08-01', dias_libres_por_mes: 1 },
      { fecha_inicio: '2025-08-01', dias_libres_por_mes: 2 },
    ])).toBe(2)
  })

  it('acepta coma decimal y cae a 1.25 cuando falta o es inválido', () => {
    expect(tasaDiasLibres([{ fecha_inicio: '2025-08-01', dias_libres_por_mes: '1,5' }])).toBe(1.5)
    expect(tasaDiasLibres([{ fecha_inicio: '2025-08-01', dias_libres_por_mes: null }])).toBe(1.25)
    expect(tasaDiasLibres([])).toBe(1.25)
  })
})

describe('calcularDiasDescanso', () => {
  it('caso Renata: inicio 2024-08-01, tasa 1.25, 22 días tomados al 2026-08-29', () => {
    const r = calcularDiasDescanso({
      fechaInicio: '2024-08-01',
      contratos: [{ fecha_inicio: '2024-08-01', dias_libres_por_mes: 1.25 }],
      diasTomados: 22,
      fechaRef: new Date(2026, 7, 29),
    })
    expect(r).toEqual({ acumulados: 31, tomados: 22, disponibles: 9 })
  })

  it('nunca devuelve disponibles negativos', () => {
    const r = calcularDiasDescanso({
      fechaInicio: '2024-08-01',
      contratos: [{ fecha_inicio: '2024-08-01', dias_libres_por_mes: 1.25 }],
      diasTomados: 999,
      fechaRef: new Date(2026, 7, 29),
    })
    expect(r.disponibles).toBe(0)
    expect(r.tomados).toBe(999)
  })

  it('sin fecha de inicio devuelve todo en cero salvo lo tomado', () => {
    expect(calcularDiasDescanso({ fechaInicio: null, diasTomados: 3 }))
      .toEqual({ acumulados: 0, tomados: 3, disponibles: 0 })
  })
})

describe('agruparColaboradores', () => {
  const base = [
    { id: 'a', nombre: 'Renata', puesto: 'Colaborador', estado: 'Activo' },
    { id: 'b', nombre: 'Felipe', puesto: 'Colaborador', estado: 'Inactivo' },
    { id: 'c', nombre_manual: '(sheet id f927515a)', puesto: 'Sin identificar - conciliar', estado: 'Inactivo' },
    { id: 'd', nombre_manual: 'Mantenimiento', puesto: 'Recurso interno (horas reservadas)', estado: 'Activo' },
    { id: 'e', nombre_manual: 'Sofía', puesto: 'Ex-colaboradora (histórico)', activo: false },
  ]

  it('separa activos e inactivos y descarta placeholders y recursos internos', () => {
    const { activos, inactivos } = agruparColaboradores(base)
    expect(activos.map(c => c.id)).toEqual(['a'])
    expect(inactivos.map(c => c.id)).toEqual(['b', 'e'])
  })

  it('tolera lista vacía', () => {
    expect(agruparColaboradores([])).toEqual({ activos: [], inactivos: [] })
  })
})

describe('limpiarWhatsapp', () => {
  it('saca el sufijo .0 de los valores migrados como float', () => {
    expect(limpiarWhatsapp('3425672161.0')).toBe('3425672161')
  })
  it('deja solo dígitos (y +) y tolera null', () => {
    expect(limpiarWhatsapp('+54 342 567-2161')).toBe('+543425672161')
    expect(limpiarWhatsapp(null)).toBe('')
  })
})

describe('parsearProspectosParaTrabajar', () => {
  it('separa por coma, recorta espacios y deduplica preservando el orden', () => {
    expect(parsearProspectosParaTrabajar('APSOL - Proyectos Internos , Norte 2025 , APSOL - Proyectos Internos'))
      .toEqual(['APSOL - Proyectos Internos', 'Norte 2025'])
  })
  it('celda vacía o nula devuelve []', () => {
    expect(parsearProspectosParaTrabajar('')).toEqual([])
    expect(parsearProspectosParaTrabajar(null)).toEqual([])
  })
})

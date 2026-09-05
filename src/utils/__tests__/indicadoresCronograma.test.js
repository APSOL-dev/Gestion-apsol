import { describe, it, expect } from 'vitest'
import { calcularIndicadoresDedicacion } from '../indicadoresCronograma'

// Actividades "resueltas" como las arma resolverActividades: fila real de
// cronograma + prospecto_nombre de solo lectura.
const acts = [
  { id: 'a1', responsable_id: 'mateo', prospecto_id: 'p1', prospecto_nombre: 'Prospecto uno', duracion_horas: 2, multiplicador: 1 },
  { id: 'a2', responsable_id: 'mateo', prospecto_id: 'p1', prospecto_nombre: 'Prospecto uno', duracion_horas: 1.5, multiplicador: 2 },
  { id: 'a3', responsable_id: 'mateo', prospecto_id: 'p2', prospecto_nombre: 'Prospecto dos', duracion_horas: 3, multiplicador: 1 },
  { id: 'a4', responsable_id: 'renata', prospecto_id: 'p1', prospecto_nombre: 'Prospecto uno', duracion_horas: 4, multiplicador: 1 },
  // Categoría interna: sin prospecto_id, el nombre sale del prefijo [Categoría].
  { id: 'a5', responsable_id: 'mateo', prospecto_id: null, prospecto_nombre: 'Consultora', duracion_horas: 1, multiplicador: 1 },
]

const prospectos = [
  { id: 'p1', nombre: 'Prospecto uno' },
  { id: 'p2', nombre: 'Prospecto dos' },
]

describe('calcularIndicadoresDedicacion', () => {
  it('sin filtros: suma todas las actividades', () => {
    const r = calcularIndicadoresDedicacion(acts, { prospectos })
    expect(r.horas).toBe(11.5)
    expect(r.actividades).toBe(5)
  })

  it('cruza personal + prospecto: horas de Mateo en Prospecto uno', () => {
    const r = calcularIndicadoresDedicacion(acts, {
      colaboradoresIds: ['mateo'],
      prospectosIds: ['p1'],
      prospectos,
    })
    // a1 (2) + a2 (1.5); a3 es otro prospecto, a4 es otra persona, a5 otra.
    expect(r.horas).toBe(3.5)
    expect(r.actividades).toBe(2)
  })

  it('pondera por el multiplicador (lo que suma al saldo)', () => {
    const r = calcularIndicadoresDedicacion(acts, {
      colaboradoresIds: ['mateo'],
      prospectosIds: ['p1'],
      prospectos,
    })
    // 2*1 + 1.5*2 = 5
    expect(r.horasPonderadas).toBe(5)
  })

  it('solo filtro de personal: suma todos los prospectos de esa persona', () => {
    const r = calcularIndicadoresDedicacion(acts, { colaboradoresIds: ['mateo'], prospectos })
    // a1+a2+a3+a5 = 2 + 1.5 + 3 + 1 = 7.5
    expect(r.horas).toBe(7.5)
    expect(r.actividades).toBe(4)
  })

  it('solo filtro de prospecto: suma todo el personal en ese prospecto', () => {
    const r = calcularIndicadoresDedicacion(acts, { prospectosIds: ['p1'], prospectos })
    // a1+a2+a4 = 2 + 1.5 + 4 = 7.5
    expect(r.horas).toBe(7.5)
    expect(r.actividades).toBe(3)
  })

  it('resuelve el prospecto por nombre cuando la actividad no tiene prospecto_id', () => {
    const r = calcularIndicadoresDedicacion(acts, {
      prospectosIds: ['pC'],
      prospectos: [{ id: 'pC', nombre: 'Consultora' }],
    })
    expect(r.horas).toBe(1)
    expect(r.actividades).toBe(1)
  })

  it('ignora los bloques "Ocupado" (reunión ajena redactada, sin duración)', () => {
    const conOcupado = [
      ...acts,
      { id: 'o1', responsable_id: 'mateo', prospecto_id: null, prospecto_nombre: '', descripcion: 'Ocupado', duracion_horas: null, ocupado: true },
    ]
    const r = calcularIndicadoresDedicacion(conOcupado, { colaboradoresIds: ['mateo'], prospectos })
    expect(r.horas).toBe(7.5)
    expect(r.actividades).toBe(4)
  })

  it('ignora actividades sin duración numérica', () => {
    const r = calcularIndicadoresDedicacion(
      [{ id: 'x', responsable_id: 'mateo', prospecto_id: 'p1', prospecto_nombre: 'Prospecto uno', duracion_horas: null, multiplicador: 1 }],
      { colaboradoresIds: ['mateo'], prospectosIds: ['p1'], prospectos }
    )
    expect(r.horas).toBe(0)
    expect(r.actividades).toBe(0)
  })

  it('redondea a 2 decimales', () => {
    const r = calcularIndicadoresDedicacion(
      [
        { id: 'x1', responsable_id: 'm', prospecto_id: 'p1', prospecto_nombre: 'Prospecto uno', duracion_horas: 0.333, multiplicador: 1 },
        { id: 'x2', responsable_id: 'm', prospecto_id: 'p1', prospecto_nombre: 'Prospecto uno', duracion_horas: 0.333, multiplicador: 1 },
      ],
      { prospectos }
    )
    expect(r.horas).toBe(0.67)
  })

  it('lista vacía o nula -> todo en cero', () => {
    expect(calcularIndicadoresDedicacion([], {})).toEqual({ horas: 0, horasPonderadas: 0, actividades: 0 })
    expect(calcularIndicadoresDedicacion(null, {})).toEqual({ horas: 0, horasPonderadas: 0, actividades: 0 })
  })
})

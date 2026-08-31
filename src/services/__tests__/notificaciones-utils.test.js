import { describe, test, expect } from 'vitest'
import {
  facturasVencidas,
  preventivosVencidos,
  prospectosConSeguimientoVencido,
  contratosPorVencer,
  alertasParaUsuario,
  linkDeNotificacion,
  URGENCIA_POR_TIPO,
  filtrarPorPreferencias,
  ETIQUETA_POR_TIPO,
} from '../notificaciones-utils'

// ──────────────────────────────────────────────────────────────
// "Requiere tu atención" (Fase 1 del plan de notificaciones): alertas
// calculadas al vuelo con los datos que la app ya tiene cargados
// (DataContext), sin tabla nueva. Cada función de acá es un filtro puro
// y testeable — Dashboard.jsx solo las llama y pinta el resultado.
// ──────────────────────────────────────────────────────────────

const HOY = '2026-08-30'

describe('facturasVencidas', () => {
  test('factura Pendiente con vencimiento pasado cuenta como vencida', () => {
    const out = facturasVencidas([
      { id: 'f1', estado: 'Pendiente', fecha_vencimiento: '2026-08-20' },
    ], HOY)
    expect(out.map(f => f.id)).toEqual(['f1'])
  })

  test('Enviada y Cobrada parcial también cuentan (todavía deben algo)', () => {
    const out = facturasVencidas([
      { id: 'f1', estado: 'Enviada', fecha_vencimiento: '2026-08-01' },
      { id: 'f2', estado: 'Cobrada parcial', fecha_vencimiento: '2026-08-01' },
    ], HOY)
    expect(out.map(f => f.id).sort()).toEqual(['f1', 'f2'])
  })

  test('Cobrada total no es vencida aunque el vencimiento haya pasado', () => {
    const out = facturasVencidas([
      { id: 'f1', estado: 'Cobrada total', fecha_vencimiento: '2026-01-01' },
    ], HOY)
    expect(out).toEqual([])
  })

  test('vencimiento hoy o futuro no cuenta', () => {
    const out = facturasVencidas([
      { id: 'f1', estado: 'Pendiente', fecha_vencimiento: HOY },
      { id: 'f2', estado: 'Pendiente', fecha_vencimiento: '2026-09-01' },
    ], HOY)
    expect(out).toEqual([])
  })

  test('sin fecha_vencimiento no rompe ni cuenta', () => {
    expect(facturasVencidas([{ id: 'f1', estado: 'Pendiente', fecha_vencimiento: null }], HOY)).toEqual([])
    expect(facturasVencidas(null, HOY)).toEqual([])
    expect(facturasVencidas(undefined, HOY)).toEqual([])
  })
})

describe('preventivosVencidos', () => {
  test('proxima_realizacion pasada cuenta como vencido', () => {
    const out = preventivosVencidos([{ id: 'p1', proxima_realizacion: '2026-08-01' }], HOY)
    expect(out.map(p => p.id)).toEqual(['p1'])
  })

  test('hoy o futuro no cuenta', () => {
    const out = preventivosVencidos([
      { id: 'p1', proxima_realizacion: HOY },
      { id: 'p2', proxima_realizacion: '2026-09-15' },
    ], HOY)
    expect(out).toEqual([])
  })

  test('sin fecha no rompe', () => {
    expect(preventivosVencidos([{ id: 'p1', proxima_realizacion: null }], HOY)).toEqual([])
    expect(preventivosVencidos(null, HOY)).toEqual([])
  })
})

describe('prospectosConSeguimientoVencido', () => {
  test('prospecto activo con tarea vencida cuenta', () => {
    const out = prospectosConSeguimientoVencido([
      { id: 'p1', estado: '3A - Seguimiento', fecha_proxima_tarea: '2026-08-10' },
    ], HOY)
    expect(out.map(p => p.id)).toEqual(['p1'])
  })

  test('prospectos caídos / no calificados / finalizados no cuentan aunque tengan tarea vencida', () => {
    const out = prospectosConSeguimientoVencido([
      { id: 'p1', estado: '1H - Caido previo reunión', fecha_proxima_tarea: '2026-01-01' },
      { id: 'p2', estado: '4H - No califica', fecha_proxima_tarea: '2026-01-01' },
      { id: 'p3', estado: '5H - Finalizados', fecha_proxima_tarea: '2026-01-01' },
    ], HOY)
    expect(out).toEqual([])
  })

  test('sin tarea próxima o con fecha futura no cuenta', () => {
    const out = prospectosConSeguimientoVencido([
      { id: 'p1', estado: 'Nuevo', fecha_proxima_tarea: null },
      { id: 'p2', estado: 'Nuevo', fecha_proxima_tarea: '2026-09-01' },
    ], HOY)
    expect(out).toEqual([])
  })
})

describe('contratosPorVencer', () => {
  test('colaborador activo con renovación dentro de la ventana cuenta', () => {
    const out = contratosPorVencer([
      { id: 'c1', activo: true, renovacion_contrato: '2026-09-15' },
    ], 30, HOY)
    expect(out.map(c => c.id)).toEqual(['c1'])
  })

  test('ya vencido también cuenta (no solo próximo a vencer)', () => {
    const out = contratosPorVencer([
      { id: 'c1', activo: true, renovacion_contrato: '2026-08-01' },
    ], 30, HOY)
    expect(out.map(c => c.id)).toEqual(['c1'])
  })

  test('fuera de la ventana (>30 días) no cuenta', () => {
    const out = contratosPorVencer([
      { id: 'c1', activo: true, renovacion_contrato: '2026-12-01' },
    ], 30, HOY)
    expect(out).toEqual([])
  })

  test('colaborador inactivo no cuenta', () => {
    const out = contratosPorVencer([
      { id: 'c1', activo: false, renovacion_contrato: '2026-09-01' },
    ], 30, HOY)
    expect(out).toEqual([])
  })

  test('sin fecha de renovación no cuenta', () => {
    const out = contratosPorVencer([{ id: 'c1', activo: true, renovacion_contrato: null }], 30, HOY)
    expect(out).toEqual([])
  })
})

describe('alertasParaUsuario', () => {
  const facturas = [{ id: 'f1', estado: 'Pendiente', fecha_vencimiento: '2026-08-01', numero_factura: '303' }]
  const preventivos = [
    { id: 'pv1', nombre: 'Aire acondicionado', proxima_realizacion: '2026-08-01', responsable_id: 'colab-1' },
    { id: 'pv2', nombre: 'Generador', proxima_realizacion: '2026-08-01', responsable_id: 'colab-2' },
  ]
  const prospectos = [{ id: 'pr1', nombre: 'Estudio Gustavo', estado: '3A - Seguimiento', fecha_proxima_tarea: '2026-08-10' }]
  const colaboradores = [{ id: 'colab-1', nombre: 'Mateo', apellido: 'Courault', activo: true, renovacion_contrato: '2026-09-01' }]

  test('Admin ve facturas, prospectos, contratos y TODOS los preventivos vencidos', () => {
    const out = alertasParaUsuario({ facturas, preventivos, prospectos, colaboradores, esAdmin: true, colaboradorId: null, hoy: HOY })
    const tipos = out.map(a => a.tipo)
    expect(tipos).toContain('factura_vencida')
    expect(tipos).toContain('prospecto_seguimiento')
    expect(tipos).toContain('contrato_por_vencer')
    expect(out.filter(a => a.tipo === 'preventivo_vencido')).toHaveLength(2)
  })

  test('Colaborador NO ve facturas/prospectos/contratos, y solo SUS preventivos', () => {
    const out = alertasParaUsuario({ facturas, preventivos, prospectos, colaboradores, esAdmin: false, colaboradorId: 'colab-1', hoy: HOY })
    const tipos = out.map(a => a.tipo)
    expect(tipos).not.toContain('factura_vencida')
    expect(tipos).not.toContain('prospecto_seguimiento')
    expect(tipos).not.toContain('contrato_por_vencer')
    const propios = out.filter(a => a.tipo === 'preventivo_vencido')
    expect(propios).toHaveLength(1)
    expect(propios[0].id).toContain('pv1')
  })

  test('las de mayor urgencia van primero', () => {
    const out = alertasParaUsuario({ facturas, preventivos, prospectos, colaboradores, esAdmin: true, colaboradorId: null, hoy: HOY })
    const urgencias = out.map(a => a.urgencia)
    const primeraMedia = urgencias.indexOf('media')
    const ultimaAlta = urgencias.lastIndexOf('alta')
    if (primeraMedia !== -1 && ultimaAlta !== -1) {
      expect(ultimaAlta).toBeLessThan(primeraMedia)
    }
  })

  test('cada alerta trae id, título y link para poder navegar', () => {
    const out = alertasParaUsuario({ facturas, preventivos, prospectos, colaboradores, esAdmin: true, colaboradorId: null, hoy: HOY })
    for (const a of out) {
      expect(a.id).toBeTruthy()
      expect(a.titulo).toBeTruthy()
      expect(a.link).toBeTruthy()
    }
  })

  test('sin datos no rompe, devuelve vacío', () => {
    expect(alertasParaUsuario({ esAdmin: true, hoy: HOY })).toEqual([])
    expect(alertasParaUsuario({ esAdmin: false, colaboradorId: 'x', hoy: HOY })).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────
// Fase 2: eventos guardados (apsol_notificaciones). No hay pantalla
// propia para una factura de colaborador individual, así que esas dos
// notificaciones apuntan al colaborador (donde se ve/paga la factura):
// ColaboradorDetalle para quien la aprueba, Mi Perfil para el dueño.
// ──────────────────────────────────────────────────────────────
describe('linkDeNotificacion', () => {
  test('ticket_asignado -> el ticket', () => {
    expect(linkDeNotificacion({ tipo: 'ticket_asignado', entidad_tipo: 'ticket', entidad_id: 't1' })).toBe('/tickets/t1')
  })

  test('sprint_item_rojo -> el sprint', () => {
    expect(linkDeNotificacion({ tipo: 'sprint_item_rojo', entidad_tipo: 'sprint', entidad_id: 's1' })).toBe('/sprints/s1')
  })

  test('factura_colaborador_pagar (Admin) -> la ficha del colaborador', () => {
    expect(linkDeNotificacion({ tipo: 'factura_colaborador_pagar', entidad_tipo: 'colaborador', entidad_id: 'c1' })).toBe('/colaboradores/c1')
  })

  test('factura_colaborador_pagada (el propio colaborador) -> Mi Perfil, no /colaboradores (RLS se lo niega)', () => {
    expect(linkDeNotificacion({ tipo: 'factura_colaborador_pagada', entidad_tipo: 'colaborador', entidad_id: 'c1' })).toBe('/mi-perfil')
  })

  test('tipo desconocido no rompe, manda a Inicio', () => {
    expect(linkDeNotificacion({ tipo: 'algo_nuevo', entidad_tipo: 'algo', entidad_id: 'x' })).toBe('/')
    expect(linkDeNotificacion({})).toBe('/')
  })
})

describe('URGENCIA_POR_TIPO', () => {
  test('todos los tipos de evento conocidos tienen una urgencia asignada', () => {
    for (const tipo of ['ticket_asignado', 'sprint_item_rojo', 'factura_colaborador_pagar', 'factura_colaborador_pagada']) {
      expect(['alta', 'media', 'baja']).toContain(URGENCIA_POR_TIPO[tipo])
    }
  })
})

// ──────────────────────────────────────────────────────────────
// Fase 3: preferencias — qué tipos de notificación no querés ver. Un
// filtro simple del lado del cliente sobre la lista ya traída; no toca
// la base ni los triggers (esos siguen creando la fila igual).
// ──────────────────────────────────────────────────────────────
describe('ETIQUETA_POR_TIPO', () => {
  test('todos los tipos conocidos tienen una etiqueta legible', () => {
    for (const tipo of Object.keys(URGENCIA_POR_TIPO)) {
      expect(typeof ETIQUETA_POR_TIPO[tipo]).toBe('string')
      expect(ETIQUETA_POR_TIPO[tipo].length).toBeGreaterThan(0)
    }
  })
})

describe('filtrarPorPreferencias', () => {
  const notas = [
    { id: 'n1', tipo: 'ticket_asignado' },
    { id: 'n2', tipo: 'sprint_item_rojo' },
    { id: 'n3', tipo: 'ticket_asignado' },
  ]

  test('sin desactivados, devuelve todo igual', () => {
    expect(filtrarPorPreferencias(notas, [])).toEqual(notas)
    expect(filtrarPorPreferencias(notas, null)).toEqual(notas)
  })

  test('saca los tipos desactivados', () => {
    const out = filtrarPorPreferencias(notas, ['ticket_asignado'])
    expect(out.map(n => n.id)).toEqual(['n2'])
  })

  test('no rompe con lista vacía', () => {
    expect(filtrarPorPreferencias([], ['ticket_asignado'])).toEqual([])
    expect(filtrarPorPreferencias(null, ['x'])).toEqual([])
  })
})

import { describe, test, expect } from 'vitest'
import {
  ORDEN_ESTADOS,
  ESTADOS_ITEM,
  contarEstados,
  porcentajeAvance,
  siguienteOrden,
  siguienteNumeroSprint,
  ordenarItems,
  itemsEnRojo,
  moverItemEnLista,
  renumerarOrden,
  resumenParaCierre,
  siguienteEstadoCiclo,
  puedeEditarSprint,
  esImagenUrl,
  dominioDeUrl,
} from '../sprints-utils'

// ──────────────────────────────────────────────────────────────
// Semáforo de un punto de sprint: los 5 estados del cuadernito de
// OneNote llevados a datos (⚪ pendiente · 🔵 en progreso · 🟢 hecho ·
// 🟡 hecho con dudas · 🔴 no se pudo).
// ──────────────────────────────────────────────────────────────
describe('ESTADOS_ITEM / ORDEN_ESTADOS', () => {
  test('hay exactamente 5 estados, en orden de avance', () => {
    expect(ORDEN_ESTADOS).toEqual(['pendiente', 'en_progreso', 'verde', 'amarillo', 'rojo'])
  })

  test('cada estado tiene etiqueta, color y emoji para pintar el semáforo', () => {
    for (const clave of ORDEN_ESTADOS) {
      expect(ESTADOS_ITEM[clave]).toMatchObject({
        label: expect.any(String),
        color: expect.any(String),
        emoji: expect.any(String),
      })
    }
  })
})

describe('contarEstados', () => {
  test('cuenta cada estado y el total', () => {
    const items = [
      { estado: 'verde' }, { estado: 'verde' }, { estado: 'amarillo' },
      { estado: 'rojo' }, { estado: 'pendiente' }, { estado: 'en_progreso' },
    ]
    expect(contarEstados(items)).toEqual({
      pendiente: 1, en_progreso: 1, verde: 2, amarillo: 1, rojo: 1, total: 6,
    })
  })

  test('un estado desconocido o ausente cuenta como pendiente', () => {
    const items = [{ estado: 'cualquiera' }, {}, { estado: null }]
    expect(contarEstados(items)).toMatchObject({ pendiente: 3, total: 3 })
  })

  test('lista vacía / no-array devuelve todo en cero', () => {
    expect(contarEstados([])).toEqual({ pendiente: 0, en_progreso: 0, verde: 0, amarillo: 0, rojo: 0, total: 0 })
    expect(contarEstados(undefined)).toEqual({ pendiente: 0, en_progreso: 0, verde: 0, amarillo: 0, rojo: 0, total: 0 })
  })
})

describe('porcentajeAvance', () => {
  test('es la proporción de puntos en verde sobre el total, redondeada', () => {
    expect(porcentajeAvance([{ estado: 'verde' }, { estado: 'verde' }, { estado: 'rojo' }, { estado: 'amarillo' }])).toBe(50)
    expect(porcentajeAvance([{ estado: 'verde' }, { estado: 'pendiente' }, { estado: 'pendiente' }])).toBe(33)
  })

  test('sin puntos, el avance es 0 (no NaN)', () => {
    expect(porcentajeAvance([])).toBe(0)
  })

  test('el amarillo NO cuenta como avance completo', () => {
    expect(porcentajeAvance([{ estado: 'amarillo' }, { estado: 'amarillo' }])).toBe(0)
  })
})

describe('siguienteOrden', () => {
  test('es el orden más alto + 1', () => {
    expect(siguienteOrden([{ orden: 0 }, { orden: 3 }, { orden: 1 }])).toBe(4)
  })
  test('con la lista vacía arranca en 1', () => {
    expect(siguienteOrden([])).toBe(1)
  })
})

describe('siguienteNumeroSprint', () => {
  test('numera correlativo por proyecto: el mayor + 1', () => {
    expect(siguienteNumeroSprint([{ numero: 1 }, { numero: 2 }])).toBe(3)
  })
  test('el primer sprint del proyecto es el 1', () => {
    expect(siguienteNumeroSprint([])).toBe(1)
  })
})

describe('ordenarItems', () => {
  test('ordena por el campo orden ascendente sin mutar el original', () => {
    const items = [{ id: 'c', orden: 2 }, { id: 'a', orden: 0 }, { id: 'b', orden: 1 }]
    const out = ordenarItems(items)
    expect(out.map(i => i.id)).toEqual(['a', 'b', 'c'])
    expect(items[0].id).toBe('c') // no mutó
  })
})

describe('itemsEnRojo', () => {
  test('devuelve solo los puntos que no se pudieron hacer', () => {
    const items = [{ id: 1, estado: 'rojo' }, { id: 2, estado: 'verde' }, { id: 3, estado: 'rojo' }]
    expect(itemsEnRojo(items).map(i => i.id)).toEqual([1, 3])
  })
})

// ──────────────────────────────────────────────────────────────
// Reordenar puntos (mover ↑/↓). Lógica pura: la UI llama y después
// persiste los `orden` resultantes.
// ──────────────────────────────────────────────────────────────
describe('moverItemEnLista', () => {
  const base = [{ id: 'a', orden: 0 }, { id: 'b', orden: 1 }, { id: 'c', orden: 2 }]

  test('mover arriba intercambia con el anterior', () => {
    expect(moverItemEnLista(base, 'c', 'arriba').map(i => i.id)).toEqual(['a', 'c', 'b'])
  })
  test('mover abajo intercambia con el siguiente', () => {
    expect(moverItemEnLista(base, 'a', 'abajo').map(i => i.id)).toEqual(['b', 'a', 'c'])
  })
  test('mover el primero hacia arriba no hace nada', () => {
    expect(moverItemEnLista(base, 'a', 'arriba').map(i => i.id)).toEqual(['a', 'b', 'c'])
  })
  test('mover el último hacia abajo no hace nada', () => {
    expect(moverItemEnLista(base, 'c', 'abajo').map(i => i.id)).toEqual(['a', 'b', 'c'])
  })
  test('no muta la lista original', () => {
    moverItemEnLista(base, 'a', 'abajo')
    expect(base.map(i => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('renumerarOrden', () => {
  test('reasigna orden = índice y devuelve solo los que cambiaron', () => {
    const items = [{ id: 'a', orden: 5 }, { id: 'b', orden: 1 }, { id: 'c', orden: 9 }]
    // 'b' ya estaba en su índice (1) -> no se re-persiste
    expect(renumerarOrden(items)).toEqual([
      { id: 'a', orden: 0 },
      { id: 'c', orden: 2 },
    ])
  })
  test('si ya están 0..n-1 no devuelve nada', () => {
    const items = [{ id: 'a', orden: 0 }, { id: 'b', orden: 1 }]
    expect(renumerarOrden(items)).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────
// Cierre de sprint: al cerrar se congela una "foto" de cómo quedó,
// para poder ver la tendencia sprint a sprint más adelante.
// ──────────────────────────────────────────────────────────────
describe('resumenParaCierre', () => {
  test('guarda los conteos por estado + el porcentaje de avance', () => {
    const items = [{ estado: 'verde' }, { estado: 'verde' }, { estado: 'amarillo' }, { estado: 'rojo' }]
    expect(resumenParaCierre(items)).toEqual({
      pendiente: 0, en_progreso: 0, verde: 2, amarillo: 1, rojo: 1, total: 4,
      porcentaje_avance: 50,
    })
  })
})

describe('siguienteEstadoCiclo', () => {
  test('avanza al siguiente estado del semáforo', () => {
    expect(siguienteEstadoCiclo('pendiente')).toBe('en_progreso')
    expect(siguienteEstadoCiclo('verde')).toBe('amarillo')
  })
  test('desde el último vuelve al primero', () => {
    expect(siguienteEstadoCiclo('rojo')).toBe('pendiente')
  })
  test('un valor raro arranca el ciclo en pendiente', () => {
    expect(siguienteEstadoCiclo('xxx')).toBe('en_progreso')
  })
})

describe('puedeEditarSprint', () => {
  test('un sprint cerrado no se edita', () => {
    expect(puedeEditarSprint({ estado: 'cerrado' })).toBe(false)
  })
  test('planificado y activo sí se editan', () => {
    expect(puedeEditarSprint({ estado: 'planificado' })).toBe(true)
    expect(puedeEditarSprint({ estado: 'activo' })).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────
// Fila de punto simplificada: un adjunto puede ser una imagen subida
// (se pinta como miniatura) o un link pegado a mano (se pinta como
// chip con ícono). No hay columna "tipo" en la base — se infiere de
// la extensión de la URL.
// ──────────────────────────────────────────────────────────────
describe('esImagenUrl', () => {
  test('reconoce extensiones de imagen comunes', () => {
    expect(esImagenUrl('https://x.supabase.co/storage/v1/object/public/Bucket%20Publico/sprints/foo.png')).toBe(true)
    expect(esImagenUrl('https://x.co/a.JPG')).toBe(true)
    expect(esImagenUrl('https://x.co/a.jpeg?token=abc')).toBe(true)
    expect(esImagenUrl('https://x.co/a.webp')).toBe(true)
  })

  test('un link cualquiera no es imagen', () => {
    expect(esImagenUrl('https://github.com/apsol/repo/pull/12')).toBe(false)
    expect(esImagenUrl('https://docs.google.com/document/d/abc')).toBe(false)
  })

  test('tolera valores vacíos/raros', () => {
    expect(esImagenUrl('')).toBe(false)
    expect(esImagenUrl(null)).toBe(false)
    expect(esImagenUrl(undefined)).toBe(false)
  })
})

// Un link adjuntado sin nombre se muestra como chip con el dominio.
describe('dominioDeUrl', () => {
  test('devuelve el hostname sin www', () => {
    expect(dominioDeUrl('https://www.github.com/apsol/repo')).toBe('github.com')
    expect(dominioDeUrl('https://docs.google.com/document/d/abc')).toBe('docs.google.com')
  })

  test('si no es una URL válida, devuelve el string tal cual', () => {
    expect(dominioDeUrl('no-es-url')).toBe('no-es-url')
  })

  test('vacío -> vacío', () => {
    expect(dominioDeUrl('')).toBe('')
  })
})

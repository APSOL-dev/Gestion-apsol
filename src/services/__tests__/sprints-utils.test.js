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
  moverItemAntesDe,
  renumerarOrden,
  resumenParaCierre,
  siguienteEstadoCiclo,
  puedeEditarSprint,
  puedeEliminarSprint,
  esImagenUrl,
  dominioDeUrl,
  esArchivoStorage,
  urlDescargaAdjunto,
  agruparPorSeccion,
  bloqueDeSeccion,
  moverBloqueAntesDe,
  moverBloqueAdyacente,
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

  test('un título de sección no cuenta en el semáforo', () => {
    const items = [
      { estado: 'verde' }, { es_seccion: true, estado: 'pendiente' }, { estado: 'rojo' },
    ]
    expect(contarEstados(items)).toEqual({
      pendiente: 0, en_progreso: 0, verde: 1, amarillo: 0, rojo: 1, total: 2,
    })
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
  test('un título de sección nunca cuenta como rojo, aunque tenga ese estado a mano', () => {
    const items = [{ id: 1, es_seccion: true, estado: 'rojo' }, { id: 2, estado: 'rojo' }]
    expect(itemsEnRojo(items).map(i => i.id)).toEqual([2])
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

describe('moverItemAntesDe (drag & drop)', () => {
  const base = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  test('arrastrar el primero sobre el tercero lo inserta ahí', () => {
    expect(moverItemAntesDe(base, 'a', 'c').map(i => i.id)).toEqual(['b', 'c', 'a', 'd'])
  })
  test('arrastrar el último sobre el primero', () => {
    expect(moverItemAntesDe(base, 'd', 'a').map(i => i.id)).toEqual(['d', 'a', 'b', 'c'])
  })
  test('soltar sobre sí mismo no cambia nada', () => {
    expect(moverItemAntesDe(base, 'b', 'b').map(i => i.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  test('id inexistente => lista igual', () => {
    expect(moverItemAntesDe(base, 'x', 'a').map(i => i.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  test('no muta la lista original', () => {
    moverItemAntesDe(base, 'a', 'd')
    expect(base.map(i => i.id)).toEqual(['a', 'b', 'c', 'd'])
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

// ──────────────────────────────────────────────────────────────
// Un sprint solo se borra si está vacío (sin puntos ni notas) y lo
// pide un Dueño o quien lo creó.
// ──────────────────────────────────────────────────────────────
describe('puedeEliminarSprint', () => {
  const vacio = { id: 's1', creado_por: 'user-1' }

  test('Dueño puede borrar un sprint vacío aunque no sea el autor', () => {
    expect(puedeEliminarSprint(vacio, { userId: 'otro', esDuenio: true, items: [], notas: [] })).toBe(true)
  })

  test('el autor puede borrar su sprint vacío sin ser Dueño', () => {
    expect(puedeEliminarSprint(vacio, { userId: 'user-1', esDuenio: false, items: [], notas: [] })).toBe(true)
  })

  test('con puntos o notas, nadie lo borra', () => {
    expect(puedeEliminarSprint(vacio, { userId: 'user-1', esDuenio: true, items: [{ id: 'i1' }], notas: [] })).toBe(false)
    expect(puedeEliminarSprint(vacio, { userId: 'user-1', esDuenio: true, items: [], notas: [{ id: 'n1' }] })).toBe(false)
  })

  test('ni Dueño ni autor -> no', () => {
    expect(puedeEliminarSprint(vacio, { userId: 'otro', esDuenio: false, items: [], notas: [] })).toBe(false)
  })

  test('sprint viejo sin autor: solo Dueño', () => {
    const viejo = { id: 's2', creado_por: null }
    expect(puedeEliminarSprint(viejo, { userId: 'user-1', esDuenio: false, items: [], notas: [] })).toBe(false)
    expect(puedeEliminarSprint(viejo, { userId: 'user-1', esDuenio: true, items: [], notas: [] })).toBe(true)
  })

  test('sin sprint -> false', () => {
    expect(puedeEliminarSprint(null, { esDuenio: true })).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────
// Forzar la descarga de archivos servidos desde Supabase Storage
// (un .html si no, se abre en el navegador en vez de bajarse).
// ──────────────────────────────────────────────────────────────
describe('esArchivoStorage / urlDescargaAdjunto', () => {
  const enStorage = 'https://x.supabase.co/storage/v1/object/public/Bucket%20Publico/sprints/s1/i1/1690000000000/reporte.html'
  const externo = 'https://github.com/apsol/repo/pull/12'

  test('detecta un archivo de Storage', () => {
    expect(esArchivoStorage(enStorage)).toBe(true)
    expect(esArchivoStorage(externo)).toBe(false)
    expect(esArchivoStorage(null)).toBe(false)
  })

  test('agrega ?download a los archivos de Storage', () => {
    expect(urlDescargaAdjunto(enStorage)).toBe(enStorage + '?download')
  })

  test('si ya tiene query, usa &download', () => {
    expect(urlDescargaAdjunto(enStorage + '?token=abc')).toBe(enStorage + '?token=abc&download')
  })

  test('un link externo se devuelve intacto (no se puede forzar)', () => {
    expect(urlDescargaAdjunto(externo)).toBe(externo)
  })
})

// ──────────────────────────────────────────────────────────────
// Secciones: un punto con es_seccion=true actúa como título de grupo.
// La agrupación se calcula solo mirando el orden: cada punto normal
// "pertenece" a la sección más cercana que lo precede.
// ──────────────────────────────────────────────────────────────
describe('agruparPorSeccion', () => {
  test('sin ninguna sección, es un solo grupo sin título (lista plana de siempre)', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const grupos = agruparPorSeccion(items)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].seccion).toBeNull()
    expect(grupos[0].puntos.map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  test('puntos sueltos antes de la primera sección quedan en un grupo sin título', () => {
    const items = [
      { id: 'p1' },
      { id: 's1', es_seccion: true, titulo: 'Formulario' },
      { id: 'p2' }, { id: 'p3' },
    ]
    const grupos = agruparPorSeccion(items)
    expect(grupos).toHaveLength(2)
    expect(grupos[0]).toMatchObject({ seccion: null })
    expect(grupos[0].puntos.map(p => p.id)).toEqual(['p1'])
    expect(grupos[1].seccion.id).toBe('s1')
    expect(grupos[1].puntos.map(p => p.id)).toEqual(['p2', 'p3'])
  })

  test('si el primer punto ya es una sección, no hay grupo sin título', () => {
    const items = [
      { id: 's1', es_seccion: true, titulo: 'Formulario' },
      { id: 'p1' }, { id: 'p2' },
    ]
    const grupos = agruparPorSeccion(items)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].seccion.id).toBe('s1')
  })

  test('varias secciones seguidas, cada punto va a la más cercana', () => {
    const items = [
      { id: 's1', es_seccion: true, titulo: 'Formulario' },
      { id: 'p1' },
      { id: 's2', es_seccion: true, titulo: 'Mejoras' },
      { id: 'p2' }, { id: 'p3' },
    ]
    const grupos = agruparPorSeccion(items)
    expect(grupos.map(g => g.seccion.titulo)).toEqual(['Formulario', 'Mejoras'])
    expect(grupos[0].puntos.map(p => p.id)).toEqual(['p1'])
    expect(grupos[1].puntos.map(p => p.id)).toEqual(['p2', 'p3'])
  })

  test('una sección sin puntos debajo igual se muestra (grupo vacío)', () => {
    const items = [
      { id: 's1', es_seccion: true, titulo: 'Formulario' },
      { id: 's2', es_seccion: true, titulo: 'Vacía' },
    ]
    const grupos = agruparPorSeccion(items)
    expect(grupos.map(g => g.seccion.titulo)).toEqual(['Formulario', 'Vacía'])
    expect(grupos[1].puntos).toEqual([])
  })

  test('lista vacía / no-array -> sin grupos', () => {
    expect(agruparPorSeccion([])).toEqual([])
    expect(agruparPorSeccion(undefined)).toEqual([])
  })
})

describe('bloqueDeSeccion', () => {
  const items = [
    { id: 'p0' },
    { id: 's1', es_seccion: true },
    { id: 'p1' }, { id: 'p2' },
    { id: 's2', es_seccion: true },
    { id: 'p3' },
  ]

  test('el bloque de una sección es su título + los puntos hasta la próxima sección', () => {
    expect(bloqueDeSeccion(items, 's1').map(i => i.id)).toEqual(['s1', 'p1', 'p2'])
  })

  test('la última sección arrastra hasta el final de la lista', () => {
    expect(bloqueDeSeccion(items, 's2').map(i => i.id)).toEqual(['s2', 'p3'])
  })

  test('un id que no es sección (o no existe) da bloque vacío', () => {
    expect(bloqueDeSeccion(items, 'p1')).toEqual([])
    expect(bloqueDeSeccion(items, 'no-existe')).toEqual([])
  })
})

describe('moverBloqueAntesDe (arrastrar una sección entera)', () => {
  const items = [
    { id: 'p0' },
    { id: 's1', es_seccion: true },
    { id: 'p1' }, { id: 'p2' },
    { id: 's2', es_seccion: true },
    { id: 'p3' },
  ]

  test('mueve el título y sus puntos juntos, como un bloque, a la nueva posición', () => {
    const bloque = bloqueDeSeccion(items, 's2').map(i => i.id) // ['s2','p3']
    const resultado = moverBloqueAntesDe(items, bloque, 'p0')
    expect(resultado.map(i => i.id)).toEqual(['s2', 'p3', 'p0', 's1', 'p1', 'p2'])
  })

  test('soltar sobre un punto del propio bloque no hace nada', () => {
    const bloque = bloqueDeSeccion(items, 's1').map(i => i.id) // ['s1','p1','p2']
    expect(moverBloqueAntesDe(items, bloque, 'p1').map(i => i.id)).toEqual(items.map(i => i.id))
  })

  test('no muta la lista original', () => {
    const bloque = bloqueDeSeccion(items, 's2').map(i => i.id)
    moverBloqueAntesDe(items, bloque, 'p0')
    expect(items.map(i => i.id)).toEqual(['p0', 's1', 'p1', 'p2', 's2', 'p3'])
  })
})

describe('moverBloqueAdyacente (flechitas ↑/↓ sobre el título de una sección)', () => {
  const items = [
    { id: 'p0' },
    { id: 's1', es_seccion: true, titulo: 'Formulario' },
    { id: 'p1' },
    { id: 's2', es_seccion: true, titulo: 'Mejoras' },
    { id: 'p2' }, { id: 'p3' },
  ]

  test('subir intercambia el bloque completo con el grupo anterior', () => {
    const resultado = moverBloqueAdyacente(items, 's2', 'arriba')
    expect(resultado.map(i => i.id)).toEqual(['p0', 's2', 'p2', 'p3', 's1', 'p1'])
  })

  test('bajar intercambia el bloque completo con el grupo siguiente', () => {
    const resultado = moverBloqueAdyacente(items, 's1', 'abajo')
    expect(resultado.map(i => i.id)).toEqual(['p0', 's2', 'p2', 'p3', 's1', 'p1'])
  })

  test('si antes solo hay puntos sueltos (sin título), la sección igual sube e intercambia con ellos', () => {
    const resultado = moverBloqueAdyacente(items, 's1', 'arriba')
    expect(resultado.map(i => i.id)).toEqual(['s1', 'p1', 'p0', 's2', 'p2', 'p3'])
  })

  test('la última sección no puede bajar más', () => {
    expect(moverBloqueAdyacente(items, 's2', 'abajo').map(i => i.id)).toEqual(items.map(i => i.id))
  })

  test('id inexistente o que no es sección -> lista igual', () => {
    expect(moverBloqueAdyacente(items, 'p1', 'arriba').map(i => i.id)).toEqual(items.map(i => i.id))
    expect(moverBloqueAdyacente(items, 'no-existe', 'arriba').map(i => i.id)).toEqual(items.map(i => i.id))
  })
})

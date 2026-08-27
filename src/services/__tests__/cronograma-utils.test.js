import { describe, test, expect, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────────────────
// Tests de saldo de horas y días desde la última reunión
// (Panel derecho del Cronograma)
// ──────────────────────────────────────────────────────────────

const FECHA_REF = new Date('2026-08-26T12:00:00')

describe('calcularSaldoHoras', () => {
  let calcularSaldoHoras

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    calcularSaldoHoras = mod.calcularSaldoHoras
  })

  test('resta las horas ya agendadas en el mes de las horas contratadas', () => {
    const prospecto = { nombre: 'Escobar', hs_mensuales: 10 }
    const actividades = [
      { prospecto_nombre: 'Escobar', inicio: '2026-08-05T09:00:00', fin: '2026-08-05T13:00:00' }, // 4h
      { prospecto_nombre: 'Escobar', inicio: '2026-08-10T09:00:00', fin: '2026-08-10T11:00:00' } // 2h
    ]
    expect(calcularSaldoHoras(prospecto, actividades, FECHA_REF)).toBe(4)
  })

  test('devuelve null si el prospecto no tiene horas mensuales contratadas configuradas', () => {
    const prospecto = { nombre: 'Escobar', hs_mensuales: null }
    expect(calcularSaldoHoras(prospecto, [], FECHA_REF)).toBeNull()
  })

  test('no cuenta actividades de otros prospectos', () => {
    const prospecto = { nombre: 'Escobar', hs_mensuales: 10 }
    const actividades = [
      { prospecto_nombre: 'Consultora', inicio: '2026-08-05T09:00:00', fin: '2026-08-05T13:00:00' }
    ]
    expect(calcularSaldoHoras(prospecto, actividades, FECHA_REF)).toBe(10)
  })

  test('no cuenta actividades fuera del mes de referencia', () => {
    const prospecto = { nombre: 'Escobar', hs_mensuales: 10 }
    const actividades = [
      { prospecto_nombre: 'Escobar', inicio: '2026-07-05T09:00:00', fin: '2026-07-05T13:00:00' }
    ]
    expect(calcularSaldoHoras(prospecto, actividades, FECHA_REF)).toBe(10)
  })

  test('el saldo puede ser negativo si se agendó más de lo contratado', () => {
    const prospecto = { nombre: 'Escobar', hs_mensuales: 2 }
    const actividades = [
      { prospecto_nombre: 'Escobar', inicio: '2026-08-05T09:00:00', fin: '2026-08-05T14:00:00' } // 5h
    ]
    expect(calcularSaldoHoras(prospecto, actividades, FECHA_REF)).toBe(-3)
  })
})

describe('calcularDiasDesdeUltimaReunion', () => {
  let calcularDiasDesdeUltimaReunion

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    calcularDiasDesdeUltimaReunion = mod.calcularDiasDesdeUltimaReunion
  })

  test('devuelve los días transcurridos desde la reunión con cliente más reciente', () => {
    const actividades = [
      { prospecto_nombre: 'Escobar', inicio: '2026-08-16T09:00:00', reunion_cliente: true }
    ]
    expect(calcularDiasDesdeUltimaReunion(actividades, 'Escobar', FECHA_REF)).toBe(10)
  })

  test('ignora actividades que no son reunión con cliente', () => {
    const actividades = [
      { prospecto_nombre: 'Escobar', inicio: '2026-08-25T09:00:00', reunion_cliente: false }
    ]
    expect(calcularDiasDesdeUltimaReunion(actividades, 'Escobar', FECHA_REF)).toBeNull()
  })

  test('ignora reuniones de otros prospectos', () => {
    const actividades = [
      { prospecto_nombre: 'Consultora', inicio: '2026-08-25T09:00:00', reunion_cliente: true }
    ]
    expect(calcularDiasDesdeUltimaReunion(actividades, 'Escobar', FECHA_REF)).toBeNull()
  })

  test('devuelve null si nunca hubo una reunión con el cliente', () => {
    expect(calcularDiasDesdeUltimaReunion([], 'Escobar', FECHA_REF)).toBeNull()
  })

  test('ignora reuniones futuras posteriores a la fecha de referencia', () => {
    const actividades = [
      { prospecto_nombre: 'Escobar', inicio: '2026-09-01T09:00:00', reunion_cliente: true }
    ]
    expect(calcularDiasDesdeUltimaReunion(actividades, 'Escobar', FECHA_REF)).toBeNull()
  })

  test('toma la reunión más reciente cuando hay varias', () => {
    const actividades = [
      { prospecto_nombre: 'Escobar', inicio: '2026-08-01T09:00:00', reunion_cliente: true },
      { prospecto_nombre: 'Escobar', inicio: '2026-08-20T09:00:00', reunion_cliente: true }
    ]
    expect(calcularDiasDesdeUltimaReunion(actividades, 'Escobar', FECHA_REF)).toBe(6)
  })
})

// ──────────────────────────────────────────────────────────────
// La tabla `cronograma` guarda `prospecto_id` (FK), no texto libre. El
// formulario de la app sigue siendo un campo de texto libre ("Prospecto /
// Cliente") para poder escribir categorías internas (Consultora, Día Libre)
// que no son un prospecto real. Estas dos funciones traducen entre ambos
// mundos, usando la convención ya establecida en el historial migrado:
// prospecto_id NULL + descripción con el prefijo "[Categoría] resto".
// ──────────────────────────────────────────────────────────────

const PROSPECTOS = [
  { id: 'p-1', nombre: 'Escobar' },
  { id: 'p-2', nombre: 'DG 2026' }
]

describe('resolverProspectoParaGuardar', () => {
  let resolverProspectoParaGuardar

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    resolverProspectoParaGuardar = mod.resolverProspectoParaGuardar
  })

  test('devuelve el id del prospecto cuando el nombre escrito coincide con uno real', () => {
    const resultado = resolverProspectoParaGuardar('Escobar', 'Reunión mensual', PROSPECTOS)
    expect(resultado).toEqual({ prospecto_id: 'p-1', descripcion: 'Reunión mensual' })
  })

  test('devuelve prospecto_id null y antepone [Nombre] a la descripción cuando no hay coincidencia', () => {
    const resultado = resolverProspectoParaGuardar('Consultora', 'Varios', PROSPECTOS)
    expect(resultado).toEqual({ prospecto_id: null, descripcion: '[Consultora] Varios' })
  })

  test('no dobla el espacio cuando la descripción está vacía', () => {
    const resultado = resolverProspectoParaGuardar('Día Libre', '', PROSPECTOS)
    expect(resultado).toEqual({ prospecto_id: null, descripcion: '[Día Libre]' })
  })

  test('recorta espacios del nombre antes de buscar la coincidencia', () => {
    const resultado = resolverProspectoParaGuardar('  Escobar  ', 'x', PROSPECTOS)
    expect(resultado).toEqual({ prospecto_id: 'p-1', descripcion: 'x' })
  })
})

describe('extraerProspectoParaMostrar', () => {
  let extraerProspectoParaMostrar

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    extraerProspectoParaMostrar = mod.extraerProspectoParaMostrar
  })

  test('devuelve el nombre real tal cual cuando el prospecto está resuelto', () => {
    const resultado = extraerProspectoParaMostrar('Escobar', 'Reunión mensual')
    expect(resultado).toEqual({ prospecto_nombre: 'Escobar', descripcion: 'Reunión mensual' })
  })

  test('extrae la categoría del prefijo [Categoria] cuando no hay prospecto real', () => {
    const resultado = extraerProspectoParaMostrar(null, '[Consultora] Varios')
    expect(resultado).toEqual({ prospecto_nombre: 'Consultora', descripcion: 'Varios' })
  })

  test('un prefijo sin texto adicional no deja un espacio colgando en la descripción', () => {
    const resultado = extraerProspectoParaMostrar(null, '[Día Libre]')
    expect(resultado).toEqual({ prospecto_nombre: 'Día Libre', descripcion: '' })
  })

  test('sin prospecto y sin prefijo devuelve el nombre vacío', () => {
    const resultado = extraerProspectoParaMostrar(null, 'Algo sin categoría')
    expect(resultado).toEqual({ prospecto_nombre: '', descripcion: 'Algo sin categoría' })
  })

  test('es inversa de resolverProspectoParaGuardar para el caso sin match (round-trip)', async () => {
    const { resolverProspectoParaGuardar } = await import('../cronograma.js')
    const guardado = resolverProspectoParaGuardar('Consultora', 'Varios', PROSPECTOS)
    const mostrado = extraerProspectoParaMostrar(null, guardado.descripcion)
    expect(mostrado).toEqual({ prospecto_nombre: 'Consultora', descripcion: 'Varios' })
  })
})

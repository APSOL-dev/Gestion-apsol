import { describe, test, expect, vi, beforeEach } from 'vitest'
import moment from 'moment'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() }
}))

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

// `calcularDiasDesdeUltimaReunion(actividades, nombre, fecha)` (que filtraba
// un array completo de actividades en el cliente) se reemplazó por
// `calcularDiasDesde(fechaUltimaReunion, fecha)`: encontrar la última
// reunión de cada prospecto ahora lo hace el servidor (ver
// getUltimasReunionesPorProspecto más abajo), así que la función pura solo
// necesita calcular la diferencia de días entre dos fechas.
describe('calcularDiasDesde', () => {
  let calcularDiasDesde

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    calcularDiasDesde = mod.calcularDiasDesde
  })

  test('calcula los días transcurridos desde la fecha dada', () => {
    expect(calcularDiasDesde('2026-08-16T09:00:00', FECHA_REF)).toBe(10)
  })

  test('devuelve null si no hay fecha (nunca hubo reunión)', () => {
    expect(calcularDiasDesde(null, FECHA_REF)).toBeNull()
    expect(calcularDiasDesde(undefined, FECHA_REF)).toBeNull()
  })

  test('devuelve null si la fecha es posterior a la referencia (reunión agendada a futuro)', () => {
    expect(calcularDiasDesde('2026-09-01T09:00:00', FECHA_REF)).toBeNull()
  })

  test('cuenta por día calendario, no por horas exactas', () => {
    // FECHA_REF es 2026-08-26T12:00; una reunión esa misma mañana da 0 días, no negativo
    expect(calcularDiasDesde('2026-08-26T08:00:00', FECHA_REF)).toBe(0)
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de las consultas acotadas del Cronograma: en vez de traer toda la
// tabla (4400+ filas y creciendo) para filtrar/calcular en el cliente,
// estas piden al servidor solo lo que hace falta en cada caso.
// ──────────────────────────────────────────────────────────────

describe('getActividadesEnRango', () => {
  let getActividadesEnRango

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../cronograma.js')
    getActividadesEnRango = mod.getActividadesEnRango
  })

  test('lee por la RPC apsol_cronograma_visible (redacción por rol server-side), no de la tabla directa', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({ data: [{ id: '1' }, { id: '2', descripcion: 'Ocupado' }], error: null })

    const resultado = await getActividadesEnRango('2026-08-01T00:00:00.000Z', '2026-08-31T23:59:59.999Z')

    expect(supabase.rpc).toHaveBeenCalledWith('apsol_cronograma_visible', {
      p_desde: '2026-08-01T00:00:00.000Z',
      p_hasta: '2026-08-31T23:59:59.999Z'
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(resultado).toEqual([{ id: '1' }, { id: '2', descripcion: 'Ocupado' }])
  })

  test('devuelve [] si la RPC no trae nada', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getActividadesEnRango('a', 'b')).toEqual([])
  })

  test('propaga el error de la RPC', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('rpc caída') })
    await expect(getActividadesEnRango('a', 'b')).rejects.toThrow('rpc caída')
  })
})

describe('getActividadesDelMes', () => {
  let getActividadesDelMes

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../cronograma.js')
    getActividadesDelMes = mod.getActividadesDelMes
  })

  test('acota la consulta al mes completo de la fecha de referencia (vía la RPC visible)', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null })

    const fechaReferencia = new Date('2026-08-15T12:00:00')
    await getActividadesDelMes(fechaReferencia)

    const args = supabase.rpc.mock.calls[0][1]
    // Comparado en UTC contra el mismo cálculo (no contra un string fijo):
    // en husos horarios negativos, el fin de mes en hora local cae del
    // lado de septiembre al convertir a UTC — eso es correcto, no un bug.
    expect(args.p_desde).toBe(moment(fechaReferencia).startOf('month').toISOString())
    expect(args.p_hasta).toBe(moment(fechaReferencia).endOf('month').toISOString())
  })
})

describe('getUltimasReunionesPorProspecto', () => {
  let getUltimasReunionesPorProspecto

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../cronograma.js')
    getUltimasReunionesPorProspecto = mod.getUltimasReunionesPorProspecto
  })

  test('devuelve un Map con la fecha de la reunión más reciente por prospecto', async () => {
    const { supabase } = await import('../../lib/supabase')
    const eqMock = vi.fn().mockReturnThis()
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: eqMock,
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValueOnce({
        data: [
          { prospecto_id: 'p-1', inicio: '2026-08-20T10:00:00' },
          { prospecto_id: 'p-2', inicio: '2026-08-18T10:00:00' },
          { prospecto_id: 'p-1', inicio: '2026-08-05T10:00:00' } // más vieja: ya viene ordenado desc, se ignora
        ],
        error: null
      })
    })

    const resultado = await getUltimasReunionesPorProspecto(new Date('2026-08-26T12:00:00'))

    expect(eqMock).toHaveBeenCalledWith('reunion_cliente', true)
    expect(resultado.get('p-1')).toBe('2026-08-20T10:00:00')
    expect(resultado.get('p-2')).toBe('2026-08-18T10:00:00')
    expect(resultado.size).toBe(2)
  })

  test('ignora filas sin prospecto_id (categorías internas sin cliente real)', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValueOnce({
        data: [{ prospecto_id: null, inicio: '2026-08-20T10:00:00' }],
        error: null
      })
    })

    const resultado = await getUltimasReunionesPorProspecto()
    expect(resultado.size).toBe(0)
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

describe('resolverActividades', () => {
  let resolverActividades

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    resolverActividades = mod.resolverActividades
  })

  test('resuelve prospecto_id a prospecto_nombre para cada actividad de la lista', () => {
    const actividades = [
      { id: '1', prospecto_id: 'p-1', descripcion: 'Reunión mensual' },
      { id: '2', prospecto_id: null, descripcion: '[Consultora] Varios' }
    ]
    const resultado = resolverActividades(actividades, PROSPECTOS)
    expect(resultado[0]).toMatchObject({ prospecto_nombre: 'Escobar', descripcion: 'Reunión mensual' })
    expect(resultado[1]).toMatchObject({ prospecto_nombre: 'Consultora', descripcion: 'Varios' })
  })
})

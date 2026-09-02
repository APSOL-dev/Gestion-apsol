import { describe, test, expect, vi, beforeEach } from 'vitest'
import moment from 'moment'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() }
}))

// ──────────────────────────────────────────────────────────────
// Tests de saldo de horas y días desde la última reunión
// (Panel derecho del Cronograma)
// ──────────────────────────────────────────────────────────────

const FECHA_REF = new Date('2026-08-26T12:00:00Z')

// El rango por defecto del Cronograma es una ventana MÓVIL de los últimos
// 3 meses (de hoy hacia atrás), no el mes calendario en curso: se
// recalcula en cada carga, así el "estándar" siempre acompaña la fecha
// actual.
describe('rangoCronogramaPorDefecto', () => {
  let rangoCronogramaPorDefecto

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    rangoCronogramaPorDefecto = mod.rangoCronogramaPorDefecto
  })

  test('va de hoy hacia 3 meses atrás (ventana móvil, no el mes calendario)', () => {
    expect(rangoCronogramaPorDefecto(new Date('2026-09-02T12:00:00'))).toEqual({
      desde: '2026-06-02',
      hasta: '2026-09-02'
    })
  })

  test('cuando el día no existe en el mes destino, lo clampea al último (31 may - 3 meses -> 28 feb)', () => {
    expect(rangoCronogramaPorDefecto(new Date('2026-05-31T12:00:00'))).toEqual({
      desde: '2026-02-28',
      hasta: '2026-05-31'
    })
  })

  test('cruza el fin de año hacia atrás', () => {
    expect(rangoCronogramaPorDefecto(new Date('2026-01-15T12:00:00'))).toEqual({
      desde: '2025-10-15',
      hasta: '2026-01-15'
    })
  })
})

describe('descripcionCumpleMinimo', () => {
  let descripcionCumpleMinimo, DESCRIPCION_MIN_CARACTERES

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    descripcionCumpleMinimo = mod.descripcionCumpleMinimo
    DESCRIPCION_MIN_CARACTERES = mod.DESCRIPCION_MIN_CARACTERES
  })

  test('el mínimo es 60 caracteres', () => {
    expect(DESCRIPCION_MIN_CARACTERES).toBe(60)
  })

  test('false si tiene menos de 60 caracteres reales', () => {
    expect(descripcionCumpleMinimo('a'.repeat(59))).toBe(false)
    expect(descripcionCumpleMinimo('')).toBe(false)
    expect(descripcionCumpleMinimo(null)).toBe(false)
  })

  test('true con 60 o más', () => {
    expect(descripcionCumpleMinimo('a'.repeat(60))).toBe(true)
    expect(descripcionCumpleMinimo('a'.repeat(120))).toBe(true)
  })

  test('no cuenta espacios de sobra en los extremos', () => {
    expect(descripcionCumpleMinimo('   ' + 'a'.repeat(58) + '   ')).toBe(false)
  })
})

describe('fusionarEventosCalendar', () => {
  let fusionarEventosCalendar

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    fusionarEventosCalendar = mod.fusionarEventosCalendar
  })

  const gcal = [
    { id: 'g1', summary: 'Club de águilas', start: '2026-09-01T14:00:00-03:00', end: '2026-09-01T15:00:00-03:00' },
    { id: 'g2', summary: 'Reunión ya cargada', start: '2026-09-02T11:00:00-03:00', end: '2026-09-02T12:00:00-03:00' },
    { id: 'g3', summary: 'Feriado', start: '2026-09-03', end: '2026-09-04', allDay: true }
  ]

  test('mapea los eventos de Google como bloques de solo lectura', () => {
    const r = fusionarEventosCalendar(gcal, [])
    const club = r.find(e => e.gcalId === 'g1')
    expect(club).toMatchObject({ id: 'gcal-g1', prospecto_nombre: 'Club de águilas', origenCalendar: true })
    expect(club.inicio).toBe('2026-09-01T14:00:00-03:00')
  })

  test('no duplica un evento que ya tiene su actividad en el cronograma (mismo google_calendar_id)', () => {
    const r = fusionarEventosCalendar(gcal, [{ id: 'act-1', google_calendar_id: 'g2' }])
    expect(r.some(e => e.gcalId === 'g2')).toBe(false)
  })

  test('descarta los eventos de día completo', () => {
    const r = fusionarEventosCalendar(gcal, [])
    expect(r.some(e => e.gcalId === 'g3')).toBe(false)
  })

  test('tolera entradas vacías', () => {
    expect(fusionarEventosCalendar(null, null)).toEqual([])
  })
})

describe('construirEventoReunion', () => {
  let construirEventoReunion

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    construirEventoReunion = mod.construirEventoReunion
  })

  test('el título es la descripción del trabajo y los horarios son Desde/Hasta', () => {
    const ev = construirEventoReunion(
      { descripcion: 'Revisión mensual del tablero', inicio: '2026-09-02T15:00', fin: '2026-09-02T16:00' },
      ['ana@cliente.com', 'yo@apsol.com.ar']
    )
    expect(ev.summary).toBe('Revisión mensual del tablero')
    expect(ev.start).toEqual({ dateTime: '2026-09-02T15:00:00', timeZone: 'America/Argentina/Buenos_Aires' })
    expect(ev.end).toEqual({ dateTime: '2026-09-02T16:00:00', timeZone: 'America/Argentina/Buenos_Aires' })
    expect(ev.attendees).toEqual([{ email: 'ana@cliente.com' }, { email: 'yo@apsol.com.ar' }])
  })

  test('normaliza y deduplica emails (trim + minúsculas)', () => {
    const ev = construirEventoReunion(
      { descripcion: 'x', inicio: '2026-09-02T15:00', fin: '2026-09-02T16:00' },
      [' Ana@Cliente.com ', 'ana@cliente.com', '', null]
    )
    expect(ev.attendees).toEqual([{ email: 'ana@cliente.com' }])
  })

  test('sin descripción usa un título por defecto', () => {
    const ev = construirEventoReunion({ inicio: '2026-09-02T15:00', fin: '2026-09-02T16:00' }, [])
    expect(ev.summary).toBe('Reunión con cliente')
  })

  test('mete comentarios y link en la descripción del evento', () => {
    const ev = construirEventoReunion({
      descripcion: 'Kickoff', inicio: '2026-09-02T15:00', fin: '2026-09-02T16:00',
      comentarios_reunion: 'Temas: alcance', link_reunion: 'https://teams.microsoft.com/x'
    }, [])
    expect(ev.description).toBe('Temas: alcance\n\nhttps://teams.microsoft.com/x')
  })
})

describe('calcularHastaConDuracion', () => {
  let calcularHastaConDuracion

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    calcularHastaConDuracion = mod.calcularHastaConDuracion
  })

  test('suma N horas al "Desde" y devuelve formato datetime-local', () => {
    expect(calcularHastaConDuracion('2026-09-02T17:00', 3)).toBe('2026-09-02T20:00')
    expect(calcularHastaConDuracion('2026-09-02T17:30', 1)).toBe('2026-09-02T18:30')
  })

  test('cruza la medianoche', () => {
    expect(calcularHastaConDuracion('2026-09-02T22:00', 4)).toBe('2026-09-03T02:00')
  })

  test('desde inválido lo devuelve sin tocar', () => {
    expect(calcularHastaConDuracion('', 2)).toBe('')
  })
})

// Categorías internas fijas (no son clientes): además de los prospectos en
// producción, el selector "Prospecto / Cliente" del modal ofrece estas
// opciones estándar. Se guardan con prospecto_id NULL y el prefijo
// "[Categoría]" en la descripción (ver resolverProspectoParaGuardar).
describe('CATEGORIAS_CRONOGRAMA', () => {
  test('expone las categorías fijas internas en el orden acordado', async () => {
    const { CATEGORIAS_CRONOGRAMA } = await import('../cronograma.js')
    expect(CATEGORIAS_CRONOGRAMA).toEqual([
      'Consultora', 'Capacitación', 'Investigación', 'Día Libre', 'otros', 'Acción de venta'
    ])
  })
})

describe('HERRAMIENTAS_CRONOGRAMA', () => {
  test('expone las herramientas del Excel fuente de verdad', async () => {
    const { HERRAMIENTAS_CRONOGRAMA } = await import('../cronograma.js')
    expect(HERRAMIENTAS_CRONOGRAMA).toEqual([
      'Antigravity', 'N8N', 'Appsheet', 'Power Bi', 'Otros', 'Herramientas No utilizadas'
    ])
  })
})

describe('normalizarMultiplicador', () => {
  let normalizarMultiplicador
  beforeEach(async () => {
    ({ normalizarMultiplicador } = await import('../cronograma.js'))
  })

  test('vacío / null / undefined -> 1 por defecto', () => {
    expect(normalizarMultiplicador('')).toBe(1)
    expect(normalizarMultiplicador(null)).toBe(1)
    expect(normalizarMultiplicador(undefined)).toBe(1)
  })

  test('deja pasar decimales y negativos (rango real del Excel)', () => {
    expect(normalizarMultiplicador('1.35')).toBe(1.35)
    expect(normalizarMultiplicador(0.3)).toBe(0.3)
    expect(normalizarMultiplicador('-14')).toBe(-14)
  })

  test('texto no numérico -> vuelve al valor por defecto', () => {
    expect(normalizarMultiplicador('abc')).toBe(1)
    expect(normalizarMultiplicador('abc', 2)).toBe(2)
  })
})

// Cada prospecto tiene que verse de un color propio en el calendario para
// distinguir un bloque del siguiente. Antes había un mapa fijo de ~8
// nombres y TODO lo demás caía en el mismo índigo -> no se notaba el
// cambio. colorDeProspecto deriva un color estable del nombre.
describe('colorDeProspecto', () => {
  let colorDeProspecto, COLORES_CATEGORIA
  beforeEach(async () => {
    ({ colorDeProspecto, COLORES_CATEGORIA } = await import('../cronograma.js'))
  })

  test('es determinístico: mismo nombre -> mismo color', () => {
    expect(colorDeProspecto('Amipack 2025')).toBe(colorDeProspecto('Amipack 2025'))
  })

  test('nombres distintos dan colores distintos', () => {
    const a = colorDeProspecto('Amipack 2025')
    const b = colorDeProspecto('Conexion Market 2026')
    const c = colorDeProspecto('Estudio Gustavo Echarte')
    expect(new Set([a, b, c]).size).toBe(3)
  })

  test('las categorías fijas usan su color semántico', () => {
    expect(colorDeProspecto('Consultora')).toBe(COLORES_CATEGORIA['Consultora'])
    expect(colorDeProspecto('Día Libre')).toBe(COLORES_CATEGORIA['Día Libre'])
  })

  test('devuelve un color CSS válido (hex o hsl) y tolera vacío', () => {
    expect(colorDeProspecto('Cliente X')).toMatch(/^(#[0-9a-f]{6}|hsl\(\d+,\s*\d+%,\s*\d+%\))$/i)
    expect(typeof colorDeProspecto('')).toBe('string')
    expect(typeof colorDeProspecto(null)).toBe('string')
  })
})

// El saldo de horas es ACUMULADO desde el inicio del servicio (no se
// resetea cada mes) — misma fórmula que usaba AppSheet, reconstruida y
// verificada a mano contra ~12 prospectos reales del histórico (ver
// database/migration_saldo_horas_acumulado.sql). Las cifras de estos tests
// (24h/mes, inicio 2025-02-03, referencia 2026-08-30 -> ~454.50h teóricas;
// 16h/mes, inicio 2026-07-22 -> ~22.17h teóricas) son justamente dos de
// esos casos reales, no números inventados.

describe('calcularHorasTeoricas', () => {
  let calcularHorasTeoricas

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    calcularHorasTeoricas = mod.calcularHorasTeoricas
  })

  test('da 0 cuando el inicio de servicio es la fecha de referencia (todavía no pasó ninguna semana)', () => {
    expect(calcularHorasTeoricas(10, '2026-08-26', new Date('2026-08-26T12:00:00Z'))).toBe(0)
  })

  test('reproduce el cálculo real verificado contra el histórico (caso: ~19 meses de antigüedad)', () => {
    expect(calcularHorasTeoricas(24, '2025-02-03', new Date('2026-08-30T12:00:00Z'))).toBeCloseTo(454.5035, 3)
  })

  test('reproduce el cálculo real para un inicio de servicio reciente, dentro del mismo año', () => {
    expect(calcularHorasTeoricas(16, '2026-07-22', new Date('2026-08-30T12:00:00Z'))).toBeCloseTo(22.1709, 3)
  })
})

describe('calcularSaldoHoras', () => {
  let calcularSaldoHoras

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    calcularSaldoHoras = mod.calcularSaldoHoras
  })

  test('resta las horas teóricas (desde el inicio del servicio) de las horas dedicadas en TODO el historial', () => {
    const prospecto = { hs_mensuales: 16, inicio_servicio: '2026-07-22' }
    expect(calcularSaldoHoras(prospecto, 16.5, new Date('2026-08-30T12:00:00Z'))).toBe(-5.67)
  })

  test('redondea a 2 decimales (la precisión con la que se compara contra el histórico de AppSheet)', () => {
    const prospecto = { hs_mensuales: 16, inicio_servicio: '2026-07-22' }
    // Con 1 decimal esto daría -5.7; con 2, -5.67.
    const saldo = calcularSaldoHoras(prospecto, 16.5, new Date('2026-08-30T12:00:00Z'))
    expect(saldo).toBe(-5.67)
    expect(Number.isInteger(saldo * 100)).toBe(true)
  })

  test('devuelve null si el prospecto no tiene horas mensuales contratadas configuradas', () => {
    const prospecto = { hs_mensuales: null, inicio_servicio: '2026-01-01' }
    expect(calcularSaldoHoras(prospecto, 10, FECHA_REF)).toBeNull()
  })

  test('devuelve null si el prospecto no tiene fecha de inicio de servicio (no hay desde cuándo contar)', () => {
    const prospecto = { hs_mensuales: 10, inicio_servicio: null }
    expect(calcularSaldoHoras(prospecto, 10, FECHA_REF)).toBeNull()
  })

  test('sin horas dedicadas registradas todavía (undefined), las trata como 0', () => {
    const prospecto = { hs_mensuales: 16, inicio_servicio: '2026-07-22' }
    expect(calcularSaldoHoras(prospecto, undefined, new Date('2026-08-30T12:00:00Z'))).toBe(-22.17)
  })

  test('el saldo puede ser positivo si se dedicó más de lo teórico', () => {
    const prospecto = { hs_mensuales: 24, inicio_servicio: '2025-02-03' }
    expect(calcularSaldoHoras(prospecto, 500, new Date('2026-08-30T12:00:00Z'))).toBe(45.5)
  })
})

// Fórmula real de AppSheet para "Días desde la última reunión" (la pasó
// Adrian tal cual del editor):
//   IF(no hay ninguna reunión con cliente,
//      [Días desde el inicio de servicio],
//      HOUR(HOY() - MAX(fecha de la última reunión)) / 24)
// Dos detalles no obvios, verificados contra ~13 prospectos reales:
//  1. HOY() se evalúa en UTC (no en la zona horaria local del navegador) -
//     por eso todo acá usa moment.utc(), no moment().
//  2. Conserva la HORA exacta de la reunión (no trunca a medianoche como
//     hacía la versión vieja) - por eso una reunión de la tarde puede dar
//     un día menos de lo que un diff de calendario puro daría.
// También, a diferencia de la versión anterior, un valor futuro da un
// número NEGATIVO (así lo muestra AppSheet), ya no se nulea a "—".
describe('calcularDiasDesde', () => {
  let calcularDiasDesde

  beforeEach(async () => {
    const mod = await import('../cronograma.js')
    calcularDiasDesde = mod.calcularDiasDesde
  })

  test('reproduce el cálculo real verificado contra el histórico (caso: ATC 2025)', () => {
    expect(calcularDiasDesde('2026-07-15T14:00:00Z', null, new Date('2026-08-30T12:00:00Z'))).toBe(45)
  })

  test('reproduce el cálculo real para otro caso (Conexion Market 2026)', () => {
    expect(calcularDiasDesde('2026-08-25T13:00:00Z', null, new Date('2026-08-30T12:00:00Z'))).toBe(4)
  })

  test('una reunión agendada a futuro da un número negativo, no null', () => {
    expect(calcularDiasDesde('2026-09-01T14:00:00Z', null, new Date('2026-08-30T12:00:00Z'))).toBe(-3)
  })

  test('una reunión justo a la medianoche UTC de referencia da 0 días', () => {
    expect(calcularDiasDesde('2026-08-30T00:00:00Z', null, new Date('2026-08-30T12:00:00Z'))).toBe(0)
  })

  test('sin ninguna reunión registrada nunca, cae al fallback: días desde el inicio de servicio', () => {
    // inicio_servicio es una fecha pura (sin hora) - de 2026-06-30 a
    // 2026-08-30 (medianoche UTC) son 61 días de calendario.
    expect(calcularDiasDesde(null, '2026-06-30', new Date('2026-08-30T12:00:00Z'))).toBe(61)
  })

  test('sin reunión y sin inicio de servicio tampoco, no hay de dónde partir', () => {
    expect(calcularDiasDesde(null, null, FECHA_REF)).toBeNull()
    expect(calcularDiasDesde(undefined, undefined, FECHA_REF)).toBeNull()
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

describe('getHorasDedicadasPorProspecto', () => {
  let getHorasDedicadasPorProspecto

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../cronograma.js')
    getHorasDedicadasPorProspecto = mod.getHorasDedicadasPorProspecto
  })

  test('agrega las horas server-side vía RPC (SUM+GROUP BY, no trae el historial completo) y arma un Map por prospecto_id', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({
      data: [
        { prospecto_id: 'p-1', horas_dedicadas: '368.10' },
        { prospecto_id: 'p-2', horas_dedicadas: 92.5 }
      ],
      error: null
    })

    const resultado = await getHorasDedicadasPorProspecto()

    expect(supabase.rpc).toHaveBeenCalledWith('get_horas_dedicadas_por_prospecto')
    expect(resultado.get('p-1')).toBe(368.1)
    expect(resultado.get('p-2')).toBe(92.5)
    expect(resultado.size).toBe(2)
  })

  test('devuelve un Map vacío si la RPC no trae nada', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null })
    const resultado = await getHorasDedicadasPorProspecto()
    expect(resultado.size).toBe(0)
  })

  test('propaga el error de la RPC', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('rpc caída') })
    await expect(getHorasDedicadasPorProspecto()).rejects.toThrow('rpc caída')
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

  test('devuelve un Map con la fecha de la reunión más reciente por prospecto, vía RPC (no una consulta directa sujeta a la RLS del calendario)', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({
      data: [
        { prospecto_id: 'p-1', ultima_reunion: '2026-08-20T10:00:00+00:00' },
        { prospecto_id: 'p-2', ultima_reunion: '2026-08-18T10:00:00+00:00' }
      ],
      error: null
    })

    const resultado = await getUltimasReunionesPorProspecto(new Date('2026-08-26T12:00:00Z'))

    expect(supabase.rpc).toHaveBeenCalledWith('get_ultima_reunion_por_prospecto', {
      p_hasta: moment(new Date('2026-08-26T12:00:00Z')).toISOString()
    })
    expect(resultado.get('p-1')).toBe('2026-08-20T10:00:00+00:00')
    expect(resultado.get('p-2')).toBe('2026-08-18T10:00:00+00:00')
    expect(resultado.size).toBe(2)
  })

  test('ignora filas sin prospecto_id (categorías internas sin cliente real)', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({
      data: [{ prospecto_id: null, ultima_reunion: '2026-08-20T10:00:00+00:00' }],
      error: null
    })

    const resultado = await getUltimasReunionesPorProspecto()
    expect(resultado.size).toBe(0)
  })

  test('propaga el error de la RPC', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('rpc caída') })
    await expect(getUltimasReunionesPorProspecto()).rejects.toThrow('rpc caída')
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

// Regresión: `duracion_horas` no lo calcula ningún trigger de la base (se
// verificó que no existe ninguno) - si saveActividad no la manda, la
// columna queda NULL y el saldo de horas la ignora en silencio (cuenta 0
// para esa actividad). Antes, nada en el código la seteaba nunca.
describe('saveActividad calcula duracion_horas', () => {
  let saveActividad
  let insertMock, updateMock, selectMock, singleMock, eqMock, fromMock

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const { supabase } = await import('../../lib/supabase')
    insertMock = vi.fn()
    updateMock = vi.fn()
    selectMock = vi.fn()
    singleMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    eqMock = vi.fn()
    fromMock = vi.fn(() => ({ insert: insertMock, update: updateMock }))
    supabase.from.mockImplementation(fromMock)
    insertMock.mockReturnValue({ select: selectMock })
    updateMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ select: selectMock })
    selectMock.mockReturnValue({ single: singleMock })

    const mod = await import('../cronograma.js')
    saveActividad = mod.saveActividad
  })

  test('al crear, calcula duracion_horas a partir de inicio/fin y la incluye en el insert', async () => {
    await saveActividad({
      prospecto_id: 'p-1',
      inicio: '2026-08-27T09:00:00',
      fin: '2026-08-27T12:30:00'
    })

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ duracion_horas: 3.5 }))
  })

  test('al editar, recalcula duracion_horas (por si cambió el horario) y la incluye en el update', async () => {
    await saveActividad({
      id: 'act-1',
      inicio: '2026-08-27T09:00:00',
      fin: '2026-08-27T13:15:00'
    })

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ duracion_horas: 4.25 }))
  })
})

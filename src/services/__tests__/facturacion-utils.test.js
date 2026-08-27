import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// ──────────────────────────────────────────────────────────────
// Tests de cálculo de montos de factura (bruto/descuento/neto/saldo)
// ──────────────────────────────────────────────────────────────
describe('calcularMontosFactura', () => {
  let calcularMontosFactura

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    calcularMontosFactura = mod.calcularMontosFactura
  })

  test('usa la fórmula tarifa_base_uva * valor_uva_dia cuando ambas están cargadas', () => {
    const factura = { tarifa_base_uva: 100, valor_uva_dia: 1500, porcentaje_descuento: 10, monto: 999999 }
    const resultado = calcularMontosFactura(factura, [])
    expect(resultado.monto_bruto).toBe(150000)
    expect(resultado.descuento).toBe(15000)
    expect(resultado.monto_neto).toBe(135000)
    expect(resultado.saldo_pendiente).toBe(135000)
  })

  test('usa el monto persistido como fallback en facturas sin tarifa UVA cargada (históricas)', () => {
    const factura = { tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0, monto: 1019620 }
    const resultado = calcularMontosFactura(factura, [])
    expect(resultado.monto_bruto).toBe(1019620)
    expect(resultado.descuento).toBe(0)
    expect(resultado.monto_neto).toBe(1019620)
    expect(resultado.saldo_pendiente).toBe(1019620)
  })

  test('redondea el saldo pendiente a 2 decimales evitando el arrastre de floats', () => {
    const factura = { tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0, monto: 1019620 }
    const pagos = [{ monto: 0.1 }, { monto: 0.2 }]
    const resultado = calcularMontosFactura(factura, pagos)
    // 0.1 + 0.2 = 0.30000000000000004 en floats crudos de JS
    expect(resultado.saldo_pendiente).toBe(1019619.7)
  })

  test('el saldo pendiente nunca es negativo cuando los pagos superan el neto', () => {
    const factura = { tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0, monto: 100 }
    const resultado = calcularMontosFactura(factura, [{ monto: 150 }])
    expect(resultado.saldo_pendiente).toBe(0)
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de calcularPrefillFactura (precompletado al elegir prospecto
// en una factura nueva). Bugs reales reportados en producción:
// la tarifa base no se traía del prospecto, y el período no continuaba
// desde la última factura.
// ──────────────────────────────────────────────────────────────
describe('calcularPrefillFactura', () => {
  let calcularPrefillFactura

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    calcularPrefillFactura = mod.calcularPrefillFactura
  })

  test('BUG real: trae la tarifa UVA de "base_indice_valor" del prospecto, no de "tarifa_base" (columna vieja sin uso, siempre en 0)', () => {
    const prospecto = { inicio_servicio: '2025-02-03', tarifa_base: 0, base_indice_valor: 30 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: null,
      esNueva: true,
      facturaActual: {}
    })
    expect(updates.tarifa_base_uva).toBe(30)
  })

  test('sin última factura: arranca el período desde "inicio_servicio" del prospecto', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: null,
      esNueva: true,
      facturaActual: {}
    })
    expect(updates.periodo_desde).toBe('2025-02-03')
    expect(updates.periodo_hasta).toBe('2025-03-03')
  })

  test('con última factura: continúa el período desde su "periodo_hasta" y usa su tarifa, no la del prospecto', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const ultimaFactura = {
      periodo_hasta: '2026-01-19', tarifa_base_uva: 36, porcentaje_descuento: 5,
      cuenta_bancaria_id: 'cuenta-1', solo_invoice: false, contacto_cobro_id: 'contacto-1',
      contacto_cobro2_id: null, razon_social_id: 'razon-1', leyenda: 'Mantenimiento mensual'
    }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura,
      contactosEmpresa: [{ id: 'contacto-1' }],
      razonesSociales: [{ id: 'razon-1' }],
      esNueva: true,
      facturaActual: {}
    })
    expect(updates.periodo_desde).toBe('2026-01-19')
    expect(updates.periodo_hasta).toBe('2026-02-19')
    expect(updates.tarifa_base_uva).toBe(36)
    expect(updates.porcentaje_descuento).toBe(5)
    expect(updates.cuenta_bancaria_id).toBe('cuenta-1')
    expect(updates.contacto_id).toBe('contacto-1')
    expect(updates.razon_social_id).toBe('razon-1')
    expect(updates.leyenda).toBe('Mantenimiento mensual')
  })

  test('no pisa un período que el usuario ya cargó a mano', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { periodo_hasta: '2026-01-19', tarifa_base_uva: 36 },
      esNueva: true,
      facturaActual: { periodo_desde: '2026-05-01', periodo_hasta: '2026-06-01' }
    })
    expect(updates.periodo_desde).toBeUndefined()
    expect(updates.periodo_hasta).toBeUndefined()
    // Al no tocar el período tampoco recalcula la tarifa (va de la mano del período)
    expect(updates.tarifa_base_uva).toBeUndefined()
  })

  test('si el contacto de la última factura ya no pertenece a la empresa, usa el primer contacto disponible', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { contacto_cobro_id: 'contacto-viejo' },
      contactosEmpresa: [{ id: 'contacto-nuevo' }],
      esNueva: true,
      facturaActual: {}
    })
    expect(updates.contacto_id).toBe('contacto-nuevo')
  })

  test('en modo edición (esNueva=false) no toca período, tarifa, contacto ni cuenta bancaria', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { periodo_hasta: '2026-01-19', tarifa_base_uva: 36, cuenta_bancaria_id: 'cuenta-1' },
      contactosEmpresa: [{ id: 'contacto-1' }],
      esNueva: false,
      facturaActual: {}
    })
    expect(updates.periodo_desde).toBeUndefined()
    expect(updates.tarifa_base_uva).toBeUndefined()
    expect(updates.contacto_id).toBeUndefined()
    expect(updates.cuenta_bancaria_id).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de fecha local (evitar el corrimiento de día por UTC)
// ──────────────────────────────────────────────────────────────
describe('fechaLocalISO', () => {
  let fechaLocalISO

  beforeEach(async () => {
    const mod = await import('../../utils/fecha.js')
    fechaLocalISO = mod.fechaLocalISO
  })

  test('formatea año, mes y día locales con ceros a la izquierda', () => {
    const fecha = new Date(2026, 7, 25, 23, 45, 0) // 25/ago/2026 23:45 hora local
    expect(fechaLocalISO(fecha)).toBe('2026-08-25')
  })

  test('no se adelanta un día cerca de la medianoche, a diferencia de toISOString', () => {
    const fecha = new Date(2026, 0, 5, 23, 59, 0) // 5/ene/2026 23:59 hora local
    expect(fechaLocalISO(fecha)).toBe('2026-01-05')
  })
})

describe('esFechaCompleta', () => {
  let esFechaCompleta

  beforeEach(async () => {
    const mod = await import('../../utils/fecha.js')
    esFechaCompleta = mod.esFechaCompleta
  })

  test('acepta una fecha completa y válida', () => {
    expect(esFechaCompleta('2026-08-25')).toBe(true)
  })

  test('rechaza un año truncado mientras se tipea (bug real observado en producción)', () => {
    expect(esFechaCompleta('0002-08-10')).toBe(false)
    expect(esFechaCompleta('0020-08-10')).toBe(false)
    expect(esFechaCompleta('0202-08-10')).toBe(false)
  })

  test('rechaza vacío, null y undefined', () => {
    expect(esFechaCompleta('')).toBe(false)
    expect(esFechaCompleta(null)).toBe(false)
    expect(esFechaCompleta(undefined)).toBe(false)
  })

  test('rechaza un formato que no sea YYYY-MM-DD', () => {
    expect(esFechaCompleta('25/08/2026')).toBe(false)
  })
})

describe('sumarMeses', () => {
  let sumarMeses

  beforeEach(async () => {
    const mod = await import('../../utils/fecha.js')
    sumarMeses = mod.sumarMeses
  })

  test('suma meses dentro del mismo año', () => {
    expect(sumarMeses('2026-01-10', 6)).toBe('2026-07-10')
  })

  test('hace rollover de año cuando la suma supera diciembre', () => {
    expect(sumarMeses('2026-08-10', 6)).toBe('2027-02-10')
  })

  test('avanza exactamente un mes (caso "próxima factura")', () => {
    expect(sumarMeses('2026-08-10', 1)).toBe('2026-09-10')
  })

  test('devuelve vacío si la fecha no es válida', () => {
    expect(sumarMeses('', 1)).toBe('')
    expect(sumarMeses(null, 1)).toBe('')
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de formateo de montos (2 decimales exactos)
// ──────────────────────────────────────────────────────────────
describe('formatearMonto', () => {
  let formatearMonto

  beforeEach(async () => {
    const mod = await import('../../utils/formateo.js')
    formatearMonto = mod.formatearMonto
  })

  test('formatea un entero con exactamente 2 decimales en locale es-AR', () => {
    expect(formatearMonto(100000)).toBe('100.000,00')
  })

  test('formatea un número con decimales flotantes a exactamente 2 decimales', () => {
    expect(formatearMonto(711386.838)).toBe('711.386,84')
  })

  test('formatea un número negativo (descuento) correctamente', () => {
    expect(formatearMonto(-37441.413)).toBe('-37.441,41')
  })

  test('formatea cero correctamente', () => {
    expect(formatearMonto(0)).toBe('0,00')
  })

  test('formatea null como 0,00', () => {
    expect(formatearMonto(null)).toBe('0,00')
  })

  test('formatea undefined como 0,00', () => {
    expect(formatearMonto(undefined)).toBe('0,00')
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de sincronización de UVA desde API externa
// ──────────────────────────────────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  }
}))

vi.mock('../notificaciones.js', () => ({
  notificarFacturacion: vi.fn()
}))

describe('sincronizarUVADesdeAPI', () => {
  let sincronizarUVADesdeAPI

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../services/sincronizacionUva.js')
    sincronizarUVADesdeAPI = mod.sincronizarUVADesdeAPI
  })

  test('retorna el valor UVA del día marcado como exacto cuando la API responde correctamente', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { fecha: '2026-08-24', valor: 1650.50 },
        { fecha: '2026-08-25', valor: 1655.75 },
      ]
    })
    const resultado = await sincronizarUVADesdeAPI('2026-08-25')
    expect(resultado).toEqual({ valor: 1655.75, exacta: true })
  })

  test('retorna el valor más reciente marcado como NO exacto si la fecha pedida no está en la API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { fecha: '2026-08-24', valor: 1650.50 },
        { fecha: '2026-08-25', valor: 1655.75 },
      ]
    })
    const resultado = await sincronizarUVADesdeAPI('2026-08-27')
    expect(resultado).toEqual({ valor: 1655.75, exacta: false })
  })

  test('lanza error cuando la API responde con estado no-OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(sincronizarUVADesdeAPI('2026-08-25')).rejects.toThrow(
      'Error al consultar la API de cotizaciones UVA'
    )
  })
})

describe('obtenerUVAParaFecha', () => {
  let obtenerUVAParaFecha

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../../services/sincronizacionUva.js')
    obtenerUVAParaFecha = mod.obtenerUVAParaFecha
  })

  test('retorna el valor local sin llamar a la API si ya existe en BD', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: { valor: 1655.75 }, error: null })
    })
    const resultado = await obtenerUVAParaFecha('2026-08-25')
    expect(resultado).toBe(1655.75)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('llama a la API externa como fallback si el valor no existe en BD', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null })
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: { valor: 1655.75 }, error: null })
      })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ fecha: '2026-08-25', valor: 1655.75 }]
    })
    const resultado = await obtenerUVAParaFecha('2026-08-25')
    expect(resultado).toBe(1655.75)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  test('NO guarda en BD cuando la API cae al valor más reciente (fecha sin cotización exacta)', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null })
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ fecha: '2026-08-24', valor: 1650.50 }]
    })
    const resultado = await obtenerUVAParaFecha('0002-08-10')
    expect(resultado).toBe(1650.50)
    // Solo se llamó from() una vez, para el SELECT: nunca se intentó el INSERT
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de sincronización del histórico UVA
//
// Rediseñado para no traer la tabla completa (3804+ filas y creciendo) para
// diffear en el cliente ni pegarle a la API externa en cada login: primero
// se mira SOLO la fecha más reciente ya guardada (una fila), y si ya está
// al día con hoy, ni siquiera se llama a la API.
// ──────────────────────────────────────────────────────────────
describe('sincronizarHistoricoUVA', () => {
  let sincronizarHistoricoUVA

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00'))
    const mod = await import('../../services/sincronizacionUva.js')
    sincronizarHistoricoUVA = mod.sincronizarHistoricoUVA
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('si la última fecha local ya es hoy, no llama a la API externa', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: { fecha: '2026-08-25' }, error: null })
    })

    const resultado = await sincronizarHistoricoUVA()

    expect(resultado).toEqual({ insertados: 0 })
    expect(mockFetch).not.toHaveBeenCalled()
    // Una sola consulta (la de la última fecha), nunca trae la tabla entera.
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  test('si la base está desactualizada, llama a la API y guarda solo lo posterior a la última fecha local', async () => {
    const { supabase } = await import('../../lib/supabase')
    const upsertMock = vi.fn().mockResolvedValueOnce({ error: null })
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: { fecha: '2026-08-23' }, error: null })
      })
      .mockReturnValueOnce({ upsert: upsertMock })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { fecha: '2026-08-22', valor: 1640 }, // anterior a la última local: se ignora
        { fecha: '2026-08-23', valor: 1645 }, // la última local: ya la tenemos, se ignora
        { fecha: '2026-08-24', valor: 1650.50 }, // nueva
        { fecha: '2026-08-25', valor: 1655.75 }, // nueva (=hoy)
      ]
    })

    const resultado = await sincronizarHistoricoUVA()

    expect(resultado).toEqual({ insertados: 2 })
    expect(upsertMock).toHaveBeenCalledWith(
      [{ fecha: '2026-08-24', valor: 1650.50 }, { fecha: '2026-08-25', valor: 1655.75 }],
      { onConflict: 'fecha', ignoreDuplicates: true }
    )
  })

  test('nunca guarda fechas posteriores a hoy, aunque la API las devuelva', async () => {
    const { supabase } = await import('../../lib/supabase')
    const upsertMock = vi.fn().mockResolvedValueOnce({ error: null })
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: { fecha: '2026-08-24' }, error: null })
      })
      .mockReturnValueOnce({ upsert: upsertMock })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { fecha: '2026-08-25', valor: 1655.75 }, // hoy: válida
        { fecha: '2026-08-26', valor: 1660 },    // mañana: no debería guardarse
      ]
    })

    await sincronizarHistoricoUVA()

    expect(upsertMock).toHaveBeenCalledWith(
      [{ fecha: '2026-08-25', valor: 1655.75 }],
      { onConflict: 'fecha', ignoreDuplicates: true }
    )
  })

  test('si la base está vacía, guarda todo lo que venga de la API hasta hoy', async () => {
    const { supabase } = await import('../../lib/supabase')
    const upsertMock = vi.fn().mockResolvedValueOnce({ error: null })
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null })
      })
      .mockReturnValueOnce({ upsert: upsertMock })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { fecha: '2016-03-31', valor: 14.05 },
        { fecha: '2026-08-25', valor: 1655.75 },
      ]
    })

    const resultado = await sincronizarHistoricoUVA()

    expect(resultado).toEqual({ insertados: 2 })
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de savePago: recálculo de estado + avance de "Próxima Factura"
// ──────────────────────────────────────────────────────────────
describe('savePago', () => {
  let savePago

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../facturacion.js')
    savePago = mod.savePago
  })

  test('al completar el saldo, marca la factura Cobrada total y avanza 1 mes la Próxima Factura del prospecto', async () => {
    const { supabase } = await import('../../lib/supabase')

    const updateEstado = vi.fn().mockReturnThis()
    const updateEstadoEq = vi.fn().mockResolvedValueOnce({ error: null })
    const updateProxima = vi.fn().mockReturnThis()
    const updateProximaEq = vi.fn().mockResolvedValueOnce({ error: null })

    supabase.from
      // 1. INSERT del pago
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: { id: 'pago-1', monto: 100 }, error: null })
      })
      // 2. getFacturaById -> SELECT de la factura (estado ANTES del pago: Pendiente)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: 'factura-1', estado: 'Pendiente', prospecto_id: 'prospecto-1',
            monto: 100, tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0
          },
          error: null
        })
      })
      // 3. getFacturaById -> SELECT de los pagos (ya incluye el recién insertado)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [{ id: 'pago-1', monto: 100 }], error: null })
      })
      // 4. UPDATE del estado de la factura
      .mockReturnValueOnce({ update: updateEstado, eq: updateEstadoEq })
      // 5. SELECT de la próxima_factura del prospecto
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: { proxima_factura: '2026-08-10' }, error: null })
      })
      // 6. UPDATE de la próxima_factura del prospecto
      .mockReturnValueOnce({ update: updateProxima, eq: updateProximaEq })

    await savePago({ facturacion_id: 'factura-1', fecha: '2026-08-10', monto: 100 })

    expect(updateEstado).toHaveBeenCalledWith({ estado: 'Cobrada total' })
    expect(updateProxima).toHaveBeenCalledWith({ proxima_factura: '2026-09-10' })

    const { notificarFacturacion } = await import('../notificaciones.js')
    expect(notificarFacturacion).toHaveBeenCalledWith(
      'pago_recibido',
      expect.objectContaining({ id: 'factura-1' })
    )
  })

  test('si la factura queda con saldo pendiente, NO toca la Próxima Factura del prospecto', async () => {
    const { supabase } = await import('../../lib/supabase')

    const updateEstado = vi.fn().mockReturnThis()
    const updateEstadoEq = vi.fn().mockResolvedValueOnce({ error: null })

    supabase.from
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: { id: 'pago-1', monto: 50 }, error: null })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: 'factura-1', estado: 'Pendiente', prospecto_id: 'prospecto-1',
            monto: 100, tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0
          },
          error: null
        })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [{ id: 'pago-1', monto: 50 }], error: null })
      })
      .mockReturnValueOnce({ update: updateEstado, eq: updateEstadoEq })

    await savePago({ facturacion_id: 'factura-1', fecha: '2026-08-10', monto: 50 })

    expect(updateEstado).toHaveBeenCalledWith({ estado: 'Cobrada parcial' })
    // Solo 4 llamadas a from(): insert pago + 2 de getFacturaById + update estado.
    // Nunca debería tocar apsol_prospectos.
    expect(supabase.from).toHaveBeenCalledTimes(4)

    const { notificarFacturacion } = await import('../notificaciones.js')
    expect(notificarFacturacion).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────
// BUG real: el webhook de n8n manda WhatsApp al contacto de cobro, pero
// getFacturaById nunca traía su teléfono (el select de los joins de
// contactos solo pedía nombre/apellido/email) — por eso llegaba el aviso
// sin número de destinatario.
// ──────────────────────────────────────────────────────────────
describe('getFacturaById', () => {
  let getFacturaById

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../facturacion.js')
    getFacturaById = mod.getFacturaById
  })

  test('pide el teléfono de ambos contactos de cobro (lo necesita el webhook de WhatsApp)', async () => {
    const { supabase } = await import('../../lib/supabase')
    const selectFactura = vi.fn().mockReturnThis()

    supabase.from
      .mockReturnValueOnce({
        select: selectFactura,
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'factura-1', monto: 100, tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0 },
          error: null
        })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [], error: null })
      })

    await getFacturaById('factura-1')

    const selectArg = selectFactura.mock.calls[0][0]
    expect(selectArg).toMatch(/contactos:apsol_contactos!facturacion_contacto_cobro_id_fkey\([^)]*telefono/)
    expect(selectArg).toMatch(/contacto2:apsol_contactos!facturacion_contacto_cobro2_id_fkey\([^)]*telefono/)
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de saveFactura: notificación "primera_vez" al webhook único
// de facturación solo cuando se CREA una factura (insert), nunca al
// editar una ya existente (update).
// ──────────────────────────────────────────────────────────────
describe('saveFactura', () => {
  let saveFactura

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../facturacion.js')
    saveFactura = mod.saveFactura
  })

  test('al crear una factura nueva, notifica "primera_vez" con la factura completa (con joins)', async () => {
    const { supabase } = await import('../../lib/supabase')
    const { notificarFacturacion } = await import('../notificaciones.js')

    supabase.from
      // 1. INSERT de la factura
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'factura-1', numero_factura: '303', contacto_cobro_id: 'contacto-1' },
          error: null
        })
      })
      // 2. getFacturaById -> SELECT de la factura completa (con joins)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: 'factura-1', numero_factura: '303', contacto_cobro_id: 'contacto-1',
            prospecto_id: 'prospecto-1', monto: 0, tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0
          },
          error: null
        })
      })
      // 3. getFacturaById -> SELECT de los pagos (factura recién creada, sin pagos)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [], error: null })
      })

    const resultado = await saveFactura({ numero_factura: '303', contacto_id: 'contacto-1' })

    expect(notificarFacturacion).toHaveBeenCalledWith(
      'primera_vez',
      expect.objectContaining({ id: 'factura-1', numero_factura: '303' })
    )
    expect(resultado.notificacionEnviada).toBe(true)
  })

  test('si el webhook de notificación falla, la factura igual se guarda (no revienta el guardado) y lo informa en el resultado', async () => {
    // BUG real: antes esto se tragaba el error silenciosamente (solo un
    // console.error) y la pantalla no tenía forma de avisarle al usuario
    // que la factura se guardó pero nadie recibió el aviso por WhatsApp/mail.
    const { supabase } = await import('../../lib/supabase')
    const { notificarFacturacion } = await import('../notificaciones.js')
    notificarFacturacion.mockRejectedValueOnce(new Error('Webhook caído'))

    supabase.from
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'factura-1', numero_factura: '303', contacto_cobro_id: 'contacto-1' },
          error: null
        })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: 'factura-1', numero_factura: '303', contacto_cobro_id: 'contacto-1',
            prospecto_id: 'prospecto-1', monto: 0, tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0
          },
          error: null
        })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [], error: null })
      })

    const resultado = await saveFactura({ numero_factura: '303', contacto_id: 'contacto-1' })

    expect(resultado.id).toBe('factura-1')
    expect(resultado.notificacionEnviada).toBe(false)
  })

  test('al editar una factura existente, NO notifica "primera_vez"', async () => {
    const { supabase } = await import('../../lib/supabase')
    const { notificarFacturacion } = await import('../notificaciones.js')

    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: { id: 'factura-1', numero_factura: '303' }, error: null })
    })

    await saveFactura({ id: 'factura-1', numero_factura: '303' })

    expect(notificarFacturacion).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de getUltimaFacturaProspecto.
// BUG real corregido: la consulta filtraba con .neq('estado', 'Anulada'),
// pero 'Anulada' NO es un valor válido de la columna enum estado_factura
// (los valores reales son Pendiente/Enviada/Cobrada parcial/Cobrada total).
// Postgres tira "invalid input value for enum" ante ese filtro, así que la
// consulta fallaba SIEMPRE que el prospecto tuviera alguna factura previa,
// rompiendo todo el precompletado de la factura nueva (tarifa, período,
// cuenta bancaria, contacto, razón social, leyenda).
// ──────────────────────────────────────────────────────────────
describe('getUltimaFacturaProspecto', () => {
  let getUltimaFacturaProspecto

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../facturacion.js')
    getUltimaFacturaProspecto = mod.getUltimaFacturaProspecto
  })

  test('no filtra por un estado "Anulada" inexistente en el enum (regresión del bug real)', async () => {
    const { supabase } = await import('../../lib/supabase')
    const maybeSingle = vi.fn().mockResolvedValueOnce({
      data: { periodo_hasta: '2026-01-19', tarifa_base_uva: 36 },
      error: null
    })
    // Mock deliberadamente SIN método .neq(): si el código todavía lo
    // llamara, esto explota con "query.neq is not a function" y el test
    // detecta la regresión sin necesitar una base de datos real.
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle
    }
    supabase.from.mockReturnValueOnce(query)

    const resultado = await getUltimaFacturaProspecto('prospecto-1')

    expect(resultado).toEqual({ periodo_hasta: '2026-01-19', tarifa_base_uva: 36 })
    expect(query.eq).toHaveBeenCalledWith('prospecto_id', 'prospecto-1')
    expect(query.not).toHaveBeenCalledWith('periodo_hasta', 'is', null)
  })

  test('devuelve null cuando el prospecto no tiene ninguna factura previa', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null })
    })

    const resultado = await getUltimaFacturaProspecto('prospecto-nuevo')
    expect(resultado).toBeNull()
  })
})

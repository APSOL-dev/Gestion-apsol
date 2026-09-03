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

  test('redondeo_multiplo > 0: redondea el NETO hacia abajo al múltiplo indicado', () => {
    // bruto = 100.37 * 1500 = 150555 ; sin descuento ; neto crudo 150555
    const factura = { tarifa_base_uva: 100.37, valor_uva_dia: 1500, porcentaje_descuento: 0, redondeo_multiplo: 1000 }
    const r = calcularMontosFactura(factura, [])
    expect(r.monto_bruto).toBe(150555)
    expect(r.monto_neto).toBe(150000)
    expect(r.saldo_pendiente).toBe(150000)
  })

  test('redondeo_multiplo aplica DESPUÉS del descuento', () => {
    // bruto 150000 ; -7% = 139500 ; floor a 1000 = 139000
    const factura = { tarifa_base_uva: 100, valor_uva_dia: 1500, porcentaje_descuento: 7, redondeo_multiplo: 1000 }
    const r = calcularMontosFactura(factura, [])
    expect(r.descuento).toBe(10500)
    expect(r.monto_neto).toBe(139000)
  })

  test('redondeo_multiplo = 0 (o ausente) no cambia nada: facturas históricas intactas', () => {
    const factura = { tarifa_base_uva: 100, valor_uva_dia: 1500, porcentaje_descuento: 10, redondeo_multiplo: 0 }
    expect(calcularMontosFactura(factura, []).monto_neto).toBe(135000)
    const sinCampo = { tarifa_base_uva: 100, valor_uva_dia: 1500, porcentaje_descuento: 10 }
    expect(calcularMontosFactura(sinCampo, []).monto_neto).toBe(135000)
  })

  test('redondeo_multiplo también aplica sobre un monto manual', () => {
    const factura = { tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0, monto: 137450, redondeo_multiplo: 1000 }
    expect(calcularMontosFactura(factura, []).monto_neto).toBe(137000)
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
  let REDONDEO_MULTIPLO_DEFAULT

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    calcularPrefillFactura = mod.calcularPrefillFactura
    REDONDEO_MULTIPLO_DEFAULT = mod.REDONDEO_MULTIPLO_DEFAULT
  })

  test('el múltiplo de redondeo por defecto es 1000', () => {
    expect(REDONDEO_MULTIPLO_DEFAULT).toBe(1000)
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

  test('arrastra a la próxima factura el redondeo, el tilde de horas en leyenda y las horas facturadas', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const ultimaFactura = {
      periodo_hasta: '2026-01-19', tarifa_base_uva: 36,
      redondeo_multiplo: 1000, incluir_horas_leyenda: true, hs_facturadas: 15
    }
    const updates = calcularPrefillFactura({ prospecto, ultimaFactura, esNueva: true, facturaActual: {} })
    expect(updates.redondeo_multiplo).toBe(1000)
    expect(updates.incluir_horas_leyenda).toBe(true)
    expect(updates.hs_facturadas).toBe(15)
  })

  test('redondeo: sin última factura, arranca en 1000 por defecto', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const updates = calcularPrefillFactura({ prospecto, ultimaFactura: null, esNueva: true, facturaActual: {} })
    expect(updates.redondeo_multiplo).toBe(1000)
  })

  test('redondeo: si la última factura tiene 0 (histórica, sin elección real), igual arranca en 1000', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { periodo_hasta: '2026-01-19', redondeo_multiplo: 0 },
      esNueva: true, facturaActual: {}
    })
    expect(updates.redondeo_multiplo).toBe(1000)
  })

  test('redondeo: un múltiplo propio > 0 de la última factura le gana al default', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { periodo_hasta: '2026-01-19', redondeo_multiplo: 500 },
      esNueva: true, facturaActual: {}
    })
    expect(updates.redondeo_multiplo).toBe(500)
  })

  test('horas facturadas: por defecto toma las horas contratadas del prospecto (hs_mensuales)', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30, hs_mensuales: 20 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { periodo_hasta: '2026-01-19', tarifa_base_uva: 36 }, // sin hs_facturadas
      esNueva: true, facturaActual: {}
    })
    expect(updates.hs_facturadas).toBe(20)
  })

  test('horas facturadas: el valor de la última factura le gana a las horas contratadas del prospecto', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30, hs_mensuales: 20 }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { periodo_hasta: '2026-01-19', hs_facturadas: 15 },
      esNueva: true, facturaActual: {}
    })
    expect(updates.hs_facturadas).toBe(15)
  })

  test('horas facturadas: sin última factura ni hs_mensuales cargadas, no precompleta nada', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const updates = calcularPrefillFactura({ prospecto, ultimaFactura: null, esNueva: true, facturaActual: {} })
    expect(updates.hs_facturadas).toBeUndefined()
  })

  test('cuenta para depósito: por defecto toma la cuenta configurada en el prospecto', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30, cuenta_bancaria_id: 'cuenta-prospecto' }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { periodo_hasta: '2026-01-19', tarifa_base_uva: 36 }, // sin cuenta_bancaria_id
      esNueva: true, facturaActual: {}
    })
    expect(updates.cuenta_bancaria_id).toBe('cuenta-prospecto')
  })

  test('cuenta para depósito: la de la última factura le gana a la del prospecto', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30, cuenta_bancaria_id: 'cuenta-prospecto' }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { periodo_hasta: '2026-01-19', cuenta_bancaria_id: 'cuenta-ultima-factura' },
      esNueva: true, facturaActual: {}
    })
    expect(updates.cuenta_bancaria_id).toBe('cuenta-ultima-factura')
  })

  test('cuenta para depósito: no pisa la que el usuario ya eligió a mano', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30, cuenta_bancaria_id: 'cuenta-prospecto' }
    const updates = calcularPrefillFactura({
      prospecto,
      ultimaFactura: { cuenta_bancaria_id: 'cuenta-ultima-factura' },
      esNueva: true, facturaActual: { cuenta_bancaria_id: 'cuenta-elegida-a-mano' }
    })
    expect(updates.cuenta_bancaria_id).toBeUndefined()
  })

  test('no pisa el redondeo / tilde / horas que el usuario ya cargó a mano en la factura', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const ultimaFactura = { redondeo_multiplo: 1000, incluir_horas_leyenda: true, hs_facturadas: 15 }
    const updates = calcularPrefillFactura({
      prospecto, ultimaFactura, esNueva: true,
      facturaActual: { redondeo_multiplo: 500, incluir_horas_leyenda: false, hs_facturadas: 8 }
    })
    expect(updates.redondeo_multiplo).toBeUndefined()
    expect(updates.incluir_horas_leyenda).toBeUndefined()
    expect(updates.hs_facturadas).toBeUndefined()
  })

  test('en edición (esNueva=false) no arrastra redondeo / tilde / horas', () => {
    const prospecto = { inicio_servicio: '2025-02-03', base_indice_valor: 30 }
    const ultimaFactura = { redondeo_multiplo: 1000, incluir_horas_leyenda: true, hs_facturadas: 15 }
    const updates = calcularPrefillFactura({ prospecto, ultimaFactura, esNueva: false, facturaActual: {} })
    expect(updates.redondeo_multiplo).toBeUndefined()
    expect(updates.incluir_horas_leyenda).toBeUndefined()
    expect(updates.hs_facturadas).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────
// componerLeyendaFactura: arma el bloque NO editable que se copia con un
// botón. Es leyenda + (horas, si está el tilde) + período (fechas completas
// dd/mm/aaaa, las dos puntas). Función pura.
// ──────────────────────────────────────────────────────────────
describe('componerLeyendaFactura', () => {
  let componerLeyendaFactura

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    componerLeyendaFactura = mod.componerLeyendaFactura
  })

  test('leyenda + período con fechas completas dd/mm/aaaa', () => {
    const out = componerLeyendaFactura({
      leyenda: 'Servicios profesionales de consultoría',
      periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31'
    })
    expect(out).toBe('Servicios profesionales de consultoría\nPeríodo: 01/08/2026 al 31/08/2026')
  })

  test('con el tilde activo agrega la línea de horas facturadas entre la leyenda y el período', () => {
    const out = componerLeyendaFactura({
      leyenda: 'Mantenimiento mensual',
      incluir_horas_leyenda: true, hs_facturadas: 12,
      periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31'
    })
    expect(out).toBe('Mantenimiento mensual\nHoras facturadas: 12\nPeríodo: 01/08/2026 al 31/08/2026')
  })

  test('sin el tilde, las horas NO aparecen aunque haya valor cargado', () => {
    const out = componerLeyendaFactura({
      leyenda: 'Mantenimiento mensual',
      incluir_horas_leyenda: false, hs_facturadas: 12,
      periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31'
    })
    expect(out).not.toMatch(/Horas facturadas/)
  })

  test('con el tilde pero sin horas cargadas (0, null, vacío) no agrega la línea de horas', () => {
    const base = { leyenda: 'X', incluir_horas_leyenda: true, periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31' }
    expect(componerLeyendaFactura({ ...base, hs_facturadas: 0 })).not.toMatch(/Horas facturadas/)
    expect(componerLeyendaFactura({ ...base, hs_facturadas: null })).not.toMatch(/Horas facturadas/)
    expect(componerLeyendaFactura({ ...base, hs_facturadas: '' })).not.toMatch(/Horas facturadas/)
  })

  test('sin leyenda arranca directo (sin línea en blanco arriba)', () => {
    const out = componerLeyendaFactura({ leyenda: '', periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31' })
    expect(out).toBe('Período: 01/08/2026 al 31/08/2026')
  })

  test('si falta alguna fecha del período, no agrega la línea de período', () => {
    expect(componerLeyendaFactura({ leyenda: 'X', periodo_desde: '2026-08-01', periodo_hasta: '' })).toBe('X')
    expect(componerLeyendaFactura({ leyenda: 'X', periodo_desde: '', periodo_hasta: '2026-08-31' })).toBe('X')
  })

  test('tolera fechas ISO con hora (las recorta a la parte de fecha)', () => {
    const out = componerLeyendaFactura({
      leyenda: 'X', periodo_desde: '2026-08-01T00:00:00', periodo_hasta: '2026-08-31T00:00:00'
    })
    expect(out).toBe('X\nPeríodo: 01/08/2026 al 31/08/2026')
  })

  test('todo vacío devuelve string vacío', () => {
    expect(componerLeyendaFactura({})).toBe('')
  })
})

// ──────────────────────────────────────────────────────────────
// fechaReferenciaUva: qué fecha del período se usa para buscar el valor UVA.
// Por defecto la de inicio; el prospecto puede pedir la de fin.
// ──────────────────────────────────────────────────────────────
describe('fechaReferenciaUva', () => {
  let fechaReferenciaUva

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    fechaReferenciaUva = mod.fechaReferenciaUva
  })

  test('por defecto usa la fecha de inicio del período', () => {
    expect(fechaReferenciaUva({ periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31' })).toBe('2026-08-01')
    expect(fechaReferenciaUva({ uva_referencia_periodo: 'inicio', periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31' })).toBe('2026-08-01')
  })

  test('con "fin" usa la fecha de fin del período', () => {
    expect(fechaReferenciaUva({ uva_referencia_periodo: 'fin', periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31' })).toBe('2026-08-31')
  })

  test('un valor desconocido cae a inicio', () => {
    expect(fechaReferenciaUva({ uva_referencia_periodo: 'cualquiera', periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31' })).toBe('2026-08-01')
  })

  test('devuelve string vacío si la fecha elegida no está cargada', () => {
    expect(fechaReferenciaUva({ uva_referencia_periodo: 'fin', periodo_desde: '2026-08-01', periodo_hasta: '' })).toBe('')
    expect(fechaReferenciaUva({})).toBe('')
  })
})

// ──────────────────────────────────────────────────────────────
// validarFacturaParaGuardar: campos obligatorios al CREAR una factura.
// ──────────────────────────────────────────────────────────────
describe('validarFacturaParaGuardar', () => {
  let validarFacturaParaGuardar

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    validarFacturaParaGuardar = mod.validarFacturaParaGuardar
  })

  const completa = {
    solo_invoice: true,
    periodo_desde: '2026-08-01',
    periodo_hasta: '2026-09-01',
    contacto_id: 'c1',
    cuenta_bancaria_id: 'cb1',
    leyenda: 'Mantenimiento mensual',
  }

  test('una factura con todos los obligatorios no da errores', () => {
    expect(validarFacturaParaGuardar(completa)).toEqual([])
  })

  test('nº de factura fiscal: obligatorio si NO es "solo invoice"', () => {
    expect(validarFacturaParaGuardar({ ...completa, solo_invoice: false, numero_factura: '' }))
      .toContain('Falta el número de factura fiscal.')
    expect(validarFacturaParaGuardar({ ...completa, solo_invoice: false, numero_factura: 'A-0001-00012345' }))
      .toEqual([])
  })

  test('nº de factura NO se exige cuando es "solo invoice" (se autogenera)', () => {
    expect(validarFacturaParaGuardar({ ...completa, solo_invoice: true, numero_factura: '' }))
      .toEqual([])
  })

  test('período Desde y Hasta son ambos obligatorios', () => {
    expect(validarFacturaParaGuardar({ ...completa, periodo_desde: '' })).toContain('Falta el período (Desde).')
    expect(validarFacturaParaGuardar({ ...completa, periodo_hasta: '' })).toContain('Falta el período (Hasta).')
  })

  test('contacto de cobro principal obligatorio; el secundario no', () => {
    expect(validarFacturaParaGuardar({ ...completa, contacto_id: '' }))
      .toContain('Falta el contacto de cobro principal.')
    // sin contacto secundario -> sigue siendo válida
    expect(validarFacturaParaGuardar({ ...completa, contacto_cobro2_id: '' })).toEqual([])
  })

  test('cuenta para depósito obligatoria', () => {
    expect(validarFacturaParaGuardar({ ...completa, cuenta_bancaria_id: '' }))
      .toContain('Falta la cuenta para depósito.')
  })

  test('leyenda obligatoria (y no vale solo espacios)', () => {
    expect(validarFacturaParaGuardar({ ...completa, leyenda: '' })).toContain('Falta la leyenda de la factura.')
    expect(validarFacturaParaGuardar({ ...completa, leyenda: '   ' })).toContain('Falta la leyenda de la factura.')
  })

  test('acumula todos los errores de una factura vacía', () => {
    const errores = validarFacturaParaGuardar({ solo_invoice: false })
    expect(errores).toEqual(expect.arrayContaining([
      'Falta el número de factura fiscal.',
      'Falta el período (Desde).',
      'Falta el período (Hasta).',
      'Falta el contacto de cobro principal.',
      'Falta la cuenta para depósito.',
      'Falta la leyenda de la factura.',
    ]))
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
    rpc: vi.fn(),
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
      // 1. SELECT del estado previo de la factura (antes de tocar los pagos)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: { estado: 'Pendiente' }, error: null })
      })
      // 2. INSERT del pago
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: { id: 'pago-1', monto: 100 }, error: null })
      })
      // 3. getFacturaById -> SELECT de la factura
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
      // 4. getFacturaById -> SELECT de los pagos (ya incluye el recién insertado)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [{ id: 'pago-1', monto: 100 }], error: null })
      })
      // 5. UPDATE del estado de la factura (fallback del trigger)
      .mockReturnValueOnce({ update: updateEstado, eq: updateEstadoEq })
      // 6. SELECT de la próxima_factura del prospecto
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: { proxima_factura: '2026-08-10' }, error: null })
      })
      // 7. UPDATE de la próxima_factura del prospecto
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
      // 1. SELECT del estado previo
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: { estado: 'Pendiente' }, error: null })
      })
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
    // 5 llamadas a from(): estado previo + insert pago + 2 de getFacturaById + update estado.
    // Nunca debería tocar apsol_prospectos.
    expect(supabase.from).toHaveBeenCalledTimes(5)

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

  test('trae dias_espera_facturacion de la empresa (lo usa saveFactura para agendar el 1er recordatorio de cobro)', async () => {
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
    expect(selectArg).toMatch(/empresas:apsol_empresas\([^)]*dias_espera_facturacion/)
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de resolverDiasEspera: cuántos días hábiles espera la app antes
// de agendar el primer recordatorio de pago. Sale de la empresa; si no
// hay dato (empresa nueva o vieja sin cargar), el estándar es 4.
// ──────────────────────────────────────────────────────────────
describe('resolverDiasEspera', () => {
  let resolverDiasEspera
  let DIAS_ESPERA_FACTURACION_DEFAULT

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    resolverDiasEspera = mod.resolverDiasEspera
    DIAS_ESPERA_FACTURACION_DEFAULT = mod.DIAS_ESPERA_FACTURACION_DEFAULT
  })

  test('el estándar de la casa es 4 días hábiles (coincide con el DEFAULT de la columna en la DB)', () => {
    expect(DIAS_ESPERA_FACTURACION_DEFAULT).toBe(4)
  })

  test('respeta un fallback explícito distinto si se lo pasan', () => {
    expect(resolverDiasEspera(null, 10)).toBe(10)
    expect(resolverDiasEspera({ dias_espera_facturacion: 0 }, 10)).toBe(10)
  })

  test('usa dias_espera_facturacion de la empresa cuando es un número válido', () => {
    expect(resolverDiasEspera({ dias_espera_facturacion: 7 })).toBe(7)
  })

  test('acepta el valor aunque venga como string (los <input number> lo devuelven así)', () => {
    expect(resolverDiasEspera({ dias_espera_facturacion: '6' })).toBe(6)
  })

  test('cae a 4 cuando la empresa no tiene el campo, es null, es 0 o es inválido', () => {
    expect(resolverDiasEspera({ dias_espera_facturacion: null })).toBe(4)
    expect(resolverDiasEspera({ dias_espera_facturacion: 0 })).toBe(4)
    expect(resolverDiasEspera({ dias_espera_facturacion: 'x' })).toBe(4)
    expect(resolverDiasEspera({})).toBe(4)
  })

  test('cae a 4 cuando no llega ninguna empresa (factura sin joins resueltos)', () => {
    expect(resolverDiasEspera(null)).toBe(4)
    expect(resolverDiasEspera(undefined)).toBe(4)
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de prepararFacturaParaGuardar: limpieza del objeto de factura que
// arma la pantalla de detalle antes de mandarlo a saveFactura.
// ──────────────────────────────────────────────────────────────
describe('prepararFacturaParaGuardar', () => {
  let prepararFacturaParaGuardar

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    prepararFacturaParaGuardar = mod.prepararFacturaParaGuardar
  })

  test('saca los campos que vienen de joins (no son columnas físicas)', () => {
    const out = prepararFacturaParaGuardar({
      id: 'f1', monto: 100,
      prospectos: { nombre: 'X' }, contactos: { nombre: 'Y' }, contacto2: null, pagos: [{ id: 'p1' }]
    })
    expect(out).not.toHaveProperty('prospectos')
    expect(out).not.toHaveProperty('contactos')
    expect(out).not.toHaveProperty('contacto2')
    expect(out).not.toHaveProperty('pagos')
    expect(out.id).toBe('f1')
    expect(out.monto).toBe(100)
  })

  test('NO manda el bookkeeping de recordatorios (lo maneja la app al crear y n8n después)', () => {
    const out = prepararFacturaParaGuardar({
      id: 'f1',
      proxima_notificacion: '2026-09-03',
      ultima_notificacion: '2026-08-20',
      recordatorios_enviados: 2
    })
    expect(out).not.toHaveProperty('proxima_notificacion')
    expect(out).not.toHaveProperty('ultima_notificacion')
    expect(out).not.toHaveProperty('recordatorios_enviados')
  })

  test('convierte a null los ids y fechas opcionales que vienen vacíos', () => {
    const out = prepararFacturaParaGuardar({
      prospecto_id: '', contacto_id: '', contacto_cobro2_id: '',
      fecha_vencimiento: '', periodo_desde: '', periodo_hasta: '',
      razon_social_id: '', cuenta_bancaria_id: ''
    })
    for (const campo of [
      'prospecto_id', 'contacto_id', 'contacto_cobro2_id', 'fecha_vencimiento',
      'periodo_desde', 'periodo_hasta', 'razon_social_id', 'cuenta_bancaria_id'
    ]) {
      expect(out[campo]).toBeNull()
    }
  })

  test('no pisa un id/fecha opcional que sí vino cargado', () => {
    const out = prepararFacturaParaGuardar({ prospecto_id: 'p1', periodo_desde: '2026-08-01' })
    expect(out.prospecto_id).toBe('p1')
    expect(out.periodo_desde).toBe('2026-08-01')
  })

  test('marca "Cobrada total" cuando el saldo es 0 y hay pagos', () => {
    const out = prepararFacturaParaGuardar({ estado: 'Pendiente', saldo_pendiente: 0 }, [{ monto: 100 }])
    expect(out.estado).toBe('Cobrada total')
  })

  test('marca "Cobrada parcial" cuando hay pagos pero queda saldo', () => {
    const out = prepararFacturaParaGuardar({ estado: 'Pendiente', saldo_pendiente: 40 }, [{ monto: 60 }])
    expect(out.estado).toBe('Cobrada parcial')
  })

  test('nunca cambia el estado de una factura Anulada', () => {
    const out = prepararFacturaParaGuardar({ estado: 'Anulada', saldo_pendiente: 0 }, [{ monto: 100 }])
    expect(out.estado).toBe('Anulada')
  })

  test('sin pagos deja el estado como estaba', () => {
    const out = prepararFacturaParaGuardar({ estado: 'Pendiente', saldo_pendiente: 100 }, [])
    expect(out.estado).toBe('Pendiente')
  })

  test('no muta el objeto factura original', () => {
    const factura = { id: 'f1', prospectos: { nombre: 'X' }, proxima_notificacion: '2026-09-03', prospecto_id: '' }
    prepararFacturaParaGuardar(factura, [])
    expect(factura.prospectos).toEqual({ nombre: 'X' })
    expect(factura.proxima_notificacion).toBe('2026-09-03')
    expect(factura.prospecto_id).toBe('')
  })

  test('coacciona los campos nuevos: hs_facturadas "" -> null, redondeo_multiplo "" -> 0, incluir_horas_leyenda -> booleano', () => {
    const out = prepararFacturaParaGuardar({
      hs_facturadas: '', redondeo_multiplo: '', incluir_horas_leyenda: undefined
    })
    expect(out.hs_facturadas).toBeNull()
    expect(out.redondeo_multiplo).toBe(0)
    expect(out.incluir_horas_leyenda).toBe(false)
  })

  test('conserva los campos nuevos cuando vienen cargados (como número / booleano)', () => {
    const out = prepararFacturaParaGuardar({
      hs_facturadas: '12.5', redondeo_multiplo: '1000', incluir_horas_leyenda: true
    })
    expect(out.hs_facturadas).toBe(12.5)
    expect(out.redondeo_multiplo).toBe(1000)
    expect(out.incluir_horas_leyenda).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────
// Tests de saveFactura: notificación "primera_vez" al webhook único
// de facturación solo cuando se CREA una factura (insert), nunca al
// editar una ya existente (update). Además, al crear se agenda la
// primera fecha de recordatorio de cobro (proxima_notificacion).
// ──────────────────────────────────────────────────────────────
describe('saveFactura', () => {
  let saveFactura

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../facturacion.js')
    saveFactura = mod.saveFactura
  })

  // Helpers para los mocks de saveFactura al crear (insert + getFacturaById + pagos).
  function mockearAltaFactura(supabase, { empresa = { dias_espera_facturacion: 4 }, fechaEmision = '2026-08-28' } = {}) {
    supabase.from
      // 1. INSERT de la factura
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'factura-1', numero_factura: '303', contacto_cobro_id: 'contacto-1', prospecto_id: 'prospecto-1' },
          error: null
        })
      })
      // 2. getFacturaById -> SELECT de la factura completa (trae la empresa con su dias_espera_facturacion)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: 'factura-1', numero_factura: '303', contacto_cobro_id: 'contacto-1',
            prospecto_id: 'prospecto-1', fecha_emision: fechaEmision,
            monto: 0, tarifa_base_uva: null, valor_uva_dia: null, porcentaje_descuento: 0,
            prospectos: { id: 'prospecto-1', empresas: empresa }
          },
          error: null
        })
      })
      // 3. getFacturaById -> SELECT de los pagos (factura nueva, sin pagos)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [], error: null })
      })
  }

  test('al crear una factura nueva, agenda proxima_notificacion = emisión + días hábiles de la empresa (cálculo local, sin RPC)', async () => {
    const { supabase } = await import('../../lib/supabase')

    const updateProxNotif = vi.fn().mockReturnThis()
    const updateProxNotifEq = vi.fn().mockResolvedValueOnce({ error: null })

    mockearAltaFactura(supabase, { empresa: { dias_espera_facturacion: 4 }, fechaEmision: '2026-08-28' })
    // 4. UPDATE de proxima_notificacion sobre la factura recién creada
    supabase.from.mockReturnValueOnce({ update: updateProxNotif, eq: updateProxNotifEq })

    await saveFactura({ numero_factura: '303', contacto_id: 'contacto-1' })

    // viernes 2026-08-28 + 4 días hábiles = jueves 2026-09-03. Además, el
    // aviso "primera_vez" que se acaba de mandar queda registrado en
    // ultima_notificacion (misma escritura).
    expect(updateProxNotif).toHaveBeenCalledWith(expect.objectContaining({
      proxima_notificacion: '2026-09-03',
      ultima_notificacion: '2026-08-28'
    }))
    expect(updateProxNotifEq).toHaveBeenCalledWith('id', 'factura-1')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  test('empresa sin dias_espera_facturacion: usa el estándar de 4 días hábiles', async () => {
    const { supabase } = await import('../../lib/supabase')
    const updateProxNotif = vi.fn().mockReturnThis()

    mockearAltaFactura(supabase, { empresa: {}, fechaEmision: '2026-08-28' })
    supabase.from.mockReturnValueOnce({ update: updateProxNotif, eq: vi.fn().mockResolvedValueOnce({ error: null }) })

    await saveFactura({ numero_factura: '303', contacto_id: 'contacto-1' })

    expect(updateProxNotif).toHaveBeenCalledWith(expect.objectContaining({ proxima_notificacion: '2026-09-03' }))
  })

  test('registra ultima_notificacion con el aviso "primera_vez" recién enviado', async () => {
    const { supabase } = await import('../../lib/supabase')
    const update = vi.fn().mockReturnThis()

    mockearAltaFactura(supabase, { empresa: { dias_espera_facturacion: 4 }, fechaEmision: '2026-08-28' })
    supabase.from.mockReturnValueOnce({ update, eq: vi.fn().mockResolvedValueOnce({ error: null }) })

    await saveFactura({ numero_factura: '303', contacto_id: 'contacto-1' })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ ultima_notificacion: '2026-08-28' }))
  })

  test('si el webhook "primera_vez" falla, NO registra ultima_notificacion (nadie fue avisado)', async () => {
    const { supabase } = await import('../../lib/supabase')
    const { notificarFacturacion } = await import('../notificaciones.js')
    notificarFacturacion.mockRejectedValueOnce(new Error('Webhook caído'))

    const update = vi.fn().mockReturnThis()
    mockearAltaFactura(supabase, { empresa: { dias_espera_facturacion: 4 }, fechaEmision: '2026-08-28' })
    supabase.from.mockReturnValueOnce({ update, eq: vi.fn().mockResolvedValueOnce({ error: null }) })

    await saveFactura({ numero_factura: '303', contacto_id: 'contacto-1' })

    // se agenda el recordatorio, pero sin ultima_notificacion
    expect(update).toHaveBeenCalledWith({ proxima_notificacion: '2026-09-03' })
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ ultima_notificacion: expect.anything() }))
  })

  test('sin fecha de emisión no agenda proxima_notificacion, pero igual registra ultima_notificacion (el aviso salió hoy)', async () => {
    const { supabase } = await import('../../lib/supabase')
    const update = vi.fn().mockReturnThis()

    mockearAltaFactura(supabase, { empresa: { dias_espera_facturacion: 4 }, fechaEmision: null })
    supabase.from.mockReturnValueOnce({ update, eq: vi.fn().mockResolvedValueOnce({ error: null }) })

    await saveFactura({ numero_factura: '303', contacto_id: 'contacto-1' })

    const arg = update.mock.calls[0]?.[0] || {}
    expect(arg).not.toHaveProperty('proxima_notificacion')
    expect(typeof arg.ultima_notificacion).toBe('string')
    expect(arg.ultima_notificacion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('si el UPDATE de proxima_notificacion falla, la factura igual queda guardada', async () => {
    const { supabase } = await import('../../lib/supabase')

    mockearAltaFactura(supabase, { empresa: { dias_espera_facturacion: 4 }, fechaEmision: '2026-08-28' })
    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockRejectedValueOnce(new Error('timeout de la base'))
    })

    const resultado = await saveFactura({ numero_factura: '303', contacto_id: 'contacto-1' })

    expect(resultado.id).toBe('factura-1')
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
      // 4. UPDATE post-alta (ultima_notificacion, ya que el aviso salió ok)
      .mockReturnValueOnce({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValueOnce({ error: null }) })

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

  test('pide también redondeo_multiplo, incluir_horas_leyenda y hs_facturadas (se arrastran a la próxima factura)', async () => {
    const { supabase } = await import('../../lib/supabase')
    const select = vi.fn().mockReturnThis()
    supabase.from.mockReturnValueOnce({
      select,
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null })
    })

    await getUltimaFacturaProspecto('prospecto-1')

    const selectArg = select.mock.calls[0][0]
    expect(selectArg).toMatch(/redondeo_multiplo/)
    expect(selectArg).toMatch(/incluir_horas_leyenda/)
    expect(selectArg).toMatch(/hs_facturadas/)
  })

  test('pide también monto y numero_factura (para congelar el precio entre actualizaciones de tarifa)', async () => {
    const { supabase } = await import('../../lib/supabase')
    const select = vi.fn().mockReturnThis()
    supabase.from.mockReturnValueOnce({
      select,
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null })
    })

    await getUltimaFacturaProspecto('prospecto-1')

    const selectArg = select.mock.calls[0][0]
    expect(selectArg).toMatch(/\bmonto\b/)
    expect(selectArg).toMatch(/numero_factura/)
  })
})

// ──────────────────────────────────────────────────────────────
// Ciclo de actualización de tarifa (índice UVA).
//
// La tarifa en UVA (Valor Base del prospecto) es fija. Lo que se ajusta es
// el valor del UVA en pesos, y NO mes a mes: solo cuando el período a
// facturar termina después de la "Próx. Act. Tarifa" pactada. Hasta
// entonces la factura repite el valor UVA de la factura anterior (precio
// congelado). Al emitir la factura que sí actualiza, el prospecto rota su
// ciclo: última = inicio del período facturado, próxima = última + frecuencia.
// ──────────────────────────────────────────────────────────────
describe('decidirActualizacionTarifa', () => {
  let decidirActualizacionTarifa

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    decidirActualizacionTarifa = mod.decidirActualizacionTarifa
  })

  const prospectoUVA = {
    indice_cobro: 'UVA',
    proxima_actualizacion_tarifa: '2026-10-01',
    frecuencia_actualizacion: 3,
  }
  const ultima = { monto: 1215000 }

  test('CONGELA cuando el fin del período todavía no superó la Próx. Act. Tarifa', () => {
    const r = decidirActualizacionTarifa({ prospecto: prospectoUVA, ultimaFactura: ultima, periodo_hasta: '2026-08-31' })
    expect(r.actualiza).toBe(false)
    expect(r.motivo).toBe('dentro-del-ciclo')
    expect(r.montoCongelado).toBe(1215000)
  })

  test('ACTUALIZA cuando el fin del período supera la Próx. Act. Tarifa', () => {
    const r = decidirActualizacionTarifa({ prospecto: prospectoUVA, ultimaFactura: ultima, periodo_hasta: '2026-10-31' })
    expect(r.actualiza).toBe(true)
    expect(r.motivo).toBe('vencio-ciclo')
  })

  test('el límite exacto (fin del período == Próx. Act. Tarifa) todavía CONGELA', () => {
    const r = decidirActualizacionTarifa({ prospecto: prospectoUVA, ultimaFactura: ultima, periodo_hasta: '2026-10-01' })
    expect(r.actualiza).toBe(false)
  })

  test('ACTUALIZA siempre si el prospecto no tiene índice de ajuste UVA', () => {
    const r = decidirActualizacionTarifa({
      prospecto: { ...prospectoUVA, indice_cobro: 'Dólar' },
      ultimaFactura: ultima, periodo_hasta: '2026-08-31',
    })
    expect(r.actualiza).toBe(true)
    expect(r.motivo).toBe('sin-indice-uva')
  })

  test('ACTUALIZA si es la primera factura del prospecto (no hay monto previo para congelar)', () => {
    expect(decidirActualizacionTarifa({ prospecto: prospectoUVA, ultimaFactura: null, periodo_hasta: '2026-08-31' }).motivo)
      .toBe('primera-factura')
    expect(decidirActualizacionTarifa({ prospecto: prospectoUVA, ultimaFactura: { monto: 0 }, periodo_hasta: '2026-08-31' }).actualiza)
      .toBe(true)
  })

  test('ACTUALIZA si el prospecto no tiene "Próx. Act. Tarifa" cargada (no hay ciclo definido)', () => {
    const r = decidirActualizacionTarifa({
      prospecto: { indice_cobro: 'UVA', proxima_actualizacion_tarifa: null, frecuencia_actualizacion: 3 },
      ultimaFactura: ultima, periodo_hasta: '2026-08-31',
    })
    expect(r.actualiza).toBe(true)
    expect(r.motivo).toBe('sin-ciclo')
  })

  test('CONGELA una tarifa lejana: períodos 2026 con Próx. Act. Tarifa en 2028 (caso Insuga)', () => {
    const r = decidirActualizacionTarifa({
      prospecto: { indice_cobro: 'UVA', proxima_actualizacion_tarifa: '2028-10-28', frecuencia_actualizacion: 3 },
      ultimaFactura: { monto: 1215000 },
      periodo_hasta: '2026-09-28',
    })
    expect(r.actualiza).toBe(false)
    expect(r.montoCongelado).toBe(1215000)
  })

  test('el disparador mira el fin del período, sin importar "Valor UVA de referencia"', () => {
    const r = decidirActualizacionTarifa({
      prospecto: { ...prospectoUVA, uva_referencia_periodo: 'inicio' },
      ultimaFactura: ultima, periodo_hasta: '2026-10-31',
    })
    expect(r.actualiza).toBe(true)
  })

  test('tolera fechas ISO con hora y un prospecto ausente', () => {
    expect(decidirActualizacionTarifa({ prospecto: prospectoUVA, ultimaFactura: ultima, periodo_hasta: '2026-08-31T00:00:00' }).actualiza)
      .toBe(false)
    expect(decidirActualizacionTarifa({}).actualiza).toBe(true)
  })

  test('expone la fecha de próxima actualización normalizada (para mostrarla en pantalla)', () => {
    const r = decidirActualizacionTarifa({ prospecto: prospectoUVA, ultimaFactura: ultima, periodo_hasta: '2026-08-31' })
    expect(r.proximaActualizacion).toBe('2026-10-01')
  })
})

describe('calcularCicloTarifaTrasActualizar', () => {
  let calcularCicloTarifaTrasActualizar

  beforeEach(async () => {
    const mod = await import('../facturacion.js')
    calcularCicloTarifaTrasActualizar = mod.calcularCicloTarifaTrasActualizar
  })

  test('última = inicio del período facturado; próxima = última + frecuencia (meses)', () => {
    expect(calcularCicloTarifaTrasActualizar({ periodo_desde: '2026-10-01', frecuencia_actualizacion: 3 }))
      .toEqual({ ultima_actualizacion_tarifa: '2026-10-01', proxima_actualizacion_tarifa: '2027-01-01' })
  })

  test('frecuencia ausente o inválida => 1 mes', () => {
    expect(calcularCicloTarifaTrasActualizar({ periodo_desde: '2026-10-01' }))
      .toEqual({ ultima_actualizacion_tarifa: '2026-10-01', proxima_actualizacion_tarifa: '2026-11-01' })
    expect(calcularCicloTarifaTrasActualizar({ periodo_desde: '2026-10-01', frecuencia_actualizacion: 'x' }).proxima_actualizacion_tarifa)
      .toBe('2026-11-01')
  })

  test('acepta la frecuencia como string (los <input number> la devuelven así)', () => {
    expect(calcularCicloTarifaTrasActualizar({ periodo_desde: '2026-10-01', frecuencia_actualizacion: '6' }).proxima_actualizacion_tarifa)
      .toBe('2027-04-01')
  })

  test('devuelve null si el inicio del período no es una fecha válida', () => {
    expect(calcularCicloTarifaTrasActualizar({ periodo_desde: '' })).toBeNull()
    expect(calcularCicloTarifaTrasActualizar({ periodo_desde: '0002-01-01' })).toBeNull()
  })

  test('tolera fecha ISO con hora', () => {
    expect(calcularCicloTarifaTrasActualizar({ periodo_desde: '2026-10-01T00:00:00', frecuencia_actualizacion: 3 }).ultima_actualizacion_tarifa)
      .toBe('2026-10-01')
  })
})

describe('actualizarCicloTarifaProspecto', () => {
  let actualizarCicloTarifaProspecto

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../facturacion.js')
    actualizarCicloTarifaProspecto = mod.actualizarCicloTarifaProspecto
  })

  test('escribe última y próxima actualización de tarifa en el prospecto (índice UVA)', async () => {
    const { supabase } = await import('../../lib/supabase')
    const update = vi.fn().mockReturnThis()
    const eq = vi.fn().mockResolvedValueOnce({ error: null })
    supabase.from.mockReturnValueOnce({ update, eq })

    const r = await actualizarCicloTarifaProspecto('prospecto-1', {
      periodo_desde: '2026-10-01', frecuencia_actualizacion: 3, indice_cobro: 'UVA',
    })

    expect(supabase.from).toHaveBeenCalledWith('apsol_prospectos')
    expect(update).toHaveBeenCalledWith({
      ultima_actualizacion_tarifa: '2026-10-01',
      proxima_actualizacion_tarifa: '2027-01-01',
    })
    expect(eq).toHaveBeenCalledWith('id', 'prospecto-1')
    expect(r).toEqual({ ultima_actualizacion_tarifa: '2026-10-01', proxima_actualizacion_tarifa: '2027-01-01' })
  })

  test('no toca la base si el prospecto no tiene índice de ajuste UVA', async () => {
    const { supabase } = await import('../../lib/supabase')
    const r = await actualizarCicloTarifaProspecto('prospecto-1', {
      periodo_desde: '2026-10-01', frecuencia_actualizacion: 3, indice_cobro: 'Dólar',
    })
    expect(r).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  test('no toca la base sin prospectoId ni con un inicio de período inválido', async () => {
    const { supabase } = await import('../../lib/supabase')
    expect(await actualizarCicloTarifaProspecto(null, { periodo_desde: '2026-10-01', indice_cobro: 'UVA' })).toBeNull()
    expect(await actualizarCicloTarifaProspecto('p1', { periodo_desde: '', indice_cobro: 'UVA' })).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

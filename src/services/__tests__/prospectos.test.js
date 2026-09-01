import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  normalizarContactoId,
  construirCambioEstado,
  normalizarServicios,
  construirPayloadProspecto,
  guardarServiciosProspecto
} from '../prospectos'

const rpcMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => rpcMock(...args)
  }
}))

describe('normalizarContactoId', () => {
  // El campo contacto_id de prospectos dejó de ser obligatorio en el
  // formulario (ahora se muestran todos los contactos de la empresa como
  // lista, no se elige uno solo) - pero la columna en la base sigue siendo
  // UUID. Si se manda un '' (string vacío, lo que trae el estado inicial
  // del form) en vez de null, Postgres lo rechaza con "invalid input syntax
  // for type uuid". Esta función es la que evita que ese string vacío
  // llegue al insert/update.
  test('convierte string vacío a null', () => {
    expect(normalizarContactoId('')).toBe(null)
  })

  test('convierte undefined a null', () => {
    expect(normalizarContactoId(undefined)).toBe(null)
  })

  test('deja pasar un id real sin tocarlo', () => {
    expect(normalizarContactoId('38f7afa7-b708-48d6-99af-439ff6c0ba02')).toBe('38f7afa7-b708-48d6-99af-439ff6c0ba02')
  })
})

describe('construirCambioEstado', () => {
  // BUG real: el modal "Actualizar Estado" mandaba
  // fecha_ultimo_cambio_estado en el payload, pero esa columna no existe
  // en la vista apsol_prospectos (ni en apsol_private.prospectos).
  // Postgres rechaza TODO el UPDATE con 42703 "column ... does not exist"
  // -> "Error al actualizar el estado." y el cambio no se guarda nunca.
  // El helper arma el payload solo con columnas reales de la vista.

  test('cambio de estado simple: solo manda estado', () => {
    expect(construirCambioEstado('3A - Seguimiento')).toEqual({ estado: '3A - Seguimiento' })
  })

  test('nunca incluye fecha_ultimo_cambio_estado (columna inexistente)', () => {
    const simple = construirCambioEstado('1H - Caido previo reunión')
    expect(simple).not.toHaveProperty('fecha_ultimo_cambio_estado')

    const produccion = construirCambioEstado('6A - En producción', { hs_mensuales: '16' })
    expect(produccion).not.toHaveProperty('fecha_ultimo_cambio_estado')
  })

  test('nunca incluye servicios_requeridos (columna calculada de la vista)', () => {
    const payload = construirCambioEstado('6A - En producción', {
      servicios_requeridos: ['Soporte'],
      hs_mensuales: '10',
    })
    expect(payload).not.toHaveProperty('servicios_requeridos')
  })

  test('pasar a 6A adjunta y castea los datos de producción', () => {
    const payload = construirCambioEstado('6A - En producción', {
      inicio_servicio: '2026-09-01',
      proxima_factura: '2026-10-01',
      hs_mensuales: '16',
      moneda_cobro: 'ARS',
      indice_cobro: 'UVA',
      uva_referencia_periodo: 'inicio',
      cuenta_bancaria_id: 'b1c2d3e4-0000-0000-0000-000000000000',
      tarifa_base: '311',
      base_indice_valor: '311',
      mensualidad_vigente_actual: '650000',
      proxima_actualizacion_tarifa: '2026-12-01',
      ultima_actualizacion_tarifa: '2026-09-01',
      dias_entre_reuniones: '15',
      frecuencia_actualizacion: '3',
    })
    expect(payload).toMatchObject({
      estado: '6A - En producción',
      hs_mensuales: 16,
      tarifa_base: 311,
      mensualidad_vigente_actual: 650000,
      dias_entre_reuniones: 15,
      frecuencia_actualizacion: 3,
    })
  })

  test('6A con campos vacíos: fechas a null y números a 0 / default', () => {
    const payload = construirCambioEstado('6A - En producción', {})
    expect(payload.inicio_servicio).toBe(null)
    expect(payload.proxima_factura).toBe(null)
    expect(payload.hs_mensuales).toBe(0)
    expect(payload.tarifa_base).toBe(0)
    expect(payload.cuenta_bancaria_id).toBe(null)
    expect(payload.uva_referencia_periodo).toBe('inicio')
    expect(payload.frecuencia_actualizacion).toBe(1)
  })

  test('estado no-6A ignora los datos de producción que le pasen', () => {
    const payload = construirCambioEstado('4A - Presupuesto Enviado', { hs_mensuales: '16', tarifa_base: '999' })
    expect(payload).toEqual({ estado: '4A - Presupuesto Enviado' })
  })
})

describe('construirPayloadProspecto', () => {
  // public.apsol_prospectos es una VISTA sobre apsol_private.prospectos.
  // servicios_requeridos NO es una columna real: es una subconsulta
  // (array_agg contra apsol_private.prospectos_servicios). Mandarla en el
  // payload de un UPDATE/INSERT a la vista hace que Postgres rechace TODO
  // el statement con "0A000: cannot update column servicios_requeridos of
  // view apsol_prospectos". El formulario completo (ProspectoDetalle) la
  // metía en dataToSave y por eso guardar un prospecto existente tiraba 400.
  test('NO incluye servicios_requeridos aunque venga en la entrada', () => {
    const payload = construirPayloadProspecto({
      nombre: 'Implementación X',
      estado: 'Nuevo',
      servicios_requeridos: ['Soporte', 'Consultoría']
    })
    expect(payload).not.toHaveProperty('servicios_requeridos')
    expect(payload.nombre).toBe('Implementación X')
    expect(payload.estado).toBe('Nuevo')
  })

  test('descarta claves que no son columnas escribibles de la vista', () => {
    const payload = construirPayloadProspecto({
      nombre: 'X',
      empresas: { nombre: 'ACME' },
      contactos: [{ id: 'c1' }],
      observaciones: [],
      facturacion: [],
      proyectos: [],
      created_at: '2026-01-01T00:00:00Z',
      fecha_creacion: '2026-01-01',
      fecha_ultimo_cambio_estado: null,
      estado_repetido: '',
      proxima_tarea_tipo: 'Llamado',
      proxima_tarea_comentario: 'algo'
    })
    expect(Object.keys(payload)).toEqual(['nombre'])
  })

  test('conserva las columnas operativas reales', () => {
    const entrada = {
      empresa_id: 'e1',
      contacto_id: null,
      canal_contacto: 'LinkedIn',
      adjuntos: '[]',
      presupuesto: '2',
      necesidad: '3',
      proxima_tarea: 'Llamado :: hoy',
      fecha_proxima_tarea: null,
      tarifa_base: 100,
      frecuencia_actualizacion: 1,
      inicio_servicio: null,
      proxima_actualizacion_tarifa: null,
      base_indice_valor: 0,
      hs_mensuales: 10,
      mensualidad_vigente_actual: 0,
      moneda_cobro: 'ARS',
      indice_cobro: 'UVA',
      proxima_factura: null,
      ultima_actualizacion_tarifa: null,
      dias_entre_reuniones: 15,
      uva_referencia_periodo: 'inicio',
      cuenta_bancaria_id: null
    }
    expect(construirPayloadProspecto(entrada)).toEqual(entrada)
  })

  test('no fabrica claves que no vinieron (no manda undefined)', () => {
    const payload = construirPayloadProspecto({ nombre: 'X' })
    expect(Object.keys(payload)).toEqual(['nombre'])
  })

  // BUG real: al crear un prospecto nuevo, los campos numéricos/fecha/uuid
  // de producción arrancan en '' en el form y nadie los toca. Postgres tira
  // "invalid input syntax for type numeric/date/uuid: ''" y rechaza el
  // INSERT entero -> "Error al guardar los datos". El helper tiene que
  // mandar null en esas columnas, no ''.
  test("convierte '' a null en columnas no-texto (numéricas, fecha, uuid)", () => {
    const payload = construirPayloadProspecto({
      nombre: 'Pagos TIC',
      estado: 'Nuevo',
      empresa_id: 'e1',
      canal_contacto: 'Email Marketing',
      tarifa_base: '',
      base_indice_valor: '',
      hs_mensuales: '',
      mensualidad_vigente_actual: '',
      frecuencia_actualizacion: '',
      dias_entre_reuniones: '',
      inicio_servicio: '',
      proxima_factura: '',
      proxima_actualizacion_tarifa: '',
      ultima_actualizacion_tarifa: '',
      fecha_proxima_tarea: '',
      cuenta_bancaria_id: ''
    })
    for (const col of [
      'tarifa_base', 'base_indice_valor', 'hs_mensuales', 'mensualidad_vigente_actual',
      'frecuencia_actualizacion', 'dias_entre_reuniones', 'inicio_servicio',
      'proxima_factura', 'proxima_actualizacion_tarifa', 'ultima_actualizacion_tarifa',
      'fecha_proxima_tarea', 'cuenta_bancaria_id'
    ]) {
      expect(payload[col]).toBe(null)
    }
    // las columnas de texto sí conservan el string (aunque sea vacío)
    expect(payload.nombre).toBe('Pagos TIC')
    expect(payload.canal_contacto).toBe('Email Marketing')
  })

  test("no toca valores reales en columnas no-texto (0, fechas, números)", () => {
    const payload = construirPayloadProspecto({
      tarifa_base: 0,
      hs_mensuales: 10,
      dias_entre_reuniones: 15,
      inicio_servicio: '2026-09-01'
    })
    expect(payload.tarifa_base).toBe(0)
    expect(payload.hs_mensuales).toBe(10)
    expect(payload.dias_entre_reuniones).toBe(15)
    expect(payload.inicio_servicio).toBe('2026-09-01')
  })
})

describe('normalizarServicios', () => {
  test('recorta, saca vacíos y duplicados', () => {
    expect(normalizarServicios(['Soporte', ' Soporte ', '', '  ', 'Consultoría']))
      .toEqual(['Soporte', 'Consultoría'])
  })

  test('tolera entradas que no son array', () => {
    expect(normalizarServicios(undefined)).toEqual([])
    expect(normalizarServicios(null)).toEqual([])
  })

  test('ignora elementos que no son string', () => {
    expect(normalizarServicios(['Soporte', 5, null, { value: 'x' }])).toEqual(['Soporte'])
  })
})

describe('guardarServiciosProspecto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpcMock.mockResolvedValue({ data: null, error: null })
  })

  // Los servicios no se pueden escribir en la vista: se persisten con el
  // RPC set_prospecto_servicios, que hace "borrar los de ese prospecto +
  // insertar los nuevos" sobre apsol_private.prospectos_servicios.
  test('llama al RPC set_prospecto_servicios con la lista normalizada', async () => {
    await guardarServiciosProspecto('p-1', ['Soporte', ' Soporte ', 'Consultoría'])

    expect(rpcMock).toHaveBeenCalledWith('set_prospecto_servicios', {
      p_prospecto_id: 'p-1',
      p_servicios: ['Soporte', 'Consultoría']
    })
  })

  test('con lista vacía igual llama al RPC (para borrar los que había)', async () => {
    await guardarServiciosProspecto('p-1', [])
    expect(rpcMock).toHaveBeenCalledWith('set_prospecto_servicios', {
      p_prospecto_id: 'p-1',
      p_servicios: []
    })
  })

  test('propaga el error del RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'No autorizado' } })
    await expect(guardarServiciosProspecto('p-1', ['Soporte'])).rejects.toEqual({ message: 'No autorizado' })
  })
})

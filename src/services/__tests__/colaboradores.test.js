import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock encadenable de supabase: cada método devuelve el mismo builder y el
// builder es "thenable" (resuelve al result configurado). fromMock guarda
// cada builder creado para poder inspeccionar los métodos llamados.
const builders = []
const results = []
const fromMock = vi.fn()

function makeBuilder(tabla) {
  const calls = []
  const result = results.length ? results.shift() : { data: [], error: null }
  const builder = {
    tabla,
    calls,
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'ilike', 'not', 'order', 'single', 'maybeSingle']) {
    builder[m] = vi.fn((...args) => {
      calls.push([m, args])
      return builder
    })
  }
  builders.push(builder)
  return builder
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  builders.length = 0
  results.length = 0
  fromMock.mockImplementation((tabla) => makeBuilder(tabla))
})

function payloadDe(builder, metodo) {
  const call = builder.calls.find(([m]) => m === metodo)
  return call ? call[1][0] : undefined
}

describe('saveColaborador', () => {
  // Regresión: `prospectos_asignados` NO es una columna de la vista
  // `public.apsol_colaboradores` (la asignación vive en la tabla de enlace
  // `colaboradores_prospectos`). Si viaja en el payload del insert/update,
  // Postgres tira "column prospectos_asignados does not exist" y guardar
  // cualquier colaborador se rompe.
  test('no incluye prospectos_asignados en el INSERT de un colaborador nuevo', async () => {
    results.push({ data: { id: 'nuevo-1' }, error: null }) // insert ... select ... single
    const { saveColaborador } = await import('../colaboradores')

    await saveColaborador({
      nombre: 'Test', apellido: 'Uno', email: 't@a.com', puesto: 'Colaborador',
      prospectos_asignados: ['p1', 'p2'],
    })

    const colabBuilder = builders.find(b => b.tabla === 'apsol_colaboradores')
    const payload = payloadDe(colabBuilder, 'insert')
    // insert recibe un array con el objeto
    const obj = Array.isArray(payload) ? payload[0] : payload
    expect(obj).not.toHaveProperty('prospectos_asignados')
  })

  // es_team_lead (Fase 3 del plan de notificaciones): flag sobre la
  // ficha de colaborador, no un cargo aparte. Tiene que viajar en el
  // payload como cualquier otro campo real de la tabla.
  test('incluye es_team_lead en el UPDATE cuando viene seteado', async () => {
    results.push({ data: { id: 'c-9' }, error: null })
    const { saveColaborador } = await import('../colaboradores')

    await saveColaborador({ id: 'c-9', nombre: 'Test', puesto: 'Colaborador', es_team_lead: true })

    const colabBuilder = builders.find(b => b.tabla === 'apsol_colaboradores')
    expect(payloadDe(colabBuilder, 'update')).toMatchObject({ es_team_lead: true })
  })

  // email_personal vive en apsol_usuarios (mismo lugar que nombre/apellido/email).
  // Es adónde n8n avisa los pagos; el admin lo carga desde la ficha.
  test('propaga email_personal al UPDATE de apsol_usuarios cuando viene', async () => {
    results.push({ error: null })                        // update apsol_usuarios
    results.push({ data: { id: 'c-9' }, error: null })   // update apsol_colaboradores ... single
    const { saveColaborador } = await import('../colaboradores')

    await saveColaborador({
      id: 'c-9', usuario_id: 'u-9', nombre: 'Test', apellido: 'X', email: 't@a.com',
      puesto: 'Colaborador', email_personal: 'personal@gmail.com',
    })

    const userBuilder = builders.find(b => b.tabla === 'apsol_usuarios')
    expect(payloadDe(userBuilder, 'update')).toMatchObject({ email_personal: 'personal@gmail.com' })
  })

  test('no toca email_personal en apsol_usuarios si el caller no lo maneja', async () => {
    results.push({ error: null })
    results.push({ data: { id: 'c-9' }, error: null })
    const { saveColaborador } = await import('../colaboradores')

    await saveColaborador({ id: 'c-9', usuario_id: 'u-9', nombre: 'Test', puesto: 'Colaborador' })

    const userBuilder = builders.find(b => b.tabla === 'apsol_usuarios')
    expect(payloadDe(userBuilder, 'update')).not.toHaveProperty('email_personal')
  })

  test('no incluye prospectos_asignados en el UPDATE de un colaborador existente', async () => {
    results.push({ data: [{ prospecto_id: 'p1' }], error: null }) // select actuales (saveColaboradorProspectos)
    results.push({ error: null })                                  // insert enlaces nuevos
    results.push({ data: { id: 'c-9' }, error: null })             // update ... select ... single
    const { saveColaborador } = await import('../colaboradores')

    await saveColaborador({
      id: 'c-9', nombre: 'Test', apellido: 'Dos', email: 't2@a.com', puesto: 'Colaborador',
      prospectos_asignados: ['p1', 'p2'],
    })

    const colabBuilder = builders.find(b => b.tabla === 'apsol_colaboradores')
    const payload = payloadDe(colabBuilder, 'update')
    expect(payload).not.toHaveProperty('prospectos_asignados')
    expect(payload).toMatchObject({ id: 'c-9', puesto: 'Colaborador' })
  })
})

describe('saveColaboradorProspectos', () => {
  test('inserta los que faltan y borra los que sobran (diff contra el estado actual)', async () => {
    results.push({ data: [{ prospecto_id: 'p1' }, { prospecto_id: 'p2' }], error: null }) // actuales
    results.push({ error: null }) // insert
    results.push({ error: null }) // delete
    const { saveColaboradorProspectos } = await import('../colaboradores')

    await saveColaboradorProspectos('c-1', ['p2', 'p3'])

    const enlaces = builders.filter(b => b.tabla === 'apsol_colaboradores_prospectos')
    const insertPayload = payloadDe(enlaces.find(b => b.calls.some(([m]) => m === 'insert')), 'insert')
    expect(insertPayload).toEqual([{ colaborador_id: 'c-1', prospecto_id: 'p3' }])

    const delBuilder = enlaces.find(b => b.calls.some(([m]) => m === 'delete'))
    const inCall = delBuilder.calls.find(([m]) => m === 'in')
    expect(inCall[1]).toEqual(['prospecto_id', ['p1']])
  })

  test('no toca la base si el objetivo es igual al estado actual', async () => {
    results.push({ data: [{ prospecto_id: 'p1' }], error: null })
    const { saveColaboradorProspectos } = await import('../colaboradores')

    await saveColaboradorProspectos('c-1', ['p1'])

    const enlaces = builders.filter(b => b.tabla === 'apsol_colaboradores_prospectos')
    expect(enlaces.some(b => b.calls.some(([m]) => m === 'insert' || m === 'delete'))).toBe(false)
  })
})

describe('getMiFichaColaborador', () => {
  test('busca la ficha por usuario_id y devuelve la forma mapeada', async () => {
    results.push({
      data: {
        id: 'colab-1', usuario_id: 'user-1', puesto: 'Colaborador', estado: 'Activo',
        whatsapp: '3411234567.0',
        usuarios: { nombre: 'Reni', apellido: 'M', email: 'reni@a.com' },
        contratos: [{ id: 'k1', fecha_inicio: '2024-08-01', fecha_fin: '2025-01-01' }],
        facturas_colaboradores: [{ id: 'f1', monto: 100 }],
        prospectos_trabajar: [{ prospecto_id: 'p1', prospectos: { nombre: 'Norte 2025' } }],
      },
      error: null,
    })
    results.push({ data: [{ inicio: '2026-01-05T09:00:00Z' }], error: null }) // getDiasLibresTomados
    const { getMiFichaColaborador } = await import('../colaboradores')

    const ficha = await getMiFichaColaborador('user-1')

    const b = builders.find(x => x.tabla === 'apsol_colaboradores')
    expect(b.calls).toContainEqual(['eq', ['usuario_id', 'user-1']])
    expect(b.calls.some(([m]) => m === 'maybeSingle')).toBe(true)
    expect(ficha.nombre).toBe('Reni')
    expect(ficha.telefono).toBe('3411234567')
    expect(ficha.prospectos_asignados).toEqual(['p1'])
    expect(ficha.prospectos_trabajar_nombres).toEqual([{ id: 'p1', nombre: 'Norte 2025' }])
    expect(ficha.dias_libres_tomados).toBe(1)
  })

  test('devuelve null si el usuario no tiene ficha', async () => {
    const { getMiFichaColaborador } = await import('../colaboradores')
    expect(await getMiFichaColaborador(null)).toBeNull()
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('getDiasLibresTomados', () => {
  test('filtra por [Día Libre] + responsable y cuenta días de calendario distintos', async () => {
    results.push({
      data: [
        { inicio: '2026-08-10T09:00:00+00:00' },
        { inicio: '2026-08-10T14:00:00+00:00' }, // mismo día -> cuenta 1
        { inicio: '2026-08-14T09:00:00+00:00' },
      ],
      error: null,
    })
    const { getDiasLibresTomados } = await import('../colaboradores')

    const n = await getDiasLibresTomados('resp-1')

    expect(n).toBe(2)
    const b = builders.find(x => x.tabla === 'apsol_cronograma')
    expect(b.calls).toContainEqual(['ilike', ['descripcion', '[Día Libre]%']])
    expect(b.calls).toContainEqual(['eq', ['responsable_id', 'resp-1']])
  })

  test('sin id devuelve 0 sin pegarle a la base', async () => {
    const { getDiasLibresTomados } = await import('../colaboradores')
    expect(await getDiasLibresTomados(null)).toBe(0)
    expect(fromMock).not.toHaveBeenCalled()
  })
})

import { describe, test, expect } from 'vitest'
import { prepararProyectoParaGuardar, COLUMNAS_PROYECTO, resolverNombreColaborador } from '../proyectos'

// ──────────────────────────────────────────────────────────────
// BUG real: "Error al cargar datos del proyecto" (y la sensación de que
// "no se guarda") al abrir un proyecto. getProyectoById/getProyectos
// pedían nombre/apellido directo sobre apsol_colaboradores, columnas que
// no existen ahí (viven en apsol_usuarios, con nombre_manual/apellido_manual
// de respaldo) -> Postgres tira "column ... does not exist" y la consulta
// entera falla para cualquier usuario, no solo Colaborador.
// resolverNombreColaborador arma el nombre a mostrar a partir del embed
// correcto (usuarios + fallback manual).
// ──────────────────────────────────────────────────────────────
describe('resolverNombreColaborador', () => {
  test('prioriza el nombre del usuario vinculado', () => {
    const out = resolverNombreColaborador({
      id: 'c1',
      usuarios: { nombre: 'Mateo', apellido: 'Courault' },
      nombre_manual: 'Manual', apellido_manual: 'Viejo',
    })
    expect(out.nombre).toBe('Mateo')
    expect(out.apellido).toBe('Courault')
  })

  test('usa nombre_manual/apellido_manual si no hay usuario vinculado', () => {
    const out = resolverNombreColaborador({ id: 'c1', usuarios: null, nombre_manual: 'Manual', apellido_manual: 'Viejo' })
    expect(out.nombre).toBe('Manual')
    expect(out.apellido).toBe('Viejo')
  })

  test('sin usuario ni datos manuales, devuelve string vacío en vez de undefined', () => {
    const out = resolverNombreColaborador({ id: 'c1' })
    expect(out.nombre).toBe('')
    expect(out.apellido).toBe('')
  })

  test('null pasa igual (proyecto sin líder asignado)', () => {
    expect(resolverNombreColaborador(null)).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────
// BUG real: "Error al guardar los datos" al crear un proyecto.
// El form mandaba a la tabla campos que no son columnas (los joins
// prospectos/colaboradores/tickets/preventivos en edición) y strings
// vacíos en FKs uuid. prepararProyectoParaGuardar deja solo columnas
// reales y normaliza los vacíos.
// ──────────────────────────────────────────────────────────────
describe('prepararProyectoParaGuardar', () => {
  test('descarta los campos que vienen de joins (no son columnas)', () => {
    const out = prepararProyectoParaGuardar({
      id: 'p1', nombre: 'Proyecto 1', prospecto_id: 'pr1',
      prospectos: { nombre: 'X' },
      colaboradores: { nombre: 'Y' },
      tickets: [{ id: 't1' }],
      preventivos: [{ id: 'pv1' }],
    })
    expect(out).not.toHaveProperty('prospectos')
    expect(out).not.toHaveProperty('colaboradores')
    expect(out).not.toHaveProperty('tickets')
    expect(out).not.toHaveProperty('preventivos')
    expect(out).toMatchObject({ id: 'p1', nombre: 'Proyecto 1', prospecto_id: 'pr1' })
  })

  test('convierte a null los ids y fechas opcionales que llegan vacíos', () => {
    const out = prepararProyectoParaGuardar({
      nombre: 'P', prospecto_id: '', responsable_id: '', colaborador_id: '',
      lider_colaborador_id: '', fecha_inicio: '', fecha_fin_estimada: '', tipo: '',
    })
    for (const campo of [
      'prospecto_id', 'responsable_id', 'colaborador_id', 'lider_colaborador_id',
      'fecha_inicio', 'fecha_fin_estimada', 'tipo',
    ]) {
      expect(out[campo]).toBeNull()
    }
  })

  test('no pisa un id/fecha opcional que sí vino cargado', () => {
    const out = prepararProyectoParaGuardar({
      prospecto_id: 'pr1', lider_colaborador_id: 'col1', fecha_inicio: '2026-08-29',
    })
    expect(out.prospecto_id).toBe('pr1')
    expect(out.lider_colaborador_id).toBe('col1')
    expect(out.fecha_inicio).toBe('2026-08-29')
  })

  test('porcentaje_avance: string -> número; vacío -> 0', () => {
    expect(prepararProyectoParaGuardar({ porcentaje_avance: '40' }).porcentaje_avance).toBe(40)
    expect(prepararProyectoParaGuardar({ porcentaje_avance: '' }).porcentaje_avance).toBe(0)
    expect(prepararProyectoParaGuardar({ porcentaje_avance: 0 }).porcentaje_avance).toBe(0)
  })

  test('solo deja pasar columnas conocidas de la tabla', () => {
    const out = prepararProyectoParaGuardar({
      nombre: 'P', campo_inventado: 'nope', otra_cosa: 123,
    })
    expect(Object.keys(out).every((k) => COLUMNAS_PROYECTO.includes(k))).toBe(true)
    expect(out).not.toHaveProperty('campo_inventado')
  })

  test('no muta el objeto original', () => {
    const proyecto = { nombre: 'P', prospecto_id: '', tickets: [{ id: 't1' }] }
    prepararProyectoParaGuardar(proyecto)
    expect(proyecto.prospecto_id).toBe('')
    expect(proyecto.tickets).toEqual([{ id: 't1' }])
  })

  test('tolera undefined / vacío', () => {
    expect(prepararProyectoParaGuardar()).toEqual({})
    expect(prepararProyectoParaGuardar({})).toEqual({})
  })
})

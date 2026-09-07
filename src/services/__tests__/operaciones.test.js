import { describe, test, expect } from 'vitest'
import { resolverNombreColaborador, limpiarPayloadTicket, COLUMNAS_TICKET } from '../operaciones'

// ──────────────────────────────────────────────────────────────
// BUG real: getTickets/getTicketById pedían nombre/apellido directo sobre
// apsol_colaboradores, columnas que no existen ahí (viven en apsol_usuarios,
// con nombre_manual/apellido_manual de respaldo) -> Postgres tira
// "column apsol_colaboradores_1.nombre does not exist" y la consulta entera
// falla para cualquier usuario, no solo Colaborador.
// resolverNombreColaborador arma el nombre a mostrar a partir del embed
// correcto (usuarios + fallback manual). Mismo patrón que proyectos.js.
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

  test('null pasa igual (ticket sin colaborador asignado)', () => {
    expect(resolverNombreColaborador(null)).toBeNull()
  })
})

// BUG real: el form de tickets mandaba `titulo`, `estado`, `colaborador_id`
// y embeds anidados (`proyectos`, `colaboradores`) al insert/update. La
// tabla no tenía `titulo`/`estado` (se agregaron por migración) y el campo
// se llama `responsable_id`, no `colaborador_id` -> siempre fallaba con
// "Could not find the 'colaborador_id' column". limpiarPayloadTicket deja
// solo columnas reales.
describe('limpiarPayloadTicket', () => {
  test('conserva las columnas reales del ticket', () => {
    const out = limpiarPayloadTicket({
      titulo: 'Falla en el bot', descripcion: 'no responde', estado: 'Abierto',
      prioridad: 'Alta', tipo_ticket: 'Correctivo', responsable_id: 'c-1',
      proyecto_id: 'p-1', fecha_resolucion: null,
    })
    expect(out).toEqual({
      titulo: 'Falla en el bot', descripcion: 'no responde', estado: 'Abierto',
      prioridad: 'Alta', tipo_ticket: 'Correctivo', responsable_id: 'c-1',
      proyecto_id: 'p-1', fecha_resolucion: null,
    })
  })

  test('descarta embeds anidados y campos que no son columnas', () => {
    const out = limpiarPayloadTicket({
      titulo: 'x', responsable_id: 'c-1',
      proyectos: { nombre: 'Proyecto' },        // embed -> fuera
      colaboradores: { nombre: 'Ana' },         // embed -> fuera
      colaborador_id: 'c-9',                     // nombre viejo -> fuera
      id: 't-1', created_at: '2026-01-01',       // no editables -> fuera
    })
    expect(out).toEqual({ titulo: 'x', responsable_id: 'c-1' })
    expect(COLUMNAS_TICKET).not.toContain('colaborador_id')
    expect(COLUMNAS_TICKET).toContain('responsable_id')
  })
})

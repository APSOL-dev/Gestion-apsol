import { describe, test, expect } from 'vitest'
import { resolverNombreColaborador } from '../operaciones'

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

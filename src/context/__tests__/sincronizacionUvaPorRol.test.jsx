import { render, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// La sincronización del histórico UVA inserta en valores_uva, y la RLS solo
// deja escribir a Admin/Dueño: si la dispara un Colaborador la consola se
// llena de 403 (42501). Solo debe correr para roles administradores.

const { authMock, sincronizarHistoricoUVA, vacio } = vi.hoisted(() => ({
  authMock: { user: null, perfil: null },
  sincronizarHistoricoUVA: vi.fn(() => Promise.resolve({ insertados: 0 })),
  vacio: () => Promise.resolve([])
}))
vi.mock('../AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('../../services/sincronizacionUva', () => ({ sincronizarHistoricoUVA }))

vi.mock('../../services/facturacion', () => ({ getFacturas: vacio }))
vi.mock('../../services/prospectos', () => ({ getProspectos: vacio }))
vi.mock('../../services/colaboradores', () => ({ getColaboradores: vacio }))
vi.mock('../../services/empresas', () => ({ getEmpresas: vacio }))
vi.mock('../../services/contactos', () => ({ getContactos: vacio }))
vi.mock('../../services/proyectos', () => ({ getProyectos: vacio }))
vi.mock('../../services/operaciones', () => ({ getTickets: vacio, getPreventivos: vacio }))
vi.mock('../../services/capacitacion', () => ({ getCapacitaciones: vacio }))
vi.mock('../../services/planificacion', () => ({ getPlanes: vacio }))
vi.mock('../../services/credenciales', () => ({ getCredenciales: vacio }))
vi.mock('../../services/valoresUva', () => ({ getValoresUVA: vacio }))
vi.mock('../../services/cuentasBancarias', () => ({ getCuentasBancarias: vacio }))

import { DataProvider } from '../DataContext'

function montarCon(perfil) {
  authMock.user = { id: 'u1' }
  authMock.perfil = perfil
  return render(<DataProvider><div /></DataProvider>)
}

describe('Sincronización UVA al iniciar sesión según el rol', () => {
  beforeEach(() => { sincronizarHistoricoUVA.mockClear() })

  it('NO sincroniza para un Colaborador', async () => {
    montarCon({ cargo: 'Colaborador' })
    await new Promise(r => setTimeout(r, 20))
    expect(sincronizarHistoricoUVA).not.toHaveBeenCalled()
  })

  it('NO sincroniza mientras el perfil todavía no cargó', async () => {
    montarCon(null)
    await new Promise(r => setTimeout(r, 20))
    expect(sincronizarHistoricoUVA).not.toHaveBeenCalled()
  })

  it('sincroniza una sola vez para un Admin', async () => {
    montarCon({ cargo: 'Admin' })
    await waitFor(() => expect(sincronizarHistoricoUVA).toHaveBeenCalledTimes(1))
  })

  it('sincroniza para el Dueño', async () => {
    montarCon({ cargo: 'Dueño' })
    await waitFor(() => expect(sincronizarHistoricoUVA).toHaveBeenCalledTimes(1))
  })
})

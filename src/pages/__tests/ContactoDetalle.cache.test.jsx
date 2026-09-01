import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ContactoDetalle from '../ContactoDetalle'
import { useData } from '../../context/DataContext'
import { getContactoById, saveContacto, getContactos } from '../../services/contactos'
import { getEmpresas } from '../../services/empresas'

// Al guardar un contacto, la lista /contactos (cacheada en DataContext con
// TTL de 90s) quedaba mostrando datos viejos hasta apretar F5, porque
// ContactoDetalle guardaba directo por la capa de servicios sin avisarle a
// la caché. Ahora fuerza refreshContactos({ forzar: true }) al guardar.

vi.mock('../../context/DataContext', () => ({ useData: vi.fn() }))

vi.mock('../../services/contactos', () => ({
  getContactoById: vi.fn(),
  saveContacto: vi.fn(),
  desactivarContacto: vi.fn(),
  activarContacto: vi.fn(),
  getContactos: vi.fn(),
}))

vi.mock('../../services/empresas', async (importOriginal) => ({
  ...(await importOriginal()),
  getEmpresas: vi.fn(),
  saveEmpresa: vi.fn(),
}))

const mockContacto = {
  id: 'cont-1',
  nombre: 'Stefanía',
  apellido: 'Lamas',
  empresa_id: 'emp-1',
  telefono: '3510000000',
  email: 's@pagotic.com',
  cargo: 'Encargada de sector',
  area: 'Marketing',
  activo: true,
  prospectos: [],
}

function renderDetalle() {
  return render(
    <MemoryRouter initialEntries={['/contactos/cont-1']}>
      <Routes>
        <Route path="/contactos/:id" element={<ContactoDetalle />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ContactoDetalle — refresco de caché al guardar', () => {
  let refreshContactos

  beforeEach(() => {
    vi.clearAllMocks()
    refreshContactos = vi.fn()
    useData.mockReturnValue({ refreshContactos, refreshEmpresas: vi.fn() })
    getContactoById.mockResolvedValue(mockContacto)
    getContactos.mockResolvedValue([])
    getEmpresas.mockResolvedValue([{ id: 'emp-1', nombre: 'Pago TIC', industria: 'Fintech' }])
    saveContacto.mockResolvedValue({ ...mockContacto })
  })

  test('guardar fuerza el refetch de la lista de contactos', async () => {
    renderDetalle()

    const botonGuardar = await screen.findByRole('button', { name: /guardar datos/i })
    fireEvent.click(botonGuardar)

    await waitFor(() => {
      expect(saveContacto).toHaveBeenCalled()
      expect(refreshContactos).toHaveBeenCalledWith(
        expect.objectContaining({ forzar: true })
      )
    })
  })
})

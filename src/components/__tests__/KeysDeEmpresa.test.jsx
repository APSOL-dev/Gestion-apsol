import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import KeysDeEmpresa from '../KeysDeEmpresa'
import { useData } from '../../context/DataContext'

vi.mock('../../context/DataContext', () => ({ useData: vi.fn() }))

const refreshCredenciales = vi.fn()

function renderBloque(credenciales) {
  useData.mockReturnValue({ credenciales, refreshCredenciales })
  return render(
    <MemoryRouter initialEntries={['/empresas/e1']}>
      <Routes>
        <Route path="/empresas/:id" element={<KeysDeEmpresa empresaId="e1" />} />
        <Route path="/keys/nueva" element={<div>FORM NUEVA</div>} />
        <Route path="/keys/:id" element={<div>FICHA KEY</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('KeysDeEmpresa (bloque en la ficha de la empresa)', () => {
  test('lista solo las keys de esa empresa, sin mostrar contraseñas', () => {
    renderBloque([
      { id: 'k1', nombre: 'Email Tori', servicio: 'Gmail', empresa_id: 'e1', ambito: 'Cliente', password: 'SECRETO', estado: 'Activo', criticidad: 'Alta' },
      { id: 'k2', nombre: 'Otra empresa', servicio: 'X', empresa_id: 'e2', ambito: 'Cliente', password: 'p', estado: 'Activo' },
      { id: 'k3', nombre: 'Propia', servicio: 'X', empresa_id: null, ambito: 'Propio', password: 'p', estado: 'Activo' },
    ])
    expect(screen.getByText('Email Tori')).toBeInTheDocument()
    expect(screen.queryByText('Otra empresa')).not.toBeInTheDocument()
    expect(screen.queryByText('Propia')).not.toBeInTheDocument()
    expect(screen.queryByText('SECRETO')).not.toBeInTheDocument()
    expect(refreshCredenciales).toHaveBeenCalled()
  })

  test('las inactivas se marcan', () => {
    renderBloque([{ id: 'k1', nombre: 'Vieja', servicio: 'X', empresa_id: 'e1', ambito: 'Cliente', password: 'p', estado: 'Inactivo' }])
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
  })

  test('sin keys muestra un mensaje', () => {
    renderBloque([])
    expect(screen.getByText(/no tiene keys/i)).toBeInTheDocument()
  })

  test('"Nueva" abre el alta con la empresa ya elegida', () => {
    renderBloque([])
    fireEvent.click(screen.getByRole('button', { name: /Nueva key/i }))
    expect(screen.getByText('FORM NUEVA')).toBeInTheDocument()
  })

  test('click en una key abre su ficha', () => {
    renderBloque([{ id: 'k1', nombre: 'Email Tori', servicio: 'Gmail', empresa_id: 'e1', ambito: 'Cliente', password: 'p', estado: 'Activo' }])
    fireEvent.click(screen.getByText('Email Tori'))
    expect(screen.getByText('FICHA KEY')).toBeInTheDocument()
  })
})

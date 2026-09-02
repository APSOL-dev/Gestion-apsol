import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PreventivoDetalle from '../PreventivoDetalle'
import { getPreventivoById, savePreventivo, deletePreventivo } from '../../services/operaciones'
import { getProyectos } from '../../services/proyectos'

vi.mock('../../services/operaciones', () => ({
  getPreventivoById: vi.fn(),
  savePreventivo: vi.fn(),
  deletePreventivo: vi.fn()
}))

vi.mock('../../services/proyectos', () => ({
  getProyectos: vi.fn()
}))

const mockProyectos = [
  { id: 'proy-1', nombre: 'Proyecto A', estado: 'Activo', prospectos: { empresas: { nombre: 'Empresa A' } } }
]

describe('Componente PreventivoDetalle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getProyectos.mockResolvedValue(mockProyectos)
  })

  test('al crear un preventivo, guarda el campo como "nombre" (columna real de apsol_preventivos), no "equipo_sistema"', async () => {
    savePreventivo.mockResolvedValue({ id: 'prev-1', nombre: 'Servidor Principal' })

    const { container } = render(
      <MemoryRouter initialEntries={['/preventivos/nuevo']}>
        <Routes>
          <Route path="/preventivos/:id" element={<PreventivoDetalle />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(getProyectos).toHaveBeenCalled())

    const equipoInput = screen.getByPlaceholderText('Ej. Servidor principal, Tablero Eléctrico T1...')
    fireEvent.change(equipoInput, { target: { value: 'Servidor Principal' } })

    fireEvent.change(container.querySelector('select'), { target: { value: 'proy-1' } })
    fireEvent.change(container.querySelector('input[type="date"]:last-of-type'), { target: { value: '2026-09-30' } })

    fireEvent.submit(screen.getByText('Guardar Plan').closest('form'))

    await waitFor(() => expect(savePreventivo).toHaveBeenCalled())

    const enviado = savePreventivo.mock.calls[0][0]
    expect(enviado.nombre).toBe('Servidor Principal')
    expect(enviado.equipo_sistema).toBeUndefined()
  })

  test('al editar un preventivo existente, muestra el nombre real en el título y en el input', async () => {
    getPreventivoById.mockResolvedValue({
      id: 'prev-1',
      nombre: 'Tablero Eléctrico T1',
      proyecto_id: 'proy-1',
      frecuencia_dias: 30,
      ultima_realizacion: null,
      proxima_realizacion: null,
      notas: ''
    })

    render(
      <MemoryRouter initialEntries={['/preventivos/prev-1']}>
        <Routes>
          <Route path="/preventivos/:id" element={<PreventivoDetalle />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Tablero Eléctrico T1')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Tablero Eléctrico T1' })).toBeInTheDocument()
  })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Proyectos from '../Proyectos'
import { useData } from '../../context/DataContext'

// Mismo bug que en Sprints.jsx: el clic solo navegaba si caía justo sobre el
// texto del link del nombre del proyecto, no en el resto de la fila/celda.

vi.mock('../../context/DataContext', () => ({
  useData: vi.fn(),
}))

const mockProyecto = {
  id: 'proy-1',
  nombre: 'proyecto 1',
  estado: 'Activo',
  porcentaje_avance: 50,
  prospectos: { nombre: 'Open Pack Final', empresas: { nombre: 'Open Pack' } },
  colaboradores: { nombre: 'Mateo', apellido: 'Courault' },
  fecha_inicio: '2026-07-31',
}

function renderProyectos() {
  return render(
    <MemoryRouter initialEntries={['/proyectos']}>
      <Routes>
        <Route path="/proyectos" element={<Proyectos />} />
        <Route path="/proyectos/:id" element={<div>Detalle del proyecto</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Proyectos — fila clickeable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useData.mockReturnValue({
      proyectos: [mockProyecto],
      loadingProyectos: false,
      refreshProyectos: vi.fn(),
    })
  })

  test('clic en la celda del líder (no en el link del nombre) navega al detalle', async () => {
    renderProyectos()

    const celdaLider = await screen.findByText('Mateo Courault')
    fireEvent.click(celdaLider)

    await waitFor(() => {
      expect(screen.getByText('Detalle del proyecto')).toBeInTheDocument()
    })
  })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Sprints from '../Sprints'
import { getSprintsActivos } from '../../services/sprints'

// El clic solo navegaba si caía justo sobre el texto del link ("Sprint 1 ·
// Sprint 1"), no en el resto de la fila/celda. Los usuarios hacen clic en
// cualquier parte de la fila, como en el resto del listado (ver Empresas.jsx),
// así que toda la fila debe ser clickeable.

vi.mock('../../services/sprints', () => ({
  getSprintsActivos: vi.fn(),
}))

const mockSprint = {
  id: 'sprint-1',
  numero: 1,
  nombre: 'Sprint 1',
  proyecto: { id: 'proy-1', nombre: 'proyecto 2' },
  items: [],
}

function renderSprints() {
  return render(
    <MemoryRouter initialEntries={['/sprints']}>
      <Routes>
        <Route path="/sprints" element={<Sprints />} />
        <Route path="/sprints/:id" element={<div>Detalle del sprint</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Sprints — fila clickeable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSprintsActivos.mockResolvedValue([mockSprint])
  })

  test('clic en la celda del proyecto (no en el link) navega al detalle del sprint', async () => {
    renderSprints()

    const celdaProyecto = await screen.findByText('proyecto 2')
    fireEvent.click(celdaProyecto)

    await waitFor(() => {
      expect(screen.getByText('Detalle del sprint')).toBeInTheDocument()
    })
  })

  test('clic en la celda de avance navega al detalle del sprint', async () => {
    renderSprints()

    const celdaAvance = await screen.findByText('0%')
    fireEvent.click(celdaAvance)

    await waitFor(() => {
      expect(screen.getByText('Detalle del sprint')).toBeInTheDocument()
    })
  })
})

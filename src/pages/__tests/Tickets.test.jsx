import { render, screen } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Tickets from '../Tickets'
import { useData } from '../../context/DataContext'

vi.mock('../../context/DataContext', () => ({ useData: vi.fn() }))

const base = {
  proyectos: { nombre: 'Proyecto Uno', prospectos: { empresas: { nombre: 'Uno SA' } } },
  colaboradores: { nombre: 'Adrian', apellido: 'Patriarca' },
  estado: 'Abierto', prioridad: 'Media',
}

function renderLista(tickets) {
  useData.mockReturnValue({ tickets, loadingTickets: false, refreshTickets: vi.fn() })
  return render(<MemoryRouter><Tickets /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('Tickets (lista)', () => {
  test('la fecha de creación se ve tal cual está guardada, sin correrse un día', () => {
    renderLista([{ ...base, id: 'aaaaaaaa-1', titulo: 'T1', fecha_creacion: '2026-09-23' }])
    expect(screen.getByText('23/9/2026')).toBeInTheDocument()
  })

  test('la prioridad Urgente se ve con el color de alerta', () => {
    renderLista([{ ...base, id: 'bbbbbbbb-1', titulo: 'T2', prioridad: 'Urgente', fecha_creacion: '2026-09-23' }])
    expect(screen.getByText('Urgente')).toHaveStyle({ color: 'var(--color-danger)' })
  })

  test('la tabla scrollea en horizontal en vez de esconder las últimas columnas', () => {
    renderLista([{ ...base, id: 'cccccccc-1', titulo: 'T3', fecha_creacion: '2026-09-23' }])
    expect(document.querySelector('.table-container')).toHaveStyle({ overflowX: 'auto' })
  })
})

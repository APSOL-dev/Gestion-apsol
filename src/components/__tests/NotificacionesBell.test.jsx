import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotificacionesBell from '../NotificacionesBell'
import { useAuth } from '../../context/AuthContext'
import {
  getNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, suscribirseANotificaciones,
  actualizarPreferenciasNotificacion,
} from '../../services/notificaciones'

// ──────────────────────────────────────────────────────────────
// Campana de notificaciones (Fase 2): contador de no leídas, panel con
// la lista, click navega y marca como leída, "marcar todas" limpia el
// contador. Los datos vienen de apsol_notificaciones (mockeado acá).
// ──────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

vi.mock('../../services/notificaciones', () => ({
  getNotificaciones: vi.fn(),
  marcarNotificacionLeida: vi.fn(),
  marcarTodasLeidas: vi.fn(),
  suscribirseANotificaciones: vi.fn(() => () => {}),
  actualizarPreferenciasNotificacion: vi.fn(),
}))

const notifs = [
  { id: 'n1', tipo: 'ticket_asignado', titulo: 'Ticket asignado: Error en checkout', entidad_tipo: 'ticket', entidad_id: 't1', leido_en: null, creado_en: '2026-08-30T10:00:00.000Z' },
  { id: 'n2', tipo: 'factura_colaborador_pagada', titulo: 'Te pagaron tu factura ($12.345)', entidad_tipo: 'colaborador', entidad_id: 'c1', leido_en: '2026-08-29T10:00:00.000Z', creado_en: '2026-08-29T09:00:00.000Z' },
]

function renderBell() {
  return render(<MemoryRouter><NotificacionesBell collapsed={false} /></MemoryRouter>)
}

describe('NotificacionesBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'user-1' } })
    getNotificaciones.mockResolvedValue(notifs)
    marcarNotificacionLeida.mockResolvedValue()
    marcarTodasLeidas.mockResolvedValue()
    actualizarPreferenciasNotificacion.mockResolvedValue()
  })

  test('muestra el contador de no leídas', async () => {
    renderBell()
    expect(await screen.findByText('1')).toBeInTheDocument()
  })

  test('sin usuario logueado no renderiza nada', () => {
    useAuth.mockReturnValue({ user: null })
    const { container } = renderBell()
    expect(container.firstChild).toBeNull()
  })

  test('click en la campana abre el panel con las notificaciones', async () => {
    renderBell()
    await waitFor(() => expect(getNotificaciones).toHaveBeenCalledWith('user-1'))

    fireEvent.click(screen.getByText('Notificaciones'))

    expect(await screen.findByText('Ticket asignado: Error en checkout')).toBeInTheDocument()
    expect(screen.getByText('Te pagaron tu factura ($12.345)')).toBeInTheDocument()
  })

  test('click en una no leída navega, la marca leída, y el contador baja', async () => {
    renderBell()
    fireEvent.click(screen.getByText('Notificaciones'))
    const item = await screen.findByText('Ticket asignado: Error en checkout')

    fireEvent.click(item)

    expect(mockNavigate).toHaveBeenCalledWith('/tickets/t1')
    await waitFor(() => expect(marcarNotificacionLeida).toHaveBeenCalledWith('n1'))
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument())
  })

  test('click en una ya leída navega pero no vuelve a marcar', async () => {
    renderBell()
    fireEvent.click(screen.getByText('Notificaciones'))
    const item = await screen.findByText('Te pagaron tu factura ($12.345)')

    fireEvent.click(item)

    expect(mockNavigate).toHaveBeenCalledWith('/mi-perfil')
    expect(marcarNotificacionLeida).not.toHaveBeenCalled()
  })

  test('"Marcar todas leídas" limpia el contador', async () => {
    renderBell()
    fireEvent.click(screen.getByText('Notificaciones'))
    await screen.findByText('Ticket asignado: Error en checkout')

    fireEvent.click(screen.getByText('Marcar todas leídas'))

    await waitFor(() => expect(marcarTodasLeidas).toHaveBeenCalledWith('user-1'))
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument())
  })

  test('sin notificaciones no muestra contador ni botón de "marcar todas"', async () => {
    getNotificaciones.mockResolvedValue([])
    renderBell()
    fireEvent.click(screen.getByText('Notificaciones'))

    expect(await screen.findByText('No hay notificaciones.')).toBeInTheDocument()
    expect(screen.queryByText('Marcar todas leídas')).not.toBeInTheDocument()
  })

  test('preferencias: desactivar un tipo lo saca de la lista y del contador', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, perfil: { notif_tipos_desactivados: [] } })
    renderBell()
    fireEvent.click(screen.getByText('Notificaciones'))
    await screen.findByText('Ticket asignado: Error en checkout')

    fireEvent.click(screen.getByTitle('Qué notificar'))
    const checkboxTicket = screen.getByLabelText('Ticket asignado a mí')
    expect(checkboxTicket).toBeChecked()

    fireEvent.click(checkboxTicket)

    await waitFor(() => expect(actualizarPreferenciasNotificacion).toHaveBeenCalledWith('user-1', ['ticket_asignado']))

    fireEvent.click(screen.getByText('Qué notificar'))
    expect(screen.queryByText('Ticket asignado: Error en checkout')).not.toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  test('un tipo ya desactivado en el perfil arranca destildado y no cuenta para el contador', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, perfil: { notif_tipos_desactivados: ['ticket_asignado'] } })
    renderBell()

    expect(screen.queryByText('1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Notificaciones'))
    fireEvent.click(await screen.findByTitle('Qué notificar'))

    expect(screen.getByLabelText('Ticket asignado a mí')).not.toBeChecked()
  })

  // ──────────────────────────────────────────────────────────────
  // Pedido real: "al refrescar la página quiero un cartel emergente con
  // las notificaciones, para que sean visibles" — no alcanza con la
  // campana pasiva. Se abre solo, una vez, al cargar, si hay algo sin
  // leer (no cada vez que llega una nueva por Realtime).
  // ──────────────────────────────────────────────────────────────
  test('al cargar la página, si hay notificaciones sin leer, aparece el cartel solo', async () => {
    renderBell()
    expect(await screen.findByRole('heading', { name: 'Notificaciones nuevas' })).toBeInTheDocument()
    expect(screen.getByText('Ticket asignado: Error en checkout')).toBeInTheDocument()
  })

  test('sin notificaciones sin leer, no aparece ningún cartel', async () => {
    getNotificaciones.mockResolvedValue([notifs[1]]) // solo la ya leída
    renderBell()
    await waitFor(() => expect(getNotificaciones).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'Notificaciones nuevas' })).not.toBeInTheDocument()
  })

  test('click en un ítem del cartel navega, marca leída y cierra el cartel', async () => {
    renderBell()
    const item = await screen.findByText('Ticket asignado: Error en checkout')

    fireEvent.click(item)

    expect(mockNavigate).toHaveBeenCalledWith('/tickets/t1')
    await waitFor(() => expect(marcarNotificacionLeida).toHaveBeenCalledWith('n1'))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Notificaciones nuevas' })).not.toBeInTheDocument())
  })

  test('cerrar el cartel con la X no marca nada como leído', async () => {
    renderBell()
    await screen.findByRole('heading', { name: 'Notificaciones nuevas' })

    fireEvent.click(screen.getByLabelText('Cerrar'))

    expect(screen.queryByRole('heading', { name: 'Notificaciones nuevas' })).not.toBeInTheDocument()
    expect(marcarNotificacionLeida).not.toHaveBeenCalled()
    // el badge de la campana lo sigue mostrando: no se marcó nada leído
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  test('una notificación nueva por Realtime NO reabre el cartel automático', async () => {
    let entregarNueva
    suscribirseANotificaciones.mockImplementation((_id, cb) => { entregarNueva = cb; return () => {} })
    getNotificaciones.mockResolvedValue([]) // arranca sin nada sin leer
    renderBell()
    await waitFor(() => expect(getNotificaciones).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'Notificaciones nuevas' })).not.toBeInTheDocument()

    entregarNueva({ id: 'n3', tipo: 'ticket_asignado', titulo: 'Otro ticket', entidad_tipo: 'ticket', entidad_id: 't9', leido_en: null, creado_en: '2026-08-31T00:00:00.000Z' })

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Notificaciones nuevas' })).not.toBeInTheDocument()
  })
})

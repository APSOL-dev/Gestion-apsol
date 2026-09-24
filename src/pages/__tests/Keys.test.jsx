import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Keys from '../Keys'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { getColaboradoresLista } from '../../services/colaboradores'

vi.mock('../../context/DataContext', () => ({ useData: vi.fn() }))
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/colaboradores', () => ({ getColaboradoresLista: vi.fn() }))

const KEYS = [
  { id: 'k1', nombre: 'Chat GPT', tipo: 'API', ambito: 'Propio', servicio: 'OpenAI', usuario: null, password: 'sk-SECRETO', url: 'https://api.openai.com', criticidad: 'Media', estado: 'Activo', lectores: ['c1'] },
  { id: 'k2', nombre: 'Email Tori', tipo: 'Contraseña de Usuario', ambito: 'Cliente', empresa_id: 'e1', empresa_nombre: 'Conexion Market', servicio: 'Gmail', usuario: 'tori@gmail.com', password: 'Conexion.2026', criticidad: 'Alta', estado: 'Activo', lectores: [] },
  { id: 'k3', nombre: 'Servidor viejo', tipo: 'Contraseña de Usuario', ambito: 'Propio', servicio: 'Físico', usuario: 'root', password: 'viejo', criticidad: 'Baja', estado: 'Inactivo', lectores: [] },
]

const refreshCredenciales = vi.fn()
const writeText = vi.fn().mockResolvedValue()

function renderLista({ cargo = 'Admin', credenciales = KEYS, error = false, loading = false } = {}) {
  useAuth.mockReturnValue({ perfil: { cargo } })
  useData.mockReturnValue({ credenciales, loadingCredenciales: loading, errorCredenciales: error, refreshCredenciales })
  return render(<MemoryRouter><Keys /></MemoryRouter>)
}

const filas = () => screen.queryAllByTestId('fila-key')
const nombresFilas = () => filas().map(f => within(f).getByTestId('nombre-key').textContent)

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(navigator, { clipboard: { writeText } })
  getColaboradoresLista.mockResolvedValue([{ id: 'c1', nombre: 'Santiago', apellido: 'Pérez', es_admin: false }])
})

describe('Keys (lista)', () => {
  test('el título de la sección es "Keys" y pide los datos al entrar', () => {
    renderLista()
    expect(screen.getByRole('heading', { name: 'Keys' })).toBeInTheDocument()
    expect(refreshCredenciales).toHaveBeenCalled()
  })

  test('las contraseñas NUNCA se ven en la lista', () => {
    renderLista()
    expect(screen.queryByText(/sk-SECRETO/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Conexion\.2026/)).not.toBeInTheDocument()
  })

  test('copiar la contraseña desde la lista, sin mostrarla, y avisa "Copiado"', async () => {
    renderLista()
    const fila = filas().find(f => f.textContent.includes('Chat GPT'))
    fireEvent.click(within(fila).getByRole('button', { name: 'Copiar contraseña' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('sk-SECRETO'))
    expect(await screen.findByText(/copiad/i)).toBeInTheDocument()
  })

  test('copiar el usuario desde la lista', async () => {
    renderLista()
    const fila = filas().find(f => f.textContent.includes('Email Tori'))
    fireEvent.click(within(fila).getByRole('button', { name: 'Copiar usuario' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('tori@gmail.com'))
  })

  test('orden alfabético y las inactivas no se ven', () => {
    renderLista()
    expect(nombresFilas()).toEqual(['Chat GPT', 'Email Tori'])
  })

  test('la lista es limpia: sin criticidad ni lectores', () => {
    renderLista()
    expect(screen.queryByText('Alta')).not.toBeInTheDocument()
    expect(screen.queryByText('Media')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filtrar por criticidad')).not.toBeInTheDocument()
    expect(screen.queryByText('Lectores')).not.toBeInTheDocument()
    expect(screen.queryByText('Solo admins')).not.toBeInTheDocument()
    expect(getColaboradoresLista).not.toHaveBeenCalled()
  })

  test('"Ver inactivas" las muestra', () => {
    renderLista()
    fireEvent.click(screen.getByLabelText('Ver inactivas'))
    expect(nombresFilas()).toContain('Servidor viejo')
  })

  test('pestañas Todo / Propio / Cliente filtran y muestran cuántas hay', () => {
    renderLista()
    expect(screen.getByRole('button', { name: /Todo\s*2/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cliente\s*1/ }))
    expect(nombresFilas()).toEqual(['Email Tori'])
    fireEvent.click(screen.getByRole('button', { name: /Propio\s*1/ }))
    expect(nombresFilas()).toEqual(['Chat GPT'])
  })

  test('la búsqueda no encuentra por contraseña y "Limpiar filtros" vuelve todo', () => {
    renderLista()
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'sk-SECRETO' } })
    expect(filas()).toHaveLength(0)
    expect(screen.getByText(/ninguna key coincide/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(filas()).toHaveLength(2)
  })

  test('filtro por tipo', () => {
    renderLista()
    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: 'API' } })
    expect(nombresFilas()).toEqual(['Chat GPT'])
  })

  test('la columna Cliente muestra la empresa o "Propio"', () => {
    renderLista()
    const tori = filas().find(f => f.textContent.includes('Email Tori'))
    expect(within(tori).getByText('Conexion Market')).toBeInTheDocument()
  })

  test('admin y colaborador pueden cargar keys', () => {
    const { unmount } = renderLista()
    expect(screen.getByRole('link', { name: /Nueva key/i })).toHaveAttribute('href', '/keys/nueva')
    unmount()
    renderLista({ cargo: 'Colaborador' })
    expect(screen.getByRole('link', { name: /Nueva key/i })).toHaveAttribute('href', '/keys/nueva')
  })

  test('el colaborador también puede ver sus keys dadas de baja', () => {
    renderLista({ cargo: 'Colaborador' })
    fireEvent.click(screen.getByLabelText('Ver inactivas'))
    expect(nombresFilas()).toContain('Servidor viejo')
  })

  test('un colaborador sin keys ve un mensaje claro que lo invita a cargar una', () => {
    renderLista({ cargo: 'Colaborador', credenciales: [] })
    expect(screen.getByText(/todavía no tenés keys/i)).toBeInTheDocument()
    expect(screen.getByText(/cargá una con "Nueva key"/i)).toBeInTheDocument()
  })

  test('si falla la carga, muestra el error y deja reintentar', () => {
    renderLista({ credenciales: [], error: true })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(refreshCredenciales).toHaveBeenLastCalledWith({ forzar: true })
  })

  test('el link de cada key abre en otra pestaña solo si es una web', () => {
    renderLista()
    const gpt = filas().find(f => f.textContent.includes('Chat GPT'))
    expect(within(gpt).getByRole('link', { name: 'Abrir link' })).toHaveAttribute('href', 'https://api.openai.com')
    const tori = filas().find(f => f.textContent.includes('Email Tori'))
    expect(within(tori).queryByRole('link', { name: 'Abrir link' })).not.toBeInTheDocument()
  })
})

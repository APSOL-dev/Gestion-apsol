import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import KeyDetalle from '../KeyDetalle'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { getColaboradoresLista } from '../../services/colaboradores'
import {
  getCredencialById, saveCredencial, deleteCredencial,
  subirArchivoKey, borrarArchivoKey, urlArchivoKey, getEmpresasParaKeys,
} from '../../services/credenciales'

vi.mock('../../context/DataContext', () => ({ useData: vi.fn() }))
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/colaboradores', () => ({ getColaboradoresLista: vi.fn() }))
vi.mock('../../services/credenciales', () => ({
  getCredencialById: vi.fn(), saveCredencial: vi.fn(), deleteCredencial: vi.fn(),
  subirArchivoKey: vi.fn(), borrarArchivoKey: vi.fn(), urlArchivoKey: vi.fn(),
  getEmpresasParaKeys: vi.fn(),
}))

const EXISTENTE = {
  id: 'k1', nombre: 'Chat GPT', tipo: 'API', ambito: 'Propio', empresa_id: null, servicio: 'OpenAI',
  usuario: 'adrian', password: 'sk-SECRETO', url: 'https://api.openai.com/v1', puerto: null, nombre_bd: null,
  notas: 'Sin usuario', estado: 'Activo', criticidad: 'Media', lectores: ['c1'],
  archivo_path: null, archivo_nombre: null, created_at: '2026-01-26T12:00:00Z', updated_at: '2026-09-20T12:00:00Z',
  creado_por: 'c3',
}
const BD = { ...EXISTENTE, id: 'k2', nombre: 'Postgres Norte', tipo: 'Credencial Base de datos', usuario: 'postgres', password: 'p@ss', url: 'db.norte.supabase.co', puerto: '5432', nombre_bd: 'postgres' }

const refreshCredenciales = vi.fn()
// Usuarios de login: u3 = Adrian (admin, colaborador c3), u1 = Santiago (colaborador c1)
const USUARIO_POR_CARGO = { Admin: 'u3', Colaborador: 'u1' }
const writeText = vi.fn().mockResolvedValue()

function renderDetalle(ruta, { cargo = 'Admin', usuarioId = USUARIO_POR_CARGO[cargo] } = {}) {
  useAuth.mockReturnValue({ perfil: { cargo }, user: { id: usuarioId } })
  useData.mockReturnValue({ credenciales: [EXISTENTE], refreshCredenciales })
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/keys" element={<div>LISTA DE KEYS</div>} />
        <Route path="/keys/:id" element={<KeyDetalle />} />
      </Routes>
    </MemoryRouter>
  )
}

const campo = (label) => screen.getByLabelText(label, { selector: 'input, select, textarea' })

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(navigator, { clipboard: { writeText } })
  getColaboradoresLista.mockResolvedValue([
    { id: 'c1', nombre: 'Santiago', apellido: 'Pérez', es_admin: false, usuario_id: 'u1' },
    { id: 'c2', nombre: 'Renata', apellido: '', es_admin: false, usuario_id: 'u2' },
    { id: 'c3', nombre: 'Adrian', apellido: 'Patriarca', es_admin: true, usuario_id: 'u3' },
    { id: 'c4', nombre: 'Sin', apellido: 'Usuario', es_admin: false, usuario_id: null },
  ])
  getCredencialById.mockResolvedValue(EXISTENTE)
  getEmpresasParaKeys.mockResolvedValue([{ id: 'e1', nombre: 'Conexion Market' }, { id: 'e2', nombre: 'El Norte' }])
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('KeyDetalle — alta (admin)', () => {
  test('guardar vacío marca los obligatorios y no llama a la base', async () => {
    renderDetalle('/keys/nueva')
    fireEvent.click(await screen.findByRole('button', { name: /Guardar/ }))
    expect(await screen.findByText(/poné un nombre/i)).toBeInTheDocument()
    expect(screen.getByText(/elegí el tipo/i)).toBeInTheDocument()
    expect(screen.getByText(/qué servicio/i)).toBeInTheDocument()
    expect(screen.getByText(/contraseña o clave es obligatoria/i)).toBeInTheDocument()
    expect(saveCredencial).not.toHaveBeenCalled()
  })

  test('al fallar la validación, el cursor va al primer campo con error', async () => {
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    fireEvent.change(campo('Nombre'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(document.activeElement).toBe(campo('Tipo')))
  })

  test('la empresa solo aparece (y es obligatoria) si la key es de Cliente', async () => {
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    expect(screen.queryByLabelText('Empresa', { selector: 'select' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cliente' }))
    expect(campo('Empresa')).toBeInTheDocument()
    fireEvent.change(campo('Nombre'), { target: { value: 'Email' } })
    fireEvent.change(campo('Tipo'), { target: { value: 'API' } })
    fireEvent.change(campo('Servicio'), { target: { value: 'Gmail' } })
    fireEvent.change(campo('Contraseña'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    expect(await screen.findByText(/elegí la empresa/i)).toBeInTheDocument()
    expect(saveCredencial).not.toHaveBeenCalled()
  })

  test('alta completa: guarda, refresca la lista y va a la ficha nueva', async () => {
    saveCredencial.mockResolvedValue({ ...EXISTENTE, id: 'nuevo' })
    getCredencialById.mockResolvedValue({ ...EXISTENTE, id: 'nuevo' })
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    fireEvent.change(campo('Nombre'), { target: { value: 'Chat GPT' } })
    fireEvent.change(campo('Tipo'), { target: { value: 'API' } })
    fireEvent.change(campo('Servicio'), { target: { value: 'OpenAI' } })
    fireEvent.change(campo('Contraseña'), { target: { value: 'sk-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }))
    fireEvent.click(await screen.findByLabelText('Santiago Pérez'))
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(saveCredencial).toHaveBeenCalled())
    const enviado = saveCredencial.mock.calls[0][0]
    expect(enviado).toMatchObject({ nombre: 'Chat GPT', tipo: 'API', servicio: 'OpenAI', password: 'sk-1', criticidad: 'Alta', ambito: 'Propio', lectores: ['c1'] })
    expect(refreshCredenciales).toHaveBeenCalledWith({ silencioso: true, forzar: true })
    expect(await screen.findByText(/key guardada/i)).toBeInTheDocument()
  })

  test('?empresa=e2 llega desde la ficha de la empresa: ya viene como Cliente con esa empresa', async () => {
    renderDetalle('/keys/nueva?empresa=e2')
    expect(await screen.findByLabelText('Empresa', { selector: 'select' })).toHaveValue('e2')
    expect(screen.getByRole('button', { name: 'Cliente' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('"Generar" crea una contraseña segura y la deja visible', async () => {
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    fireEvent.click(screen.getByRole('button', { name: 'Generar contraseña' }))
    const pass = campo('Contraseña')
    expect(pass.value).toHaveLength(20)
    expect(pass).toHaveAttribute('type', 'text')
  })

  test('lectores: solo colaboradores con usuario y que no son admin (los admins ya ven todo)', async () => {
    renderDetalle('/keys/nueva')
    expect(await screen.findByLabelText('Santiago Pérez')).toBeInTheDocument()
    expect(screen.getByLabelText('Renata')).toBeInTheDocument()
    expect(screen.queryByLabelText('Adrian Patriarca')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sin Usuario')).not.toBeInTheDocument()
    expect(screen.getByText(/administradores ven todas/i)).toBeInTheDocument()
  })

  test('los campos de base de datos aparecen solo para ese tipo', async () => {
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    expect(screen.queryByLabelText('Puerto')).not.toBeInTheDocument()
    fireEvent.change(campo('Tipo'), { target: { value: 'Credencial Base de datos' } })
    expect(campo('Puerto')).toBeInTheDocument()
    expect(campo('Nombre de la base')).toBeInTheDocument()
  })

  test('un puerto inválido muestra error', async () => {
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    fireEvent.change(campo('Tipo'), { target: { value: 'Credencial Base de datos' } })
    fireEvent.change(campo('Puerto'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    expect(await screen.findByText(/número entre 1 y 65535/i)).toBeInTheDocument()
  })

  test('si la base rechaza el guardado, muestra el error y no pierde lo cargado', async () => {
    saveCredencial.mockRejectedValue(new Error('duplicate key'))
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    fireEvent.change(campo('Nombre'), { target: { value: 'X' } })
    fireEvent.change(campo('Tipo'), { target: { value: 'API' } })
    fireEvent.change(campo('Servicio'), { target: { value: 'S' } })
    fireEvent.change(campo('Contraseña'), { target: { value: 'p' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    expect(await screen.findByText(/no se pudo guardar/i)).toBeInTheDocument()
    expect(campo('Nombre')).toHaveValue('X')
  })

  test('un adjunto elegido en el alta se sube después de crear la key', async () => {
    saveCredencial
      .mockResolvedValueOnce({ ...EXISTENTE, id: 'nuevo' })
      .mockResolvedValueOnce({ ...EXISTENTE, id: 'nuevo', archivo_path: 'nuevo/1-a.pdf', archivo_nombre: 'a.pdf' })
    subirArchivoKey.mockResolvedValue({ archivo_path: 'nuevo/1-a.pdf', archivo_nombre: 'a.pdf' })
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    fireEvent.change(campo('Nombre'), { target: { value: 'X' } })
    fireEvent.change(campo('Tipo'), { target: { value: 'Licencia' } })
    fireEvent.change(campo('Servicio'), { target: { value: 'S' } })
    fireEvent.change(campo('Contraseña'), { target: { value: 'p' } })
    const file = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Adjuntar archivo'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(subirArchivoKey).toHaveBeenCalledWith('nuevo', file))
    await waitFor(() => expect(saveCredencial).toHaveBeenCalledTimes(2))
    expect(saveCredencial.mock.calls[1][0]).toMatchObject({ id: 'nuevo', archivo_path: 'nuevo/1-a.pdf' })
  })

  test('un adjunto de formato inválido se rechaza sin subir', async () => {
    renderDetalle('/keys/nueva')
    await screen.findByRole('button', { name: /Guardar/ })
    const file = new File(['MZ'], 'virus.exe', { type: 'application/x-msdownload' })
    fireEvent.change(screen.getByLabelText('Adjuntar archivo'), { target: { files: [file] } })
    expect(await screen.findByText(/formato no permitido/i)).toBeInTheDocument()
  })
})

describe('KeyDetalle — edición (admin)', () => {
  test('carga la key con la contraseña oculta y se puede mostrar', async () => {
    renderDetalle('/keys/k1')
    const pass = await screen.findByDisplayValue('sk-SECRETO')
    expect(pass).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(pass).toHaveAttribute('type', 'text')
  })

  test('muestra la fecha de creación (que no se puede editar) y la última modificación', async () => {
    renderDetalle('/keys/k1')
    expect(await screen.findByText(/Creada el 26\/1\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/modificada el 20\/9\/2026/i)).toBeInTheDocument()
  })

  test('copiar contraseña, usuario y link', async () => {
    renderDetalle('/keys/k1')
    await screen.findByDisplayValue('sk-SECRETO')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar contraseña' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('sk-SECRETO'))
    fireEvent.click(screen.getByRole('button', { name: 'Copiar usuario' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('adrian'))
    expect(screen.getByRole('link', { name: 'Abrir link' })).toHaveAttribute('href', 'https://api.openai.com/v1')
  })

  test('los lectores guardados vienen tildados', async () => {
    renderDetalle('/keys/k1')
    expect(await screen.findByLabelText('Santiago Pérez')).toBeChecked()
    expect(screen.getByLabelText('Renata')).not.toBeChecked()
  })

  test('una key de base de datos ofrece copiar la cadena de conexión', async () => {
    getCredencialById.mockResolvedValue(BD)
    renderDetalle('/keys/k2')
    await screen.findByDisplayValue('p@ss')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar cadena de conexión' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('postgresql://postgres:p%40ss@db.norte.supabase.co:5432/postgres'))
  })

  test('eliminar pide confirmación con el nombre, borra y vuelve a la lista', async () => {
    deleteCredencial.mockResolvedValue()
    renderDetalle('/keys/k1')
    await screen.findByDisplayValue('sk-SECRETO')
    fireEvent.click(screen.getByRole('button', { name: /Eliminar/ }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Chat GPT'))
    await waitFor(() => expect(deleteCredencial).toHaveBeenCalledWith(expect.objectContaining({ id: 'k1' })))
    expect(await screen.findByText('LISTA DE KEYS')).toBeInTheDocument()
    expect(refreshCredenciales).toHaveBeenCalledWith({ silencioso: true, forzar: true })
  })

  test('si cancela la confirmación, no borra nada', async () => {
    window.confirm.mockReturnValue(false)
    renderDetalle('/keys/k1')
    await screen.findByDisplayValue('sk-SECRETO')
    fireEvent.click(screen.getByRole('button', { name: /Eliminar/ }))
    expect(deleteCredencial).not.toHaveBeenCalled()
  })

  test('volver con cambios sin guardar pide confirmación', async () => {
    window.confirm.mockReturnValue(false)
    renderDetalle('/keys/k1')
    await screen.findByDisplayValue('sk-SECRETO')
    fireEvent.change(campo('Nombre'), { target: { value: 'Otro nombre' } })
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/sin guardar/i))
    expect(screen.queryByText('LISTA DE KEYS')).not.toBeInTheDocument()
  })

  test('volver sin cambios no pregunta nada', async () => {
    renderDetalle('/keys/k1')
    await screen.findByDisplayValue('sk-SECRETO')
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(window.confirm).not.toHaveBeenCalled()
    expect(await screen.findByText('LISTA DE KEYS')).toBeInTheDocument()
  })

  test('adjunto existente: se abre con link temporal y se puede quitar', async () => {
    getCredencialById.mockResolvedValue({ ...EXISTENTE, archivo_path: 'k1/1-contrato.pdf', archivo_nombre: 'contrato.pdf' })
    urlArchivoKey.mockResolvedValue('https://firmado')
    saveCredencial.mockResolvedValue({ ...EXISTENTE })
    borrarArchivoKey.mockResolvedValue()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderDetalle('/keys/k1')
    fireEvent.click(await screen.findByRole('button', { name: /contrato\.pdf/ }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://firmado', '_blank', 'noopener'))
    fireEvent.click(screen.getByRole('button', { name: 'Quitar adjunto' }))
    await waitFor(() => expect(borrarArchivoKey).toHaveBeenCalledWith('k1/1-contrato.pdf'))
    expect(saveCredencial).toHaveBeenCalledWith(expect.objectContaining({ id: 'k1', archivo_path: null, archivo_nombre: null }))
  })

  test('después de adjuntar un archivo (que se guarda solo), volver no pregunta por cambios sin guardar', async () => {
    subirArchivoKey.mockResolvedValue({ archivo_path: 'k1/1-a.pdf', archivo_nombre: 'a.pdf' })
    // La base devuelve la fila con datos nuevos (fecha de modificación, etc.)
    saveCredencial.mockResolvedValue({ ...EXISTENTE, archivo_path: 'k1/1-a.pdf', archivo_nombre: 'a.pdf', updated_at: '2026-09-24T22:00:00Z', empresa_nombre: null })
    renderDetalle('/keys/k1')
    await screen.findByDisplayValue('sk-SECRETO')
    const file = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Adjuntar archivo'), { target: { files: [file] } })
    expect(await screen.findByRole('button', { name: /a\.pdf/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(window.confirm).not.toHaveBeenCalled()
    expect(await screen.findByText('LISTA DE KEYS')).toBeInTheDocument()
  })

  test('key inexistente o sin permiso: mensaje claro', async () => {
    getCredencialById.mockResolvedValue(null)
    renderDetalle('/keys/zzz')
    expect(await screen.findByText(/no existe o no tenés permiso/i)).toBeInTheDocument()
  })
})

describe('KeyDetalle — colaborador lector de una key ajena (solo lectura)', () => {
  test('ve los datos y puede copiar, pero no editar, borrar ni ver lectores', async () => {
    renderDetalle('/keys/k1', { cargo: 'Colaborador' })
    expect(await screen.findByText('Chat GPT')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Santiago Pérez')).not.toBeInTheDocument()
    expect(screen.queryByText('sk-SECRETO')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(screen.getByText('sk-SECRETO')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar contraseña' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('sk-SECRETO'))
  })

  test('muestra ámbito, servicio, criticidad y notas', async () => {
    renderDetalle('/keys/k1', { cargo: 'Colaborador' })
    const ficha = await screen.findByTestId('ficha-lectura')
    for (const t of ['Propio', 'OpenAI', 'Media', 'Sin usuario', 'API']) {
      expect(within(ficha).getByText(t)).toBeInTheDocument()
    }
  })
})

describe('KeyDetalle — colaborador que carga keys', () => {
  test('puede cargar una key nueva: ve el formulario, sin elegir lectores ni borrar', async () => {
    saveCredencial.mockResolvedValue({ ...EXISTENTE, id: 'nuevo', creado_por: 'c1' })
    renderDetalle('/keys/nueva', { cargo: 'Colaborador' })
    await screen.findByRole('button', { name: /Guardar/ })
    expect(screen.queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText(/vos y los administradores/i)).toBeInTheDocument()
    fireEvent.change(campo('Nombre'), { target: { value: 'App Stock - rol vendedor' } })
    fireEvent.change(campo('Tipo'), { target: { value: 'Contraseña de Usuario' } })
    fireEvent.change(campo('Servicio'), { target: { value: 'App Stock' } })
    fireEvent.change(campo('Contraseña'), { target: { value: 'v3nd3dor' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(saveCredencial).toHaveBeenCalled())
    expect(saveCredencial.mock.calls[0][0]).toMatchObject({ nombre: 'App Stock - rol vendedor', password: 'v3nd3dor' })
  })

  test('para una key de cliente elige la empresa de la lista (aunque no pueda ver Empresas)', async () => {
    renderDetalle('/keys/nueva', { cargo: 'Colaborador' })
    await screen.findByRole('button', { name: /Guardar/ })
    fireEvent.click(screen.getByRole('button', { name: 'Cliente' }))
    const select = campo('Empresa')
    await waitFor(() => expect(within(select).getByRole('option', { name: 'El Norte' })).toBeInTheDocument())
    expect(getEmpresasParaKeys).toHaveBeenCalled()
  })

  test('puede editar una key que cargó él (p. ej. cambió la contraseña), pero no borrarla', async () => {
    getCredencialById.mockResolvedValue({ ...EXISTENTE, creado_por: 'c1' })
    saveCredencial.mockResolvedValue({ ...EXISTENTE, creado_por: 'c1', password: 'nueva' })
    renderDetalle('/keys/k1', { cargo: 'Colaborador' })
    const pass = await screen.findByDisplayValue('sk-SECRETO')
    expect(screen.queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.change(pass, { target: { value: 'nueva' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(saveCredencial).toHaveBeenCalledWith(expect.objectContaining({ id: 'k1', password: 'nueva' })))
  })

  test('la ficha dice quién la cargó', async () => {
    getCredencialById.mockResolvedValue({ ...EXISTENTE, creado_por: 'c1' })
    renderDetalle('/keys/k1')
    expect(await screen.findByText(/Cargada por Santiago Pérez/)).toBeInTheDocument()
  })
})

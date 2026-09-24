import { describe, test, expect, vi, beforeEach } from 'vitest'

// Cadena de consultas falsa: cada método devuelve la misma cadena y el
// resultado final se define con `resultado`.
let resultado
const q = {}
for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single', 'maybeSingle']) {
  q[m] = vi.fn(() => q)
}
q.then = (res, rej) => Promise.resolve(resultado).then(res, rej)

const bucket = {
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => q),
    rpc: vi.fn(),
    storage: { from: vi.fn(() => bucket) },
  },
}))

import { supabase } from '../../lib/supabase'
import {
  getCredenciales, getCredencialById, saveCredencial, deleteCredencial,
  subirArchivoKey, urlArchivoKey, borrarArchivoKey, getEmpresasParaKeys,
} from '../credenciales'

beforeEach(() => {
  vi.clearAllMocks()
  resultado = { data: null, error: null }
})

describe('lectura', () => {
  test('la lista sale de la vista pública ordenada por nombre', async () => {
    resultado = { data: [{ id: '1' }], error: null }
    expect(await getCredenciales()).toEqual([{ id: '1' }])
    expect(supabase.from).toHaveBeenCalledWith('apsol_credenciales')
    expect(q.order).toHaveBeenCalledWith('nombre', { ascending: true })
  })

  test('una key inexistente o sin permiso devuelve null (no revienta)', async () => {
    resultado = { data: null, error: null }
    expect(await getCredencialById('00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(q.maybeSingle).toHaveBeenCalled()
  })

  test('un id que no es un identificador válido (link mal copiado) es "no existe", sin consultar la base', async () => {
    expect(await getCredencialById('cualquier-cosa')).toBeNull()
    expect(await getCredencialById(undefined)).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  test('propaga los errores de la base', async () => {
    resultado = { data: null, error: new Error('boom') }
    await expect(getCredenciales()).rejects.toThrow('boom')
  })
})

describe('saveCredencial', () => {
  const base = { nombre: ' Chat ', tipo: 'API', ambito: 'Propio', servicio: 'OpenAI', password: 'x', empresa_id: 'e1', empresa_nombre: 'X', created_at: 'hoy', lectores: [] }

  test('alta: inserta la key ya limpia (sin empresa si es propia, sin campos calculados)', async () => {
    resultado = { data: { id: 'nuevo' }, error: null }
    const out = await saveCredencial(base)
    expect(out).toEqual({ id: 'nuevo' })
    const enviado = q.insert.mock.calls[0][0][0]
    expect(enviado.nombre).toBe('Chat')
    expect(enviado.empresa_id).toBeNull()
    expect(enviado).not.toHaveProperty('empresa_nombre')
    expect(enviado).not.toHaveProperty('created_at')
    expect(enviado).not.toHaveProperty('id')
  })

  test('edición: actualiza por id sin mandar el id ni la fecha de creación en los datos', async () => {
    resultado = { data: { id: 'k1' }, error: null }
    await saveCredencial({ ...base, id: 'k1' })
    const enviado = q.update.mock.calls[0][0]
    expect(enviado).not.toHaveProperty('id')
    expect(enviado).not.toHaveProperty('created_at')
    expect(q.eq).toHaveBeenCalledWith('id', 'k1')
  })

  test('si la key no pasa la validación, no llama a la base', async () => {
    await expect(saveCredencial({ ...base, nombre: '' })).rejects.toThrow(/nombre/i)
    expect(q.insert).not.toHaveBeenCalled()
  })
})

describe('deleteCredencial', () => {
  test('borra la key y su adjunto', async () => {
    await deleteCredencial({ id: 'k1', archivo_path: 'k1/1-a.pdf' })
    expect(q.delete).toHaveBeenCalled()
    expect(q.eq).toHaveBeenCalledWith('id', 'k1')
    expect(bucket.remove).toHaveBeenCalledWith(['k1/1-a.pdf'])
  })

  test('si falla el borrado del adjunto, la key igual queda borrada (no tira error)', async () => {
    bucket.remove.mockRejectedValueOnce(new Error('storage caído'))
    await expect(deleteCredencial({ id: 'k1', archivo_path: 'k1/a.pdf' })).resolves.toBeUndefined()
  })

  test('si la base no deja borrar, no toca el adjunto', async () => {
    resultado = { data: null, error: new Error('sin permiso') }
    await expect(deleteCredencial({ id: 'k1', archivo_path: 'k1/a.pdf' })).rejects.toThrow('sin permiso')
    expect(bucket.remove).not.toHaveBeenCalled()
  })
})

describe('adjuntos (bucket privado)', () => {
  test('sube al bucket privado en la carpeta de la key, con nombre seguro', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(111)
    bucket.upload.mockResolvedValue({ data: {}, error: null })
    const file = { name: 'Contrato Cliente (firmado).pdf', type: 'application/pdf', size: 100 }
    const out = await subirArchivoKey('k1', file)
    expect(supabase.storage.from).toHaveBeenCalledWith('keys-archivos')
    expect(bucket.upload.mock.calls[0][0]).toBe('k1/111-Contrato_Cliente_firmado_.pdf')
    expect(out).toEqual({ archivo_path: 'k1/111-Contrato_Cliente_firmado_.pdf', archivo_nombre: 'Contrato Cliente (firmado).pdf' })
  })

  test('rechaza archivos inválidos antes de subir', async () => {
    await expect(subirArchivoKey('k1', { name: 'a.exe', type: 'application/x-msdownload', size: 5 })).rejects.toThrow(/formato/i)
    expect(bucket.upload).not.toHaveBeenCalled()
  })

  test('para abrir el adjunto pide un link temporal (el bucket no es público)', async () => {
    bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://firmado' }, error: null })
    expect(await urlArchivoKey('k1/a.pdf')).toBe('https://firmado')
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('k1/a.pdf', 60)
  })

  test('borrarArchivoKey sin path no hace nada', async () => {
    await borrarArchivoKey(null)
    expect(bucket.remove).not.toHaveBeenCalled()
  })
})

describe('getEmpresasParaKeys', () => {
  test('trae id + nombre por la función de la base (el colaborador no puede leer empresas directo)', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ id: 'e1', nombre: 'El Norte' }], error: null })
    expect(await getEmpresasParaKeys()).toEqual([{ id: 'e1', nombre: 'El Norte' }])
    expect(supabase.rpc).toHaveBeenCalledWith('apsol_empresas_nombres')
  })

  test('propaga el error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('sin permiso') })
    await expect(getEmpresasParaKeys()).rejects.toThrow('sin permiso')
  })
})

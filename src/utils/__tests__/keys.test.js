import { describe, test, expect } from 'vitest'
import {
  TIPOS_KEY, CRITICIDADES, KEY_VACIA,
  validarKey, prepararKeyParaGuardar, filtrarKeys, ordenarKeys,
  urlAbrible, linkDeKey, generarPassword, cadenaConexionBD, nombresLectores,
  esAdminKeys, puedeEditarKey, validarArchivoKey, tiposDisponibles, hayCambiosKey,
} from '../keys'

const valida = {
  ...KEY_VACIA,
  nombre: 'Chat GPT', tipo: 'API', ambito: 'Propio', servicio: 'OpenAI', password: 'sk-123',
}

describe('catálogos', () => {
  test('los tipos son los 4 de la app vieja', () => {
    expect(TIPOS_KEY).toEqual(['Licencia', 'API', 'Contraseña de Usuario', 'Credencial Base de datos'])
  })
  test('criticidades Baja / Media / Alta y por defecto Media', () => {
    expect(CRITICIDADES).toEqual(['Baja', 'Media', 'Alta'])
    expect(KEY_VACIA.criticidad).toBe('Media')
    expect(KEY_VACIA.ambito).toBe('Propio')
    expect(KEY_VACIA.estado).toBe('Activo')
    expect(KEY_VACIA.lectores).toEqual([])
  })
  test('tiposDisponibles suma los tipos inventados que ya existen, sin repetir', () => {
    const keys = [{ tipo: 'API' }, { tipo: 'Certificado SSL' }, { tipo: 'Certificado SSL' }, { tipo: '' }]
    expect(tiposDisponibles(keys)).toEqual([...TIPOS_KEY, 'Certificado SSL'])
  })
})

describe('validarKey', () => {
  test('una key completa no tiene errores', () => {
    expect(validarKey(valida)).toEqual({})
  })
  test('nombre, tipo, servicio y contraseña son obligatorios (espacios no cuentan)', () => {
    const e = validarKey({ ...valida, nombre: '   ', tipo: '', servicio: ' ', password: '' })
    expect(Object.keys(e).sort()).toEqual(['nombre', 'password', 'servicio', 'tipo'])
  })
  test('si es de Cliente, la empresa es obligatoria', () => {
    expect(validarKey({ ...valida, ambito: 'Cliente', empresa_id: '' })).toHaveProperty('empresa_id')
    expect(validarKey({ ...valida, ambito: 'Cliente', empresa_id: 'e1' })).toEqual({})
  })
  test('si es Propia, no pide empresa', () => {
    expect(validarKey({ ...valida, ambito: 'Propio', empresa_id: '' })).toEqual({})
  })
  test('el puerto, si se carga, tiene que ser un número entre 1 y 65535', () => {
    expect(validarKey({ ...valida, puerto: '5432' })).toEqual({})
    expect(validarKey({ ...valida, puerto: 'abc' })).toHaveProperty('puerto')
    expect(validarKey({ ...valida, puerto: '70000' })).toHaveProperty('puerto')
    expect(validarKey({ ...valida, puerto: '0' })).toHaveProperty('puerto')
  })
  test('ámbito y criticidad fuera de catálogo se rechazan', () => {
    expect(validarKey({ ...valida, ambito: 'Otro' })).toHaveProperty('ambito')
    expect(validarKey({ ...valida, criticidad: 'Urgente' })).toHaveProperty('criticidad')
  })
  test('tolera una key sin algunos campos (null) sin romper', () => {
    expect(() => validarKey({ nombre: null })).not.toThrow()
  })
})

describe('prepararKeyParaGuardar', () => {
  test('recorta espacios y manda null en los opcionales vacíos', () => {
    const out = prepararKeyParaGuardar({ ...valida, nombre: '  Chat GPT ', usuario: '  ', url: '', puerto: ' ', nombre_bd: '', notas: '' })
    expect(out.nombre).toBe('Chat GPT')
    expect(out.usuario).toBeNull()
    expect(out.url).toBeNull()
    expect(out.puerto).toBeNull()
    expect(out.nombre_bd).toBeNull()
    expect(out.notas).toBeNull()
  })
  test('la contraseña NO se recorta (un espacio puede ser parte de la clave)', () => {
    expect(prepararKeyParaGuardar({ ...valida, password: ' a b ' }).password).toBe(' a b ')
  })
  test('si es Propia, borra la empresa aunque haya quedado elegida', () => {
    expect(prepararKeyParaGuardar({ ...valida, ambito: 'Propio', empresa_id: 'e1' }).empresa_id).toBeNull()
  })
  test('si es de Cliente, conserva la empresa', () => {
    expect(prepararKeyParaGuardar({ ...valida, ambito: 'Cliente', empresa_id: 'e1' }).empresa_id).toBe('e1')
  })
  test('no manda los campos que calcula la base ni la fecha de creación', () => {
    const out = prepararKeyParaGuardar({ ...valida, id: 'k1', empresa_nombre: 'X', created_at: '2026-01-26', updated_at: 'y' })
    expect(out).not.toHaveProperty('empresa_nombre')
    expect(out).not.toHaveProperty('created_at')
    expect(out).not.toHaveProperty('updated_at')
    expect(out.id).toBe('k1')
  })
  test('lectores sin duplicados ni vacíos', () => {
    expect(prepararKeyParaGuardar({ ...valida, lectores: ['a', 'a', '', null, 'b'] }).lectores).toEqual(['a', 'b'])
  })
})

describe('filtrarKeys', () => {
  const keys = [
    { id: '1', nombre: 'Chat GPT', servicio: 'OpenAI', ambito: 'Propio', tipo: 'API', criticidad: 'Media', estado: 'Activo', usuario: null, password: 'secreto-unico' },
    { id: '2', nombre: 'Email Tori', servicio: 'Gmail', ambito: 'Cliente', empresa_nombre: 'Conexión Market', tipo: 'Contraseña de Usuario', criticidad: 'Alta', estado: 'Activo', usuario: 'tori@gmail.com' },
    { id: '3', nombre: 'Servidor viejo', servicio: 'Físico', ambito: 'Propio', tipo: 'Contraseña de Usuario', criticidad: 'Baja', estado: 'Inactivo', url: '192.168.0.10', notas: 'dado de baja' },
  ]
  const ids = (l) => l.map(k => k.id)

  test('sin filtros muestra solo las activas', () => {
    expect(ids(filtrarKeys(keys, {}))).toEqual(['1', '2'])
  })
  test('se pueden ver también las inactivas', () => {
    expect(ids(filtrarKeys(keys, { verInactivas: true }))).toEqual(['1', '2', '3'])
  })
  test('filtro Propio / Cliente', () => {
    expect(ids(filtrarKeys(keys, { ambito: 'Cliente' }))).toEqual(['2'])
    expect(ids(filtrarKeys(keys, { ambito: 'Propio', verInactivas: true }))).toEqual(['1', '3'])
    expect(ids(filtrarKeys(keys, { ambito: 'Todo' }))).toEqual(['1', '2'])
  })
  test('filtro por tipo y por criticidad', () => {
    expect(ids(filtrarKeys(keys, { tipo: 'API' }))).toEqual(['1'])
    expect(ids(filtrarKeys(keys, { criticidad: 'Alta' }))).toEqual(['2'])
  })
  test('la búsqueda ignora mayúsculas y acentos y mira nombre, servicio, usuario, empresa, url y notas', () => {
    expect(ids(filtrarKeys(keys, { busqueda: 'conexion' }))).toEqual(['2'])
    expect(ids(filtrarKeys(keys, { busqueda: 'OPENAI' }))).toEqual(['1'])
    expect(ids(filtrarKeys(keys, { busqueda: 'tori@' }))).toEqual(['2'])
    expect(ids(filtrarKeys(keys, { busqueda: '192.168', verInactivas: true }))).toEqual(['3'])
    expect(ids(filtrarKeys(keys, { busqueda: 'de baja', verInactivas: true }))).toEqual(['3'])
  })
  test('la búsqueda NUNCA mira la contraseña', () => {
    expect(filtrarKeys(keys, { busqueda: 'secreto-unico' })).toEqual([])
  })
  test('búsqueda con espacios de más no rompe', () => {
    expect(ids(filtrarKeys(keys, { busqueda: '  chat  ' }))).toEqual(['1'])
  })
  test('lista vacía o nula devuelve []', () => {
    expect(filtrarKeys(null, {})).toEqual([])
  })
})

describe('ordenarKeys', () => {
  test('primero las de criticidad Alta, después Media y Baja; dentro, por nombre', () => {
    const l = [
      { nombre: 'b', criticidad: 'Baja' }, { nombre: 'z', criticidad: 'Alta' },
      { nombre: 'a', criticidad: 'Media' }, { nombre: 'c', criticidad: 'Alta' },
    ]
    expect(ordenarKeys(l).map(k => k.nombre)).toEqual(['c', 'z', 'a', 'b'])
  })
  test('no modifica la lista original', () => {
    const l = [{ nombre: 'b', criticidad: 'Baja' }, { nombre: 'a', criticidad: 'Alta' }]
    ordenarKeys(l)
    expect(l[0].nombre).toBe('b')
  })
})

describe('urlAbrible', () => {
  test('respeta http/https', () => {
    expect(urlAbrible('https://api.openai.com/v1')).toBe('https://api.openai.com/v1')
    expect(urlAbrible('http://x.com')).toBe('http://x.com')
  })
  test('le agrega https:// a un dominio suelto', () => {
    expect(urlAbrible('app.supabase.com')).toBe('https://app.supabase.com')
    expect(urlAbrible('  prueba.easypanel.host/manager ')).toBe('https://prueba.easypanel.host/manager')
  })
  test('no ofrece abrir cosas que no son web', () => {
    expect(urlAbrible('postgresql://u:p@host:5432/db')).toBeNull()
    expect(urlAbrible('192.168.0.10')).toBeNull()
    expect(urlAbrible('javascript:alert(1)')).toBeNull()
    expect(urlAbrible('texto con espacios')).toBeNull()
    expect(urlAbrible('')).toBeNull()
    expect(urlAbrible(null)).toBeNull()
  })
})

describe('linkDeKey', () => {
  test('las keys web ofrecen abrir el link', () => {
    expect(linkDeKey({ tipo: 'API', url: 'api.openai.com/v1' })).toBe('https://api.openai.com/v1')
  })
  test('una base de datos no ofrece abrir el host en el navegador', () => {
    expect(linkDeKey({ tipo: 'Credencial Base de datos', url: 'db.x.supabase.co' })).toBeNull()
  })
  test('sin key, null', () => {
    expect(linkDeKey(null)).toBeNull()
  })
})

describe('generarPassword', () => {
  test('genera el largo pedido, con mayúsculas, minúsculas, números y símbolos', () => {
    const p = generarPassword(24)
    expect(p).toHaveLength(24)
    expect(p).toMatch(/[A-Z]/)
    expect(p).toMatch(/[a-z]/)
    expect(p).toMatch(/[0-9]/)
    expect(p).toMatch(/[^A-Za-z0-9]/)
  })
  test('por defecto 20 caracteres y dos seguidas no se repiten', () => {
    const a = generarPassword()
    expect(a).toHaveLength(20)
    expect(generarPassword()).not.toBe(a)
  })
})

describe('cadenaConexionBD', () => {
  const bd = { tipo: 'Credencial Base de datos', usuario: 'postgres', password: 'p@ss:1', url: 'db.abc.supabase.co', puerto: '5432', nombre_bd: 'postgres' }
  test('arma la cadena de conexión con la contraseña codificada', () => {
    expect(cadenaConexionBD(bd)).toBe('postgresql://postgres:p%40ss%3A1@db.abc.supabase.co:5432/postgres')
  })
  test('sin puerto ni base usa lo mínimo', () => {
    expect(cadenaConexionBD({ ...bd, puerto: '', nombre_bd: '' })).toBe('postgresql://postgres:p%40ss%3A1@db.abc.supabase.co')
  })
  test('si la url ya trae protocolo, lo saca del host', () => {
    expect(cadenaConexionBD({ ...bd, url: 'https://db.abc.supabase.co/' })).toBe('postgresql://postgres:p%40ss%3A1@db.abc.supabase.co:5432/postgres')
  })
  test('solo aplica a las de base de datos con host y usuario', () => {
    expect(cadenaConexionBD({ ...bd, tipo: 'API' })).toBeNull()
    expect(cadenaConexionBD({ ...bd, url: '' })).toBeNull()
    expect(cadenaConexionBD({ ...bd, usuario: '' })).toBeNull()
  })
})

describe('nombresLectores', () => {
  const colabs = [{ id: 'a', nombre: 'Santiago', apellido: 'Pérez' }, { id: 'b', nombre: 'Renata', apellido: null }]
  test('devuelve los nombres en el orden guardado y avisa si alguno ya no existe', () => {
    expect(nombresLectores(['b', 'a', 'x'], colabs)).toEqual(['Renata', 'Santiago Pérez', 'Colaborador eliminado'])
  })
  test('sin lectores, lista vacía', () => {
    expect(nombresLectores(null, colabs)).toEqual([])
  })
})

describe('esAdminKeys', () => {
  test('Admin y Dueño administran; Colaborador no', () => {
    expect(esAdminKeys('Admin')).toBe(true)
    expect(esAdminKeys('Dueño')).toBe(true)
    expect(esAdminKeys('Colaborador')).toBe(false)
    expect(esAdminKeys(undefined)).toBe(false)
  })
})

describe('puedeEditarKey', () => {
  test('el admin edita cualquier key', () => {
    expect(puedeEditarKey({ id: 'k', creado_por: 'otro' }, { esAdmin: true, miColaboradorId: 'c1' })).toBe(true)
  })
  test('cualquiera puede cargar una key nueva', () => {
    expect(puedeEditarKey({}, { esAdmin: false, miColaboradorId: 'c1' })).toBe(true)
  })
  test('el colaborador edita solo las que cargó él', () => {
    expect(puedeEditarKey({ id: 'k', creado_por: 'c1' }, { esAdmin: false, miColaboradorId: 'c1' })).toBe(true)
    expect(puedeEditarKey({ id: 'k', creado_por: 'c2' }, { esAdmin: false, miColaboradorId: 'c1' })).toBe(false)
  })
  test('sin saber quién soy, o key sin creador, el colaborador no edita', () => {
    expect(puedeEditarKey({ id: 'k', creado_por: null }, { esAdmin: false, miColaboradorId: null })).toBe(false)
    expect(puedeEditarKey({ id: 'k', creado_por: 'c1' }, { esAdmin: false, miColaboradorId: null })).toBe(false)
  })
})

describe('validarArchivoKey', () => {
  const f = (name, type, size) => ({ name, type, size })
  test('acepta PDF, imágenes y texto de hasta 10 MB', () => {
    expect(validarArchivoKey(f('a.pdf', 'application/pdf', 1000))).toBeNull()
    expect(validarArchivoKey(f('a.png', 'image/png', 1000))).toBeNull()
    expect(validarArchivoKey(f('a.jpg', 'image/jpeg', 1000))).toBeNull()
    expect(validarArchivoKey(f('a.txt', 'text/plain', 1000))).toBeNull()
  })
  test('rechaza otros formatos', () => {
    expect(validarArchivoKey(f('a.exe', 'application/x-msdownload', 10))).toMatch(/formato/i)
  })
  test('rechaza más de 10 MB', () => {
    expect(validarArchivoKey(f('a.pdf', 'application/pdf', 10 * 1024 * 1024 + 1))).toMatch(/10 MB/)
  })
  test('rechaza un archivo vacío', () => {
    expect(validarArchivoKey(f('a.pdf', 'application/pdf', 0))).toMatch(/vacío/i)
  })
})

describe('hayCambiosKey', () => {
  const a = { ...valida, id: 'k1', lectores: ['c1'], updated_at: 'x', empresa_nombre: null, archivo_path: null, archivo_nombre: null, creado_por: 'c1' }
  test('sin cambios -> false', () => {
    expect(hayCambiosKey(a, { ...a })).toBe(false)
  })
  test('un campo editable cambiado -> true', () => {
    expect(hayCambiosKey(a, { ...a, nombre: 'Otro' })).toBe(true)
    expect(hayCambiosKey(a, { ...a, lectores: ['c1', 'c2'] })).toBe(true)
  })
  test('ignora lo que calcula la base y el adjunto (que se guarda solo)', () => {
    expect(hayCambiosKey(a, { ...a, updated_at: 'y', empresa_nombre: 'X', archivo_path: 'k1/a.pdf', archivo_nombre: 'a.pdf', creado_por: 'c9' })).toBe(false)
  })
  test('null y texto vacío cuentan igual', () => {
    expect(hayCambiosKey({ ...a, notas: null }, { ...a, notas: '' })).toBe(false)
  })
  test('sin alguna de las dos -> false', () => {
    expect(hayCambiosKey(null, a)).toBe(false)
  })
})

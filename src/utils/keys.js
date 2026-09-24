// Reglas de la sección "Keys" (bóveda de claves y accesos). Todo lo que se
// puede probar sin React vive acá; las páginas solo pintan.

export const TIPOS_KEY = ['Licencia', 'API', 'Contraseña de Usuario', 'Credencial Base de datos']
export const TIPO_BD = 'Credencial Base de datos'
export const CRITICIDADES = ['Baja', 'Media', 'Alta']
export const AMBITOS = ['Propio', 'Cliente']

export const KEY_VACIA = {
  nombre: '', tipo: '', ambito: 'Propio', empresa_id: '', servicio: '',
  usuario: '', password: '', url: '', puerto: '', nombre_bd: '', notas: '',
  estado: 'Activo', criticidad: 'Media', lectores: [],
  archivo_path: null, archivo_nombre: null,
}

const OPCIONALES = ['usuario', 'url', 'puerto', 'nombre_bd', 'notas']
const CALCULADOS_POR_LA_BASE = ['empresa_nombre', 'created_at', 'updated_at']

const texto = (v) => (v == null ? '' : String(v))
const vacio = (v) => texto(v).trim() === ''

/** Tipos para el selector: los 4 estándar + los que ya se inventaron. */
export function tiposDisponibles(keys) {
  const extra = new Set()
  for (const k of keys || []) {
    const t = texto(k?.tipo).trim()
    if (t && !TIPOS_KEY.includes(t)) extra.add(t)
  }
  return [...TIPOS_KEY, ...[...extra].sort((a, b) => a.localeCompare(b, 'es'))]
}

/** Devuelve { campo: mensaje } con lo que falta o está mal. {} = válida. */
export function validarKey(key) {
  const k = key || {}
  const errores = {}
  if (vacio(k.nombre)) errores.nombre = 'Poné un nombre para reconocer la key.'
  if (vacio(k.tipo)) errores.tipo = 'Elegí el tipo.'
  if (vacio(k.servicio)) errores.servicio = 'Indicá a qué servicio corresponde.'
  if (texto(k.password) === '') errores.password = 'La contraseña o clave es obligatoria.'
  if (!AMBITOS.includes(k.ambito)) errores.ambito = 'Elegí si es propia o de un cliente.'
  if (k.ambito === 'Cliente' && vacio(k.empresa_id)) errores.empresa_id = 'Elegí la empresa del cliente.'
  if (k.criticidad != null && !CRITICIDADES.includes(k.criticidad)) errores.criticidad = 'Criticidad inválida.'
  if (!vacio(k.puerto)) {
    const p = texto(k.puerto).trim()
    const n = Number(p)
    if (!/^\d+$/.test(p) || n < 1 || n > 65535) errores.puerto = 'El puerto tiene que ser un número entre 1 y 65535.'
  }
  return errores
}

/** Deja la key lista para mandar a la base. */
export function prepararKeyParaGuardar(key) {
  const out = { ...key }
  for (const c of CALCULADOS_POR_LA_BASE) delete out[c]
  out.nombre = texto(out.nombre).trim()
  out.tipo = texto(out.tipo).trim()
  out.servicio = texto(out.servicio).trim()
  for (const c of OPCIONALES) out[c] = vacio(out[c]) ? null : texto(out[c]).trim()
  out.empresa_id = out.ambito === 'Cliente' && !vacio(out.empresa_id) ? out.empresa_id : null
  out.lectores = [...new Set((out.lectores || []).filter(Boolean))]
  if (!out.id) delete out.id
  return out
}

const normalizar = (s) => texto(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const CAMPOS_BUSQUEDA = ['nombre', 'servicio', 'usuario', 'empresa_nombre', 'url', 'notas', 'tipo']

/**
 * Filtros de la lista. Nunca busca dentro de la contraseña.
 * @param {{busqueda?:string, ambito?:'Todo'|'Propio'|'Cliente', tipo?:string, criticidad?:string, verInactivas?:boolean}} f
 */
export function filtrarKeys(keys, f = {}) {
  const q = normalizar(f.busqueda).trim().replace(/\s+/g, ' ')
  return (keys || []).filter(k => {
    if (!f.verInactivas && k.estado === 'Inactivo') return false
    if (f.ambito && f.ambito !== 'Todo' && k.ambito !== f.ambito) return false
    if (f.tipo && k.tipo !== f.tipo) return false
    if (f.criticidad && k.criticidad !== f.criticidad) return false
    if (q && !CAMPOS_BUSQUEDA.some(c => normalizar(k[c]).includes(q))) return false
    return true
  })
}

const PESO_CRITICIDAD = { Alta: 0, Media: 1, Baja: 2 }

/** Alta primero, después Media y Baja; dentro de cada una, por nombre. */
export function ordenarKeys(keys) {
  return [...(keys || [])].sort((a, b) =>
    (PESO_CRITICIDAD[a.criticidad] ?? 1) - (PESO_CRITICIDAD[b.criticidad] ?? 1) ||
    texto(a.nombre).localeCompare(texto(b.nombre), 'es', { sensitivity: 'base' })
  )
}

/** Link que se puede abrir en el navegador, o null si no es una web. */
export function urlAbrible(url) {
  const u = texto(url).trim()
  if (!u || /\s/.test(u)) return null
  if (/^https?:\/\//i.test(u)) return u
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null            // postgresql:, javascript:, etc.
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(u)) return null // IP suelta: suele ser un host de BD
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(u)) return null
  return `https://${u}`
}

/** Link para el botón "Abrir": las bases de datos no se abren en el navegador. */
export function linkDeKey(key) {
  if (!key || key.tipo === TIPO_BD) return null
  return urlAbrible(key.url)
}

const MAYUS ='ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUS = 'abcdefghijkmnopqrstuvwxyz'
const NUMS = '23456789'
const SIMBOLOS = '!@#$%&*-_=+?'
const TODOS = MAYUS + MINUS + NUMS + SIMBOLOS

function azar(max) {
  const a = new Uint32Array(1)
  globalThis.crypto.getRandomValues(a)
  return a[0] % max
}

/** Contraseña segura (sin caracteres confundibles como 0/O, 1/l/I). */
export function generarPassword(largo = 20) {
  const n = Math.max(8, largo)
  const chars = [MAYUS, MINUS, NUMS, SIMBOLOS].map(set => set[azar(set.length)])
  while (chars.length < n) chars.push(TODOS[azar(TODOS.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = azar(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** "postgresql://usuario:clave@host:puerto/base" para pegar en un cliente de BD. */
export function cadenaConexionBD(key) {
  if (!key || key.tipo !== TIPO_BD) return null
  if (vacio(key.url) || vacio(key.usuario)) return null
  const host = texto(key.url).trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '')
  const puerto = vacio(key.puerto) ? '' : `:${texto(key.puerto).trim()}`
  const base = vacio(key.nombre_bd) ? '' : `/${texto(key.nombre_bd).trim()}`
  return `postgresql://${encodeURIComponent(texto(key.usuario).trim())}:${encodeURIComponent(texto(key.password))}@${host}${puerto}${base}`
}

export function nombreColaborador(c) {
  return [c?.nombre, c?.apellido].filter(Boolean).join(' ')
}

export function nombresLectores(ids, colaboradores) {
  return (ids || []).map(id => {
    const c = (colaboradores || []).find(x => x.id === id)
    return c ? nombreColaborador(c) : 'Colaborador eliminado'
  })
}

// Lo que la persona edita en el formulario. El adjunto no va: se guarda
// solo apenas se sube/quita. Fechas, creador y empresa_nombre los pone la base.
const CAMPOS_EDITABLES = [
  'nombre', 'tipo', 'ambito', 'empresa_id', 'servicio', 'usuario', 'password',
  'url', 'puerto', 'nombre_bd', 'notas', 'estado', 'criticidad', 'lectores',
]

/** ¿Hay cambios sin guardar entre lo cargado y lo que está en pantalla? */
export function hayCambiosKey(original, actual) {
  if (!original || !actual) return false
  return CAMPOS_EDITABLES.some(c => {
    if (c === 'lectores') return JSON.stringify(original[c] || []) !== JSON.stringify(actual[c] || [])
    return texto(original[c]) !== texto(actual[c])
  })
}

/** Administra Keys: ve todas, borra y elige lectores. */
export function esAdminKeys(cargo) {
  return cargo === 'Admin' || cargo === 'Dueño'
}

/**
 * ¿Puede modificar esta key? El admin, cualquiera; un colaborador, solo las
 * que cargó él (una key nueva, sin id, la puede cargar cualquiera). Es la
 * misma regla que aplica el RLS de la base.
 */
export function puedeEditarKey(key, { esAdmin, miColaboradorId } = {}) {
  if (esAdmin) return true
  if (!key?.id) return true
  return !!miColaboradorId && key.creado_por === miColaboradorId
}

export const MAX_ARCHIVO_KEY = 10 * 1024 * 1024
export const TIPOS_ARCHIVO_KEY = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain']

/** null si el archivo sirve; si no, el motivo. */
export function validarArchivoKey(file) {
  if (!file) return 'No se eligió ningún archivo.'
  if (!file.size) return 'El archivo está vacío.'
  if (!TIPOS_ARCHIVO_KEY.includes(file.type)) return 'Formato no permitido: subí un PDF, una imagen (PNG/JPG) o un .txt.'
  if (file.size > MAX_ARCHIVO_KEY) return 'El archivo supera los 10 MB.'
  return null
}

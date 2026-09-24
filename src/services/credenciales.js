import { supabase } from '../lib/supabase'
import { prepararKeyParaGuardar, validarKey, validarArchivoKey } from '../utils/keys'

// Sección "Keys". La tabla sigue llamándose credenciales en la base.
// Quién ve qué lo decide el RLS: los admins ven todas; un colaborador solo
// las ACTIVAS donde figura como lector (y no puede modificarlas).

const VISTA = 'apsol_credenciales'
const BUCKET = 'keys-archivos' // privado: se abre con links temporales

export async function getCredenciales() {
  const { data, error } = await supabase
    .from(VISTA)
    .select('*')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** null si no existe o si el usuario no tiene permiso para verla. */
export async function getCredencialById(id) {
  if (!ES_UUID.test(String(id))) return null // link mal copiado: la base lo rechazaría con error
  const { data, error } = await supabase
    .from(VISTA)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveCredencial(key) {
  const errores = validarKey(key)
  const primero = Object.values(errores)[0]
  if (primero) throw new Error(primero)

  const { id, ...datos } = prepararKeyParaGuardar(key)
  if (id) {
    const { data, error } = await supabase
      .from(VISTA)
      .update(datos)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from(VISTA)
    .insert([datos])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCredencial(key) {
  const { error } = await supabase
    .from(VISTA)
    .delete()
    .eq('id', key.id)
  if (error) throw error
  // El adjunto se limpia "a mejor esfuerzo": si falla, la key ya no existe
  // y el archivo queda inaccesible para los colaboradores igual (RLS).
  await borrarArchivoKey(key.archivo_path).catch(err => console.error(err))
}

/**
 * Empresas (id + nombre) para elegir el cliente de una key. Va por una
 * función de la base porque un colaborador no puede leer la tabla de
 * empresas (tiene datos que no le corresponden).
 */
export async function getEmpresasParaKeys() {
  const { data, error } = await supabase.rpc('apsol_empresas_nombres')
  if (error) throw error
  return data || []
}

function nombreSeguro(nombre) {
  return String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
}

export async function subirArchivoKey(keyId, file) {
  const motivo = validarArchivoKey(file)
  if (motivo) throw new Error(motivo)
  const archivo_path = `${keyId}/${Date.now()}-${nombreSeguro(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(archivo_path, file, { contentType: file.type })
  if (error) throw error
  return { archivo_path, archivo_nombre: file.name }
}

export async function borrarArchivoKey(path) {
  if (!path) return
  const { error } = (await supabase.storage.from(BUCKET).remove([path])) || {}
  if (error) throw error
}

/** Link temporal (60 s) para abrir el adjunto. */
export async function urlArchivoKey(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

import { supabase } from '../lib/supabase'

// El formulario ya no obliga a elegir un contacto único para el prospecto
// (se muestran todos los de la empresa como lista) - el estado del form
// arranca en '' para ese campo. La columna contacto_id sigue siendo UUID
// en la base, así que ese '' hay que convertirlo a null antes de guardar,
// o Postgres tira "invalid input syntax for type uuid".
export function normalizarContactoId(contactoId) {
  return contactoId || null
}

// Payload para un cambio de estado del prospecto. Solo columnas REALES de
// la vista apsol_prospectos: mandar una columna inexistente (el viejo
// `fecha_ultimo_cambio_estado`) o la calculada `servicios_requeridos` hace
// que Postgres rechace todo el UPDATE ("column ... does not exist" /
// "cannot update column") y el cambio de estado falla entero.
// El historial de cambios ya queda registrado como observación automática.
export function construirCambioEstado(nuevoEstado, datos = {}) {
  const payload = { estado: nuevoEstado }

  // Pasar a "6A - En producción" requiere los datos operativos del modal.
  if ((nuevoEstado || '').includes('6A')) {
    payload.inicio_servicio = datos.inicio_servicio || null
    payload.proxima_factura = datos.proxima_factura || null
    payload.hs_mensuales = parseFloat(datos.hs_mensuales) || 0
    payload.moneda_cobro = datos.moneda_cobro
    payload.indice_cobro = datos.indice_cobro
    payload.uva_referencia_periodo = datos.uva_referencia_periodo || 'inicio'
    payload.cuenta_bancaria_id = datos.cuenta_bancaria_id || null
    payload.tarifa_base = parseFloat(datos.tarifa_base) || 0
    payload.base_indice_valor = parseFloat(datos.base_indice_valor) || 0
    payload.mensualidad_vigente_actual = parseFloat(datos.mensualidad_vigente_actual) || 0
    payload.proxima_actualizacion_tarifa = datos.proxima_actualizacion_tarifa || null
    payload.ultima_actualizacion_tarifa = datos.ultima_actualizacion_tarifa || null
    payload.dias_entre_reuniones = parseInt(datos.dias_entre_reuniones) || 0
    payload.frecuencia_actualizacion = parseInt(datos.frecuencia_actualizacion) || 1
  }

  return payload
}

// public.apsol_prospectos es una VISTA sobre apsol_private.prospectos. Solo
// se pueden escribir sus columnas reales: cualquier clave de más
// (relaciones anidadas del select, campos auxiliares del form, o columnas
// calculadas) hace que Postgres rechace TODO el INSERT/UPDATE.
//
// OJO servicios_requeridos: en la vista es una subconsulta
// (array_agg contra apsol_private.prospectos_servicios), NO una columna.
// Mandarla tira "0A000: cannot update column servicios_requeridos of view".
// Se persiste aparte con guardarServiciosProspecto().
const COLUMNAS_PROSPECTO_ESCRIBIBLES = [
  'nombre',
  'estado',
  'empresa_id',
  'contacto_id',
  'canal_contacto',
  'adjuntos',
  'presupuesto',
  'necesidad',
  'proxima_tarea',
  'fecha_proxima_tarea',
  'tarifa_base',
  'frecuencia_actualizacion',
  'inicio_servicio',
  'proxima_actualizacion_tarifa',
  'base_indice_valor',
  'hs_mensuales',
  'mensualidad_vigente_actual',
  'moneda_cobro',
  'indice_cobro',
  'proxima_factura',
  'ultima_actualizacion_tarifa',
  'dias_entre_reuniones',
  'uva_referencia_periodo',
  'cuenta_bancaria_id'
]

// Columnas de texto de la vista: todas las demás son numéricas / fecha /
// uuid y NO toleran '' (Postgres tira "invalid input syntax for type
// numeric/date/uuid: ''"). El form arranca esos campos en '' y al crear un
// prospecto nuevo nadie los toca, así que hay que mandarlos como null.
const COLUMNAS_PROSPECTO_TEXTO = new Set([
  'nombre',
  'estado',
  'canal_contacto',
  'adjuntos',
  'presupuesto',
  'necesidad',
  'proxima_tarea',
  'moneda_cobro',
  'indice_cobro',
  'uva_referencia_periodo'
])

// Filtra el objeto del formulario a solo lo que la vista apsol_prospectos
// acepta escribir. No agrega claves que no vinieron (no manda undefined) y
// convierte '' a null en las columnas no-texto.
export function construirPayloadProspecto(prospecto) {
  const payload = {}
  for (const col of COLUMNAS_PROSPECTO_ESCRIBIBLES) {
    if (prospecto[col] === undefined) continue
    const valor = prospecto[col]
    payload[col] = (valor === '' && !COLUMNAS_PROSPECTO_TEXTO.has(col)) ? null : valor
  }
  return payload
}

// Deja una lista de servicios lista para persistir: strings recortados, sin
// vacíos ni duplicados, ignorando cualquier cosa que no sea string.
export function normalizarServicios(servicios) {
  if (!Array.isArray(servicios)) return []
  const vistos = new Set()
  const limpios = []
  for (const s of servicios) {
    const v = typeof s === 'string' ? s.trim() : ''
    if (v && !vistos.has(v)) {
      vistos.add(v)
      limpios.push(v)
    }
  }
  return limpios
}

// Los servicios de un prospecto viven en apsol_private.prospectos_servicios,
// no se pueden tocar desde la vista. El RPC set_prospecto_servicios
// (SECURITY DEFINER, chequea es_admin) hace el "borrar los de ese prospecto
// + insertar los nuevos" en una sola llamada atómica.
export async function guardarServiciosProspecto(prospectoId, servicios) {
  const limpios = normalizarServicios(servicios)
  const { error } = await supabase.rpc('set_prospecto_servicios', {
    p_prospecto_id: prospectoId,
    p_servicios: limpios
  })
  if (error) throw error
  return limpios
}

export async function uploadFile(file) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `prospectos/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('Bucket Publico')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('Bucket Publico')
    .getPublicUrl(filePath)
    
  return data.publicUrl
}

export async function getProspectos(opciones = { soloActivos: true }) {
  let query = supabase
    .from('apsol_prospectos')
    .select(`
      *,
      empresas:apsol_empresas(nombre),
      contactos:apsol_contactos(nombre, apellido)
    `)
    .order('fecha_creacion', { ascending: false })

  if (opciones.estadoExacto) {
    query = query.eq('estado', opciones.estadoExacto)
  } else if (opciones.soloActivos) {
    query = query.not('estado', 'in', '(Ganado,Perdido)')
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getProspectoById(id) {
  const { data, error } = await supabase
    .from('apsol_prospectos')
    .select(`
      *,
      empresas:apsol_empresas(id, nombre),
      contactos:apsol_contactos(id, nombre, apellido, email, telefono),
      observaciones:apsol_observaciones(*, usuarios:apsol_usuarios(nombre, apellido)),
      facturacion:apsol_facturacion(*),
      proyectos:apsol_proyectos(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function saveProspecto(prospecto) {
  if (prospecto.id) {
    const { id, ...dataToUpdate } = prospecto
    const { data, error } = await supabase
      .from('apsol_prospectos')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_prospectos')
      .insert([prospecto])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteProspecto(id) {
  const { error } = await supabase
    .from('apsol_prospectos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function saveObservacion(observacion) {
  const { data, error } = await supabase
    .from('apsol_observaciones')
    .insert([observacion])
    .select('*, usuarios:apsol_usuarios(nombre, apellido)')
    .single()
  if (error) throw error
  return data
}


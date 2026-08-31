import { supabase } from '../lib/supabase'
import { finDeContrato, limpiarWhatsapp } from '../utils/colaboradores'

// ========================
// ARCHIVOS / STORAGE
// ========================
export async function uploadFile(file) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `colaboradores/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('Bucket Publico')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('Bucket Publico')
    .getPublicUrl(filePath)

  return data.publicUrl
}

// ========================
// COLABORADORES
// ========================

/**
 * Lista mínima de colaboradores (id + nombre + estado), visible para
 * CUALQUIER usuario autenticado — a diferencia de getColaboradores(), que
 * por RLS solo le devuelve su propia ficha a un Colaborador. Se usa para
 * poblar selectores (filtro "Personal" del Cronograma, invitados, etc.)
 * sin exponer la PII de la ficha completa.
 * Por defecto trae solo los activos.
 */
export async function getColaboradoresLista({ soloActivos = true } = {}) {
  let query = supabase
    .from('apsol_colaboradores_lista')
    .select('id, usuario_id, estado, nombre, apellido, es_admin')
    .order('nombre')
  if (soloActivos) query = query.neq('estado', 'Inactivo')

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(c => ({
    ...c,
    nombre: c.nombre || '',
    apellido: c.apellido || '',
    activo: c.estado !== 'Inactivo'
  }))
}

export async function getColaboradores() {
  const { data, error } = await supabase
    .from('apsol_colaboradores')
    .select(`
      *,
      usuarios:apsol_usuarios(nombre, apellido, email),
      contratos:apsol_contratos(fecha_inicio, fecha_fin)
    `)

  if (error) throw error
  return (data || []).map(c => ({
    ...c,
    nombre: c.usuarios?.nombre || c.nombre_manual || '',
    apellido: c.usuarios?.apellido || c.apellido_manual || '',
    email: c.usuarios?.email || '',
    telefono: limpiarWhatsapp(c.whatsapp),
    activo: c.estado !== 'Inactivo',
    // "Fin de contrato" que se ve en la lista: fecha_fin del último contrato.
    fin_contrato: finDeContrato(c.contratos),
  }))
}

const SELECT_FICHA = `
  *,
  usuarios:apsol_usuarios(nombre, apellido, email),
  contratos:apsol_contratos(*),
  facturas_colaboradores:apsol_facturas_colaboradores(*),
  prospectos_trabajar:apsol_colaboradores_prospectos(prospecto_id, prospectos:apsol_prospectos(nombre))
`

async function mapearFichaCompleta(data) {
  if (!data) return data
  const diasTomados = await getDiasLibresTomados(data.id)
  return {
    ...data,
    nombre: data.usuarios?.nombre || data.nombre_manual || '',
    apellido: data.usuarios?.apellido || data.apellido_manual || '',
    email: data.usuarios?.email || '',
    telefono: limpiarWhatsapp(data.whatsapp),
    prospectos_asignados: (data.prospectos_trabajar || []).map(p => p.prospecto_id),
    prospectos_trabajar_nombres: (data.prospectos_trabajar || [])
      .map(p => ({ id: p.prospecto_id, nombre: p.prospectos?.nombre || '' }))
      .filter(p => p.nombre),
    dias_libres_tomados: diasTomados,
  }
}

export async function getColaboradorById(id) {
  const { data, error } = await supabase
    .from('apsol_colaboradores')
    .select(SELECT_FICHA)
    .eq('id', id)
    .single()

  if (error) throw error
  return mapearFichaCompleta(data)
}

/**
 * Ficha completa del colaborador vinculado al usuario logueado (pantalla
 * "Mi Perfil"). Devuelve `null` si el usuario no tiene ficha de colaborador.
 * Las RLS "Colaborador ve su propia ficha/…" habilitan esta lectura.
 */
export async function getMiFichaColaborador(usuarioId) {
  if (!usuarioId) return null
  const { data, error } = await supabase
    .from('apsol_colaboradores')
    .select(SELECT_FICHA)
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (error) throw error
  return mapearFichaCompleta(data)
}

/**
 * Cuenta los días de calendario distintos en que el colaborador tuvo una
 * entrada de "Día Libre" en el cronograma. Es la fuente de "días tomados"
 * del bloque "Días de descanso" (no hay una tabla dedicada).
 */
export async function getDiasLibresTomados(colaboradorId) {
  if (!colaboradorId) return 0
  const { data, error } = await supabase
    .from('apsol_cronograma')
    .select('inicio')
    .ilike('descripcion', '[Día Libre]%')
    .eq('responsable_id', colaboradorId)
  if (error) throw error
  const dias = new Set((data || []).map(r => String(r.inicio).slice(0, 10)))
  return dias.size
}

const CLAVES_COLABORADOR = [
  'id', 'usuario_id', 'puesto', 'es_team_lead', 'fecha_inicio',
  'frecuencia_pago', 'proxima_fecha_pago',
  'renovacion_contrato', 'estado', 'whatsapp',
  'created_at',
  'dni', 'cuit_cuil', 'direccion', 'fecha_nacimiento',
  'nacionalidad', 'estado_civil', 'tarifa_base_hora',
  'dedicacion_mensual_horas', 'banco', 'cbu_cvu', 'alias',
  'nombre_manual', 'apellido_manual',
]

export async function saveColaborador(colaborador) {
  const finalColab = {}
  for (const key of CLAVES_COLABORADOR) {
    if (colaborador[key] !== undefined) {
      finalColab[key] = colaborador[key]
    }
  }
  if (colaborador.telefono !== undefined) {
    finalColab.whatsapp = limpiarWhatsapp(colaborador.telefono)
  }

  // Mapear el booleano 'activo' a su estado de texto correspondiente
  if (colaborador.activo !== undefined) {
    finalColab.estado = colaborador.activo ? 'Activo' : 'Inactivo'
  }

  // Actualizar también la información en la tabla de usuarios
  if (colaborador.usuario_id) {
    const { error: userError } = await supabase
      .from('apsol_usuarios')
      .update({
        nombre: colaborador.nombre,
        apellido: colaborador.apellido,
        email: colaborador.email
      })
      .eq('id', colaborador.usuario_id)
    if (userError) {
      console.error('Error al actualizar datos de usuario:', userError)
    }
  }

  let guardado
  if (finalColab.id) {
    const { data, error } = await supabase
      .from('apsol_colaboradores')
      .update(finalColab)
      .eq('id', finalColab.id)
      .select()
      .single()
    if (error) throw error
    guardado = data
  } else {
    const { data, error } = await supabase
      .from('apsol_colaboradores')
      .insert([finalColab])
      .select()
      .single()
    if (error) throw error
    guardado = data
  }

  // "Prospectos para trabajar" vive en la tabla de enlace, no en la vista.
  if (colaborador.prospectos_asignados !== undefined) {
    await saveColaboradorProspectos(guardado.id, colaborador.prospectos_asignados)
  }

  return guardado
}

export async function deleteColaborador(id) {
  const { error } = await supabase
    .from('apsol_colaboradores')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ========================
// PROSPECTOS PARA TRABAJAR (tabla de enlace)
// ========================
export async function saveColaboradorProspectos(colaboradorId, prospectoIds) {
  const objetivo = [...new Set((prospectoIds || []).filter(Boolean))]

  const { data: actuales, error } = await supabase
    .from('apsol_colaboradores_prospectos')
    .select('prospecto_id')
    .eq('colaborador_id', colaboradorId)
  if (error) throw error

  const setActual = new Set((actuales || []).map(r => r.prospecto_id))
  const setObjetivo = new Set(objetivo)
  const aAgregar = objetivo.filter(pid => !setActual.has(pid))
  const aQuitar = [...setActual].filter(pid => !setObjetivo.has(pid))

  if (aAgregar.length) {
    const { error: e1 } = await supabase
      .from('apsol_colaboradores_prospectos')
      .insert(aAgregar.map(prospecto_id => ({ colaborador_id: colaboradorId, prospecto_id })))
    if (e1) throw e1
  }
  if (aQuitar.length) {
    const { error: e2 } = await supabase
      .from('apsol_colaboradores_prospectos')
      .delete()
      .eq('colaborador_id', colaboradorId)
      .in('prospecto_id', aQuitar)
    if (e2) throw e2
  }
}

// ========================
// CONTRATOS
// ========================
export async function saveContrato(contrato) {
  if (contrato.id) {
    const { data, error } = await supabase
      .from('apsol_contratos')
      .update(contrato)
      .eq('id', contrato.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_contratos')
      .insert([contrato])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteContrato(id) {
  const { error } = await supabase
    .from('apsol_contratos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ========================
// FACTURAS COLABORADORES
// ========================
export async function saveFacturaColaborador(factura) {
  if (factura.id) {
    const { data, error } = await supabase
      .from('apsol_facturas_colaboradores')
      .update(factura)
      .eq('id', factura.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_facturas_colaboradores')
      .insert([factura])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteFacturaColaborador(id) {
  const { error } = await supabase
    .from('apsol_facturas_colaboradores')
    .delete()
    .eq('id', id)
  if (error) throw error
}

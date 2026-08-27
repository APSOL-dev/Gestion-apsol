import { supabase } from '../lib/supabase'

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
export async function getColaboradores() {
  const { data, error } = await supabase
    .from('apsol_colaboradores')
    .select(`
      *,
      usuarios:apsol_usuarios(nombre, apellido, email)
    `)

  if (error) throw error
  return (data || []).map(c => ({
    ...c,
    nombre: c.usuarios?.nombre || c.nombre_manual || '',
    apellido: c.usuarios?.apellido || c.apellido_manual || '',
    email: c.usuarios?.email || '',
    telefono: c.whatsapp || ''
  }))
}

export async function getColaboradorById(id) {
  const { data, error } = await supabase
    .from('apsol_colaboradores')
    .select(`
      *,
      usuarios:apsol_usuarios(nombre, apellido, email),
      contratos:apsol_contratos(*),
      facturas_colaboradores:apsol_facturas_colaboradores(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  if (data) {
    return {
      ...data,
      nombre: data.usuarios?.nombre || data.nombre_manual || '',
      apellido: data.usuarios?.apellido || data.apellido_manual || '',
      email: data.usuarios?.email || '',
      telefono: data.whatsapp || ''
    }
  }
  return data
}

export async function saveColaborador(colaborador) {
  const allowedKeys = [
    'id', 'usuario_id', 'puesto', 'fecha_inicio',
    'frecuencia_pago', 'proxima_fecha_pago',
    'renovacion_contrato', 'estado', 'whatsapp',
    'prospectos_asignados', 'created_at',
    'dni', 'cuit_cuil', 'direccion', 'fecha_nacimiento',
    'nacionalidad', 'estado_civil', 'tarifa_base_hora',
    'dedicacion_mensual_horas', 'banco', 'cbu_cvu', 'alias',
    'nombre_manual', 'apellido_manual'
  ]
  const finalColab = {}
  for (const key of allowedKeys) {
    if (colaborador[key] !== undefined) {
      finalColab[key] = colaborador[key]
    }
  }
  if (colaborador.telefono !== undefined) {
    finalColab.whatsapp = colaborador.telefono
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

  if (finalColab.id) {
    const { data, error } = await supabase
      .from('apsol_colaboradores')
      .update(finalColab)
      .eq('id', finalColab.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_colaboradores')
      .insert([finalColab])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteColaborador(id) {
  const { error } = await supabase
    .from('apsol_colaboradores')
    .delete()
    .eq('id', id)
  if (error) throw error
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

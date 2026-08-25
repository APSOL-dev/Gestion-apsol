import { supabase } from '../lib/supabase'

export async function getFacturas() {
  const { data: facturas, error } = await supabase
    .from('apsol_facturacion')
    .select(`
      *,
      prospectos:apsol_prospectos(nombre, empresas:apsol_empresas(nombre)),
      contactos:apsol_contactos!facturacion_contacto_cobro_id_fkey(nombre, apellido, email),
      contacto2:apsol_contactos!facturacion_contacto_cobro2_id_fkey(nombre, apellido, email),
      pagos:apsol_pagos(facturacion_id, fecha)
    `)
    .order('fecha_emision', { ascending: false })

  if (error) throw error

  return facturas
}

export async function getFacturaById(id) {
  // Consultar factura con sus relaciones básicas
  const { data: factura, error: facturaError } = await supabase
    .from('apsol_facturacion')
    .select(`
      *,
      prospectos:apsol_prospectos(id, nombre, empresa_id, empresas:apsol_empresas(nombre)),
      contactos:apsol_contactos!facturacion_contacto_cobro_id_fkey(id, nombre, apellido, email),
      contacto2:apsol_contactos!facturacion_contacto_cobro2_id_fkey(id, nombre, apellido, email)
    `)
    .eq('id', id)
    .single()

  if (facturaError) throw facturaError

  // Consultar pagos por separado para evitar problemas de joins en vistas
  const { data: pagos, error: pagosError } = await supabase
    .from('apsol_pagos')
    .select('*')
    .eq('facturacion_id', id)
    .order('fecha', { ascending: false })

  if (pagosError) throw pagosError

  return {
    ...factura,
    pagos: pagos || []
  }
}

export async function saveFactura(factura) {
  // Limpiar campos que vienen de joins para evitar error 400
  const { prospectos, contactos, contacto2, pagos, ...dataToSave } = factura

  if (dataToSave.id) {
    const { data, error } = await supabase
      .from('apsol_facturacion')
      .update(dataToSave)
      .eq('id', dataToSave.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_facturacion')
      .insert([dataToSave])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteFactura(id) {
  // Primero borrar pagos asociados para evitar error de clave foránea
  const { error: pagosError } = await supabase
    .from('apsol_pagos')
    .delete()
    .eq('facturacion_id', id)
  
  if (pagosError) throw pagosError

  const { error } = await supabase
    .from('apsol_facturacion')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Servicios para Pagos
export async function savePago(pago) {
  // Limpiar campos de joins
  const { cuentas_bancarias, ...dataToSave } = pago

  if (dataToSave.id) {
    const { data, error } = await supabase
      .from('apsol_pagos')
      .update(dataToSave)
      .eq('id', dataToSave.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_pagos')
      .insert([dataToSave])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deletePago(id) {
  const { error } = await supabase
    .from('apsol_pagos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getNextInvoiceNumber() {
  const { data, error } = await supabase
    .from('apsol_facturacion')
    .select('numero_factura')
    .filter('solo_invoice', 'eq', true)

  if (error) throw error
  
  if (!data || data.length === 0) return 300

  const numeros = data
    .map(f => parseInt(f.numero_factura))
    .filter(n => !isNaN(n))
  
  const max = numeros.length > 0 ? Math.max(...numeros) : 299
  return max + 1
}

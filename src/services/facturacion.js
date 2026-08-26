import { supabase } from '../lib/supabase'

export async function getFacturas() {
  const { data: facturas, error } = await supabase
    .from('apsol_facturacion')
    .select(`
      *,
      prospectos:apsol_prospectos(nombre, empresas:apsol_empresas(nombre)),
      contactos:apsol_contactos!facturacion_contacto_cobro_id_fkey(nombre, apellido, email),
      contacto2:apsol_contactos!facturacion_contacto_cobro2_id_fkey(nombre, apellido, email),
      pagos:apsol_pagos(facturacion_id, fecha, monto)
    `)
    .order('fecha_emision', { ascending: false })

  if (error) throw error

  return (facturas || []).map(f => {
    const m_bruto = Number(f.tarifa_base_uva || 0) * Number(f.valor_uva_dia || 0)
    const desc = m_bruto * (Number(f.porcentaje_descuento || 0) / 100)
    const m_neto = m_bruto - desc
    const totalPagos = (f.pagos || []).reduce((sum, p) => sum + Number(p.monto || 0), 0)
    const saldo = m_neto - totalPagos

    return {
      ...f,
      monto_bruto: m_bruto,
      descuento: desc,
      monto_neto: m_neto,
      saldo_pendiente: saldo > 0 ? saldo : 0,
      contacto_id: f.contacto_cobro_id
    }
  })
}

export async function getFacturaById(id) {
  // Consultar factura con sus relaciones básicas
  const { data: factura, error: facturaError } = await supabase
    .from('apsol_facturacion')
    .select(`
      *,
      prospectos:apsol_prospectos(id, nombre, empresa_id, empresas:apsol_empresas(nombre)),
      contactos:apsol_contactos!facturacion_contacto_cobro_id_fkey(id, nombre, apellido, email),
      contacto2:apsol_contactos!facturacion_contacto_cobro2_id_fkey(id, nombre, apellido, email),
      cuenta_bancaria:apsol_cuentas_bancarias(id, nombre_interno, banco, titular, cbu, alias)
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

  const m_bruto = Number(factura.tarifa_base_uva || 0) * Number(factura.valor_uva_dia || 0)
  const desc = m_bruto * (Number(factura.porcentaje_descuento || 0) / 100)
  const m_neto = m_bruto - desc
  const totalPagos = (pagos || []).reduce((sum, p) => sum + Number(p.monto || 0), 0)
  const saldo = m_neto - totalPagos

  return {
    ...factura,
    monto_bruto: m_bruto,
    descuento: desc,
    monto_neto: m_neto,
    saldo_pendiente: saldo > 0 ? saldo : 0,
    contacto_id: factura.contacto_cobro_id,
    pagos: pagos || []
  }
}

export async function saveFactura(factura) {
  // Limpiar campos que vienen de joins para evitar error 400
  const { prospectos, contactos, contacto2, pagos, cuenta_bancaria, ...dataToSave } = factura

  // Mapear contacto_id a la columna de la DB contacto_cobro_id
  if ('contacto_id' in dataToSave) {
    dataToSave.contacto_cobro_id = dataToSave.contacto_id
    delete dataToSave.contacto_id
  }

  // Mapear el monto_neto calculado al campo 'monto' de la base de datos
  dataToSave.monto = dataToSave.monto_neto

  // Eliminar propiedades calculadas del frontend que no existen en la DB física
  delete dataToSave.monto_bruto
  delete dataToSave.monto_neto
  delete dataToSave.descuento
  delete dataToSave.saldo_pendiente

  // Eliminar campos de UI que no tienen columna física en la DB
  delete dataToSave.fecha_vencimiento
  delete dataToSave.leyenda
  delete dataToSave.documento_general
  delete dataToSave.valor_uva_referencia

  if (dataToSave.id) {
    const { data, error } = await supabase
      .from('apsol_facturacion')
      .update(dataToSave)
      .eq('id', dataToSave.id)
      .select()
      .single()
    if (error) throw error
    
    return {
      ...data,
      contacto_id: data.contacto_cobro_id
    }
  } else {
    const { data, error } = await supabase
      .from('apsol_facturacion')
      .insert([dataToSave])
      .select()
      .single()
    if (error) throw error
    
    return {
      ...data,
      contacto_id: data.contacto_cobro_id
    }
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

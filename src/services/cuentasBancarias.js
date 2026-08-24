import { supabase } from '../lib/supabase'

export async function getCuentasBancarias() {
  const { data, error } = await supabase
    .from('apsol_cuentas_bancarias')
    .select('*')
    .order('banco')

  if (error) throw error
  return data
}

export async function saveCuentaBancaria(cuenta) {
  if (cuenta.id) {
    const { data, error } = await supabase
      .from('apsol_cuentas_bancarias')
      .update(cuenta)
      .eq('id', cuenta.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_cuentas_bancarias')
      .insert([cuenta])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteCuentaBancaria(id) {
  const { error } = await supabase
    .from('apsol_cuentas_bancarias')
    .delete()
    .eq('id', id)
  if (error) throw error
}

import { supabase } from '../lib/supabase'

export async function getValoresUVA() {
  const { data, error } = await supabase
    .from('apsol_valores_uva')
    .select('*')
    .order('fecha', { ascending: false })

  if (error) throw error
  return data
}

export async function saveValorUVA(valor) {
  if (valor.id) {
    const { data, error } = await supabase
      .from('apsol_valores_uva')
      .update(valor)
      .eq('id', valor.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('apsol_valores_uva')
      .insert([valor])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteValorUVA(id) {
  const { error } = await supabase
    .from('apsol_valores_uva')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getValorUVAByDate(fecha) {
  const { data, error } = await supabase
    .from('apsol_valores_uva')
    .select('valor')
    .eq('fecha', fecha)
    .maybeSingle()

  if (error) throw error
  return data?.valor || null
}

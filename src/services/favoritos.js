import { supabase } from '../lib/supabase'

export async function guardarFavoritos(userId, favoritos) {
  const { error } = await supabase
    .from('apsol_usuarios')
    .update({ favoritos })
    .eq('id', userId)
  if (error) throw error
}

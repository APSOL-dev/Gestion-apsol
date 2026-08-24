import { supabase } from '../lib/supabase'

export async function uploadFile(file, path) {
  const fileName = `${Date.now()}_${file.name}`
  const filePath = `${path}/${fileName}`

  const { data, error } = await supabase.storage
    .from('Bucket Publico')
    .upload(filePath, file)

  if (error) throw error

  // Obtener URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('Bucket Publico')
    .getPublicUrl(filePath)

  return publicUrl
}

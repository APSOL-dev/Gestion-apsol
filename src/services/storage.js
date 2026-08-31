import { supabase } from '../lib/supabase'

export async function uploadFile(file, path) {
  // El timestamp va como carpeta, no pegado al nombre del archivo: así la
  // URL pública termina exactamente en el nombre original que subió el
  // usuario (con su extensión), y n8n puede usarlo tal cual para nombrar
  // el adjunto que reenvía por WhatsApp/mail sin arrastrar el timestamp.
  const filePath = `${path}/${Date.now()}/${file.name}`

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

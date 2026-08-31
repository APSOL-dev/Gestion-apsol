import { supabase } from '../lib/supabase'
import { conTimeout } from '../utils/reintentar'

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

/**
 * Sube un adjunto de factura con un TOPE DE TIEMPO. Si el cliente de
 * Supabase se cuelga (refresh de token trabado, red caída), rechaza con un
 * error claro en vez de dejar la UI esperando para siempre — antes esto
 * dejaba el botón "Guardar" pegado en "Guardando...".
 *
 * @param {File} file
 * @param {string|null|undefined} facturaId  id de la factura, o null si es nueva
 * @param {{ timeoutMs?: number }} [opciones]
 * @returns {Promise<string>} URL pública del archivo subido
 */
export async function subirAdjuntoFactura(file, facturaId, { timeoutMs = 30000 } = {}) {
  return conTimeout(
    uploadFile(file, `facturacion/${facturaId || 'nueva'}`),
    timeoutMs,
    'La subida del archivo tardó demasiado. Probá de nuevo.'
  )
}

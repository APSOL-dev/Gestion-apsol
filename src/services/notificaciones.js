import { supabase } from '../lib/supabase'

const WEBHOOK_FACTURACION_URL = 'https://bots.apsol-consultora.com.ar/webhook/facturacion'
const WEBHOOK_COLABORADOR_URL = 'https://bots.apsol-consultora.com.ar/webhook/Colaborador'

/**
 * Notifica al webhook único de n8n que centraliza los avisos de
 * facturación (email + WhatsApp). n8n decide internamente, según
 * 'evento', qué canal(es) y qué plantilla usar - por eso acá se manda
 * la factura completa (con sus joins de contacto/empresa/cuenta
 * bancaria), para que n8n no tenga que volver a consultarla.
 */
export async function notificarFacturacion(evento, factura) {
  const res = await fetch(WEBHOOK_FACTURACION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, factura })
  })
  if (!res.ok) {
    throw new Error(`Error al notificar al webhook de facturación (status ${res.status})`)
  }
}

/**
 * Notifica al webhook de n8n dedicado a los pagos que SALEN a
 * colaboradores. Dos eventos:
 *  - 'colaborador_subio_factura': el colaborador adjuntó su factura del
 *    período -> n8n avisa por email al admin para que registre el pago.
 *  - 'pago_colaborador_registrado': el admin cargó el comprobante y la
 *    fecha de pago -> n8n avisa por email al colaborador.
 *
 * Endpoint aparte del de facturación a clientes (otro workflow, otra
 * plantilla, otro destinatario). Se manda `colaborador` + `factura`
 * completos para que n8n no tenga que volver a consultar la base.
 *
 * @param {'colaborador_subio_factura'|'pago_colaborador_registrado'} evento
 * @param {{colaborador: object, factura: object}} datos
 */
export async function notificarFacturaColaborador(evento, { colaborador, factura }) {
  const res = await fetch(WEBHOOK_COLABORADOR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, colaborador, factura }),
  })
  if (!res.ok) {
    throw new Error(`Error al notificar al webhook de colaboradores (status ${res.status})`)
  }
}

// ──────────────────────────────────────────────────────────────
// Notificaciones internas (Fase 2). Las filas se crean únicamente por
// triggers en la base (database/migration_notificaciones_fase2.sql) —
// acá solo se leen y se marcan como leídas.
// ──────────────────────────────────────────────────────────────

export async function getNotificaciones(usuarioId, limite = 30) {
  if (!usuarioId) return []
  const { data, error } = await supabase
    .from('apsol_notificaciones')
    .select('*')
    .eq('destinatario_id', usuarioId)
    .order('creado_en', { ascending: false })
    .limit(limite)

  if (error) throw error
  return data || []
}

export async function marcarNotificacionLeida(id) {
  const { error } = await supabase
    .from('apsol_notificaciones')
    .update({ leido_en: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function marcarTodasLeidas(usuarioId) {
  if (!usuarioId) return
  const { error } = await supabase
    .from('apsol_notificaciones')
    .update({ leido_en: new Date().toISOString() })
    .eq('destinatario_id', usuarioId)
    .is('leido_en', null)
  if (error) throw error
}

// Fase 3: qué tipos de notificación no querés ver. Vive en
// apsol_usuarios.notif_tipos_desactivados (RLS ya permite a cada
// usuario editar su propia fila).
export async function actualizarPreferenciasNotificacion(usuarioId, tiposDesactivados) {
  const { error } = await supabase
    .from('apsol_usuarios')
    .update({ notif_tipos_desactivados: tiposDesactivados || [] })
    .eq('id', usuarioId)
  if (error) throw error
}

/**
 * Se suscribe en vivo a notificaciones nuevas del usuario (INSERT en
 * apsol_notificaciones vía Realtime de Supabase). Devuelve una función
 * para cancelar la suscripción.
 */
export function suscribirseANotificaciones(usuarioId, onNueva) {
  if (!usuarioId) return () => {}
  const canal = supabase
    .channel(`notificaciones-${usuarioId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'apsol_notificaciones',
      filter: `destinatario_id=eq.${usuarioId}`,
    }, (payload) => onNueva(payload.new))
    .subscribe()

  return () => supabase.removeChannel(canal)
}

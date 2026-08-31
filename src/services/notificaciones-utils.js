import { fechaLocalISO, sumarDias } from '../utils/fecha'

// ──────────────────────────────────────────────────────────────
// "Requiere tu atención" — Fase 1 del plan de notificaciones. Alertas
// calculadas al vuelo con datos que la app ya tiene cargados (facturas,
// preventivos, prospectos, colaboradores vía DataContext), sin tabla ni
// consulta nueva. No hay "leído": la alerta desaparece sola cuando el
// dato subyacente deja de cumplir la condición.
//
// Los eventos puntuales (ticket asignado, punto de sprint en rojo,
// factura de colaborador para pagar) NO viven acá — esos son Fase 2
// (tabla apsol_notificaciones + triggers), porque necesitan quedar
// guardados para poder marcarse como leídos.
// ──────────────────────────────────────────────────────────────

const ESTADOS_FACTURA_ABIERTA = ['Pendiente', 'Enviada', 'Cobrada parcial']

export function facturasVencidas(facturas, hoy = fechaLocalISO()) {
  return (facturas || []).filter(f =>
    ESTADOS_FACTURA_ABIERTA.includes(f?.estado) &&
    f?.fecha_vencimiento && f.fecha_vencimiento < hoy
  )
}

export function preventivosVencidos(preventivos, hoy = fechaLocalISO()) {
  return (preventivos || []).filter(p => p?.proxima_realizacion && p.proxima_realizacion < hoy)
}

// Estados "caídos"/cerrados de ESTADOS_PROSPECTO (utils/formateo.js) son
// los que empiezan con dígito+H (1H..5H) — mismo criterio de substring
// que ya usa getEstadoProspectoStyle.
function esProspectoActivo(estado) {
  const e = (estado || '').toLowerCase()
  return !/\dh\b/.test(e) && !e.includes('h -')
}

export function prospectosConSeguimientoVencido(prospectos, hoy = fechaLocalISO()) {
  return (prospectos || []).filter(p =>
    esProspectoActivo(p?.estado) && p?.fecha_proxima_tarea && p.fecha_proxima_tarea < hoy
  )
}

// Cuenta tanto lo ya vencido como lo próximo a vencer dentro de la
// ventana — no hay razón para dejar de avisar justo el día que vence.
export function contratosPorVencer(colaboradores, dias = 30, hoy = fechaLocalISO()) {
  const limite = sumarDias(hoy, dias)
  return (colaboradores || []).filter(c =>
    c?.activo !== false && c?.renovacion_contrato && c.renovacion_contrato <= limite
  )
}

const URGENCIA_ORDEN = { alta: 0, media: 1, baja: 2 }

/**
 * Arma la lista de alertas "requiere tu atención" para el usuario logueado,
 * cruzando rol (Admin ve riesgo de negocio) con asignación puntual
 * (cualquiera ve sus propios preventivos). Ordenada por urgencia.
 */
export function alertasParaUsuario({ facturas, preventivos, prospectos, colaboradores, esAdmin, colaboradorId, hoy = fechaLocalISO() }) {
  const alertas = []

  if (esAdmin) {
    for (const f of facturasVencidas(facturas, hoy)) {
      alertas.push({
        id: `factura_vencida-${f.id}`,
        tipo: 'factura_vencida',
        titulo: `Factura ${f.numero_factura || 'sin número'} vencida sin cobrar`,
        urgencia: 'alta',
        link: `/facturacion/${f.id}`,
      })
    }
    for (const p of prospectosConSeguimientoVencido(prospectos, hoy)) {
      alertas.push({
        id: `prospecto_seguimiento-${p.id}`,
        tipo: 'prospecto_seguimiento',
        titulo: `Seguimiento vencido: ${p.nombre || 'prospecto'}`,
        urgencia: 'media',
        link: `/prospectos/${p.id}`,
      })
    }
    for (const c of contratosPorVencer(colaboradores, 30, hoy)) {
      alertas.push({
        id: `contrato_por_vencer-${c.id}`,
        tipo: 'contrato_por_vencer',
        titulo: `Contrato de ${c.nombre || ''} ${c.apellido || ''}`.trim() + ' por vencer',
        urgencia: 'alta',
        link: `/colaboradores/${c.id}`,
      })
    }
  }

  for (const p of preventivosVencidos(preventivos, hoy)) {
    if (!esAdmin && p.responsable_id !== colaboradorId) continue
    alertas.push({
      id: `preventivo_vencido-${p.id}`,
      tipo: 'preventivo_vencido',
      titulo: `Preventivo vencido: ${p.nombre || 'sin nombre'}`,
      urgencia: 'alta',
      link: `/preventivos/${p.id}`,
    })
  }

  return alertas.sort((a, b) => URGENCIA_ORDEN[a.urgencia] - URGENCIA_ORDEN[b.urgencia])
}

// ──────────────────────────────────────────────────────────────
// Fase 2: eventos guardados en apsol_notificaciones (ver
// database/migration_notificaciones_fase2.sql). Cada fila trae
// entidad_tipo/entidad_id; acá se resuelve a dónde navegar al tocarla.
// ──────────────────────────────────────────────────────────────

export const URGENCIA_POR_TIPO = {
  ticket_asignado: 'alta',
  sprint_item_rojo: 'alta',
  factura_colaborador_pagar: 'media',
  factura_colaborador_pagada: 'alta',
}

export const ETIQUETA_POR_TIPO = {
  ticket_asignado: 'Ticket asignado a mí',
  sprint_item_rojo: 'Punto de sprint bloqueado',
  factura_colaborador_pagar: 'Factura de colaborador para pagar',
  factura_colaborador_pagada: 'Me pagaron una factura',
}

// Fase 3: preferencias por usuario (apsol_usuarios.notif_tipos_desactivados).
// Filtro del lado del cliente sobre la lista ya traída — no toca la base
// ni los triggers, esos siguen creando la fila igual.
export function filtrarPorPreferencias(notificaciones, tiposDesactivados) {
  const arr = Array.isArray(notificaciones) ? notificaciones : []
  const desactivados = new Set(tiposDesactivados || [])
  if (desactivados.size === 0) return arr
  return arr.filter(n => !desactivados.has(n?.tipo))
}

// No hay pantalla propia para una factura de colaborador individual:
// vive dentro de ColaboradorDetalle (quien la aprueba) o Mi Perfil (el
// dueño de la factura, a quien la RLS de apsol_colaboradores le niega
// /colaboradores/:id salvo que sea la suya).
export function linkDeNotificacion(n) {
  switch (n?.entidad_tipo) {
    case 'ticket': return `/tickets/${n.entidad_id}`
    case 'sprint': return `/sprints/${n.entidad_id}`
    case 'colaborador':
      return n.tipo === 'factura_colaborador_pagada' ? '/mi-perfil' : `/colaboradores/${n.entidad_id}`
    default: return '/'
  }
}

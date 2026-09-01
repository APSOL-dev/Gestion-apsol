// La DB solo tiene una columna de texto libre `proxima_tarea` (más
// `fecha_proxima_tarea` aparte) - el "tipo" de tarea (Contactar, Enviar
// presupuesto, etc.) no es una columna propia, es una convención de
// formato: "Tipo - comentario libre". Estas dos funciones son la única
// fuente de verdad para armar/desarmar ese formato, así ProspectoDetalle.jsx
// y el quick-edit de ProspectoDrawer.jsx nunca divergen en cómo lo guardan.

// Acciones comerciales del CRM real (AppSheet). "Otro" habilita texto
// libre en el campo de comentario/observación de la próxima tarea.
export const TIPOS_TAREA = [
  'Contactar',
  'Enviar Formulario',
  'Enviar presupuesto',
  '1ra consulta presupuesto',
  '2da consulta presupuesto',
  'Ultimátum',
  'Otro'
]

export function componerProximaTarea(tipo, comentario) {
  if (tipo) {
    return comentario ? `${tipo} - ${comentario}` : tipo
  }
  return comentario || null
}

export function descomponerProximaTarea(proximaTareaTexto) {
  const texto = proximaTareaTexto || ''
  for (const tipo of TIPOS_TAREA) {
    if (texto.startsWith(tipo + ' - ')) {
      return { tipo, comentario: texto.substring(tipo.length + 3) }
    }
    if (texto === tipo) {
      return { tipo, comentario: '' }
    }
  }
  return { tipo: '', comentario: texto }
}

// ──────────────────────────────────────────────────────────────
// Formato liviano para el texto de un punto de sprint. NO es un editor:
// solo estas cuatro cosas, sobre el mismo campo de texto del punto.
//
//   **texto**        -> negrita (al renderizar)
//   "- " al inicio   -> viñeta "• " (mientras se tipea)
//   botón/tap        -> mete o saca la viñeta de la línea actual
//   Ctrl+Enter       -> salto de línea (y continúa la viñeta)
//
// Enter (solo) NO lo maneja esto: la pantalla lo usa para confirmar el
// punto.
// ──────────────────────────────────────────────────────────────

const RE_VINETA = /^(\s*)([•*-]) /   // línea que ya arranca con viñeta (•, - o *)
const ESPACIOS_POR_NIVEL = 2

// Mientras se escribe: "- " al principio de una línea pasa a "• ".
// Idempotente y línea por línea. No toca "-x", "--", ni guiones del medio.
export function autoformatearVineta(texto) {
  if (typeof texto !== 'string') return texto
  return texto
    .split('\n')
    .map((linea) => linea.replace(/^(\s*)- (?=\S|$)/, '$1• '))
    .join('\n')
}

function parsearNegrita(contenido) {
  if (!contenido) return []
  const partes = []
  let resto = contenido
  const re = /\*\*([^*]+)\*\*/
  let m
  while ((m = re.exec(resto))) {
    if (m.index > 0) partes.push({ texto: resto.slice(0, m.index), negrita: false })
    partes.push({ texto: m[1], negrita: true })
    resto = resto.slice(m.index + m[0].length)
  }
  if (resto) partes.push({ texto: resto, negrita: false })
  return partes
}

// Descompone el texto en líneas listas para pintar: viñeta sí/no,
// nivel de sangría (2 espacios = 1 nivel) y las partes con/sin negrita.
export function parsearItemFormato(texto) {
  const fuente = typeof texto === 'string' ? texto : ''
  return fuente.split('\n').map((linea) => {
    const vin = linea.match(RE_VINETA)
    if (vin) {
      const sangria = Math.floor(vin[1].length / ESPACIOS_POR_NIVEL)
      return { vineta: true, sangria, partes: parsearNegrita(linea.slice(vin[0].length)) }
    }
    const espacios = (linea.match(/^(\s*)/)?.[1] || '').length
    return {
      vineta: false,
      sangria: Math.floor(espacios / ESPACIOS_POR_NIVEL),
      partes: parsearNegrita(linea.slice(espacios)),
    }
  })
}

function limitesDeLinea(texto, pos) {
  const inicio = texto.lastIndexOf('\n', pos - 1) + 1
  const finRel = texto.indexOf('\n', pos)
  return { inicio, fin: finRel === -1 ? texto.length : finRel }
}

// Botón/tap de viñeta: si la línea del cursor no tiene viñeta, se la
// pone; si ya la tiene, se la saca (toggle).
export function insertarVinetaEnLinea(texto, selStart, selEnd = selStart) {
  const fuente = typeof texto === 'string' ? texto : ''
  const { inicio, fin } = limitesDeLinea(fuente, selStart)
  const linea = fuente.slice(inicio, fin)

  let nuevaLinea
  let delta
  if (RE_VINETA.test(linea)) {
    nuevaLinea = linea.replace(RE_VINETA, '$1')
    delta = -2
  } else {
    nuevaLinea = linea.replace(/^(\s*)/, '$1• ')
    delta = 2
  }
  return {
    texto: fuente.slice(0, inicio) + nuevaLinea + fuente.slice(fin),
    cursor: Math.max(inicio, selEnd + delta),
  }
}

// Ctrl+Enter: salto de línea. Si venías en una viñeta con contenido, la
// nueva línea arranca con "• " y la misma sangría. Si la viñeta estaba
// vacía, se corta la lista.
export function insertarSalto(texto, selStart, selEnd = selStart) {
  const fuente = typeof texto === 'string' ? texto : ''
  const antes = fuente.slice(0, selStart)
  const despues = fuente.slice(selEnd)
  const inicioLinea = antes.lastIndexOf('\n') + 1
  const lineaActual = antes.slice(inicioLinea)

  const vin = lineaActual.match(RE_VINETA)
  if (vin) {
    if (lineaActual.slice(vin[0].length).trim() === '') {
      return { texto: antes.slice(0, inicioLinea) + '\n' + despues, cursor: inicioLinea + 1 }
    }
    const prefijo = vin[1] + '• '
    return { texto: antes + '\n' + prefijo + despues, cursor: selStart + 1 + prefijo.length }
  }
  return { texto: antes + '\n' + despues, cursor: selStart + 1 }
}

// Para el panel "Rojo ahora mismo" y el tablero: sin ** ni viñetas, todo
// en una línea.
export function textoPlano(texto) {
  if (typeof texto !== 'string') return ''
  return texto
    .split('\n')
    .map((l) => l.replace(/^\s*[•*-] /, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .join(' · ')
}

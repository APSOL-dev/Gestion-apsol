import { supabase } from '../lib/supabase'

const API_URL = 'https://api.argentinadatos.com/v1/finanzas/indices/uva'

/**
 * Consulta la API pública de Argentina Datos y obtiene el valor UVA
 * para la fecha indicada. Si la fecha exacta no está disponible, devuelve
 * el valor del día más reciente que aparezca en la respuesta.
 *
 * @param {string} fecha  Formato 'YYYY-MM-DD'
 * @returns {Promise<{valor: number, exacta: boolean}>} Valor UVA encontrado,
 *   y si corresponde exactamente a la fecha pedida o es un fallback al día
 *   más reciente disponible.
 * @throws Error si la API no responde con 2xx
 */
export async function sincronizarUVADesdeAPI(fecha) {
  const respuesta = await fetch(API_URL)

  if (!respuesta.ok) {
    throw new Error('Error al consultar la API de cotizaciones UVA')
  }

  const cotizaciones = await respuesta.json()

  if (!Array.isArray(cotizaciones) || cotizaciones.length === 0) {
    throw new Error('La API de cotizaciones UVA devolvió datos vacíos')
  }

  // Buscar la fecha exacta
  const exacta = cotizaciones.find(c => c.fecha === fecha)
  if (exacta) return { valor: exacta.valor, exacta: true }

  // Fallback: el valor más reciente (el array viene ordenado cronológicamente)
  const masReciente = [...cotizaciones].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  return { valor: masReciente.valor, exacta: false }
}

/**
 * Busca el valor UVA para una fecha en la base de datos local.
 * Si no lo encuentra, lo trae desde la API de Argentina Datos y lo devuelve.
 * Solo lo persiste en la base de datos cuando la API tiene la cotización
 * EXACTA de esa fecha: si se recurre al valor más reciente como aproximación
 * (fecha fuera de rango, inválida, o todavía sin publicar), se devuelve para
 * no trabar a quien está facturando, pero no se guarda en el histórico bajo
 * una fecha que no le corresponde.
 *
 * @param {string} fecha  Formato 'YYYY-MM-DD'
 * @returns {Promise<number|null>} Valor UVA o null si no hay datos
 */
export async function obtenerUVAParaFecha(fecha) {
  // Intentar traer el valor de la BD local primero
  const { data, error } = await supabase
    .from('apsol_valores_uva')
    .select('valor')
    .eq('fecha', fecha)
    .maybeSingle()

  if (error) throw error

  if (data?.valor != null) {
    return data.valor
  }

  // Fallback: consultar la API externa
  try {
    const { valor, exacta } = await sincronizarUVADesdeAPI(fecha)

    if (!exacta) {
      console.warn(`No hay cotización UVA exacta para ${fecha}; se usó el valor más reciente sin guardarlo en el histórico.`)
      return valor
    }

    // Guardar en la BD para no volver a consultar
    const { data: insertado, error: errorInsert } = await supabase
      .from('apsol_valores_uva')
      .insert([{ fecha, valor }])
      .select()
      .single()

    if (errorInsert) {
      console.warn('No se pudo guardar el valor UVA en BD:', errorInsert.message)
    }

    return insertado?.valor ?? valor
  } catch (err) {
    console.error('No se pudo obtener el valor UVA desde la API:', err.message)
    return null
  }
}

/**
 * Sincroniza el histórico completo de cotizaciones UVA desde la API pública
 * de Argentina Datos hacia la base de datos local, insertando únicamente las
 * fechas que todavía no existen (evita duplicar días ya cargados). Pensada
 * para llamarse una vez al abrir la app, en segundo plano.
 *
 * @returns {Promise<{insertados: number}>}
 */
export async function sincronizarHistoricoUVA() {
  const respuesta = await fetch(API_URL)

  if (!respuesta.ok) {
    throw new Error('Error al consultar la API de cotizaciones UVA')
  }

  const cotizaciones = await respuesta.json()
  if (!Array.isArray(cotizaciones) || cotizaciones.length === 0) {
    return { insertados: 0 }
  }

  const { data: existentes, error } = await supabase
    .from('apsol_valores_uva')
    .select('fecha')

  if (error) throw error

  const fechasExistentes = new Set((existentes || []).map(r => r.fecha))

  const nuevos = cotizaciones
    .filter(c => c.fecha && c.valor != null && !fechasExistentes.has(c.fecha))
    .map(c => ({ fecha: c.fecha, valor: c.valor }))

  if (nuevos.length === 0) return { insertados: 0 }

  // ignoreDuplicates como red de seguridad extra: la columna 'fecha' es
  // UNIQUE, así que ante una carrera con otra pestaña/usuario no se rompe.
  const { error: insertError } = await supabase
    .from('apsol_valores_uva')
    .upsert(nuevos, { onConflict: 'fecha', ignoreDuplicates: true })

  if (insertError) throw insertError

  return { insertados: nuevos.length }
}

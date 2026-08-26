import { supabase } from '../lib/supabase'

const API_URL = 'https://api.argentinadatos.com/v1/finanzas/indices/uva'

/**
 * Consulta la API pública de Argentina Datos y obtiene el valor UVA
 * para la fecha indicada. Si la fecha exacta no está disponible, devuelve
 * el valor del día más reciente que aparezca en la respuesta.
 * 
 * @param {string} fecha  Formato 'YYYY-MM-DD'
 * @returns {Promise<number>} Valor UVA encontrado
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
  if (exacta) return exacta.valor

  // Fallback: el valor más reciente (el array viene ordenado cronológicamente)
  const masReciente = [...cotizaciones].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  return masReciente.valor
}

/**
 * Busca el valor UVA para una fecha en la base de datos local.
 * Si no lo encuentra, lo trae desde la API de Argentina Datos,
 * lo guarda en la base de datos y lo devuelve.
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
    const valorAPI = await sincronizarUVADesdeAPI(fecha)

    // Guardar en la BD para no volver a consultar
    const { data: insertado, error: errorInsert } = await supabase
      .from('apsol_valores_uva')
      .insert([{ fecha, valor: valorAPI }])
      .select()
      .single()

    if (errorInsert) {
      console.warn('No se pudo guardar el valor UVA en BD:', errorInsert.message)
    }

    return insertado?.valor ?? valorAPI
  } catch (err) {
    console.error('No se pudo obtener el valor UVA desde la API:', err.message)
    return null
  }
}

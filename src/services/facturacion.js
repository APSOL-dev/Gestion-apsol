import { supabase } from '../lib/supabase'
import { redondear2 } from '../utils/formateo'
import { sumarMeses, sumarDiasHabiles, fechaLocalISO, esFechaCompleta } from '../utils/fecha'
import { notificarFacturacion } from './notificaciones'

/**
 * Días hábiles que espera APSOL, desde la emisión de una factura, antes de
 * agendar el primer recordatorio de cobro cuando la empresa no tiene el
 * dato cargado. Coincide con el DEFAULT de apsol_empresas.dias_espera_facturacion.
 */
export const DIAS_ESPERA_FACTURACION_DEFAULT = 4

/**
 * Múltiplo de redondeo por defecto para una factura nueva. El neto se
 * redondea siempre hacia abajo a este múltiplo (ver calcularMontosFactura).
 * Coincide con el DEFAULT de apsol_private.facturacion.redondeo_multiplo.
 */
export const REDONDEO_MULTIPLO_DEFAULT = 1000

/**
 * Calcula monto bruto, descuento, monto neto y saldo pendiente de una factura.
 * Si la factura tiene tarifa en UVA cargada (tarifa_base_uva y valor_uva_dia),
 * el bruto se deriva de esos dos valores. Si no (facturas creadas antes de que
 * existiera este esquema, o cargadas con un monto fijo), se usa directamente
 * la columna 'monto' ya persistida para no mostrar $0 en facturas históricas.
 */
export function calcularMontosFactura(factura, pagos = []) {
  const tarifa = Number(factura.tarifa_base_uva || 0)
  const valorUva = Number(factura.valor_uva_dia || 0)
  const tieneTarifaUVA = tarifa > 0 && valorUva > 0

  const monto_bruto = tieneTarifaUVA
    ? redondear2(tarifa * valorUva)
    : redondear2(factura.monto)
  const descuento = tieneTarifaUVA
    ? redondear2(monto_bruto * (Number(factura.porcentaje_descuento || 0) / 100))
    : 0
  // Redondeo del NETO a un múltiplo (ej. 1000), siempre hacia abajo. Es
  // opcional por factura y se arrastra a la próxima del mismo prospecto.
  // redondeo_multiplo <= 0 (o ausente, facturas históricas) => sin redondeo.
  const multiplo = Number(factura.redondeo_multiplo || 0)
  const netoCrudo = redondear2(monto_bruto - descuento)
  const monto_neto = multiplo > 0
    ? Math.floor(netoCrudo / multiplo) * multiplo
    : netoCrudo
  const totalPagos = redondear2((pagos || []).reduce((sum, p) => sum + Number(p.monto || 0), 0))
  const saldo_pendiente = redondear2(monto_neto - totalPagos)

  return {
    monto_bruto,
    descuento,
    monto_neto,
    saldo_pendiente: saldo_pendiente > 0 ? saldo_pendiente : 0
  }
}

/**
 * Valida los campos obligatorios al CREAR una factura. Devuelve un array de
 * mensajes (vacío = todo ok). Pura, se testea sin montar el componente.
 *
 *  - Nº de factura fiscal: obligatorio salvo "solo invoice" (ahí el nº se
 *    autogenera).
 *  - Período Desde y Hasta: ambos obligatorios.
 *  - Contacto de cobro principal: obligatorio (el secundario no).
 *  - Cuenta para depósito: obligatoria.
 *  - Leyenda de la factura: obligatoria.
 */
export function validarFacturaParaGuardar(factura = {}) {
  const errores = []
  const txt = (v) => String(v ?? '').trim()

  if (!factura.solo_invoice && !txt(factura.numero_factura)) {
    errores.push('Falta el número de factura fiscal.')
  }
  if (!esFechaCompleta(txt(factura.periodo_desde).split('T')[0])) {
    errores.push('Falta el período (Desde).')
  }
  if (!esFechaCompleta(txt(factura.periodo_hasta).split('T')[0])) {
    errores.push('Falta el período (Hasta).')
  }
  if (!txt(factura.contacto_id)) {
    errores.push('Falta el contacto de cobro principal.')
  }
  if (!txt(factura.cuenta_bancaria_id)) {
    errores.push('Falta la cuenta para depósito.')
  }
  if (!txt(factura.leyenda)) {
    errores.push('Falta la leyenda de la factura.')
  }
  return errores
}

/** 'YYYY-MM-DD' (o ISO con hora) -> 'DD/MM/YYYY'. Vacío si no matchea. */
function fechaDDMMAAAA(valor) {
  const s = String(valor || '').split('T')[0]
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/**
 * Arma el texto NO editable que la pantalla de la factura muestra debajo de
 * la leyenda, con su botón de "Copiar". Es puro (sin I/O ni DOM).
 *
 *   <leyenda>
 *   Horas facturadas: <N>        <- solo si incluir_horas_leyenda y hay horas > 0
 *   Período: 01/08/2026 al 31/08/2026   <- fechas completas, las dos puntas
 *
 * Las líneas que no aplican se omiten (sin renglones en blanco). Con todo
 * vacío devuelve ''.
 */
export function componerLeyendaFactura({
  leyenda, hs_facturadas, incluir_horas_leyenda, periodo_desde, periodo_hasta
} = {}) {
  const lineas = []

  const leyendaTxt = String(leyenda || '').trim()
  if (leyendaTxt) lineas.push(leyendaTxt)

  const horas = Number(hs_facturadas)
  if (incluir_horas_leyenda && Number.isFinite(horas) && horas > 0) {
    lineas.push(`Horas facturadas: ${horas}`)
  }

  const desde = fechaDDMMAAAA(periodo_desde)
  const hasta = fechaDDMMAAAA(periodo_hasta)
  if (desde && hasta) lineas.push(`Período: ${desde} al ${hasta}`)

  return lineas.join('\n')
}

/**
 * Qué fecha del período se usa para buscar el valor UVA de la factura.
 * Por defecto la de INICIO (periodo_desde); si el prospecto está configurado
 * con uva_referencia_periodo = 'fin', se usa la de FIN (periodo_hasta).
 * Devuelve '' si la fecha elegida todavía no está cargada.
 */
export function fechaReferenciaUva({ uva_referencia_periodo, periodo_desde, periodo_hasta } = {}) {
  const fecha = uva_referencia_periodo === 'fin' ? periodo_hasta : periodo_desde
  return fecha || ''
}

/**
 * Decide qué campos precompletar al elegir un prospecto en una factura nueva:
 * razón social, contactos de cobro, cuenta bancaria, tipo de comprobante,
 * leyenda, período a facturar y tarifa UVA. Prioriza continuar desde la
 * última factura ya cargada de ese prospecto (para no repetir tipeo mes a
 * mes); si no hay última factura, arranca desde los datos base del
 * prospecto. Es una función pura (sin I/O) para poder testear esta decisión
 * sin mockear Supabase ni montar el componente.
 *
 * BUG real corregido acá: la tarifa UVA del prospecto vive en la columna
 * 'base_indice_valor' (la que se edita como "Valor Base (Índice)" en la
 * ficha del prospecto). El código leía 'tarifa_base', una columna vieja que
 * ninguna pantalla completa y por eso siempre está en 0 — la tarifa nunca
 * se precargaba para prospectos sin facturas previas.
 */
export function calcularPrefillFactura({ prospecto, ultimaFactura, contactosEmpresa = [], razonesSociales = [], esNueva, facturaActual = {} }) {
  const updates = {}

  // Razón social: preferir la de la última factura si sigue siendo válida
  if (!facturaActual.razon_social_id) {
    const razonPrevia = ultimaFactura?.razon_social_id && razonesSociales.some(r => r.id === ultimaFactura.razon_social_id)
      ? ultimaFactura.razon_social_id
      : razonesSociales[0]?.id
    if (razonPrevia) updates.razon_social_id = razonPrevia
  }

  if (esNueva && contactosEmpresa.length > 0) {
    updates.contacto_id = facturaActual.contacto_id
      || (contactosEmpresa.some(c => c.id === ultimaFactura?.contacto_cobro_id) ? ultimaFactura.contacto_cobro_id : '')
      || contactosEmpresa[0]?.id || ''
    updates.contacto_cobro2_id = facturaActual.contacto_cobro2_id
      || (contactosEmpresa.some(c => c.id === ultimaFactura?.contacto_cobro2_id) ? ultimaFactura.contacto_cobro2_id : '')
      || ''
  }

  // Cuenta para depósito: por defecto la configurada en el prospecto (a dónde
  // se le dice en general que deposite). Si la última factura ya usó una,
  // esa le gana (continuidad). El tipo de comprobante también se repite.
  if (esNueva && !facturaActual.cuenta_bancaria_id) {
    const cuenta = ultimaFactura?.cuenta_bancaria_id || prospecto.cuenta_bancaria_id
    if (cuenta) updates.cuenta_bancaria_id = cuenta
  }
  if (esNueva && ultimaFactura?.solo_invoice != null) {
    updates.solo_invoice = ultimaFactura.solo_invoice
  }
  if (esNueva && !facturaActual.leyenda && ultimaFactura?.leyenda) {
    updates.leyenda = ultimaFactura.leyenda
  }

  // Config de leyenda generada y redondeo: se repiten mes a mes, así que
  // la próxima factura del prospecto los hereda de la última.
  // Redondeo: por defecto 1000 en toda factura nueva. Si la última factura
  // del prospecto ya usó un múltiplo propio (> 0), ese le gana (continuidad).
  if (esNueva && (facturaActual.redondeo_multiplo == null || facturaActual.redondeo_multiplo === '')) {
    const prev = Number(ultimaFactura?.redondeo_multiplo)
    updates.redondeo_multiplo = prev > 0 ? prev : REDONDEO_MULTIPLO_DEFAULT
  }
  if (esNueva && facturaActual.incluir_horas_leyenda == null && ultimaFactura?.incluir_horas_leyenda != null) {
    updates.incluir_horas_leyenda = ultimaFactura.incluir_horas_leyenda
  }
  // Horas facturadas: por defecto, las horas mensuales contratadas del
  // prospecto (hs_mensuales). Si la última factura ya traía un valor propio,
  // ese le gana (continuidad mes a mes).
  if (esNueva && (facturaActual.hs_facturadas == null || facturaActual.hs_facturadas === '')) {
    const horas = ultimaFactura?.hs_facturadas ?? prospecto.hs_mensuales
    if (horas != null && horas !== '' && Number(horas) > 0) {
      updates.hs_facturadas = horas
    }
  }

  // Próximo período a facturar y tarifa. Prioriza continuar desde el
  // último período ya facturado (ej. día 10 a día 10 de cada mes); si
  // todavía no tiene facturas, arranca desde 'inicio_servicio'.
  if (esNueva && (!facturaActual.periodo_desde || !facturaActual.periodo_hasta)) {
    const inicioStr = (ultimaFactura?.periodo_hasta || prospecto.inicio_servicio || '').split('T')[0]

    if (inicioStr) {
      if (!facturaActual.periodo_desde) updates.periodo_desde = inicioStr
      if (!facturaActual.periodo_hasta) updates.periodo_hasta = sumarMeses(inicioStr, 1)
    }

    const tarifaPrevia = ultimaFactura?.tarifa_base_uva || prospecto.base_indice_valor
    if (tarifaPrevia) updates.tarifa_base_uva = tarifaPrevia
    if (ultimaFactura?.porcentaje_descuento != null) {
      updates.porcentaje_descuento = ultimaFactura.porcentaje_descuento
    }
  }

  return updates
}

/**
 * Días hábiles que se esperan, desde la emisión de una factura, antes de
 * agendar el primer recordatorio de cobro. El dato vive en la empresa
 * (apsol_empresas.dias_espera_facturacion). Si la empresa no lo tiene
 * cargado, es 0 o vino inválido, se usa el estándar de la casa: 4.
 * Función pura para poder testear la decisión sin tocar Supabase.
 */
export function resolverDiasEspera(empresa, fallback = DIAS_ESPERA_FACTURACION_DEFAULT) {
  const dias = Number(empresa?.dias_espera_facturacion)
  return Number.isFinite(dias) && dias > 0 ? dias : fallback
}

/**
 * Limpia el objeto de factura que arma la pantalla de detalle antes de
 * mandarlo a `saveFactura`:
 *  - saca los campos que vienen de joins (no son columnas físicas)
 *  - saca el bookkeeping del flujo de recordatorios de cobro
 *    (proxima_notificacion / ultima_notificacion / recordatorios_enviados):
 *    lo setea la app al crear la factura y n8n en cada aviso, la edición
 *    manual NO debe pisarlo con el valor que tenía cargado la pantalla
 *  - convierte a null los ids/fechas opcionales vacíos
 *  - recalcula el estado a partir de los pagos reales (salvo 'Anulada')
 * Función pura: se testea sin montar el componente ni mockear Supabase.
 */
export function prepararFacturaParaGuardar(factura, pagos = []) {
  const {
    prospectos, contactos, contacto2, pagos: _pagos,
    proxima_notificacion, ultima_notificacion, recordatorios_enviados,
    ...dataToSave
  } = factura

  for (const campo of [
    'prospecto_id', 'contacto_id', 'contacto_cobro2_id', 'fecha_vencimiento',
    'periodo_desde', 'periodo_hasta', 'razon_social_id', 'cuenta_bancaria_id'
  ]) {
    if (!dataToSave[campo]) dataToSave[campo] = null
  }

  // Campos nuevos: los <input> devuelven string; la columna es numeric/boolean.
  if ('hs_facturadas' in dataToSave) {
    dataToSave.hs_facturadas =
      dataToSave.hs_facturadas === '' || dataToSave.hs_facturadas == null
        ? null
        : Number(dataToSave.hs_facturadas)
  }
  if ('redondeo_multiplo' in dataToSave) {
    dataToSave.redondeo_multiplo = Number(dataToSave.redondeo_multiplo) || 0
  }
  if ('incluir_horas_leyenda' in dataToSave) {
    dataToSave.incluir_horas_leyenda = !!dataToSave.incluir_horas_leyenda
  }

  if (dataToSave.estado !== 'Anulada') {
    if (Number(dataToSave.saldo_pendiente) <= 0 && pagos.length > 0) {
      dataToSave.estado = 'Cobrada total'
    } else if (pagos.length > 0) {
      dataToSave.estado = 'Cobrada parcial'
    }
  }

  return dataToSave
}

export async function getFacturas() {
  const { data: facturas, error } = await supabase
    .from('apsol_facturacion')
    .select(`
      *,
      prospectos:apsol_prospectos(nombre, empresas:apsol_empresas(nombre)),
      contactos:apsol_contactos!facturacion_contacto_cobro_id_fkey(nombre, apellido, email),
      contacto2:apsol_contactos!facturacion_contacto_cobro2_id_fkey(nombre, apellido, email),
      pagos:apsol_pagos(facturacion_id, fecha, monto)
    `)
    .order('fecha_emision', { ascending: false })

  if (error) throw error

  return (facturas || []).map(f => ({
    ...f,
    ...calcularMontosFactura(f, f.pagos),
    contacto_id: f.contacto_cobro_id
  }))
}

export async function getFacturaById(id) {
  // Consultar factura con sus relaciones básicas
  const { data: factura, error: facturaError } = await supabase
    .from('apsol_facturacion')
    .select(`
      *,
      prospectos:apsol_prospectos(id, nombre, empresa_id, uva_referencia_periodo, empresas:apsol_empresas(nombre, dias_espera_facturacion)),
      contactos:apsol_contactos!facturacion_contacto_cobro_id_fkey(id, nombre, apellido, email, telefono),
      contacto2:apsol_contactos!facturacion_contacto_cobro2_id_fkey(id, nombre, apellido, email, telefono),
      cuenta_bancaria:apsol_cuentas_bancarias(id, nombre_interno, banco, titular, cbu, alias)
    `)
    .eq('id', id)
    .single()

  if (facturaError) throw facturaError

  // Consultar pagos por separado para evitar problemas de joins en vistas
  const { data: pagos, error: pagosError } = await supabase
    .from('apsol_pagos')
    .select('*')
    .eq('facturacion_id', id)
    .order('fecha', { ascending: false })

  if (pagosError) throw pagosError

  return {
    ...factura,
    ...calcularMontosFactura(factura, pagos),
    contacto_id: factura.contacto_cobro_id,
    pagos: pagos || []
  }
}

export async function saveFactura(factura) {
  // Limpiar campos que vienen de joins para evitar error 400
  const { prospectos, contactos, contacto2, pagos, cuenta_bancaria, ...dataToSave } = factura

  // Mapear contacto_id a la columna de la DB contacto_cobro_id
  if ('contacto_id' in dataToSave) {
    dataToSave.contacto_cobro_id = dataToSave.contacto_id
    delete dataToSave.contacto_id
  }

  // Mapear el monto_neto calculado al campo 'monto' de la base de datos
  dataToSave.monto = dataToSave.monto_neto

  // Eliminar propiedades calculadas del frontend que no existen en la DB física
  delete dataToSave.monto_bruto
  delete dataToSave.monto_neto
  delete dataToSave.descuento
  delete dataToSave.saldo_pendiente

  // valor_uva_referencia es solo un valor de previsualización en el cliente
  // (mientras se busca el UVA por fecha), no tiene columna física en la DB.
  delete dataToSave.valor_uva_referencia

  if (dataToSave.id) {
    const { data, error } = await supabase
      .from('apsol_facturacion')
      .update(dataToSave)
      .eq('id', dataToSave.id)
      .select()
      .single()
    if (error) throw error
    
    return {
      ...data,
      contacto_id: data.contacto_cobro_id
    }
  } else {
    const { data, error } = await supabase
      .from('apsol_facturacion')
      .insert([dataToSave])
      .select()
      .single()
    if (error) throw error

    const facturaCompleta = await getFacturaById(data.id)
    // Un fallo del webhook (n8n caído, red, etc.) nunca debe tirar abajo el
    // guardado de la factura, que ya está hecho — pero antes se tragaba el
    // error en silencio (solo console.error) y la pantalla no tenía forma
    // de avisarle al usuario que nadie recibió el aviso. Se informa acá con
    // `notificacionEnviada` para que la UI pueda mostrar un aviso.
    let notificacionEnviada = true
    try {
      await notificarFacturacion('primera_vez', facturaCompleta)
    } catch (notifError) {
      console.error('Error al notificar primera_vez al webhook de facturación:', notifError)
      notificacionEnviada = false
    }

    // Post-alta, en una sola escritura:
    //  - ultima_notificacion: el aviso "primera_vez" que se acaba de mandar
    //    ES una notificación al cliente -> se registra su fecha (antes quedaba
    //    en blanco aunque el aviso hubiera salido).
    //  - proxima_notificacion: primer recordatorio de cobro = fecha de emisión
    //    + los días hábiles de espera de la empresa (sumarDiasHabiles salta
    //    sáb/dom). Las siguientes las recalcula n8n tras cada envío.
    // Un fallo acá nunca debe tirar abajo el alta, que ya está hecha.
    const fechaEmision = (facturaCompleta?.fecha_emision || '').split('T')[0]
    const fechaProxima = sumarDiasHabiles(
      fechaEmision,
      resolverDiasEspera(facturaCompleta?.prospectos?.empresas)
    )
    const updatePostAlta = {}
    if (notificacionEnviada) updatePostAlta.ultima_notificacion = fechaEmision || fechaLocalISO()
    if (fechaProxima) updatePostAlta.proxima_notificacion = fechaProxima
    if (Object.keys(updatePostAlta).length > 0) {
      try {
        await supabase
          .from('apsol_facturacion')
          .update(updatePostAlta)
          .eq('id', data.id)
      } catch (notifError) {
        console.error('No se pudo agendar próxima/última notificación de cobro:', notifError)
      }
    }

    return {
      ...data,
      ...updatePostAlta, // refleja ultima_notificacion / proxima_notificacion recién seteadas
      contacto_id: data.contacto_cobro_id,
      notificacionEnviada
    }
  }
}

export async function deleteFactura(id) {
  // Primero borrar pagos asociados para evitar error de clave foránea
  const { error: pagosError } = await supabase
    .from('apsol_pagos')
    .delete()
    .eq('facturacion_id', id)
  
  if (pagosError) throw pagosError

  const { error } = await supabase
    .from('apsol_facturacion')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Recalcula el estado de una factura a partir de sus pagos reales y, si
 * corresponde, lo persiste. Si la factura ACABA de quedar "Cobrada total"
 * (no lo estaba antes de este recálculo), avanza en 1 mes la "Próxima
 * Factura" del prospecto asociado, para que el ciclo de facturación
 * continúe solo.
 */
async function recalcularEstadoFactura(facturacionId, estadoPrevio = null) {
  const factura = await getFacturaById(facturacionId)
  if (!factura || factura.estado === 'Anulada') return

  // El estado ANTES de esta operación. Hay un trigger en la DB
  // (apsol_private.pagos -> fn_recalc_estado_factura) que ya recalcula el
  // estado, así que `factura.estado` puede venir YA actualizado. Para decidir
  // si esta operación es la que dejó la factura saldada (y avisar una sola
  // vez) usamos el estado previo real si nos lo pasaron.
  const estadoAnterior = estadoPrevio ?? factura.estado
  let nuevoEstado
  if (factura.pagos.length === 0) {
    nuevoEstado = 'Pendiente'
  } else if (factura.saldo_pendiente > 0) {
    nuevoEstado = 'Cobrada parcial'
  } else {
    nuevoEstado = 'Cobrada total'
  }

  // Fallback: si el trigger no está (build viejo / entorno sin migrar) o no
  // corrió, persistimos el estado desde acá igual que antes.
  if (nuevoEstado !== factura.estado) {
    const { error } = await supabase
      .from('apsol_facturacion')
      .update({ estado: nuevoEstado })
      .eq('id', facturacionId)
    if (error) throw error
  }

  const recienCobradaTotal = nuevoEstado === 'Cobrada total' && estadoAnterior !== 'Cobrada total'
  if (recienCobradaTotal) {
    if (factura.prospecto_id) {
      await avanzarProximaFacturaProspecto(factura.prospecto_id)
    }
    try {
      await notificarFacturacion('pago_recibido', factura)
    } catch (notifError) {
      console.error('Error al notificar pago_recibido al webhook de facturación:', notifError)
    }
  }
}

async function avanzarProximaFacturaProspecto(prospectoId) {
  const { data: prospecto, error } = await supabase
    .from('apsol_prospectos')
    .select('proxima_factura')
    .eq('id', prospectoId)
    .maybeSingle()
  if (error || !prospecto?.proxima_factura) return

  const nuevaFecha = sumarMeses(prospecto.proxima_factura, 1)
  if (!nuevaFecha) return

  await supabase
    .from('apsol_prospectos')
    .update({ proxima_factura: nuevaFecha })
    .eq('id', prospectoId)
}

// Servicios para Pagos
export async function savePago(pago) {
  // Limpiar campos de joins
  const { cuentas_bancarias, ...dataToSave } = pago

  // Estado de la factura ANTES de tocar los pagos. Sirve para saber si esta
  // operación es la que la deja saldada y disparar el webhook 'pago_recibido'
  // una sola vez (el estado en sí lo recalcula el trigger de la DB).
  let estadoPrevio = null
  if (dataToSave.facturacion_id) {
    try {
      const { data } = await supabase
        .from('apsol_facturacion')
        .select('estado')
        .eq('id', dataToSave.facturacion_id)
        .maybeSingle()
      estadoPrevio = data?.estado ?? null
    } catch (e) {
      console.error('No se pudo leer el estado previo de la factura:', e)
    }
  }

  let saved
  if (dataToSave.id) {
    const { data, error } = await supabase
      .from('apsol_pagos')
      .update(dataToSave)
      .eq('id', dataToSave.id)
      .select()
      .single()
    if (error) throw error
    saved = data
  } else {
    const { data, error } = await supabase
      .from('apsol_pagos')
      .insert([dataToSave])
      .select()
      .single()
    if (error) throw error
    saved = data
  }

  await recalcularEstadoFactura(dataToSave.facturacion_id, estadoPrevio)
  return saved
}

export async function deletePago(id, facturacionId) {
  const { error } = await supabase
    .from('apsol_pagos')
    .delete()
    .eq('id', id)
  if (error) throw error

  if (facturacionId) {
    await recalcularEstadoFactura(facturacionId)
  }
}

export async function getNextInvoiceNumber() {
  const { data, error } = await supabase
    .from('apsol_facturacion')
    .select('numero_factura')
    .filter('solo_invoice', 'eq', true)

  if (error) throw error
  
  if (!data || data.length === 0) return 300

  const numeros = data
    .map(f => parseInt(f.numero_factura))
    .filter(n => !isNaN(n))
  
  const max = numeros.length > 0 ? Math.max(...numeros) : 299
  return max + 1
}

/**
 * Devuelve la última factura ya cargada para un prospecto (por
 * 'periodo_hasta' más reciente), con los datos que típicamente se repiten
 * de un período a otro: período, tarifa, cuenta para depósito, tipo de
 * comprobante, contactos de cobro, razón social y leyenda. Se usa al crear
 * una factura nueva para no tener que volver a tipear todo eso cada vez —
 * el usuario elige el prospecto primero y el resto se pre-completa solo,
 * quedando libre para corregir cualquier campo antes de guardar.
 */
export async function getUltimaFacturaProspecto(prospectoId) {
  const { data, error } = await supabase
    .from('apsol_facturacion')
    .select(`
      periodo_desde, periodo_hasta, tarifa_base_uva, porcentaje_descuento,
      cuenta_bancaria_id, solo_invoice, contacto_cobro_id, contacto_cobro2_id,
      razon_social_id, leyenda, redondeo_multiplo, incluir_horas_leyenda, hs_facturadas
    `)
    .eq('prospecto_id', prospectoId)
    .not('periodo_hasta', 'is', null)
    .order('periodo_hasta', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

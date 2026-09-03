import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Receipt, DollarSign, Calendar, UploadCloud, Plus, Search, Copy, Check, FileText, Upload, Briefcase, Building2, Download } from 'lucide-react'
import { getFacturaById, saveFactura, deleteFactura, savePago, deletePago, getNextInvoiceNumber, calcularMontosFactura, calcularPrefillFactura, getUltimaFacturaProspecto, prepararFacturaParaGuardar, componerLeyendaFactura, fechaReferenciaUva, validarFacturaParaGuardar, decidirActualizacionTarifa, calcularCicloTarifaTrasActualizar, actualizarCicloTarifaProspecto } from '../services/facturacion'
import BotonCopiar from '../components/BotonCopiar'
import { useData } from '../context/DataContext'
import { getContactos } from '../services/contactos'
import { getProspectos } from '../services/prospectos'
import { getValoresUVA } from '../services/valoresUva'
import { obtenerUVAParaFecha } from '../services/sincronizacionUva'
import { getCuentasBancarias } from '../services/cuentasBancarias'
import { getRazonesSocialesByEmpresa, saveRazonSocial } from '../services/empresas'
import { subirAdjuntoFactura } from '../services/storage'
import { formatearMonto } from '../utils/formateo'
import { fechaLocalISO, esFechaCompleta, sumarDias } from '../utils/fecha'
import { esArchivoPDF } from '../utils/archivos'
import { guardarBorrador, leerBorrador, limpiarBorrador } from '../utils/borradorFactura'
import { reintentar, conTimeout } from '../utils/reintentar'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function FacturaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNueva = id === 'nueva'
  const { refreshFacturas } = useData()

  const [factura, setFactura] = useState({
    numero_factura: '',
    prospecto_id: '',
    contacto_id: '',
    contacto_cobro2_id: '',
    fecha_emision: fechaLocalISO(),
    fecha_vencimiento: '',
    periodo_desde: '',
    periodo_hasta: '',
    tarifa_base_uva: 0,
    valor_uva_dia: 0,
    monto_bruto: 0,
    descuento: 0,
    porcentaje_descuento: 0,
    monto_neto: 0,
    saldo_pendiente: 0,
    estado: 'Pendiente',
    comprobantes_adjuntos: [],
    documento_general: '',
    notas: '',
    leyenda: '',
    hs_facturadas: '',
    incluir_horas_leyenda: false,
    redondeo_multiplo: '', // el prefill lo pone en 1000 (REDONDEO_MULTIPLO_DEFAULT) al elegir prospecto
    cuenta_bancaria_id: '',
    razon_social_id: '',
    solo_invoice: true
  })
  
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null)
  // Última factura ya cargada del prospecto elegido (solo al crear una
  // nueva). Sirve para el precompletado y para "congelar" el valor UVA entre
  // dos actualizaciones de tarifa pactadas. Ver decidirActualizacionTarifa().
  const [ultimaFacturaProspecto, setUltimaFacturaProspecto] = useState(null)

  const [pagos, setPagos] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [contactos, setContactos] = useState([])
  const [valoresUVA, setValoresUVA] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [razonesSociales, setRazonesSociales] = useState([])
  const [mostrarNuevaRazon, setMostrarNuevaRazon] = useState(false)
  const [nuevaRazon, setNuevaRazon] = useState({ razon_social: '', cuit: '' })
  const [savingRazon, setSavingRazon] = useState(false)

  const [loading, setLoading] = useState(!esNueva)
  const [saving, setSaving] = useState(false)
  // Estado propio para la subida de adjuntos: NO reusar `saving`, si no el
  // botón "Guardar" queda pegado en "Guardando..." mientras sube (y para
  // siempre si la subida se cuelga).
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  // Carga de datos base del formulario (prospectos, contactos, UVA, cuentas).
  // Antes: un Promise.all que si fallaba una request dejaba la lista de
  // prospectos vacía sin aviso ni reintento -> había que recargar la página.
  const [cargandoDatosPrevios, setCargandoDatosPrevios] = useState(true)
  const [errorDatosPrevios, setErrorDatosPrevios] = useState(false)
  // true = el monto se escribe a mano en vez de calcularse con tarifa UVA x valor UVA
  // (para redondeos, precios especiales, etc.)
  const [modoManualMonto, setModoManualMonto] = useState(false)
  const [loadingRazones, setLoadingRazones] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [advertencia, setAdvertencia] = useState('')

  // Búsqueda de prospectos
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [copiando, setCopiando] = useState(null) // ID de la razón social copiada

  // Estado para modal de nuevo pago
  const [mostrandoFormPago, setMostrandoFormPago] = useState(false)
  const [nuevoPago, setNuevoPago] = useState({ fecha: fechaLocalISO(), monto: 0, cuenta_bancaria_id: '', comprobante: '', observaciones: '' })
  const [mostrarContacto2, setMostrarContacto2] = useState(false)

  // Borrador local (localStorage) para "Nueva Factura": lo que hay guardado
  // sin decidir si continuarlo o descartarlo. Ver src/utils/borradorFactura.js
  const [borrador, setBorrador] = useState(null)
  const [borradorGuardadoOk, setBorradorGuardadoOk] = useState(null) // null | true | false
  // Última versión de `factura`, para poder guardarla desde el intervalo y al
  // desmontar (salir de la pantalla) sin depender de la identidad del objeto.
  const facturaRef = useRef(factura)
  facturaRef.current = factura

  useEffect(() => {
    const control = { vivo: true }
    cargarDatosPrevios(control)
    if (!esNueva) cargarFactura()
    // Si el usuario sale de la pantalla mientras una request sigue colgada
    // (cliente de Supabase trabado en un refresh de token), al desmontar
    // marcamos el control como muerto: la carga que quede en curso ya no
    // toca el estado y no pisa una carga posterior más nueva.
    return () => { control.vivo = false }
  }, [id])

  // ── Borrador local de "Nueva Factura" ────────────────────────────────────
  // Al entrar, si hay un borrador guardado se ofrece continuarlo (no se carga
  // solo). Se autoguarda con debounce mientras se edita (una vez elegido el
  // prospecto), y también al salir de la pantalla. Se borra al guardar la
  // factura de verdad o al descartarlo.
  useEffect(() => {
    if (!esNueva) return
    const b = leerBorrador()
    if (b && b.prospecto_id) setBorrador(b)
  }, [esNueva])

  // Autoguardado: cada 2s, y al salir de la pantalla. Se usa un intervalo con
  // ref (no un debounce sobre `factura`) porque `factura` cambia de identidad
  // en cascada tras elegir un prospecto y un debounce nunca llegaba a disparar.
  useEffect(() => {
    if (!esNueva) return
    function persistir() {
      if (!facturaRef.current?.prospecto_id) return
      setBorradorGuardadoOk(guardarBorrador(facturaRef.current))
    }
    const iv = setInterval(persistir, 2000)
    return () => { clearInterval(iv); persistir() }
  }, [esNueva])

  function continuarBorrador() {
    if (borrador) setFactura(prev => ({ ...prev, ...borrador }))
    setBorrador(null)
  }
  function descartarBorrador() {
    limpiarBorrador()
    setBorrador(null)
  }

  // Recalcular montos al cambiar tarifa, valor UVA, descuento o pagos.
  // Usa la misma fórmula que el backend (con fallback al 'monto' persistido
  // para facturas históricas sin tarifa en UVA), así no se pisa con $0 el
  // monto real de una factura recién cargada.
  useEffect(() => {
    const montos = calcularMontosFactura(factura, pagos)
    const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0)

    // Cálculo automático de estado según pagos y saldo
    let nuevoEstado = factura.estado
    if (nuevoEstado !== 'Anulada') {
      if (totalPagado <= 0) {
        nuevoEstado = 'Pendiente'
      } else if (montos.saldo_pendiente > 0) {
        nuevoEstado = 'Cobrada parcial'
      } else {
        nuevoEstado = 'Cobrada total'
      }
    }

    setFactura(prev => ({
      ...prev,
      ...montos,
      estado: nuevoEstado
    }))
  }, [factura.tarifa_base_uva, factura.valor_uva_dia, factura.porcentaje_descuento, factura.monto, factura.redondeo_multiplo, pagos])

  // Filtrar contactos de la empresa del prospecto seleccionado
  const contactosFiltrados = factura.prospecto_id 
    ? contactos.filter(c => c.empresa_id === prospectos.find(p => p.id === factura.prospecto_id)?.empresa_id)
    : []

  // Auto-seleccionar y precompletar datos al elegir prospecto. Al crear una
  // factura nueva, todo lo que normalmente NO cambia de un período a otro
  // (cuenta para depósito, Invoice vs Factura, contacto de cobro, razón
  // social, leyenda, período y tarifa) se trae de la última factura de ese
  // mismo prospecto, para no tener que volver a tipearlo cada vez — el
  // usuario elige el prospecto primero y después corrige lo que cambió.
  useEffect(() => {
    async function updateProspectoData() {
      if (factura.prospecto_id && prospectos.length > 0) {
        const prosp = prospectos.find(p => p.id === factura.prospecto_id)
        setProspectoSeleccionado(prosp)

        if (prosp) {
          // Cargar Razones Sociales
          let rs = []
          try {
            setLoadingRazones(true)
            rs = await getRazonesSocialesByEmpresa(prosp.empresa_id)
            setRazonesSociales(rs)
          } catch (err) {
            console.error('Error al cargar razones sociales:', err)
          } finally {
            setLoadingRazones(false)
          }

          // Contactos de la empresa, como fallback si el prospecto no tiene facturas previas
          const contactosEmpresa = contactos.filter(c => c.empresa_id === prosp.empresa_id)

          let ultimaFactura = null
          if (esNueva) {
            try {
              ultimaFactura = await getUltimaFacturaProspecto(prosp.id)
            } catch (err) {
              console.error('Error al buscar la última factura del prospecto:', err)
            }
            setUltimaFacturaProspecto(ultimaFactura)
          }

          const updates = calcularPrefillFactura({
            prospecto: prosp,
            ultimaFactura,
            contactosEmpresa,
            razonesSociales: rs,
            esNueva,
            facturaActual: factura
          })

          if (updates.contacto_cobro2_id) setMostrarContacto2(true)

          // Ciclo de ajuste de tarifa (índice UVA): si NO toca actualizar,
          // esta factura repite EL ÚLTIMO MONTO facturado (monto fijo, igual
          // que las facturas históricas) en vez de recalcular con tarifa UVA.
          // Si toca actualizar, queda en modo tarifa UVA para re-preciar.
          if (esNueva) {
            const decision = decidirActualizacionTarifa({
              prospecto: prosp,
              ultimaFactura,
              periodo_hasta: updates.periodo_hasta || factura.periodo_hasta
            })
            if (!decision.actualiza) {
              setModoManualMonto(true)
              updates.monto = decision.montoCongelado
              updates.tarifa_base_uva = 0
              updates.valor_uva_dia = 0
              updates.redondeo_multiplo = 0 // facturar exactamente el último monto
            } else {
              setModoManualMonto(false)
            }
          }

          if (Object.keys(updates).length > 0) {
            setFactura(prev => ({ ...prev, ...updates }))
          }
        }
      } else {
        setProspectoSeleccionado(null)
        setRazonesSociales([])
        setUltimaFacturaProspecto(null)
      }
    }
    updateProspectoData()
  }, [factura.prospecto_id, prospectos, contactos])

  // Calcular vencimiento automatico (15 dias despues de emision)
  useEffect(() => {
    if (esNueva && factura.fecha_emision) {
      setFactura(prev => ({ ...prev, fecha_vencimiento: sumarDias(factura.fecha_emision, 15) }))
    }
  }, [factura.fecha_emision, esNueva])

  // Qué fecha del período se usa para buscar el valor UVA: por defecto la de
  // inicio (periodo_desde); el prospecto puede pedir la de fin (periodo_hasta)
  // vía uva_referencia_periodo. Ver fechaReferenciaUva().
  const uvaReferenciaPeriodo =
    prospectoSeleccionado?.uva_referencia_periodo ||
    factura.prospectos?.uva_referencia_periodo ||
    'inicio'
  const fechaParaUVA = fechaReferenciaUva({
    uva_referencia_periodo: uvaReferenciaPeriodo,
    periodo_desde: factura.periodo_desde,
    periodo_hasta: factura.periodo_hasta
  })

  // Ciclo de ajuste de tarifa (índice UVA): decide si esta factura nueva
  // RE-PRECIA con el valor UVA del día ("actualiza") o repite el ÚLTIMO MONTO
  // facturado ("congela"), según la "Próx. Act. Tarifa" pactada del prospecto.
  // Ver decidirActualizacionTarifa() en services/facturacion.
  const decisionTarifa = decidirActualizacionTarifa({
    prospecto: prospectoSeleccionado,
    ultimaFactura: ultimaFacturaProspecto,
    periodo_hasta: factura.periodo_hasta
  })
  const congelarMonto = esNueva && !decisionTarifa.actualiza && decisionTarifa.montoCongelado > 0
  // A qué quedaría la "Próx. Act. Tarifa" del prospecto si esta factura
  // re-precia la tarifa (para mostrarlo en el aviso de la sección de montos).
  const cicloTrasActualizar = calcularCicloTarifaTrasActualizar({
    periodo_desde: factura.periodo_desde,
    frecuencia_actualizacion: prospectoSeleccionado?.frecuencia_actualizacion
  })
  const fmtFechaCorta = (f) => {
    const s = String(f || '').split('T')[0]
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : '—'
  }
  const uvaRefTexto = uvaReferenciaPeriodo === 'fin' ? 'fin' : 'inicio'

  // Campos obligatorios que faltan para poder guardar (solo al crear). Los
  // botones "Guardar Factura" solo se muestran cuando esto está vacío.
  const faltantesObligatorios = esNueva ? validarFacturaParaGuardar(factura) : []
  const puedeGuardar = faltantesObligatorios.length === 0

  // Bloque NO editable que se copia con un botón: leyenda + (horas, si está
  // el tilde) + período con fechas completas. Ver componerLeyendaFactura().
  const leyendaGenerada = componerLeyendaFactura({
    leyenda: factura.leyenda,
    hs_facturadas: factura.hs_facturadas,
    incluir_horas_leyenda: factura.incluir_horas_leyenda,
    periodo_desde: factura.periodo_desde,
    periodo_hasta: factura.periodo_hasta
  })

  // Efecto para buscar valor UVA por la fecha de referencia (con fallback a API
  // externa). Solo dispara con una fecha COMPLETA y válida: algunos navegadores
  // emiten valores parciales de <input type="date"> mientras se tipea el año
  // (ej. '0002-08-10'), y eso antes generaba consultas y, peor, guardaba
  // cotizaciones en el histórico bajo fechas truncadas.
  useEffect(() => {
    async function buscarUVA() {
      if (!esFechaCompleta(fechaParaUVA)) return
      // Tarifa congelada: la factura repite el último monto (modo manual), no
      // se re-precia con el UVA del día. No pisar valor_uva_dia en ese caso.
      if (congelarMonto) return
      try {
        const valor = await obtenerUVAParaFecha(fechaParaUVA)
        if (valor) {
          setFactura(prev => ({
            ...prev,
            valor_uva_referencia: valor,
            ...(esNueva ? { valor_uva_dia: valor } : {})
          }))
        }
      } catch (error) {
        console.error('Error al buscar UVA:', error)
      }
    }
    buscarUVA()
  }, [fechaParaUVA, esNueva, congelarMonto])

  // Efecto para auto-numerar Invoice
  useEffect(() => {
    async function autoNumerar() {
      if (esNueva && factura.solo_invoice && !factura.numero_factura) {
        try {
          const proximo = await getNextInvoiceNumber()
          setFactura(prev => ({ ...prev, numero_factura: proximo.toString() }))
        } catch (error) {
          console.error('Error al auto-numerar:', error)
        }
      } else if (esNueva && !factura.solo_invoice && /^\d+$/.test(factura.numero_factura)) {
         // Si pasa de solo invoice a factura y tiene un numero autogenerado, lo limpiamos para que pongan el fiscal
         setFactura(prev => ({ ...prev, numero_factura: '' }))
      }
    }
    autoNumerar()
  }, [factura.solo_invoice, esNueva])

  async function cargarDatosPrevios(control = { vivo: true }) {
    setCargandoDatosPrevios(true)
    setErrorDatosPrevios(false)
    try {
      // - allSettled: que una request que pinche (token refrescándose, red)
      //   no tumbe a las otras tres.
      // - conTimeout: si el cliente de Supabase se cuelga en un refresh de
      //   token (pasa al volver a esta pantalla tras navegar), la tanda no
      //   se queda esperando para siempre y el spinner no queda infinito.
      // - reintentar: un 2º intento suele salir bien porque el request
      //   colgado ya terminó de fallar.
      const resultados = await reintentar(
        () => conTimeout(
          Promise.allSettled([
            getProspectos({ estadoExacto: '6A - En producción' }),
            getContactos(),
            getValoresUVA(),
            getCuentasBancarias()
          ]),
          8000,
          'La carga de prospectos tardó demasiado'
        ).then(res => {
          // Si TODAS fallaron, tratamos la tanda como fallida para reintentar.
          if (res.every(r => r.status === 'rejected')) throw res[0].reason
          return res
        }),
        { intentos: 2, esperaMs: 1000 }
      )

      if (!control.vivo) return
      const [prospectosR, contactosR, uvaR, cuentasR] = resultados

      if (prospectosR.status === 'fulfilled') setProspectos(prospectosR.value)
      if (contactosR.status === 'fulfilled') setContactos(contactosR.value)
      if (cuentasR.status === 'fulfilled') setCuentas(cuentasR.value)
      if (uvaR.status === 'fulfilled') {
        setValoresUVA(uvaR.value)
        if (esNueva && uvaR.value.length > 0) {
          setFactura(prev => ({ ...prev, valor_uva_dia: uvaR.value[0].valor }))
        }
      }

      // Los prospectos son el dato crítico de esta pantalla: si no llegaron,
      // marcamos error para ofrecer "Reintentar" en vez de mostrar un
      // engañoso "no se encontraron prospectos".
      if (prospectosR.status === 'rejected') {
        console.error('No se pudieron cargar los prospectos:', prospectosR.reason)
        setErrorDatosPrevios(true)
      }
    } catch (err) {
      console.error('Falló la carga de datos previos de la factura:', err)
      if (control.vivo) setErrorDatosPrevios(true)
    } finally {
      if (control.vivo) setCargandoDatosPrevios(false)
    }
  }

  async function cargarFactura() {
    setLoading(true)
    try {
      const data = await getFacturaById(id)
      setFactura({
        ...data,
        fecha_emision: data.fecha_emision ? data.fecha_emision.split('T')[0] : '',
        fecha_vencimiento: data.fecha_vencimiento ? data.fecha_vencimiento.split('T')[0] : '',
        periodo_desde: data.periodo_desde ? data.periodo_desde.split('T')[0] : '',
        periodo_hasta: data.periodo_hasta ? data.periodo_hasta.split('T')[0] : '',
        comprobantes_adjuntos: data.comprobantes_adjuntos || [],
        documento_general: data.documento_general || '',
        leyenda: data.leyenda || '',
        hs_facturadas: data.hs_facturadas ?? '',
        incluir_horas_leyenda: data.incluir_horas_leyenda ?? false,
        redondeo_multiplo: data.redondeo_multiplo ?? 0,
        cuenta_bancaria_id: data.cuenta_bancaria_id || '',
        razon_social_id: data.razon_social_id || '',
        porcentaje_descuento: data.porcentaje_descuento || 0,
        solo_invoice: data.solo_invoice ?? true
      })
      setModoManualMonto(!(Number(data.tarifa_base_uva) > 0 && Number(data.valor_uva_dia) > 0))
      if (data.contacto_cobro2_id) setMostrarContacto2(true)
      setPagos(data.pagos || [])
      
      // Cargar razones sociales si hay empresa
      if (data.prospectos?.empresa_id) {
        const rs = await getRazonesSocialesByEmpresa(data.prospectos.empresa_id)
        setRazonesSociales(rs)
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar factura.')
    } finally {
      setLoading(false)
    }
  }

  async function generarPDF(facturaData = factura) {
    try {
      console.log('Generando PDF con datos:', facturaData)
      const doc = new jsPDF()
      const margin = 20
      let y = 20

      // Header
      doc.setFontSize(22)
      doc.setTextColor(40, 40, 40)
      doc.text('INVOICE', margin, y)
      
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Número: ${facturaData.numero_factura || 'S/N'}`, 150, y)
      y += 10
      doc.text(`Fecha Emisión: ${facturaData.fecha_emision || '-'}`, 150, y)
      
      y += 15
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, 190, y)
      
      y += 15
      // Datos APSOL
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.text('EMISOR:', margin, y)
      doc.setFont('helvetica', 'normal')
      doc.text('APSOL - Soluciones Tecnológicas', margin, y + 6)
      doc.text('Buenos Aires, Argentina', margin, y + 12)
      
      // Datos Cliente
      const nombreEmpresa = prospectoSeleccionado?.empresas?.nombre || 'Cliente'
      doc.setFont('helvetica', 'bold')
      doc.text('CLIENTE:', 110, y)
      doc.setFont('helvetica', 'normal')
      doc.text(nombreEmpresa, 110, y + 6)
      
      y += 30
      // Periodo y Concepto
      doc.setFont('helvetica', 'bold')
      doc.text('CONCEPTO Y PERIODO:', margin, y)
      doc.setFont('helvetica', 'normal')
      doc.text(`Servicios profesionales - Periodo: ${facturaData.periodo_desde || '-'} al ${facturaData.periodo_hasta || '-'}`, margin, y + 6)
      if (facturaData.leyenda) {
        doc.text(`Nota: ${facturaData.leyenda}`, margin, y + 12)
      }

      y += 25
      // Tabla de Items
      const items = [
        ['Descripción', 'Cantidad', 'Tarifa (UVA)', 'Valor UVA', 'Subtotal (ARS)'],
        [
          'Abono mensual de servicios', 
          '1', 
          (facturaData.tarifa_base_uva || 0).toString(), 
          (facturaData.valor_uva_dia || 0).toString(), 
          `$${(facturaData.monto_neto || 0).toLocaleString('es-AR')}`
        ]
      ]

      autoTable(doc, {
        startY: y,
        head: [items[0]],
        body: [items[1]],
        theme: 'striped',
        headStyles: { fillColor: [67, 97, 238] }
      })

      y = doc.lastAutoTable?.finalY || (y + 20)

      // Totales
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`TOTAL A PAGAR: $${(facturaData.monto_neto || 0).toLocaleString('es-AR')} ARS`, 110, y)

      y += 20
      // Cuentas Bancarias
      const cuenta = cuentas.find(c => c.id === facturaData.cuenta_bancaria_id)
      if (cuenta) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('DATOS DE PAGO:', margin, y)
        doc.setFont('helvetica', 'normal')
        doc.text(`Banco: ${cuenta.banco || '-'}`, margin, y + 6)
        doc.text(`CBU: ${cuenta.cbu || '-'}`, margin, y + 12)
        doc.text(`Alias: ${cuenta.alias || '-'}`, margin, y + 18)
        doc.text(`Titular: ${cuenta.titular || '-'}`, margin, y + 24)
      } else {
        doc.setFontSize(10)
        doc.setTextColor(200, 0, 0)
        doc.text('No se seleccionó cuenta bancaria de destino.', margin, y)
      }

      // Pie de página
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text('Gracias por su confianza. APSOL.', margin, 280)

      // Retornar objeto con el doc y un nombre sugerido
      const nombreArchivo = `Invoice_${facturaData.numero_factura || 'BORRADOR'}.pdf`
      return { doc, nombreArchivo }
    } catch (error) {
      console.error('Error crítico en generarPDF:', error)
      alert('Error al generar el PDF: ' + error.message)
      throw error
    }
  }

  async function handleSave(e) {
    e.preventDefault()

    // Campos obligatorios al crear una factura (ver validarFacturaParaGuardar)
    if (esNueva) {
      const faltantes = validarFacturaParaGuardar(factura)
      if (faltantes.length > 0) {
        setError(faltantes.join(' '))
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    setSaving(true)
    setError('')
    try {
      const dataToSave = prepararFacturaParaGuardar(factura, pagos)

      const saved = await saveFactura(dataToSave)

      // La factura ya está guardada de verdad: el borrador local no hace falta.
      limpiarBorrador()

      // Si esta factura RE-PRECIA la tarifa (venció el ciclo de UVA o es la
      // primera del prospecto), rotar el ciclo de ajuste del prospecto:
      // Última Act. Tarifa = inicio del período facturado; Próx. Act. Tarifa
      // = + Frecuencia Act. Un fallo acá nunca tira abajo el guardado.
      if (esNueva && decisionTarifa.actualiza && factura.prospecto_id) {
        try {
          await actualizarCicloTarifaProspecto(factura.prospecto_id, {
            periodo_desde: factura.periodo_desde,
            frecuencia_actualizacion: prospectoSeleccionado?.frecuencia_actualizacion,
            indice_cobro: prospectoSeleccionado?.indice_cobro
          })
        } catch (cicloErr) {
          console.error('No se pudo rotar el ciclo de actualización de tarifa del prospecto:', cicloErr)
        }
      }

      // Refrescar la caché del listado de Facturación SÍ o SÍ (forzar): si no,
      // al volver a /facturacion dentro de los 90s del TTL, la lista no se
      // vuelve a pedir y la factura recién guardada no aparece.
      try {
        await refreshFacturas({ silencioso: true, forzar: true })
      } catch (refreshErr) {
        console.error('No se pudo refrescar el listado de facturación:', refreshErr)
      }

      // Generar y descargar PDF si es solo invoice
      if (factura.solo_invoice) {
        try {
          const { doc, nombreArchivo } = await generarPDF(saved)
          doc.save(nombreArchivo)
        } catch (pdfErr) {
          console.error('Error al generar PDF tras guardar:', pdfErr)
        }
      }

      if (esNueva) {
        // BUG real: si el webhook de n8n fallaba (caído, red, etc.) al
        // avisar por WhatsApp/mail, se navegaba igual sin decir nada — la
        // factura quedaba guardada pero nadie se enteraba de avisarle al
        // cliente. Ahora se frena un momento para mostrarlo antes de salir.
        if (saved.notificacionEnviada === false) {
          setAdvertencia('Factura guardada, pero no se pudo avisar por WhatsApp/mail (el webhook no respondió). Avisá al cliente manualmente.')
          setTimeout(() => navigate('/facturacion'), 3000)
        } else {
          navigate('/facturacion')
        }
      } else {
        setSuccess('Cambios guardados con éxito.')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      console.error('Error al guardar:', err)
      setError(`Error al guardar: ${err.message || 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    console.log('Iniciando proceso de eliminación para ID:', id)
    if (!window.confirm('¿Estás seguro de eliminar esta factura?')) return
    
    try {
      await deleteFactura(id)
      console.log('Eliminación exitosa en Supabase')
      try {
        await refreshFacturas({ silencioso: true, forzar: true })
      } catch (refreshErr) {
        console.error('No se pudo refrescar el listado de facturación:', refreshErr)
      }
      navigate('/facturacion')
    } catch (err) {
      console.error('Error detallado al eliminar:', err)
      alert(`Error al eliminar (ID: ${id}): ${err.message || 'Error desconocido'}`)
    }
  }

  async function handleAddPago(e) {
    e.preventDefault()
    if (!nuevoPago.monto || !nuevoPago.fecha) return

    try {
      await savePago({
        ...nuevoPago,
        facturacion_id: id,
        cuenta_bancaria_id: nuevoPago.cuenta_bancaria_id || null
      })
      setNuevoPago({ fecha: fechaLocalISO(), monto: 0, cuenta_bancaria_id: '', comprobante: '', observaciones: '' })
      setMostrandoFormPago(false)

      // savePago ya recalculó y persistió el estado/saldo reales en el
      // servidor (y avanzó la "Próxima Factura" del prospecto si corresponde
      // que la factura haya quedado Cobrada total). Traemos esos valores.
      await sincronizarFacturaYPagos()
    } catch (err) {
      console.error(err)
      alert('Error al agregar pago')
    }
  }

  async function handleDeletePago(pagoId) {
    if (!window.confirm('¿Eliminar este pago? Se recalculará el saldo de la factura.')) return
    try {
      await deletePago(pagoId, id)
      await sincronizarFacturaYPagos()
    } catch (err) {
      console.error(err)
      alert('Error al eliminar pago')
    }
  }

  // Trae de nuevo el estado/saldo/pagos reales desde el servidor tras
  // registrar o borrar un pago, en vez de recalcularlos a mano en el cliente.
  async function sincronizarFacturaYPagos() {
    const actualizada = await getFacturaById(id)
    setFactura(prev => ({
      ...prev,
      monto_bruto: actualizada.monto_bruto,
      descuento: actualizada.descuento,
      monto_neto: actualizada.monto_neto,
      saldo_pendiente: actualizada.saldo_pendiente,
      estado: actualizada.estado
    }))
    setPagos(actualizada.pagos || [])
  }

  async function handleFileUpload(e, type, index = null) {
    const file = e.target.files[0]
    if (!file) return

    // Las facturas fiscales adjuntas solo admiten PDF — antes el `accept`
    // del input dejaba pasar jpg/png (era solo una sugerencia visual del
    // selector de archivos, no una restricción real).
    if (type === 'comprobante' && !esArchivoPDF(file)) {
      setError('Solo se admiten archivos PDF para las facturas fiscales adjuntas.')
      e.target.value = ''
      return
    }

    const input = e.target
    setError('')
    setSubiendoArchivo(true)
    try {
      const url = await subirAdjuntoFactura(file, id)

      if (type === 'comprobante') {
        const nuevosAdjuntos = [...factura.comprobantes_adjuntos]
        nuevosAdjuntos[index] = url
        setFactura({ ...factura, comprobantes_adjuntos: nuevosAdjuntos })
      } else {
        setFactura({ ...factura, documento_general: url })
      }
    } catch (err) {
      console.error(err)
      setError(/tardó demasiado/i.test(err?.message) ? err.message : 'Error al subir el archivo.')
    } finally {
      setSubiendoArchivo(false)
      // Limpiar el input SIEMPRE: si no, tras un error no se puede volver a
      // elegir el mismo archivo (el evento 'change' no vuelve a dispararse).
      if (input) input.value = ''
    }
  }

  function toggleModoManualMonto() {
    setModoManualMonto(prev => {
      const nuevoModo = !prev
      if (nuevoModo) {
        // Al pasar a manual, se anula la tarifa UVA para que calcularMontosFactura
        // use directamente 'monto' en vez de tarifa_base_uva * valor_uva_dia.
        setFactura(f => ({ ...f, tarifa_base_uva: 0, valor_uva_dia: 0 }))
      }
      return nuevoModo
    })
  }

  function handleCopyCuit(cuit, rsId) {
    navigator.clipboard.writeText(cuit)
    setCopiando(rsId)
    setTimeout(() => setCopiando(null), 2000)
  }

  async function agregarRazonSocial(e) {
    e.preventDefault()
    if (!nuevaRazon.razon_social.trim() || !prospectoSeleccionado?.empresa_id) return
    setSavingRazon(true)
    try {
      const guardada = await saveRazonSocial({ ...nuevaRazon, empresa_id: prospectoSeleccionado.empresa_id })
      setRazonesSociales(prev => [...prev, guardada])
      setFactura(prev => ({ ...prev, razon_social_id: guardada.id }))
      setNuevaRazon({ razon_social: '', cuit: '' })
      setMostrarNuevaRazon(false)
    } catch (err) {
      console.error(err)
      alert('Error al guardar la razón social: ' + (err.message || 'Error desconocido'))
    } finally {
      setSavingRazon(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando factura...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/facturacion')} style={{ padding: '8px', borderRadius: '50%' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="page-title">{esNueva ? 'Nueva Factura' : `Factura ${factura.numero_factura || '(Borrador)'}`}</h1>
              <span className={`badge ${
                factura.estado === 'Pagado' ? 'badge-green' : 
                factura.estado === 'Pagado parcial' ? 'badge-orange' : 
                'badge-gray'
              }`} style={{ padding: '4px 12px', fontSize: '12px' }}>
                {factura.estado.toUpperCase()}
              </span>
            </div>
            <p className="page-subtitle">
              {esNueva ? 'Configura los datos del nuevo comprobante' : 'Gestión y seguimiento de cobro'}
              {esNueva && factura.prospecto_id && borradorGuardadoOk === true && (
                <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--color-success, #385723)' }}>· Borrador guardado ✓</span>
              )}
              {esNueva && factura.prospecto_id && borradorGuardadoOk === false && (
                <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--color-danger)' }}>· No se pudo guardar el borrador (el navegador bloquea el almacenamiento local)</span>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {!esNueva && (
            <>
              <button 
                className="btn btn-secondary" 
                onClick={async () => {
                  try {
                    const { doc, nombreArchivo } = await generarPDF()
                    const blob = doc.output('blob')
                    const url = URL.createObjectURL(blob)
                    
                    // Método 1: Abrir en pestaña nueva
                    const win = window.open(url, '_blank')
                    if (!win) {
                      alert('El navegador bloqueó la pestaña nueva. Por favor, permite ventanas emergentes.')
                    }

                    // Método 2: Descarga forzada con enlace
                    const link = document.createElement('a')
                    link.href = url
                    link.download = nombreArchivo
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    
                  } catch (e) {
                    alert('Error al procesar PDF: ' + e.message)
                  }
                }} 
                title="Ver y Descargar PDF"
              >
                <Download size={18} />
                Ver/Descargar PDF
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  alert('Has presionado Eliminar')
                  handleDelete()
                }} 
                style={{ color: 'var(--color-danger)' }}
              >
                <Trash2 size={18} />
                Eliminar
              </button>
            </>
          )}
          {(!esNueva || puedeGuardar) && (
            <button type="submit" form="facturaForm" className="btn btn-primary" disabled={saving || subiendoArchivo}>
              <Save size={18} />
              {saving ? 'Guardando...' : subiendoArchivo ? 'Subiendo archivo…' : 'Guardar Factura'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {esNueva && borrador && !factura.prospecto_id && (
        <div className="alert alert-warning" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span>
            Tenés un borrador sin terminar
            {(() => {
              const p = prospectos.find(x => x.id === borrador.prospecto_id)
              const emp = p?.empresas?.nombre || p?.nombre
              const per = borrador.periodo_desde
                ? ` (período ${borrador.periodo_desde}${borrador.periodo_hasta ? ` → ${borrador.periodo_hasta}` : ''})`
                : ''
              return emp ? ` — ${emp}${per}` : per
            })()}.
          </span>
          <span style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px', height: 'auto' }} onClick={continuarBorrador}>
              Continuar borrador
            </button>
            <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '12px', height: 'auto' }} onClick={descartarBorrador}>
              Descartar
            </button>
          </span>
        </div>
      )}

      {esNueva && !puedeGuardar && prospectoSeleccionado && (
        <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
          Para guardar la factura, completá: {faltantesObligatorios.map(f => f.replace(/^Falta (el |la )?/i, '').replace(/\.$/, '')).join(' · ')}.
        </div>
      )}
      {advertencia && <div className="alert alert-warning" style={{ marginBottom: '20px' }}>{advertencia}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '20px' }}>{success}</div>}

      <form id="facturaForm" onSubmit={handleSave} style={{ display: 'grid', gap: '24px' }}>
        
        {/* SECCIÓN 1: PROSPECTO CON BÚSQUEDA (primero, porque de acá se precompleta el resto) */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={20} className="text-primary" />
            1. Oportunidad / Prospecto
          </h3>
          <div className="field" style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input 
                type="text" 
                placeholder="Buscar prospecto por nombre o empresa..."
                value={prospectoSeleccionado ? `${prospectoSeleccionado.nombre} (${prospectoSeleccionado.empresas?.nombre || 'Sin Empresa'})` : searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  if (prospectoSeleccionado) {
                    setProspectoSeleccionado(null)
                    setFactura({...factura, prospecto_id: '', razon_social_id: ''})
                  }
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                style={{ paddingLeft: '40px' }}
              />
              {prospectoSeleccionado && (
                <button 
                  type="button"
                  onClick={() => {
                    setProspectoSeleccionado(null)
                    setFactura({...factura, prospecto_id: '', razon_social_id: ''})
                    setSearchTerm('')
                  }}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                >
                  Cambiar
                </button>
              )}
            </div>

            {showDropdown && !prospectoSeleccionado && (
              <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px', padding: '8px', maxHeight: '300px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                {prospectos
                  .filter(p => 
                    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    p.empresas?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(p => (
                    <div 
                      key={p.id} 
                      className="hover-row" 
                      style={{ padding: '12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                      onClick={() => {
                        setFactura({...factura, prospecto_id: p.id})
                        setProspectoSeleccionado(p)
                        setShowDropdown(false)
                        setSearchTerm('')
                      }}
                    >
                      <Briefcase size={16} className="text-primary" />
                      <div>
                        <div style={{ fontWeight: '600' }}>{p.nombre}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{p.empresas?.nombre || 'Sin Empresa'}</div>
                      </div>
                    </div>
                  ))
                }
                {cargandoDatosPrevios ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando prospectos…</div>
                ) : errorDatosPrevios ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ marginBottom: '8px' }}>No se pudieron cargar los prospectos.</div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '13px' }}
                      onClick={() => cargarDatosPrevios()}
                    >
                      Reintentar
                    </button>
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>Si sigue sin aparecer, recargá la página.</div>
                  </div>
                ) : prospectos.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.empresas?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No se encontraron prospectos en producción</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 2: TIPO DE COMPROBANTE */}
        {prospectoSeleccionado && (
          <div className="card" style={{ border: '2px solid var(--color-primary)', background: 'var(--color-surface2)' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} className="text-primary" />
              2. Selección de Comprobante
            </h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className={`btn ${factura.solo_invoice ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '16px', height: 'auto', flexDirection: 'column', gap: '8px' }}
                onClick={() => setFactura({...factura, solo_invoice: true})}
              >
                <FileText size={24} />
                <div style={{ textAlign: 'center' }}>
                  <strong>Solo Invoice</strong>
                  <p style={{ fontSize: '11px', opacity: 0.8 }}>Documento interno APSOL</p>
                </div>
              </button>
              <button
                type="button"
                className={`btn ${!factura.solo_invoice ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '16px', height: 'auto', flexDirection: 'column', gap: '8px' }}
                onClick={() => setFactura({...factura, solo_invoice: false})}
              >
                <Receipt size={24} />
                <div style={{ textAlign: 'center' }}>
                  <strong>Invoice + Factura</strong>
                  <p style={{ fontSize: '11px', opacity: 0.8 }}>Requiere adjuntar factura fiscal</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* SECCIÓN 3: RAZONES SOCIALES (SELECCIONABLES Y COPIABLES) */}
        {prospectoSeleccionado && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                <Building2 size={20} className="text-primary" />
                3. Razón Social y CUIT
              </h3>
              {!loadingRazones && !mostrarNuevaRazon && (
                <button
                  type="button"
                  onClick={() => setMostrarNuevaRazon(true)}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}
                >
                  <Plus size={12} /> Nueva Razón Social
                </button>
              )}
            </div>
            {loadingRazones ? (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Cargando razones sociales...</div>
            ) : razonesSociales.length === 0 ? (
              <div className="alert alert-error">Esta empresa no tiene razones sociales cargadas.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                {razonesSociales.map(rs => (
                  <div 
                    key={rs.id} 
                    style={{ 
                      padding: '16px', 
                      borderRadius: '8px', 
                      border: `2px solid ${factura.razon_social_id === rs.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: factura.razon_social_id === rs.id ? 'var(--color-surface2)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setFactura({...factura, razon_social_id: rs.id})}
                  >
                    <div style={{ fontWeight: '700', marginBottom: '8px', color: factura.razon_social_id === rs.id ? 'var(--color-primary)' : 'inherit' }}>
                      {rs.razon_social}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px' }}>
                      <code style={{ fontSize: '13px' }}>{rs.cuit}</code>
                      <button 
                        type="button"
                        className="btn btn-secondary" 
                        style={{ padding: '4px', height: 'auto', background: 'transparent', borderColor: 'transparent' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopyCuit(rs.cuit, rs.id)
                        }}
                        title="Copiar CUIT"
                      >
                        {copiando === rs.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </button>
                    </div>
                    {factura.razon_social_id === rs.id && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Seleccionado para la factura
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!loadingRazones && mostrarNuevaRazon && (
              // Nota: es un <div>, no un <form>, a propósito. Esta sección ya vive
              // dentro del <form id="facturaForm"> de la factura completa, y un
              // <form> anidado hace que el evento "submit" burbujee hasta ese form
              // externo y dispare handleSave (guardando/creando la factura y
              // navegando a otra pantalla) además de agregarRazonSocial.
              <div
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarRazonSocial(e) } }}
                style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '16px', padding: '16px', background: 'var(--color-surface2)', borderRadius: '8px' }}
              >
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label>Razón Social</label>
                  <input
                    type="text"
                    placeholder="Ej. Mi Empresa S.A."
                    value={nuevaRazon.razon_social}
                    onChange={e => setNuevaRazon({...nuevaRazon, razon_social: e.target.value})}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label>CUIT</label>
                  <input
                    type="text"
                    placeholder="20-XXXXXXXX-X"
                    value={nuevaRazon.cuit}
                    onChange={e => setNuevaRazon({...nuevaRazon, cuit: e.target.value})}
                  />
                </div>
                <button type="button" className="btn btn-primary" onClick={agregarRazonSocial} disabled={savingRazon || !nuevaRazon.razon_social.trim()}>
                  {savingRazon ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarNuevaRazon(false)}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {/* SECCIÓN 4: DETALLES DE LA FACTURA */}
        {prospectoSeleccionado && (
          <div className="card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} className="text-primary" />
              4. Detalles del Comprobante
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="field">
                <label>{factura.solo_invoice ? 'Número de Invoice (Auto)' : 'Número de Factura Fiscal *'}</label>
                <input
                  type="text"
                  disabled={factura.solo_invoice && esNueva}
                  required={!factura.solo_invoice}
                  placeholder={factura.solo_invoice ? "Se generará al guardar" : "Ej. A-0001-00001234"}
                  value={factura.numero_factura}
                  onChange={e => setFactura({...factura, numero_factura: e.target.value})}
                />
                {factura.solo_invoice && <small style={{ color: 'var(--color-text-muted)' }}>Auto-numeración desde 300.</small>}
              </div>
              <div className="field">
                <label>Fecha de Emisión *</label>
                <input
                  type="date"
                  required
                  value={factura.fecha_emision}
                  onChange={e => setFactura({...factura, fecha_emision: e.target.value})}
                />
              </div>
              {!esNueva && (
                <div className="field">
                  <label>
                    Próximo recordatorio de cobro{' '}
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(automático)</span>
                  </label>
                  <input
                    type="date"
                    disabled
                    value={factura.proxima_notificacion ? String(factura.proxima_notificacion).split('T')[0] : ''}
                    title="Emisión + días hábiles de espera de la empresa. Lo recalcula el flujo de recordatorios tras cada aviso."
                  />
                  {factura.ultima_notificacion && (
                    <small style={{ color: 'var(--color-text-muted)' }}>
                      Último aviso enviado: {String(factura.ultima_notificacion).split('T')[0]}
                    </small>
                  )}
                </div>
              )}
              <div className="field">
                <label>Período (Desde) *</label>
                <input type="date" required value={factura.periodo_desde} onChange={e => setFactura({...factura, periodo_desde: e.target.value})} />
              </div>
              <div className="field">
                <label>Período (Hasta) *</label>
                <input type="date" required value={factura.periodo_hasta} onChange={e => setFactura({...factura, periodo_hasta: e.target.value})} />
              </div>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ marginBottom: 0 }}>Contacto de Cobro Principal *</label>
                  {!mostrarContacto2 && (
                    <button 
                      type="button" 
                      onClick={() => setMostrarContacto2(true)}
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
                    >
                      <Plus size={12} /> Contacto Secundario
                    </button>
                  )}
                </div>
                <select required value={factura.contacto_id} onChange={e => setFactura({...factura, contacto_id: e.target.value})}>
                  <option value="">-- Seleccionar Contacto --</option>
                  {contactosFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                </select>
              </div>
              
              {mostrarContacto2 && (
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ marginBottom: 0 }}>Contacto Secundario</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        setMostrarContacto2(false)
                        setFactura({...factura, contacto_cobro2_id: ''})
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', color: 'var(--color-danger)' }}
                    >
                      Quitar
                    </button>
                  </div>
                  <select 
                    disabled={!factura.contacto_id}
                    value={factura.contacto_cobro2_id} 
                    onChange={e => setFactura({...factura, contacto_cobro2_id: e.target.value})}
                  >
                    <option value="">-- Seleccionar Contacto --</option>
                    {contactosFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                  </select>
                </div>
              )}
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Cuenta para Depósito *</label>
                <select required value={factura.cuenta_bancaria_id} onChange={e => setFactura({...factura, cuenta_bancaria_id: e.target.value})}>
                  <option value="">-- Seleccionar Cuenta --</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} - {c.titular} ({c.moneda})</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Leyenda de la Factura *</label>
                <textarea rows="2" required value={factura.leyenda} onChange={e => setFactura({...factura, leyenda: e.target.value})} placeholder="Mensaje para el cliente..." />
              </div>
              <div className="field">
                <label>Horas facturadas</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={factura.hs_facturadas}
                  onChange={e => setFactura({...factura, hs_facturadas: e.target.value})}
                  placeholder="Ej. 12"
                />
              </div>
              <div className="field" style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={!!factura.incluir_horas_leyenda}
                    onChange={e => setFactura({...factura, incluir_horas_leyenda: e.target.checked})}
                    style={{ width: 'auto' }}
                  />
                  Incluir horas en la leyenda generada
                </label>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ marginBottom: 0 }}>
                    Leyenda generada{' '}
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(no editable)</span>
                  </label>
                  <BotonCopiar
                    texto={leyendaGenerada}
                    className="btn btn-secondary"
                    style={{ padding: '2px 10px', fontSize: '11px', height: 'auto' }}
                  >
                    Copiar
                  </BotonCopiar>
                </div>
                <textarea
                  readOnly
                  rows="3"
                  value={leyendaGenerada}
                  placeholder="Se arma sola con la leyenda, las horas y el período."
                  style={{ background: 'var(--color-surface2)', cursor: 'text' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 5: MONTOS Y CALCULADORA */}
        {prospectoSeleccionado && (
          <div className="card" style={{ background: 'var(--color-surface2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                <DollarSign size={20} className="text-primary" />
                5. Montos y Cálculos
              </h3>
              <button
                type="button"
                onClick={toggleModoManualMonto}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}
              >
                {modoManualMonto ? 'Calcular con tarifa UVA' : 'Ingresar monto manual'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {modoManualMonto ? (
                <div className="field">
                  <label>Monto</label>
                  <input type="number" step="0.01" value={factura.monto || ''} onChange={e => setFactura({...factura, monto: e.target.value})} />
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>
                      Tarifa Base (en UVA){' '}
                      <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(se define en el prospecto)</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={factura.tarifa_base_uva}
                      readOnly
                      title="Viene del prospecto (Valor Base Índice). Para cambiarla, editá el prospecto."
                      style={{ background: 'var(--color-surface2)', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div className="field">
                    <label>
                      Valor UVA del día ($)
                      {fechaParaUVA && (
                        <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · al {fmtFechaCorta(fechaParaUVA)}</span>
                      )}
                    </label>
                    <input type="number" step="0.01" value={factura.valor_uva_dia} onChange={e => setFactura({...factura, valor_uva_dia: e.target.value})} />
                  </div>
                </>
              )}

              {/* Aviso del ciclo de ajuste de tarifa (índice UVA). Explica por
                  qué esta factura repite el último monto o re-precia con UVA. */}
              {esNueva && prospectoSeleccionado && decisionTarifa.motivo !== 'sin-indice-uva' && (congelarMonto || !modoManualMonto) && (
                <div style={{
                  gridColumn: '1 / -1',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  lineHeight: 1.55,
                  background: congelarMonto ? 'rgba(56,87,35,0.08)' : 'rgba(197,90,17,0.08)',
                  border: `1px solid ${congelarMonto ? 'rgba(56,87,35,0.25)' : 'rgba(197,90,17,0.25)'}`
                }}>
                  {congelarMonto ? (
                    <>
                      <strong>🔒 Monto congelado.</strong> Esta factura repite el último monto facturado del
                      prospecto: <strong>${formatearMonto(decisionTarifa.montoCongelado)}</strong>
                      {ultimaFacturaProspecto?.numero_factura ? ` (factura N° ${ultimaFacturaProspecto.numero_factura})` : ''}.
                      La tarifa se re-precia con el valor UVA recién cuando el <strong>fin del período</strong> supere la{' '}
                      <strong>Próx. Act. Tarifa</strong>
                      {decisionTarifa.proximaActualizacion ? ` (${fmtFechaCorta(decisionTarifa.proximaActualizacion)})` : ''}.
                    </>
                  ) : decisionTarifa.motivo === 'primera-factura' ? (
                    <>
                      <strong>🔄 Primera factura del prospecto.</strong> Se toma el valor UVA de {uvaRefTexto} del
                      período. Al guardar arranca el ciclo: <strong>Última Act. Tarifa</strong> = inicio del período
                      {cicloTrasActualizar ? ` (${fmtFechaCorta(cicloTrasActualizar.ultima_actualizacion_tarifa)})` : ''} y{' '}
                      <strong>Próx. Act. Tarifa</strong>{cicloTrasActualizar ? ` = ${fmtFechaCorta(cicloTrasActualizar.proxima_actualizacion_tarifa)}` : ' = + Frecuencia Act.'}
                    </>
                  ) : decisionTarifa.motivo === 'sin-ciclo' ? (
                    <>
                      <strong>ℹ️ El prospecto no tiene “Próx. Act. Tarifa” cargada.</strong> Sin ciclo definido, la
                      factura toma el valor UVA de {uvaRefTexto} del período todos los meses. Cargá esa fecha y la
                      Frecuencia Act. en el prospecto (pestaña Gestión y Operaciones) para congelar el precio entre ajustes.
                    </>
                  ) : (
                    <>
                      <strong>🔄 Actualiza tarifa.</strong> El fin del período supera la Próx. Act. Tarifa
                      {decisionTarifa.proximaActualizacion ? ` (${fmtFechaCorta(decisionTarifa.proximaActualizacion)})` : ''}:
                      se toma el valor UVA de {uvaRefTexto} del período. Al guardar, la Próx. Act. Tarifa del prospecto
                      pasa a {cicloTrasActualizar ? fmtFechaCorta(cicloTrasActualizar.proxima_actualizacion_tarifa) : '+ Frecuencia Act.'}
                    </>
                  )}
                </div>
              )}
              <div className="field">
                <label>Descuento (%)</label>
                <input type="number" min="0" max="100" value={factura.porcentaje_descuento} onChange={e => setFactura({...factura, porcentaje_descuento: e.target.value})} disabled={modoManualMonto} title={modoManualMonto ? 'No aplica con monto manual' : ''} />
              </div>
              <div className="field">
                <label>
                  Redondear a múltiplo de{' '}
                  <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(0 = sin redondeo)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={factura.redondeo_multiplo}
                  onChange={e => setFactura({...factura, redondeo_multiplo: e.target.value})}
                  title="El neto (bruto − descuento) se redondea hacia abajo a este múltiplo. Ej. 1000."
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Bruto:</span>
                  <span style={{ fontWeight: '600' }}>${formatearMonto(factura.monto_bruto)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Descuento:</span>
                  <span style={{ fontWeight: '600', color: 'var(--color-danger)' }}>-${formatearMonto(factura.descuento)}</span>
                </div>
              </div>
            </div>
            <div style={{ padding: '20px', background: 'var(--color-surface)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>TOTAL NETO A COBRAR</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)' }}>${formatearMonto(factura.monto_neto)}</div>
                  <BotonCopiar
                    texto={String(Math.round(Number(factura.monto_neto) || 0))}
                    title="Copiar el total neto como número entero (sin decimales)"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}
                  />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>SALDO PENDIENTE</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: factura.saldo_pendiente > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  ${formatearMonto(factura.saldo_pendiente)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 6: DOCUMENTOS ADJUNTOS (ARCHIVOS REALES) */}
        {prospectoSeleccionado && (
          <div className="card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={20} className="text-primary" />
              6. Archivos Adjuntos
            </h3>
            
            <div style={{ display: 'grid', gap: '20px' }}>
              {!factura.solo_invoice && (
                <div className="field">
                  <label>Facturas Fiscales (Hasta 3 archivos)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {[0, 1, 2].map(idx => (
                      <div key={idx} style={{ position: 'relative', height: '120px', border: '2px dashed var(--color-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {factura.comprobantes_adjuntos[idx] ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface2)', padding: '12px' }}>
                            <FileText size={32} className="text-primary" style={{ marginBottom: '8px' }} />
                            <span style={{ fontSize: '11px', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>Archivo cargado</span>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                              <a href={factura.comprobantes_adjuntos[idx]} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px' }}>Ver</a>
                              <button type="button" onClick={() => {
                                const newAdj = [...factura.comprobantes_adjuntos]
                                newAdj[idx] = null
                                setFactura({...factura, comprobantes_adjuntos: newAdj})
                              }} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--color-danger)' }}>Quitar</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              onChange={(e) => handleFileUpload(e, 'comprobante', idx)}
                              disabled={subiendoArchivo}
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: subiendoArchivo ? 'wait' : 'pointer' }}
                              accept=".pdf,application/pdf"
                            />
                            <Upload size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{subiendoArchivo ? 'Subiendo…' : `Subir Factura ${idx + 1}`}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <label>Documento General / Anexo</label>
                <div style={{ position: 'relative', height: '80px', border: '2px dashed var(--color-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {factura.documento_general ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface2)', padding: '0 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileText size={24} className="text-primary" />
                        <span style={{ fontSize: '13px' }}>Anexo cargado</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={factura.documento_general} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">Ver</a>
                        <button type="button" onClick={() => setFactura({...factura, documento_general: ''})} className="btn btn-secondary" style={{ color: 'var(--color-danger)' }}>Quitar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        onChange={(e) => handleFileUpload(e, 'documento')}
                        disabled={subiendoArchivo}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: subiendoArchivo ? 'wait' : 'pointer' }}
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                      />
                      <Upload size={20} style={{ marginRight: '8px', opacity: 0.5 }} />
                      <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{subiendoArchivo ? 'Subiendo…' : 'Haz clic para subir un documento anexo'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 7: PAGOS (SOLO SI NO ES NUEVA) */}
        {!esNueva && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} className="text-primary" />
                7. Historial de Pagos
              </h3>
              <button type="button" className="btn btn-secondary" onClick={() => setMostrandoFormPago(!mostrandoFormPago)}>
                <Plus size={16} /> Agregar Pago
              </button>
            </div>

            {mostrandoFormPago && (
              <div style={{ padding: '20px', background: 'var(--color-surface2)', borderRadius: '12px', marginBottom: '24px', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="field">
                    <label>Fecha del Pago</label>
                    <input type="date" value={nuevoPago.fecha} onChange={e => setNuevoPago({...nuevoPago, fecha: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Monto</label>
                    <input type="number" step="0.01" value={nuevoPago.monto} onChange={e => setNuevoPago({...nuevoPago, monto: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Cuenta Destino</label>
                    <select value={nuevoPago.cuenta_bancaria_id} onChange={e => setNuevoPago({...nuevoPago, cuenta_bancaria_id: e.target.value})}>
                      <option value="">-- Seleccionar Cuenta --</option>
                      {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} ({c.moneda})</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ gridColumn: 'span 3' }}>
                    <label>Comprobante / Referencia</label>
                    <input type="text" placeholder="ID de transacción, N° de ticket..." value={nuevoPago.comprobante} onChange={e => setNuevoPago({...nuevoPago, comprobante: e.target.value})} />
                  </div>
                  <div className="field" style={{ gridColumn: 'span 3' }}>
                    <label>Observaciones</label>
                    <textarea rows="2" value={nuevoPago.observaciones} onChange={e => setNuevoPago({...nuevoPago, observaciones: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setMostrandoFormPago(false)}>Cancelar</button>
                  <button type="button" className="btn btn-primary" onClick={handleAddPago}>Guardar Pago</button>
                </div>
              </div>
            )}

            {pagos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                <DollarSign size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                <p>No hay pagos registrados para esta factura.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Observaciones</th>
                      <th>Monto</th>
                      <th>Comprobante</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map(p => (
                      <tr key={p.id}>
                        <td>{new Date(p.fecha).toLocaleDateString('es-AR')}</td>
                        <td style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{p.observaciones || '-'}</td>
                        <td style={{ fontWeight: '700', color: 'var(--color-success)' }}>${Number(p.monto).toLocaleString('es-AR')}</td>
                        <td style={{ fontSize: '12px' }}>{p.comprobante || '-'}</td>
                        <td>
                          <button type="button" onClick={() => handleDeletePago(p.id)} style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(!esNueva || puedeGuardar) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving || subiendoArchivo}>
              <Save size={18} />
              {saving ? 'Guardando...' : subiendoArchivo ? 'Subiendo archivo…' : 'Guardar Factura'}
            </button>
          </div>
        )}

      </form>

      {/* ESPACIADO FINAL */}
      <div style={{ height: '100px' }}></div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Receipt, DollarSign, Calendar, UploadCloud, Plus, Search, Copy, Check, FileText, Upload, Briefcase, Building2, Download } from 'lucide-react'
import { getFacturaById, saveFactura, deleteFactura, savePago, deletePago, getNextInvoiceNumber, calcularMontosFactura, calcularPrefillFactura, getUltimaFacturaProspecto } from '../services/facturacion'
import { getContactos } from '../services/contactos'
import { getProspectos } from '../services/prospectos'
import { getValoresUVA } from '../services/valoresUva'
import { obtenerUVAParaFecha } from '../services/sincronizacionUva'
import { getCuentasBancarias } from '../services/cuentasBancarias'
import { getRazonesSocialesByEmpresa, saveRazonSocial } from '../services/empresas'
import { uploadFile } from '../services/storage'
import { formatearMonto } from '../utils/formateo'
import { fechaLocalISO, esFechaCompleta, sumarDias } from '../utils/fecha'
import { esArchivoPDF } from '../utils/archivos'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function FacturaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNueva = id === 'nueva'

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
    cuenta_bancaria_id: '',
    razon_social_id: '',
    solo_invoice: true
  })
  
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null)
  
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

  useEffect(() => {
    cargarDatosPrevios()
    if (!esNueva) cargarFactura()
  }, [id])

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
  }, [factura.tarifa_base_uva, factura.valor_uva_dia, factura.porcentaje_descuento, factura.monto, pagos])

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

          if (Object.keys(updates).length > 0) {
            setFactura(prev => ({ ...prev, ...updates }))
          }
        }
      } else {
        setProspectoSeleccionado(null)
        setRazonesSociales([])
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

  // Efecto para buscar valor UVA por fecha 'Desde' (con fallback a API externa).
  // Solo dispara con una fecha COMPLETA y válida: algunos navegadores emiten
  // valores parciales de <input type="date"> mientras se tipea el año
  // (ej. '0002-08-10'), y eso antes generaba consultas y, peor, guardaba
  // cotizaciones en el histórico bajo fechas truncadas.
  useEffect(() => {
    async function buscarUVA() {
      if (!esFechaCompleta(factura.periodo_desde)) return
      try {
        const valor = await obtenerUVAParaFecha(factura.periodo_desde)
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
  }, [factura.periodo_desde, esNueva])

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

  async function cargarDatosPrevios() {
    try {
      const [prospectosData, contactosData, uvaData, cuentasData] = await Promise.all([
        getProspectos({ estadoExacto: '6A - En producción' }),
        getContactos(),
        getValoresUVA(),
        getCuentasBancarias()
      ])
      setProspectos(prospectosData)
      setContactos(contactosData)
      setValoresUVA(uvaData)
      setCuentas(cuentasData)

      if (esNueva && uvaData.length > 0) {
        // Asignar valor UVA más reciente por defecto
        setFactura(prev => ({ ...prev, valor_uva_dia: uvaData[0].valor }))
      }
    } catch (err) {
      console.error(err)
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
    setSaving(true)
    setError('')
    try {
      const dataToSave = { ...factura }
      delete dataToSave.prospectos
      delete dataToSave.contactos
      delete dataToSave.contacto2
      delete dataToSave.pagos

      if (!dataToSave.prospecto_id) dataToSave.prospecto_id = null
      if (!dataToSave.contacto_id) dataToSave.contacto_id = null
      if (!dataToSave.contacto_cobro2_id) dataToSave.contacto_cobro2_id = null
      if (!dataToSave.fecha_vencimiento) dataToSave.fecha_vencimiento = null
      if (!dataToSave.periodo_desde) dataToSave.periodo_desde = null
      if (!dataToSave.periodo_hasta) dataToSave.periodo_hasta = null
      if (!dataToSave.razon_social_id) dataToSave.razon_social_id = null
      if (!dataToSave.cuenta_bancaria_id) dataToSave.cuenta_bancaria_id = null
      
      // Auto-update status (nunca para facturas anuladas)
      if (dataToSave.estado !== 'Anulada') {
        if (dataToSave.saldo_pendiente <= 0 && pagos.length > 0) {
          dataToSave.estado = 'Cobrada total'
        } else if (pagos.length > 0) {
          dataToSave.estado = 'Cobrada parcial'
        }
      }

      const saved = await saveFactura(dataToSave)

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

    setSaving(true)
    try {
      const url = await uploadFile(file, `facturacion/${id || 'nueva'}`)
      
      if (type === 'comprobante') {
        const nuevosAdjuntos = [...factura.comprobantes_adjuntos]
        nuevosAdjuntos[index] = url
        setFactura({ ...factura, comprobantes_adjuntos: nuevosAdjuntos })
      } else {
        setFactura({ ...factura, documento_general: url })
      }
    } catch (err) {
      console.error(err)
      setError('Error al subir el archivo.')
    } finally {
      setSaving(false)
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
            <p className="page-subtitle">{esNueva ? 'Configura los datos del nuevo comprobante' : 'Gestión y seguimiento de cobro'}</p>
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
          <button type="submit" form="facturaForm" className="btn btn-primary" disabled={saving}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Factura'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}
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
                {prospectos.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.empresas?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
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
                <label>{factura.solo_invoice ? 'Número de Invoice (Auto)' : 'Número de Factura Fiscal'}</label>
                <input 
                  type="text" 
                  disabled={factura.solo_invoice && esNueva}
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
              <div className="field">
                <label>Período (Desde)</label>
                <input type="date" value={factura.periodo_desde} onChange={e => setFactura({...factura, periodo_desde: e.target.value})} />
              </div>
              <div className="field">
                <label>Período (Hasta)</label>
                <input type="date" value={factura.periodo_hasta} onChange={e => setFactura({...factura, periodo_hasta: e.target.value})} />
              </div>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ marginBottom: 0 }}>Contacto de Cobro Principal</label>
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
                <select value={factura.contacto_id} onChange={e => setFactura({...factura, contacto_id: e.target.value})}>
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
                <label>Leyenda de la Factura</label>
                <textarea rows="2" value={factura.leyenda} onChange={e => setFactura({...factura, leyenda: e.target.value})} placeholder="Mensaje para el cliente..." />
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
                    <label>Tarifa Base (en UVA)</label>
                    <input type="number" step="0.1" value={factura.tarifa_base_uva} onChange={e => setFactura({...factura, tarifa_base_uva: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Valor UVA del día ($)</label>
                    <input type="number" step="0.01" value={factura.valor_uva_dia} onChange={e => setFactura({...factura, valor_uva_dia: e.target.value})} />
                  </div>
                </>
              )}
              <div className="field">
                <label>Descuento (%)</label>
                <input type="number" min="0" max="100" value={factura.porcentaje_descuento} onChange={e => setFactura({...factura, porcentaje_descuento: e.target.value})} disabled={modoManualMonto} title={modoManualMonto ? 'No aplica con monto manual' : ''} />
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
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)' }}>${formatearMonto(factura.monto_neto)}</div>
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
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                              accept=".pdf,application/pdf"
                            />
                            <Upload size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Subir Factura {idx + 1}</span>
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
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                      />
                      <Upload size={20} style={{ marginRight: '8px', opacity: 0.5 }} />
                      <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Haz clic para subir un documento anexo</span>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Factura'}
          </button>
        </div>

      </form>

      {/* ESPACIADO FINAL */}
      <div style={{ height: '100px' }}></div>
    </div>
  )
}

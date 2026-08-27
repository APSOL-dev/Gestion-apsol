import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, FolderKanban, Star, Plus, Clock, User, Building2, X, Link, Upload, DownloadCloud, ChevronDown, Calendar, DollarSign, RefreshCw, Users, CreditCard, Activity, Mail, ExternalLink } from 'lucide-react'
import CreatableSelect from 'react-select/creatable'

import { getProspectoById, saveProspecto, deleteProspecto, saveObservacion, uploadFile } from '../services/prospectos'
import { getEmpresas, saveEmpresa } from '../services/empresas'
import { getContactos, saveContacto } from '../services/contactos'
import { sumarMeses } from '../utils/fecha'
import { construirEnlaceContacto } from '../utils/navegacion'
import { ESTADOS_PROSPECTO, getEstadoProspectoStyle } from '../utils/formateo'

const TIPOS_TAREA = [
  'Llamada Comercial',
  'Reunión Virtual',
  'Reunión Presencial',
  'Envío de Presupuesto',
  'Seguimiento de Propuesta',
  'Demostración de Producto',
  'Visita Técnica',
  'Otro'
]

const PAISES_LATAM = [
  'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica', 'Cuba',
  'Ecuador', 'El Salvador', 'Guatemala', 'Honduras', 'México', 'Nicaragua',
  'Panamá', 'Paraguay', 'Perú', 'Puerto Rico', 'República Dominicana', 'Uruguay', 'Venezuela'
]

const PROVINCIAS_AR = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
]

const CANALES_COMUNES = ['Recomendación', 'LinkedIn', 'Web', 'WhatsApp', 'Llamada Fría', 'Instagram'].map(c => ({ value: c, label: c }))
const SERVICIOS_COMUNES = ['Implementación', 'Soporte', 'Consultoría', 'Auditoría', 'Desarrollo a medida'].map(c => ({ value: c, label: c }))

// Componente visual para estrellas
function StarRating({ value, onChange, label }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3].map(num => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num.toString())}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              color: value >= num ? '#fbbf24' : '#e5e7eb',
              transition: 'color 0.2s'
            }}
          >
            <Star size={24} fill={value >= num ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ProspectoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nuevo'

  const [prospecto, setProspecto] = useState({
    nombre: '',
    empresa_id: '',
    contacto_id: '',
    canal_contacto: '',
    servicios_requeridos: [],
    adjuntos: '[]',
    presupuesto: '0',
    necesidad: '0',
    estado: 'Nuevo',
    proxima_tarea: '',
    fecha_proxima_tarea: '',
    proxima_tarea_tipo: '',
    proxima_tarea_comentario: '',
    // Campos de producción
    inicio_servicio: '',
    proxima_factura: '',
    hs_mensuales: '',
    moneda_cobro: 'ARS',
    indice_cobro: 'UVA',
    tarifa_base: '',
    base_indice_valor: '',
    mensualidad_vigente_actual: '',
    proxima_actualizacion_tarifa: '',
    ultima_actualizacion_tarifa: '',
    dias_entre_reuniones: '15',
    frecuencia_actualizacion: 1,
    // Marketing y Tracking
    fecha_ultimo_cambio_estado: null,
    estado_repetido: ''
  })

  // Estado para el modal de cambio de estado
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatusData, setNewStatusData] = useState({
    estado: '',
    // Sub-estado de producción
    inicio_servicio: '',
    proxima_factura: '',
    hs_mensuales: '',
    moneda_cobro: 'ARS',
    indice_cobro: 'UVA',
    tarifa_base: '',
    base_indice_valor: '',
    mensualidad_vigente_actual: '',
    proxima_actualizacion_tarifa: '',
    ultima_actualizacion_tarifa: '',
    dias_entre_reuniones: '15',
    frecuencia_actualizacion: 1
  })
  
  const [empresas, setEmpresas] = useState([])
  const [contactos, setContactos] = useState([])
  const [todosLosContactos, setTodosLosContactos] = useState([])
  
  // Datos para autocompletado
  const [industriasExistentes, setIndustriasExistentes] = useState([])
  const [cargosExistentes, setCargosExistentes] = useState([])
  const [areasExistentes, setAreasExistentes] = useState([])

  // Formularios en línea
  const [showNuevaEmpresa, setShowNuevaEmpresa] = useState(false)
  const [creandoEmpresa, setCreandoEmpresa] = useState(false)
  const [nuevaEmpresa, setNuevaEmpresa] = useState({
    nombre: '', pais: 'Argentina', provincia: '', industria: '', tamaño_personas: '', dias_espera_facturacion: 5
  })

  const [showNuevoContacto, setShowNuevoContacto] = useState(false)
  const [creandoContacto, setCreandoContacto] = useState(false)
  const [nuevoContacto, setNuevoContacto] = useState({
    nombre: '', apellido: '', telefono: '', email: '', cargo: '', area: ''
  })

  const [observaciones, setObservaciones] = useState([])
  const [nuevaObsTexto, setNuevaObsTexto] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingObs, setSavingObs] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState('')
  
  const [showPlanningModal, setShowPlanningModal] = useState(false)
  const [planningData, setPlanningData] = useState({
    estado: 'Nuevo',
    proxima_tarea_tipo: '',
    proxima_tarea_comentario: '',
    fecha_proxima_tarea: ''
  })

  // Control de pestañas UX
  const [activeTab, setActiveTab] = useState('info')

  // Selects visuales
  const [selectedServicios, setSelectedServicios] = useState([])
  const [selectedCanal, setSelectedCanal] = useState(null)

  const adjuntosList = getAdjuntosParsed()
  const enlaceContacto = construirEnlaceContacto(prospecto.contacto_id, todosLosContactos)

  useEffect(() => {
    cargarDatos()
  }, [id])

  useEffect(() => {
    if (prospecto.empresa_id) {
      setContactos(todosLosContactos.filter(c => c.empresa_id === prospecto.empresa_id))
    } else {
      setContactos(todosLosContactos)
    }
  }, [prospecto.empresa_id, todosLosContactos])

  // La "Próxima Actualización de Tarifa" se calcula sola: última actualización
  // + la frecuencia de actualización (en meses). No se tipea a mano.
  useEffect(() => {
    if (!prospecto.ultima_actualizacion_tarifa) return
    const meses = parseInt(prospecto.frecuencia_actualizacion) || 1
    const calculada = sumarMeses(prospecto.ultima_actualizacion_tarifa, meses)
    if (calculada && calculada !== prospecto.proxima_actualizacion_tarifa) {
      setProspecto(prev => ({ ...prev, proxima_actualizacion_tarifa: calculada }))
    }
  }, [prospecto.ultima_actualizacion_tarifa, prospecto.frecuencia_actualizacion])

  function getAdjuntosParsed() {
    try {
      return JSON.parse(prospecto.adjuntos || '[]')
    } catch {
      return []
    }
  }

  function setAdjuntosParsed(arr) {
    setProspecto(p => ({ ...p, adjuntos: JSON.stringify(arr) }))
  }

  function handleAdjuntoChange(index, field, value) {
    const arr = [...adjuntosList]
    arr[index][field] = value
    setAdjuntosParsed(arr)
  }

  function removeAdjunto(index) {
    const arr = adjuntosList.filter((_, idx) => idx !== index)
    setAdjuntosParsed(arr)
  }

  async function cargarDatos() {
    setLoading(true)
    try {
      const [empresasData, contactosData] = await Promise.all([
        getEmpresas(),
        getContactos()
      ])
      setEmpresas(empresasData)
      setTodosLosContactos(contactosData)

      // Listas de autocompletado
      setIndustriasExistentes([...new Set(empresasData.map(e => e.industria).filter(Boolean))].sort())
      setCargosExistentes([...new Set(contactosData.map(c => c.cargo).filter(Boolean))].sort())
      setAreasExistentes([...new Set(contactosData.map(c => c.area).filter(Boolean))].sort())

      if (!esNuevo) {
        const data = await getProspectoById(id)
        
        let tipoTarea = ''
        let comentarioTarea = data.proxima_tarea || ''
        for (const t of TIPOS_TAREA) {
          if (comentarioTarea.startsWith(t + ' - ')) {
            tipoTarea = t
            comentarioTarea = comentarioTarea.substring(t.length + 3)
            break
          } else if (comentarioTarea === t) {
            tipoTarea = t
            comentarioTarea = ''
            break
          }
        }

        setProspecto({
          ...data,
          fecha_proxima_tarea: data.fecha_proxima_tarea ? data.fecha_proxima_tarea.split('T')[0] : '',
          inicio_servicio: data.inicio_servicio ? data.inicio_servicio.split('T')[0] : '',
          proxima_factura: data.proxima_factura ? data.proxima_factura.split('T')[0] : '',
          ultima_actualizacion_tarifa: data.ultima_actualizacion_tarifa ? data.ultima_actualizacion_tarifa.split('T')[0] : '',
          proxima_tarea_tipo: tipoTarea,
          proxima_tarea_comentario: comentarioTarea
        })

        setObservaciones(data.observaciones || [])
        
        if (data.servicios_requeridos) {
          setSelectedServicios(data.servicios_requeridos.map(s => ({ value: s, label: s })))
        }
        if (data.canal_contacto) {
          setSelectedCanal({ value: data.canal_contacto, label: data.canal_contacto })
        }
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const url = await uploadFile(file)
      const arr = [...adjuntosList, { titulo: file.name, url }]
      setAdjuntosParsed(arr)
    } catch (err) {
      console.error(err)
      alert('Error al subir el archivo')
    } finally {
      setUploadingFile(false)
    }
  }

  async function handleAddObservacion() {
    if (!nuevaObsTexto.trim()) return
    setSavingObs(true)
    try {
      const newObs = await saveObservacion({
        prospecto_id: id,
        observacion: nuevaObsTexto
      })
      setObservaciones([newObs, ...observaciones])
      setNuevaObsTexto('')
    } catch (err) {
      console.error(err)
      alert('Error al guardar observación')
    } finally {
      setSavingObs(false)
    }
  }

  async function crearEmpresaRapida() {
    if (!nuevaEmpresa.nombre.trim()) { alert('El nombre de la empresa es obligatorio.'); return }
    if (!nuevaEmpresa.provincia.trim()) { alert('La provincia es obligatoria.'); return }
    if (!nuevaEmpresa.industria.trim()) { alert('La industria/sector es obligatoria.'); return }
    if (!nuevaEmpresa.tamaño_personas) { alert('El tamaño (empleados) es obligatorio.'); return }

    setCreandoEmpresa(true)
    try {
      const saved = await saveEmpresa({
        nombre: nuevaEmpresa.nombre.trim(),
        pais: nuevaEmpresa.pais,
        provincia: nuevaEmpresa.provincia,
        industria: nuevaEmpresa.industria,
        tamaño_personas: Number(nuevaEmpresa.tamaño_personas),
        dias_espera_facturacion: Number(nuevaEmpresa.dias_espera_facturacion) || 5
      })
      setEmpresas(prev => [...prev, saved].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setProspecto(prev => ({ ...prev, empresa_id: saved.id }))
      setShowNuevaEmpresa(false)
      setNuevaEmpresa({ nombre: '', pais: 'Argentina', provincia: '', industria: '', tamaño_personas: '', dias_espera_facturacion: 5 })
    } catch (err) {
      alert('Error al crear la empresa. Intente nuevamente.')
    } finally {
      setCreandoEmpresa(false)
    }
  }

  async function crearContactoRapido() {
    if (!prospecto.empresa_id) { alert('Debe seleccionar una empresa primero para crear el contacto.'); return }
    if (!nuevoContacto.nombre.trim()) { alert('El nombre del contacto es obligatorio.'); return }

    setCreandoContacto(true)
    try {
      const saved = await saveContacto({
        ...nuevoContacto,
        empresa_id: prospecto.empresa_id,
        activo: true
      })
      setTodosLosContactos(prev => [...prev, saved])
      setProspecto(prev => ({ ...prev, contacto_id: saved.id }))
      setShowNuevoContacto(false)
      setNuevoContacto({ nombre: '', apellido: '', telefono: '', email: '', cargo: '', area: '' })
    } catch (err) {
      alert('Error al crear el contacto. Intente nuevamente.')
    } finally {
      setCreandoContacto(false)
    }
  }

  async function handleInitialSave(e) {
    if (e) e.preventDefault()
    if (!prospecto.nombre || !prospecto.empresa_id || !prospecto.contacto_id) {
      setError('Nombre, Empresa y Contacto son obligatorios.')
      return
    }
    setSaving(true)
    setError('')
    
    try {
      const p_tarea = prospecto.proxima_tarea_tipo 
        ? (prospecto.proxima_tarea_comentario ? `${prospecto.proxima_tarea_tipo} - ${prospecto.proxima_tarea_comentario}` : prospecto.proxima_tarea_tipo)
        : (prospecto.proxima_tarea_comentario || null)

      // Limpieza exhaustiva mediante desestructuración
      const { 
        empresas, contactos, observaciones, facturacion, proyectos,
        created_at, proxima_tarea_tipo, proxima_tarea_comentario,
        ...datosBase 
      } = prospecto

      const dataToSave = {
        ...datosBase,
        proxima_tarea: p_tarea,
        servicios_requeridos: selectedServicios.map(s => s.value),
        canal_contacto: selectedCanal ? selectedCanal.value : '',
        adjuntos: typeof prospecto.adjuntos === 'string' ? prospecto.adjuntos : JSON.stringify(prospecto.adjuntos),
        fecha_proxima_tarea: prospecto.fecha_proxima_tarea || null
      }

      const saved = await saveProspecto(dataToSave)
      setProspecto(saved)
      
      if (!esNuevo) {
        setSaving(false)
        return // Fin, guardado exitoso y no mostramos modal
      }

      setPlanningData({
        estado: saved.estado || 'Nuevo',
        proxima_tarea_tipo: prospecto.proxima_tarea_tipo || '',
        proxima_tarea_comentario: prospecto.proxima_tarea_comentario || '',
        fecha_proxima_tarea: saved.fecha_proxima_tarea || ''
      })
      setShowPlanningModal(true)

    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      if (esNuevo) setSaving(false) // Si no es nuevo ya se paró arriba o en caso de error
    }
  }

  async function handleUpdateTarea(e) {
    if (e) e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const p_tarea = prospecto.proxima_tarea_tipo 
        ? (prospecto.proxima_tarea_comentario ? `${prospecto.proxima_tarea_tipo} - ${prospecto.proxima_tarea_comentario}` : prospecto.proxima_tarea_tipo)
        : (prospecto.proxima_tarea_comentario || null)

      const toSave = { 
        id: prospecto.id,
        proxima_tarea: p_tarea,
        fecha_proxima_tarea: prospecto.fecha_proxima_tarea || null
      }
      
      const saved = await saveProspecto(toSave)
      setProspecto(prev => ({ ...prev, ...saved }))
    } catch (err) {
      console.error(err)
      setError('Error al actualizar la tarea.')
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalSave() {
    setSaving(true)
    try {
      const p_tarea = planningData.proxima_tarea_tipo 
        ? (planningData.proxima_tarea_comentario ? `${planningData.proxima_tarea_tipo} - ${planningData.proxima_tarea_comentario}` : planningData.proxima_tarea_tipo)
        : (planningData.proxima_tarea_comentario || null)

      const toSave = { 
        id: prospecto.id,
        estado: planningData.estado,
        proxima_tarea: p_tarea,
        fecha_proxima_tarea: planningData.fecha_proxima_tarea || null
      }
      
      const saved = await saveProspecto(toSave)
      setShowPlanningModal(false)
      navigate('/prospectos')
    } catch (err) {
      console.error(err)
      setError('Error al guardar planificación.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Estás seguro de eliminar este prospecto?')) return
    try {
      await deleteProspecto(id)
      navigate('/prospectos')
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  async function handleOperationalSave() {
    setSaving(true)
    try {
      const dataToSave = {
        id: prospecto.id,
        inicio_servicio: prospecto.inicio_servicio || null,
        proxima_factura: prospecto.proxima_factura || null,
        hs_mensuales: parseFloat(prospecto.hs_mensuales) || 0,
        moneda_cobro: prospecto.moneda_cobro,
        indice_cobro: prospecto.indice_cobro,
        tarifa_base: parseFloat(prospecto.tarifa_base) || 0,
        base_indice_valor: parseFloat(prospecto.base_indice_valor) || 0,
        mensualidad_vigente_actual: parseFloat(prospecto.mensualidad_vigente_actual) || 0,
        proxima_actualizacion_tarifa: prospecto.proxima_actualizacion_tarifa || null,
        ultima_actualizacion_tarifa: prospecto.ultima_actualizacion_tarifa || null,
        dias_entre_reuniones: parseInt(prospecto.dias_entre_reuniones) || 0,
        frecuencia_actualizacion: parseInt(prospecto.frecuencia_actualizacion) || 1
      }

      const saved = await saveProspecto(dataToSave)
      setProspecto(prev => ({ ...prev, ...saved }))
      alert('Datos operativos guardados correctamente')
    } catch (err) {
      console.error(err)
      setError('Error al guardar datos operativos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusUpdate() {
    setSaving(true)
    try {
      // Definimos solo los campos básicos de actualización
      const dataToSave = {
        id: prospecto.id,
        estado: newStatusData.estado,
        fecha_ultimo_cambio_estado: new Date().toISOString()
      }

      // Si es producción, adjuntar campos extra desde el modal
      if (newStatusData.estado.includes('6A')) {
        dataToSave.inicio_servicio = newStatusData.inicio_servicio || null
        dataToSave.proxima_factura = newStatusData.proxima_factura || null
        dataToSave.hs_mensuales = parseFloat(newStatusData.hs_mensuales) || 0
        dataToSave.moneda_cobro = newStatusData.moneda_cobro
        dataToSave.indice_cobro = newStatusData.indice_cobro
        dataToSave.tarifa_base = parseFloat(newStatusData.tarifa_base) || 0
        dataToSave.base_indice_valor = parseFloat(newStatusData.base_indice_valor) || 0
        dataToSave.mensualidad_vigente_actual = parseFloat(newStatusData.mensualidad_vigente_actual) || 0
        dataToSave.proxima_actualizacion_tarifa = newStatusData.proxima_actualizacion_tarifa || null
        dataToSave.ultima_actualizacion_tarifa = newStatusData.ultima_actualizacion_tarifa || null
        dataToSave.dias_entre_reuniones = parseInt(newStatusData.dias_entre_reuniones) || 0
        dataToSave.frecuencia_actualizacion = parseInt(newStatusData.frecuencia_actualizacion) || 1
      }

      const saved = await saveProspecto(dataToSave)
      // Actualizamos el estado local con la respuesta limpia
      setProspecto(prev => ({ ...prev, ...saved }))
      setShowStatusModal(false)
      
      // Añadir una observación automática del cambio de estado
      await saveObservacion({
        prospecto_id: id,
        observacion: `Cambio de estado: ${saved.estado}`
      })
      cargarDatos() // Recargar para ver historial

    } catch (err) {
      console.error(err)
      setError('Error al actualizar el estado.')
    } finally {
      setSaving(false)
    }
  }

  const currentStyle = getEstadoProspectoStyle(prospecto.estado)

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando datos...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: esNuevo ? '800px' : '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/prospectos')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{esNuevo ? 'Nuevo Prospecto' : prospecto.nombre}</h1>
            <p className="page-subtitle">{esNuevo ? 'Inicia una nueva oportunidad comercial' : 'Detalles de la oportunidad'}</p>
          </div>
        </div>
        {!esNuevo && (
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={18} />
            Eliminar
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {/* TABS (SOLO PARA PROSPECTOS EXISTENTES) */}
      {!esNuevo && (
        <div style={{ display: 'flex', gap: '20px', borderBottom: '2px solid var(--color-border)', marginBottom: '24px' }}>
          <button 
            type="button"
            onClick={() => setActiveTab('info')}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'info' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'info' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'info' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s'
            }}
          >
            Información General
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('seguimiento')}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'seguimiento' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'seguimiento' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'seguimiento' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s'
            }}
          >
            Marketing y Venta
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('gestion')}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'gestion' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'gestion' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'gestion' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
              opacity: (prospecto.estado || '').toLowerCase().includes('6a') || (prospecto.estado || '').toLowerCase().includes('5h') ? 1 : 0.4,
              cursor: (prospecto.estado || '').toLowerCase().includes('6a') || (prospecto.estado || '').toLowerCase().includes('5h') ? 'pointer' : 'not-allowed',
              pointerEvents: (prospecto.estado || '').toLowerCase().includes('6a') || (prospecto.estado || '').toLowerCase().includes('5h') ? 'auto' : 'none'
            }}
          >
            Gestión y Operaciones
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', alignItems: 'start' }}>
        {/* PESTAÑA 1: INFORMACIÓN GENERAL (o Formulario nuevo) */}
        {(esNuevo || activeTab === 'info') && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={24} className="text-primary" />
                Datos Principales
              </h2>
              {!esNuevo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>ESTADO ACTUAL</span>
                  <div 
                    onClick={() => {
                      setNewStatusData({ 
                        ...prospecto, 
                        estado: prospecto.estado,
                        inicio_servicio: prospecto.inicio_servicio || '',
                        proxima_factura: prospecto.proxima_factura || '',
                        hs_mensuales: prospecto.hs_mensuales || '',
                        moneda_cobro: prospecto.moneda_cobro || 'ARS',
                        indice_cobro: prospecto.indice_cobro || 'UVA',
                        tarifa_base: prospecto.tarifa_base || '',
                        base_indice_valor: prospecto.base_indice_valor || '',
                        mensualidad_vigente_actual: prospecto.mensualidad_vigente_actual || '',
                        proxima_actualizacion_tarifa: prospecto.proxima_actualizacion_tarifa || '',
                        ultima_actualizacion_tarifa: prospecto.ultima_actualizacion_tarifa || '',
                        dias_entre_reuniones: prospecto.dias_entre_reuniones || '15',
                        frecuencia_actualizacion: prospecto.frecuencia_actualizacion || 1
                      });
                      setShowStatusModal(true);
                    }}
                    style={{ 
                      padding: '6px 14px', 
                      borderRadius: '16px', 
                      background: currentStyle.bg,
                      color: currentStyle.text,
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '2px solid transparent',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                    onMouseOut={e => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'}
                  >
                    {prospecto.estado}
                    <ChevronDown size={14} />
                  </div>
                </div>
              )}
            </div>
          <form onSubmit={handleInitialSave} style={{ display: 'grid', gap: '20px' }}>
            
            <div className="field">
              <label>Nombre del Prospecto *</label>
              <input 
                type="text" 
                required 
                placeholder="Ej. Implementación Odoo 2024"
                value={prospecto.nombre} 
                onChange={e => setProspecto({...prospecto, nombre: e.target.value})} 
              />
            </div>

            {/* SECCIÓN EMPRESA */}
            <div className="field">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={14} /> Empresa *
                </span>
                <button
                  type="button"
                  onClick={() => setShowNuevaEmpresa(!showNuevaEmpresa)}
                  style={{ fontSize: '11px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
                >
                  <Plus size={13} /> Crear nueva
                </button>
              </label>
              <select
                value={prospecto.empresa_id || ''}
                onChange={e => setProspecto({ ...prospecto, empresa_id: e.target.value, contacto_id: '' })}
              >
                <option value="">Seleccionar empresa...</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>

              {showNuevaEmpresa && (
                <div style={{ marginTop: '12px', padding: '16px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary)', display: 'grid', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>Nueva Empresa</span>
                    <button type="button" onClick={() => setShowNuevaEmpresa(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="field">
                    <label>Nombre Comercial *</label>
                    <input type="text" placeholder="Nombre de la empresa" value={nuevaEmpresa.nombre} onChange={e => setNuevaEmpresa({...nuevaEmpresa, nombre: e.target.value})} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="field">
                      <label>País *</label>
                      <select value={nuevaEmpresa.pais} onChange={e => setNuevaEmpresa({...nuevaEmpresa, pais: e.target.value, provincia: ''})}>
                        {PAISES_LATAM.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Provincia *</label>
                      {nuevaEmpresa.pais === 'Argentina' ? (
                        <select value={nuevaEmpresa.provincia} onChange={e => setNuevaEmpresa({...nuevaEmpresa, provincia: e.target.value})}>
                          <option value="">Seleccionar...</option>
                          {PROVINCIAS_AR.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <input type="text" placeholder="Provincia / Estado" value={nuevaEmpresa.provincia} onChange={e => setNuevaEmpresa({...nuevaEmpresa, provincia: e.target.value})} />
                      )}
                    </div>
                  </div>

                  <div className="field">
                    <label>Industria / Sector *</label>
                    <input type="text" list="industrias-nueva-empresa" placeholder="Ej: Transporte" value={nuevaEmpresa.industria} onChange={e => setNuevaEmpresa({...nuevaEmpresa, industria: e.target.value})} />
                    <datalist id="industrias-nueva-empresa">
                      {industriasExistentes.map(i => <option key={i} value={i} />)}
                    </datalist>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="field">
                      <label>Tamaño (empleados) *</label>
                      <input type="number" min="1" placeholder="Ej: 50" value={nuevaEmpresa.tamaño_personas} onChange={e => setNuevaEmpresa({...nuevaEmpresa, tamaño_personas: e.target.value})} />
                    </div>
                    <div className="field">
                      <label>Días espera facturación</label>
                      <input type="number" min="1" value={nuevaEmpresa.dias_espera_facturacion} onChange={e => setNuevaEmpresa({...nuevaEmpresa, dias_espera_facturacion: e.target.value})} />
                    </div>
                  </div>

                  <button type="button" className="btn btn-primary w-full" onClick={crearEmpresaRapida} disabled={creandoEmpresa}>
                    {creandoEmpresa ? 'Creando empresa...' : 'Crear y seleccionar empresa'}
                  </button>
                </div>
              )}
            </div>

            {/* SECCIÓN CONTACTO */}
            <div className="field">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} /> Contacto *
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {enlaceContacto && (
                    <a
                      href={enlaceContacto.href}
                      target="_blank"
                      rel="noreferrer"
                      title={enlaceContacto.label}
                      style={{ fontSize: '11px', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
                    >
                      <ExternalLink size={13} /> Ver ficha
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!prospecto.empresa_id) alert('Selecciona una empresa primero')
                      else setShowNuevoContacto(!showNuevoContacto)
                    }}
                    style={{ fontSize: '11px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
                  >
                    <Plus size={13} /> Crear nuevo
                  </button>
                </span>
              </label>
              <select
                value={prospecto.contacto_id || ''}
                onChange={e => setProspecto({ ...prospecto, contacto_id: e.target.value })}
                disabled={!prospecto.empresa_id && contactos.length === 0}
              >
                <option value="">Seleccionar contacto...</option>
                {contactos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                ))}
              </select>

              {showNuevoContacto && prospecto.empresa_id && (
                <div style={{ marginTop: '12px', padding: '16px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary)', display: 'grid', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>Nuevo Contacto</span>
                    <button type="button" onClick={() => setShowNuevoContacto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="field">
                      <label>Nombre *</label>
                      <input type="text" placeholder="Ej: Juan" value={nuevoContacto.nombre} onChange={e => setNuevoContacto({...nuevoContacto, nombre: e.target.value})} />
                    </div>
                    <div className="field">
                      <label>Apellido</label>
                      <input type="text" placeholder="Ej: Pérez" value={nuevoContacto.apellido} onChange={e => setNuevoContacto({...nuevoContacto, apellido: e.target.value})} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="field">
                      <label>Teléfono</label>
                      <input type="text" placeholder="+54 9..." value={nuevoContacto.telefono} onChange={e => setNuevoContacto({...nuevoContacto, telefono: e.target.value})} />
                    </div>
                    <div className="field">
                      <label>Email</label>
                      <input type="email" placeholder="juan@empresa.com" value={nuevoContacto.email} onChange={e => setNuevoContacto({...nuevoContacto, email: e.target.value})} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="field">
                      <label>Cargo</label>
                      <input type="text" list="cargos-list" placeholder="Ej: Gerente" value={nuevoContacto.cargo} onChange={e => setNuevoContacto({...nuevoContacto, cargo: e.target.value})} />
                      <datalist id="cargos-list">
                        {cargosExistentes.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div className="field">
                      <label>Área</label>
                      <input type="text" list="areas-list" placeholder="Ej: Sistemas" value={nuevoContacto.area} onChange={e => setNuevoContacto({...nuevoContacto, area: e.target.value})} />
                      <datalist id="areas-list">
                        {areasExistentes.map(a => <option key={a} value={a} />)}
                      </datalist>
                    </div>
                  </div>

                  <button type="button" className="btn btn-primary w-full" onClick={crearContactoRapido} disabled={creandoContacto}>
                    {creandoContacto ? 'Creando contacto...' : 'Crear y seleccionar contacto'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label>Canal de Contacto</label>
                <CreatableSelect
                  isClearable
                  placeholder="Seleccionar o escribir..."
                  value={selectedCanal}
                  options={CANALES_COMUNES}
                  onChange={v => setSelectedCanal(v)}
                  formatCreateLabel={(inputValue) => `Crear "${inputValue}"`}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: 'var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      minHeight: '42px',
                      boxShadow: 'none',
                      '&:hover': {
                        borderColor: 'var(--color-border-hover)'
                      }
                    })
                  }}
                />
              </div>

              <div className="field">
                <label>Servicios Requeridos</label>
                <CreatableSelect
                  isMulti
                  isClearable
                  placeholder="Seleccionar o escribir..."
                  value={selectedServicios}
                  options={SERVICIOS_COMUNES}
                  onChange={v => setSelectedServicios(v || [])}
                  formatCreateLabel={(inputValue) => `Crear servicio "${inputValue}"`}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: 'var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      minHeight: '42px',
                      boxShadow: 'none',
                      '&:hover': {
                        borderColor: 'var(--color-border-hover)'
                      }
                    })
                  }}
                />
              </div>
            </div>

            {/* Calificación */}
            <div style={{ display: 'flex', gap: '40px', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
              <StarRating 
                label="Presupuesto del Cliente" 
                value={prospecto.presupuesto} 
                onChange={v => setProspecto({...prospecto, presupuesto: v})} 
              />
              <StarRating 
                label="Necesidad / Urgencia" 
                value={prospecto.necesidad} 
                onChange={v => setProspecto({...prospecto, necesidad: v})} 
              />
            </div>

            {/* Adjuntos */}
            <div className="field">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Enlaces y Archivos Adjuntos</span>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <label style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    <Upload size={14} /> Subir archivo
                    <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingFile} />
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setAdjuntosParsed([...adjuntosList, { titulo: '', url: '' }])}
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
                  >
                    <Link size={14} /> Añadir link
                  </button>
                </div>
              </label>
              {uploadingFile && <p style={{ fontSize: '0.85rem', color: '#f59e0b', margin: '4px 0' }}>Subiendo archivo...</p>}
              {adjuntosList.length === 0 && !uploadingFile && <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No hay adjuntos.</p>}
              {adjuntosList.map((adj, i) => {
                const isUploaded = adj.url && adj.url.includes('supabase.co/storage')
                return (
                  <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', background: isUploaded ? 'var(--color-surface2)' : 'transparent', padding: isUploaded ? '6px 10px' : '0', borderRadius: 'var(--radius-sm)' }}>
                    {isUploaded ? (
                      <>
                        <DownloadCloud size={16} className="text-primary" />
                        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {adj.titulo || 'Archivo adjunto'}
                        </span>
                        <a href={adj.url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'white' }}>
                          Descargar
                        </a>
                        <button type="button" onClick={() => removeAdjunto(i)} className="btn btn-secondary" style={{ padding: '6px', color: 'var(--color-danger)', background: 'white', border: '1px solid var(--color-border)' }}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <input 
                          type="text" 
                          placeholder="Título (Ej: Carpeta Drive)" 
                          value={adj.titulo}
                          onChange={e => handleAdjuntoChange(i, 'titulo', e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <input 
                          type="url" 
                          placeholder="https://..." 
                          value={adj.url}
                          onChange={e => handleAdjuntoChange(i, 'url', e.target.value)}
                          style={{ flex: 2 }}
                        />
                        <button 
                          type="button" 
                          onClick={() => removeAdjunto(i)}
                          className="btn btn-secondary" 
                          style={{ padding: '8px', color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={18} />
                {saving ? 'Procesando...' : 'Guardar y Planificar Siguiente Acción'}
              </button>
            </div>
          </form>
        </div>
        </div>
        )}

        {/* PESTAÑA 2: MARKETING Y VENTA */}
        {(!esNuevo && activeTab === 'seguimiento') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* PRÓXIMA TAREA CARD */}
              <div className="card" style={{ background: 'var(--color-surface2)', border: '2px solid var(--color-primary-light)' }}>
                <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                  <FolderKanban size={20} className="text-primary" />
                  Planificación: Próxima Tarea
                </h3>
                
                <div className="field">
                  <label>Tipo de Tarea</label>
                  <select 
                    value={prospecto.proxima_tarea_tipo || ''} 
                    onChange={e => setProspecto({...prospecto, proxima_tarea_tipo: e.target.value})}
                    style={{ background: 'white' }}
                  >
                    <option value="">(Sin definir)</option>
                    {TIPOS_TAREA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label>Comentario / Detalle</label>
                  <input 
                    type="text" 
                    value={prospecto.proxima_tarea_comentario || ''} 
                    onChange={e => setProspecto({...prospecto, proxima_tarea_comentario: e.target.value})}
                    placeholder="Ej. Enviar propuesta ajustada"
                    style={{ background: 'white' }}
                  />
                </div>

                <div className="field">
                  <label>Fecha programada</label>
                  <input 
                    type="date" 
                    value={prospecto.fecha_proxima_tarea || ''} 
                    onChange={e => setProspecto({...prospecto, fecha_proxima_tarea: e.target.value})}
                    style={{ background: 'white' }}
                  />
                </div>

                <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }} onClick={handleUpdateTarea} disabled={saving}>
                  <Save size={16} /> 
                  {saving ? 'Guardando...' : 'Actualizar Tarea'}
                </button>
              </div>

            </div>

            {/* HISTORIAL DE OBSERVACIONES */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} className="text-primary" />
                Historial de Observaciones
              </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <textarea 
                placeholder="Añadir una nueva nota al historial..."
                value={nuevaObsTexto}
                onChange={e => setNuevaObsTexto(e.target.value)}
                rows={3}
                style={{ marginBottom: '8px' }}
              />
              <button 
                onClick={handleAddObservacion} 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={savingObs || !nuevaObsTexto.trim()}
              >
                {savingObs ? 'Guardando...' : 'Agregar Nota'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '500px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {observaciones.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>No hay observaciones aún.</p>
              ) : (
                observaciones.map(obs => (
                  <div key={obs.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#334155' }}>{obs.observacion}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} /> 
                        {obs.usuarios ? `${obs.usuarios.nombre} ${obs.usuarios.apellido}` : 'Sistema'}
                      </span>
                      <span>{new Date(obs.fecha || obs.created_at || new Date()).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}

        {/* PESTAÑA 3: GESTIÓN Y OPERACIONES */}
        {(!esNuevo && activeTab === 'gestion') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* PANEL DE PRODUCCIÓN */}
            <div className="card" style={{ borderLeft: '4px solid var(--color-success)' }}>
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} className="text-success" />
                Control de Producción y Facturación
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div className="field">
                  <label>Horas Mensuales</label>
                  <input 
                    type="number" 
                    value={prospecto.hs_mensuales || ''} 
                    onChange={e => setProspecto({...prospecto, hs_mensuales: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Mensualidad Actual</label>
                  <input 
                    type="number" 
                    value={prospecto.mensualidad_vigente_actual || ''} 
                    onChange={e => setProspecto({...prospecto, mensualidad_vigente_actual: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Moneda de Cobro</label>
                  <select 
                    value={prospecto.moneda_cobro || 'Pesos'} 
                    onChange={e => setProspecto({...prospecto, moneda_cobro: e.target.value})}
                  >
                    <option value="Pesos">Pesos</option>
                    <option value="Dolar">Dólar</option>
                  </select>
                </div>
                <div className="field">
                  <label>Índice de Ajuste</label>
                  <select 
                    value={prospecto.indice_cobro || ''} 
                    onChange={e => setProspecto({...prospecto, indice_cobro: e.target.value})}
                  >
                    <option value="">(Ninguno)</option>
                    <option value="UVA">UVA</option>
                    <option value="Dólar">Dólar</option>
                  </select>
                </div>
                <div className="field">
                  <label>Valor Base (Índice)</label>
                  <input 
                    type="number" 
                    value={prospecto.base_indice_valor || ''} 
                    onChange={e => setProspecto({...prospecto, base_indice_valor: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Inicio de Servicio</label>
                  <input 
                    type="date" 
                    value={prospecto.inicio_servicio || ''} 
                    onChange={e => setProspecto({...prospecto, inicio_servicio: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Próxima Factura</label>
                  <input 
                    type="date" 
                    value={prospecto.proxima_factura || ''} 
                    onChange={e => setProspecto({...prospecto, proxima_factura: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Última Act. Tarifa</label>
                  <input
                    type="date"
                    value={prospecto.ultima_actualizacion_tarifa || ''}
                    onChange={e => setProspecto({...prospecto, ultima_actualizacion_tarifa: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Próx. Act. Tarifa <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(automático)</span></label>
                  <input
                    type="date"
                    disabled
                    value={prospecto.proxima_actualizacion_tarifa || ''}
                    title="Se calcula sola: Última Act. Tarifa + Frecuencia de Actualización"
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', display: 'flex', gap: '20px' }}>
                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Días e/ Reuniones</label>
                  <input 
                    type="number" 
                    value={prospecto.dias_entre_reuniones || ''} 
                    onChange={e => setProspecto({...prospecto, dias_entre_reuniones: e.target.value})}
                  />
                </div>
                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Frecuencia Act. (meses)</label>
                  <input 
                    type="number" 
                    value={prospecto.frecuencia_actualizacion || ''} 
                    onChange={e => setProspecto({...prospecto, frecuencia_actualizacion: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleOperationalSave} disabled={saving}>
                <Save size={18} />
                {saving ? 'Guardando...' : 'Guardar Cambios Operativos'}
              </button>
            </div>

          </div>
        )}
      </div>

      {/* MODAL DE PLANIFICACIÓN */}
      {showPlanningModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%', animation: 'slideIn 0.3s ease' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderKanban size={24} className="text-primary" />
              Siguiente Acción
            </h2>
            <p style={{ marginBottom: '20px', color: '#64748b', fontSize: '0.95rem' }}>
              Prospecto guardado exitosamente. Ahora, define su estado actual y la próxima tarea.
            </p>
            
            <div className="field">
              <label>Estado del Prospecto</label>
              <select 
                value={planningData.estado} 
                onChange={e => setPlanningData({...planningData, estado: e.target.value})}
                style={{ padding: '10px', fontSize: '1rem' }}
              >
                {ESTADOS_PROSPECTO.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
            
            <div className="field">
              <label>Tipo de Tarea</label>
              <select 
                value={planningData.proxima_tarea_tipo || ''} 
                onChange={e => setPlanningData({...planningData, proxima_tarea_tipo: e.target.value})}
                style={{ padding: '10px', fontSize: '1rem' }}
              >
                <option value="">Seleccionar...</option>
                {TIPOS_TAREA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Comentario adicional</label>
              <input 
                type="text" 
                placeholder="Ej. Llevar muestras"
                value={planningData.proxima_tarea_comentario || ''} 
                onChange={e => setPlanningData({...planningData, proxima_tarea_comentario: e.target.value})} 
                style={{ padding: '10px', fontSize: '1rem' }}
              />
            </div>

            <div className="field">
              <label>Fecha de la próxima tarea</label>
              <input 
                type="date" 
                value={planningData.fecha_proxima_tarea} 
                onChange={e => setPlanningData({...planningData, fecha_proxima_tarea: e.target.value})} 
                style={{ padding: '10px', fontSize: '1rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowPlanningModal(false)
                  navigate('/prospectos')
                }}
                style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
              >
                Omitir
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleFinalSave}
                style={{ flex: 2, padding: '10px', justifyContent: 'center' }}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CAMBIO DE ESTADO */}
      {showStatusModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RefreshCw size={24} className="text-primary" />
                Actualizar Estado
              </h2>
              <button className="btn-close" onClick={() => setShowStatusModal(false)}><X /></button>
            </div>
            
            <div className="modal-body" style={{ display: 'grid', gap: '20px' }}>
              <div className="field">
                <label>Nuevo Estado</label>
                <select 
                  value={newStatusData.estado} 
                  onChange={e => setNewStatusData({...newStatusData, estado: e.target.value})}
                  style={{ padding: '10px', fontSize: '1rem' }}
                >
                  {ESTADOS_PROSPECTO.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              {/* CAMPOS EXTRA SI ES PRODUCCIÓN */}
              {newStatusData.estado.includes('6A') && (
                <div style={{ 
                  background: 'var(--color-surface2)', 
                  padding: '20px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--color-primary-light)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px'
                }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', marginBottom: '5px' }}>
                      <Plus size={18} /> Datos de Producción
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>Por favor, completa estos datos para activar la producción.</p>
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Inicio de Servicio</label>
                    <input 
                      type="date" 
                      value={newStatusData.inicio_servicio} 
                      onChange={e => setNewStatusData({...newStatusData, inicio_servicio: e.target.value})} 
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CreditCard size={14} /> Próxima Factura</label>
                    <input 
                      type="date" 
                      value={newStatusData.proxima_factura} 
                      onChange={e => setNewStatusData({...newStatusData, proxima_factura: e.target.value})} 
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Horas Mensuales</label>
                    <input 
                      type="number" 
                      value={newStatusData.hs_mensuales} 
                      onChange={e => setNewStatusData({...newStatusData, hs_mensuales: e.target.value})} 
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14} /> Moneda</label>
                    <select 
                      value={newStatusData.moneda_cobro} 
                      onChange={e => setNewStatusData({...newStatusData, moneda_cobro: e.target.value})}
                    >
                      <option value="ARS">Pesos (ARS)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={14} /> Índice</label>
                    <select 
                      value={newStatusData.indice_cobro} 
                      onChange={e => setNewStatusData({...newStatusData, indice_cobro: e.target.value})}
                    >
                      <option value="UVA">UVA</option>
                      <option value="Dolar">Dólar</option>
                      <option value="Ninguno">Ninguno</option>
                    </select>
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14} /> Mensualidad Vigente</label>
                    <input 
                      type="number" 
                      placeholder="Ej. 987100"
                      value={newStatusData.mensualidad_vigente_actual} 
                      onChange={e => setNewStatusData({...newStatusData, mensualidad_vigente_actual: e.target.value})} 
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14} /> Base (Índice)</label>
                    <input 
                      type="number" 
                      placeholder="Ej. 537"
                      value={newStatusData.base_indice_valor} 
                      onChange={e => setNewStatusData({...newStatusData, base_indice_valor: e.target.value})} 
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Próx. Act. Tarifa</label>
                    <input 
                      type="date" 
                      value={newStatusData.proxima_actualizacion_tarifa} 
                      onChange={e => setNewStatusData({...newStatusData, proxima_actualizacion_tarifa: e.target.value})} 
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Última Act. Tarifa</label>
                    <input 
                      type="date" 
                      value={newStatusData.ultima_actualizacion_tarifa} 
                      onChange={e => setNewStatusData({...newStatusData, ultima_actualizacion_tarifa: e.target.value})} 
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> Días e/ Reuniones</label>
                    <input 
                      type="number" 
                      value={newStatusData.dias_entre_reuniones} 
                      onChange={e => setNewStatusData({...newStatusData, dias_entre_reuniones: e.target.value})} 
                    />
                  </div>

                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={14} /> Frecuencia Actualización (Meses)</label>
                    <input 
                      type="number" 
                      value={newStatusData.frecuencia_actualizacion} 
                      onChange={e => setNewStatusData({...newStatusData, frecuencia_actualizacion: e.target.value})} 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleStatusUpdate} disabled={saving}>
                <Save size={18} />
                {saving ? 'Guardando...' : 'Confirmar Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

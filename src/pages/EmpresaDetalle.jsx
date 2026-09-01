import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Building2, Plus, ChevronRight, Globe, FileText, Calendar, Users, Target } from 'lucide-react'
import { getEmpresaById, saveEmpresa, deleteEmpresa, getEmpresas, saveRazonSocial, deleteRazonSocial } from '../services/empresas'
import { getContactos, saveContacto } from '../services/contactos'
import { useData } from '../context/DataContext'

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

export default function EmpresaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNueva = id === 'nueva'
  const { refreshEmpresas, refreshContactos, refreshProspectos, refreshProyectos } = useData()

  // Tras guardar/borrar, invalidamos la caché global (DataContext, TTL 90s) y
  // refetcheamos en segundo plano, así las listas no quedan con datos viejos
  // al volver sin apretar F5. `cascada` = true al borrar la empresa, que
  // arrastra contactos, prospectos y proyectos.
  function invalidarCacheEmpresas({ tambienContactos = false, cascada = false } = {}) {
    refreshEmpresas?.({ silencioso: true, forzar: true })
    if (tambienContactos || cascada) refreshContactos?.({ silencioso: true, forzar: true })
    if (cascada) {
      refreshProspectos?.({ silencioso: true, forzar: true })
      refreshProyectos?.({ silencioso: true, forzar: true })
    }
  }

  const [empresa, setEmpresa] = useState({
    nombre: '',
    pais: 'Argentina',
    provincia: '',
    industria: '',
    tamanio: '',
    dias_espera_facturacion: 4
  })

  const [razonesSociales, setRazonesSociales] = useState([])
  const [nuevaRazon, setNuevaRazon] = useState({ razon_social: '', cuit: '' })
  const [savingRazon, setSavingRazon] = useState(false)

  const [modoContacto, setModoContacto] = useState('nuevo') // 'nuevo' o 'existente'
  const [contactoSeleccionadoId, setContactoSeleccionadoId] = useState('')
  const [contactoPrincipal, setContactoPrincipal] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: ''
  })
  
  const [industriasExistentes, setIndustriasExistentes] = useState([])
  const [todosLosContactos, setTodosLosContactos] = useState([])
  const [contactos, setContactos] = useState([])
  const [prospectos, setProspectos] = useState([])
  
  const [loading, setLoading] = useState(!esNueva)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarAuxiliares()
    if (!esNueva) cargarDatos()
  }, [id])

  async function cargarAuxiliares() {
    try {
      const [empData, contData] = await Promise.all([
        getEmpresas(),
        getContactos()
      ])
      const unicas = [...new Set(empData.map(e => e.industria).filter(Boolean))]
      setIndustriasExistentes(unicas)
      setTodosLosContactos(contData)
    } catch (err) {
      console.error('Error cargando auxiliares:', err)
    }
  }

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getEmpresaById(id)
      setEmpresa({
        id: data.id,
        nombre: data.nombre || '',
        pais: data.pais || 'Argentina',
        provincia: data.provincia || '',
        industria: data.industria || '',
        tamanio: data.tamanio || '',
        dias_espera_facturacion: data.dias_espera_facturacion ?? 4
      })
      setContactos(data.contactos || [])
      setProspectos(data.prospectos || [])
      setRazonesSociales(data.razones_sociales || [])
    } catch (err) {
      console.error(err)
      setError('Error al cargar la empresa.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    
    // Validación de contacto para empresas nuevas
    if (esNueva) {
      if (modoContacto === 'nuevo' && (!contactoPrincipal.nombre || !contactoPrincipal.apellido)) {
        setError('Es obligatorio completar los datos del nuevo contacto principal.')
        return
      }
      if (modoContacto === 'existente' && !contactoSeleccionadoId) {
        setError('Es obligatorio seleccionar un contacto existente.')
        return
      }
    }

    setSaving(true)
    setError('')
    try {
      const datosAEnviar = { ...empresa }
      if (datosAEnviar.tamanio === '') delete datosAEnviar.tamanio
      
      const saved = await saveEmpresa(datosAEnviar)
      
      // Si es nueva, gestionamos el contacto
      if (esNueva) {
        if (modoContacto === 'nuevo') {
          await saveContacto({
            ...contactoPrincipal,
            empresa_id: saved.id,
            activo: true
          })
        } else {
          // Solo actualizamos el vínculo del contacto existente con la nueva empresa
          // (enviamos solo id y empresa_id para no romper con los datos relacionados)
          await saveContacto({ id: contactoSeleccionadoId, empresa_id: saved.id })
        }
        invalidarCacheEmpresas({ tambienContactos: true })
        navigate(`/empresas/${saved.id}`, { replace: true })
      } else {
        invalidarCacheEmpresas()
        alert('Datos guardados correctamente')
      }
    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function asociarContacto(contactoId) {
    if (!contactoId) return
    try {
      const contacto = todosLosContactos.find(c => c.id === contactoId)
      await saveContacto({ ...contacto, empresa_id: id })
      refreshContactos?.({ silencioso: true, forzar: true })
      cargarDatos() // Recargamos para ver el nuevo contacto
    } catch (err) {
      alert('Error al asociar contacto')
    }
  }

  async function agregarRazonSocial(e) {
    e.preventDefault()
    if (!nuevaRazon.razon_social.trim()) return
    setSavingRazon(true)
    try {
      const guardada = await saveRazonSocial({ ...nuevaRazon, empresa_id: id })
      setRazonesSociales(prev => [...prev, guardada])
      setNuevaRazon({ razon_social: '', cuit: '' })
    } catch (err) {
      console.error(err)
      alert('Error al guardar la razón social: ' + (err.message || 'Error desconocido'))
    } finally {
      setSavingRazon(false)
    }
  }

  async function quitarRazonSocial(razonId) {
    if (!window.confirm('¿Eliminar esta razón social?')) return
    try {
      await deleteRazonSocial(razonId)
      setRazonesSociales(prev => prev.filter(r => r.id !== razonId))
    } catch (err) {
      console.error(err)
      alert('Error al eliminar la razón social: ' + (err.message || 'Error desconocido'))
    }
  }

  async function handleDelete() {
    const confirmar = window.confirm(
      '¿ESTÁS SEGURO? \n\n' +
      'Eliminar esta empresa también borrará permanentemente: \n' +
      '• Todos sus contactos asociados \n' +
      '• Todos sus prospectos y proyectos \n' +
      '• Sus razones sociales y credenciales \n\n' +
      'Esta acción no se puede deshacer.'
    )
    
    if (!confirmar) return

    setSaving(true)
    try {
      await deleteEmpresa(id)
      invalidarCacheEmpresas({ cascada: true })
      navigate('/empresas')
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar la empresa. Es posible que tenga facturas u otros datos protegidos.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando ficha...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '1200px' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/empresas')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{esNueva ? 'Nueva Empresa' : empresa.nombre}</h1>
            <p className="page-subtitle">{esNueva ? 'Registro de nuevo cliente' : 'Gestión de ficha corporativa'}</p>
          </div>
        </div>
        {!esNueva && (
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={18} />
            Eliminar
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* COLUMNA 1: DATOS Y RAZONES */}
        <div style={{ display: 'grid', gap: '24px' }}>
          <form onSubmit={handleSave} className="card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} className="text-primary" />
              Datos Institucionales
            </h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="field">
                <label>Nombre Comercial *</label>
                <input type="text" required value={empresa.nombre} onChange={e => setEmpresa({...empresa, nombre: e.target.value})} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="field">
                  <label>País</label>
                  <select value={empresa.pais} onChange={e => setEmpresa({...empresa, pais: e.target.value, provincia: ''})}>
                    {PAISES_LATAM.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Provincia</label>
                  {empresa.pais === 'Argentina' ? (
                    <select value={empresa.provincia} onChange={e => setEmpresa({...empresa, provincia: e.target.value})}>
                      <option value="">Seleccionar...</option>
                      {PROVINCIAS_AR.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={empresa.provincia} onChange={e => setEmpresa({...empresa, provincia: e.target.value})} />
                  )}
                </div>
              </div>

              <div className="field">
                <label>Industria / Sector</label>
                <input type="text" list="industrias-list" value={empresa.industria} onChange={e => setEmpresa({...empresa, industria: e.target.value})} />
                <datalist id="industrias-list">
                  {industriasExistentes.map(ind => <option key={ind} value={ind} />)}
                </datalist>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="field">
                  <label>Tamaño (empleados)</label>
                  <input type="number" value={empresa.tamanio} onChange={e => setEmpresa({...empresa, tamanio: e.target.value})} />
                </div>
                <div className="field">
                  <label>Días espera facturación</label>
                  <input type="number" value={empresa.dias_espera_facturacion} onChange={e => setEmpresa({...empresa, dias_espera_facturacion: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '10px' }}>
                <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Datos'}
              </button>
            </div>
          </form>

          {/* CONTACTO PRINCIPAL (Solo al crear empresa nueva) */}
          {esNueva && (
            <div className="card" style={{ borderColor: 'var(--color-primary)' }}>
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} className="text-primary" />
                Contacto de Referencia (Obligatorio)
              </h3>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--color-surface2)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
                <button 
                  type="button"
                  onClick={() => setModoContacto('nuevo')}
                  style={{ 
                    flex: 1, padding: '8px', border: 'none', borderRadius: 'var(--radius-sm)',
                    background: modoContacto === 'nuevo' ? 'var(--color-primary)' : 'transparent',
                    color: modoContacto === 'nuevo' ? 'white' : 'inherit',
                    cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s'
                  }}
                >
                  Crear Nuevo
                </button>
                <button 
                  type="button"
                  onClick={() => setModoContacto('existente')}
                  style={{ 
                    flex: 1, padding: '8px', border: 'none', borderRadius: 'var(--radius-sm)',
                    background: modoContacto === 'existente' ? 'var(--color-primary)' : 'transparent',
                    color: modoContacto === 'existente' ? 'white' : 'inherit',
                    cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s'
                  }}
                >
                  Elegir Existente
                </button>
              </div>

              {modoContacto === 'nuevo' ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="field">
                      <label>Nombre *</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Juan"
                        value={contactoPrincipal.nombre} 
                        onChange={e => setContactoPrincipal({...contactoPrincipal, nombre: e.target.value})} 
                      />
                    </div>
                    <div className="field">
                      <label>Apellido *</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Pérez"
                        value={contactoPrincipal.apellido} 
                        onChange={e => setContactoPrincipal({...contactoPrincipal, apellido: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input 
                      type="email" 
                      placeholder="juan@email.com"
                      value={contactoPrincipal.email} 
                      onChange={e => setContactoPrincipal({...contactoPrincipal, email: e.target.value})} 
                    />
                  </div>
                  <div className="field">
                    <label>Teléfono / WhatsApp</label>
                    <input 
                      type="text" 
                      placeholder="+54 9 342..."
                      value={contactoPrincipal.telefono} 
                      onChange={e => setContactoPrincipal({...contactoPrincipal, telefono: e.target.value})} 
                    />
                  </div>
                </div>
              ) : (
                <div className="field">
                  <label>Seleccionar contacto de la lista *</label>
                  <select 
                    value={contactoSeleccionadoId} 
                    onChange={e => setContactoSeleccionadoId(e.target.value)}
                  >
                    <option value="">Buscar contacto...</option>
                    {todosLosContactos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.apellido} {c.empresas?.nombre ? `(${c.empresas.nombre})` : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '11px', marginTop: '8px', opacity: 0.6 }}>
                    * Al seleccionar un contacto, este se vinculará a la nueva empresa al guardar.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} className="text-primary" />
              Facturación (Razones Sociales)
            </h3>

            {esNueva ? (
              <p className="text-muted text-sm">Guardá primero los datos institucionales para poder cargar razones sociales.</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {razonesSociales.length === 0 && (
                  <p className="text-muted text-sm">Sin razones sociales cargadas.</p>
                )}
                {razonesSociales.map(rs => (
                  <div key={rs.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{rs.razon_social}</div>
                      <div style={{ fontSize: '11px', opacity: 0.6 }}>{rs.cuit || 'Sin CUIT'}</div>
                    </div>
                    <button type="button" className="btn btn-icon text-danger" onClick={() => quitarRazonSocial(rs.id)} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* <div>, no <form>: esta sección vive dentro del <form onSubmit={handleSave}>
                    de la empresa, y un <form> anidado hace que el "submit" burbujee hasta
                    ese form externo y también dispare handleSave (re-guardando la empresa,
                    y navegando a otra pantalla si es una empresa nueva). */}
                <div
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarRazonSocial(e) } }}
                  style={{ display: 'grid', gap: '8px', marginTop: '8px' }}
                >
                  <div className="field" style={{ marginBottom: 0 }}>
                    <input
                      type="text"
                      placeholder="Razón Social"
                      value={nuevaRazon.razon_social}
                      onChange={e => setNuevaRazon({...nuevaRazon, razon_social: e.target.value})}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <input
                      type="text"
                      placeholder="CUIT"
                      value={nuevaRazon.cuit}
                      onChange={e => setNuevaRazon({...nuevaRazon, cuit: e.target.value})}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={agregarRazonSocial} disabled={savingRazon || !nuevaRazon.razon_social.trim()}>
                    <Plus size={14} /> {savingRazon ? 'Guardando...' : 'Agregar Razón Social'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA 2: CONTACTOS Y PROSPECTOS */}
        {!esNueva && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} className="text-primary" /> Contactos
                </h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/contactos/nuevo?empresa=' + id)}>
                  <Plus size={14} /> Nuevo
                </button>
              </div>
              
              <div className="field" style={{ marginBottom: '16px' }}>
                <select onChange={e => asociarContacto(e.target.value)} value="">
                  <option value="">Asociar contacto existente...</option>
                  {todosLosContactos.filter(c => c.empresa_id !== id).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} {c.apellido} ({c.empresas?.nombre || 'Sin empresa'})</option>
                  ))}
                </select>
              </div>

              {contactos.length === 0 ? (
                <p className="text-muted text-sm">Sin contactos asociados.</p>
              ) : (
                <div className="list-group">
                  {contactos.map(c => (
                    <div key={c.id} className="list-item" onClick={() => navigate(`/contactos/${c.id}`)}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '500' }}>{c.nombre} {c.apellido}</span>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>{c.cargo || 'Contacto'}</span>
                      </div>
                      <ChevronRight size={14} opacity={0.3} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={20} className="text-primary" /> Prospectos / Proyectos
              </h3>
              {prospectos.length === 0 ? (
                <p className="text-muted text-sm">Esta empresa no tiene proyectos registrados.</p>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {prospectos.map(p => (
                    <div key={p.id} className="list-item" onClick={() => navigate(`/prospectos/${p.id}`)} style={{ padding: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: '600', fontSize: '14px' }}>{p.nombre}</span>
                          <span className={`badge ${(p.estado || '').includes('A') ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '10px' }}>
                            {p.estado || 'Sin estado'}
                          </span>
                        </div>
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', opacity: 0.7 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} /> {new Date(p.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} opacity={0.3} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

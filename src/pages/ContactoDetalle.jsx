import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, UserMinus, UserPlus, User, FolderKanban, ChevronRight, Building2, Plus, X } from 'lucide-react'
import { getContactoById, saveContacto, desactivarContacto, activarContacto, getContactos } from '../services/contactos'
import { getEmpresas, saveEmpresa } from '../services/empresas'

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

export default function ContactoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nuevo'

  const [contacto, setContacto] = useState({
    nombre: '',
    apellido: '',
    empresa_id: '',
    telefono: '',
    email: '',
    cargo: '',
    area: '',
    activo: true
  })
  const [empresas, setEmpresas] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [cargosExistentes, setCargosExistentes] = useState([])
  const [areasExistentes, setAreasExistentes] = useState([])

  // Estado para crear nueva empresa al vuelo
  const [showNuevaEmpresa, setShowNuevaEmpresa] = useState(false)
  const [creandoEmpresa, setCreandoEmpresa] = useState(false)
  const [industriasExistentes, setIndustriasExistentes] = useState([])
  const [nuevaEmpresa, setNuevaEmpresa] = useState({
    nombre: '',
    pais: 'Argentina',
    provincia: '',
    industria: '',
    tamaño_personas: '',
    dias_espera_facturacion: 4
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [empresasData, todosContactos] = await Promise.all([
        getEmpresas(),
        getContactos()
      ])
      setEmpresas(empresasData)

      // Extraer cargos, áreas e industrias únicas de los datos existentes
      const cargos = [...new Set(todosContactos.map(c => c.cargo).filter(Boolean))].sort()
      const areas  = [...new Set(todosContactos.map(c => c.area).filter(Boolean))].sort()
      const industrias = [...new Set(empresasData.map(e => e.industria).filter(Boolean))].sort()
      setCargosExistentes(cargos)
      setAreasExistentes(areas)
      setIndustriasExistentes(industrias)

      if (!esNuevo) {
        const data = await getContactoById(id)
        setContacto({
          id: data.id,
          nombre: data.nombre || '',
          apellido: data.apellido || '',
          empresa_id: data.empresa_id || '',
          telefono: data.telefono || '',
          email: data.email || '',
          cargo: data.cargo || '',
          area: data.area || '',
          activo: data.activo !== false
        })
        setProspectos(data.prospectos || [])
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos.')
    } finally {
      setLoading(false)
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
        dias_espera_facturacion: Number(nuevaEmpresa.dias_espera_facturacion) || 4
      })
      setEmpresas(prev => [...prev, saved].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setContacto(prev => ({ ...prev, empresa_id: saved.id }))
      setShowNuevaEmpresa(false)
      setNuevaEmpresa({ nombre: '', pais: 'Argentina', provincia: '', industria: '', tamaño_personas: '', dias_espera_facturacion: 4 })
    } catch (err) {
      alert('Error al crear la empresa. Intente nuevamente.')
    } finally {
      setCreandoEmpresa(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')

    // Validaciones explícitas
    if (!contacto.empresa_id) {
      setError('La empresa es obligatoria. Seleccioná una existente o creá una nueva.')
      return
    }
    if (!contacto.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!contacto.telefono.trim()) {
      setError('El teléfono es obligatorio.')
      return
    }
    if (!contacto.cargo.trim()) {
      setError('El cargo es obligatorio.')
      return
    }
    if (!contacto.area.trim()) {
      setError('El área es obligatoria.')
      return
    }

    setSaving(true)
    try {
      const saved = await saveContacto({ ...contacto })
      if (esNuevo) {
        navigate(`/contactos/${saved.id}`, { replace: true })
      }
    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo() {
    const accion = contacto.activo ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Estás seguro de ${accion} este contacto?`)) return
    try {
      if (contacto.activo) {
        await desactivarContacto(id)
        setContacto(prev => ({ ...prev, activo: false }))
      } else {
        await activarContacto(id)
        setContacto(prev => ({ ...prev, activo: true }))
      }
    } catch (err) {
      alert(`Error al ${accion} el contacto`)
    }
  }

  const getEstadoColor = (estado) => {
    switch (estado?.toLowerCase()) {
      case 'nuevo': return 'badge-gray'
      case 'contactado': return 'badge-blue'
      case 'propuesta': return 'badge-orange'
      case 'negociación': return 'badge-purple'
      case 'ganado': return 'badge-green'
      case 'perdido': return 'badge-red'
      default: return 'badge-gray'
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando datos...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '800px' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/contactos')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {esNuevo ? 'Nuevo Contacto' : `${contacto.nombre} ${contacto.apellido}`}
              {!esNuevo && !contacto.activo && (
                <span style={{ fontSize: '13px', fontWeight: 500, background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', borderRadius: '999px', padding: '2px 10px' }}>Inactivo</span>
              )}
            </h1>
            <p className="page-subtitle">{esNuevo ? 'Completa los datos del contacto' : 'Detalles del contacto'}</p>
          </div>
        </div>
        {!esNuevo && (
          <button
            className="btn btn-secondary"
            onClick={handleToggleActivo}
            style={{
              color: contacto.activo ? 'var(--color-danger)' : 'var(--color-success)',
              borderColor: contacto.activo ? 'var(--color-danger)' : 'var(--color-success)',
              background: 'transparent'
            }}
          >
            {contacto.activo ? <UserMinus size={18} /> : <UserPlus size={18} />}
            {contacto.activo ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'grid', gap: '24px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={20} className="text-primary" />
            Datos del Contacto
          </h3>

          <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px' }}>

            {/* EMPRESA — OBLIGATORIA */}
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
                value={contacto.empresa_id || ''}
                onChange={e => setContacto({ ...contacto, empresa_id: e.target.value })}
                style={{ borderColor: !contacto.empresa_id && error ? 'var(--color-danger)' : undefined }}
              >
                <option value="">Seleccionar empresa...</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>

              {/* CREAR EMPRESA RÁPIDA — FORMULARIO COMPLETO */}
              {showNuevaEmpresa && (
                <div style={{
                  marginTop: '12px',
                  padding: '16px',
                  background: 'var(--color-surface2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-primary)',
                  display: 'grid',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>Nueva Empresa</span>
                    <button type="button" onClick={() => setShowNuevaEmpresa(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="field">
                    <label>Nombre Comercial *</label>
                    <input type="text" autoFocus placeholder="Nombre de la empresa" value={nuevaEmpresa.nombre} onChange={e => setNuevaEmpresa({...nuevaEmpresa, nombre: e.target.value})} />
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
                      <label>Días espera facturación *</label>
                      <input type="number" min="1" value={nuevaEmpresa.dias_espera_facturacion} onChange={e => setNuevaEmpresa({...nuevaEmpresa, dias_espera_facturacion: e.target.value})} />
                    </div>
                  </div>

                  <button type="button" className="btn btn-primary w-full" onClick={crearEmpresaRapida} disabled={creandoEmpresa}>
                    {creandoEmpresa ? 'Creando empresa...' : 'Crear y seleccionar empresa'}
                  </button>
                </div>
              )}
            </div>

            {/* NOMBRE Y APELLIDO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label>Nombre *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan"
                  value={contacto.nombre}
                  onChange={e => setContacto({ ...contacto, nombre: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Apellido</label>
                <input
                  type="text"
                  placeholder="Ej: Pérez"
                  value={contacto.apellido}
                  onChange={e => setContacto({ ...contacto, apellido: e.target.value })}
                />
              </div>
            </div>

            {/* TELÉFONO Y EMAIL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label>Teléfono / WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="+54 9 342..."
                  value={contacto.telefono}
                  onChange={e => setContacto({ ...contacto, telefono: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="juan@empresa.com"
                  value={contacto.email}
                  onChange={e => setContacto({ ...contacto, email: e.target.value })}
                />
              </div>
            </div>

            {/* CARGO Y ÁREA — con autocompletado basado en datos existentes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label>Cargo *</label>
                <input
                  type="text"
                  list="cargos-list"
                  required
                  placeholder="Ej: Gerente de IT"
                  value={contacto.cargo}
                  onChange={e => setContacto({ ...contacto, cargo: e.target.value })}
                />
                <datalist id="cargos-list">
                  {cargosExistentes.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="field">
                <label>Área *</label>
                <input
                  type="text"
                  list="areas-list"
                  required
                  placeholder="Ej: Administración"
                  value={contacto.area}
                  onChange={e => setContacto({ ...contacto, area: e.target.value })}
                />
                <datalist id="areas-list">
                  {areasExistentes.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={18} />
                {saving ? 'Guardando...' : 'Guardar Datos'}
              </button>
            </div>
          </form>
        </div>

        {/* PROSPECTOS ASOCIADOS */}
        {!esNuevo && (
          <div className="card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderKanban size={20} className="text-primary" />
              Prospectos / Oportunidades
            </h3>
            {prospectos.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Este contacto no tiene prospectos asociados.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Estado</th>
                      <th>Próx. Tarea</th>
                      <th style={{ width: '80px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospectos.map(p => (
                      <tr key={p.id} onClick={() => navigate(`/prospectos/${p.id}`)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                        <td>
                          <span className={`badge ${getEstadoColor(p.estado)}`}>
                            {p.estado || 'Nuevo'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {p.proxima_tarea || '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <ChevronRight size={16} style={{ opacity: 0.3 }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

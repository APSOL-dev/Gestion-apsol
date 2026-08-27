import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, Landmark, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import { saveCuentaBancaria, deleteCuentaBancaria } from '../services/cuentasBancarias'

const CUENTA_VACIA = {
  banco: '',
  tipo_cuenta: 'Cuenta Corriente',
  moneda: 'ARS',
  cbu: '',
  alias: '',
  titular: '',
  nombre_interno: '',
  cuit: '',
  red: '',
  wallet_address: '',
  direccion_banco: '',
  numero_ruta_aba: '',
  codigo_swift: '',
  numero_cuenta_intl: ''
}

export default function CuentasBancarias() {
  const { cuentasBancarias, loadingCuentasBancarias, refreshCuentasBancarias } = useData()
  const [mostrandoForm, setMostrandoForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cuenta, setCuenta] = useState({ ...CUENTA_VACIA })
  const [eliminandoId, setEliminandoId] = useState(null)

  const editando = Boolean(cuenta.id)
  const esCripto = cuenta.tipo_cuenta === 'Cripto'
  const esInternacional = cuenta.tipo_cuenta === 'Transferencia Internacional'
  const esEfectivo = cuenta.tipo_cuenta === 'Efectivo'
  const esLocal = !esCripto && !esInternacional && !esEfectivo

  useEffect(() => {
    const esSilencioso = cuentasBancarias.length > 0
    refreshCuentasBancarias(esSilencioso)
  }, [])

  function abrirNueva() {
    setCuenta({ ...CUENTA_VACIA })
    setMostrandoForm(true)
  }

  function abrirEdicion(c) {
    setCuenta({ ...CUENTA_VACIA, ...c })
    setMostrandoForm(true)
  }

  function cerrarForm() {
    setMostrandoForm(false)
    setCuenta({ ...CUENTA_VACIA })
  }

  async function handleGuardar(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const dataToSave = { ...cuenta }
      if (!dataToSave.nombre_interno) dataToSave.nombre_interno = dataToSave.banco

      await saveCuentaBancaria(dataToSave)
      await refreshCuentasBancarias()
      cerrarForm()
    } catch (err) {
      console.error(err)
      alert('Error al guardar la cuenta: ' + (err.message || 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmarEliminar(id) {
    try {
      await deleteCuentaBancaria(id)
      await refreshCuentasBancarias()
    } catch (err) {
      console.error(err)
      alert('Error al eliminar: ' + (err.message || 'Error desconocido'))
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuentas Bancarias</h1>
          <p className="page-subtitle">Gestiona las cuentas de destino para cobros o pagos</p>
        </div>
        <button className="btn btn-primary" onClick={() => (mostrandoForm ? cerrarForm() : abrirNueva())}>
          <Plus size={18} />
          {mostrandoForm ? 'Cancelar' : 'Nueva Cuenta'}
        </button>
      </div>

      {mostrandoForm && (
        <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--color-primary)' }}>
          <form onSubmit={handleGuardar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="field">
              <label>Nombre Interno / Referencia *</label>
              <input
                type="text"
                required
                placeholder="Ej. Galicia Principal, MP Personal"
                value={cuenta.nombre_interno}
                onChange={e => setCuenta({...cuenta, nombre_interno: e.target.value})}
              />
            </div>
            <div className="field">
              <label>Banco / Billetera *</label>
              <input
                type="text"
                required
                placeholder="Ej. Banco Galicia, MercadoPago"
                value={cuenta.banco}
                onChange={e => setCuenta({...cuenta, banco: e.target.value})}
              />
            </div>

            <div className="field">
              <label>Titular de la Cuenta *</label>
              <input
                type="text"
                required
                placeholder="Nombre completo"
                value={cuenta.titular}
                onChange={e => setCuenta({...cuenta, titular: e.target.value})}
              />
            </div>
            <div className="field">
              <label>CUIT del Titular</label>
              <input
                type="text"
                placeholder="20-XXXXXXXX-X"
                value={cuenta.cuit}
                onChange={e => setCuenta({...cuenta, cuit: e.target.value})}
              />
            </div>

            <div className="field">
              <label>Tipo de Cuenta</label>
              <select
                value={cuenta.tipo_cuenta}
                onChange={e => setCuenta({
                  ...cuenta,
                  tipo_cuenta: e.target.value,
                  // Limpiar los campos específicos del tipo anterior para no
                  // arrastrar datos obsoletos (ej. wallet de una cuenta Cripto
                  // que pasa a ser Cuenta Corriente).
                  cbu: '', alias: '', red: '', wallet_address: '',
                  direccion_banco: '', numero_ruta_aba: '', codigo_swift: '', numero_cuenta_intl: ''
                })}
              >
                <option value="Cuenta Corriente">Cuenta Corriente</option>
                <option value="Caja de Ahorro">Caja de Ahorro</option>
                <option value="Billetera Virtual">Billetera Virtual</option>
                <option value="Transferencia Internacional">Transferencia Internacional</option>
                <option value="Cripto">Cripto</option>
                <option value="Efectivo">Efectivo</option>
              </select>
            </div>
            <div className="field">
              <label>Moneda</label>
              <select
                value={cuenta.moneda}
                onChange={e => setCuenta({...cuenta, moneda: e.target.value})}
              >
                <option value="ARS">ARS - Pesos Argentinos</option>
                <option value="USD">USD - Dólares</option>
                <option value="USDT">USDT - Stablecoin</option>
              </select>
            </div>

            {esLocal && (
              <>
                <div className="field">
                  <label>CBU / CVU</label>
                  <input
                    type="text"
                    placeholder="22 dígitos"
                    value={cuenta.cbu}
                    onChange={e => setCuenta({...cuenta, cbu: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Alias</label>
                  <input
                    type="text"
                    placeholder="Alias de la cuenta"
                    value={cuenta.alias}
                    onChange={e => setCuenta({...cuenta, alias: e.target.value})}
                  />
                </div>
              </>
            )}

            {esCripto && (
              <>
                <div className="field">
                  <label>Red</label>
                  <input
                    type="text"
                    placeholder="Ej. Tron - TRX - TRC20"
                    value={cuenta.red}
                    onChange={e => setCuenta({...cuenta, red: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Wallet Address</label>
                  <input
                    type="text"
                    placeholder="Dirección de la wallet"
                    value={cuenta.wallet_address}
                    onChange={e => setCuenta({...cuenta, wallet_address: e.target.value})}
                  />
                </div>
              </>
            )}

            {esInternacional && (
              <>
                <div className="field">
                  <label>Dirección del Banco</label>
                  <input
                    type="text"
                    placeholder="Dirección completa"
                    value={cuenta.direccion_banco}
                    onChange={e => setCuenta({...cuenta, direccion_banco: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Número de Cuenta</label>
                  <input
                    type="text"
                    placeholder="Número de cuenta internacional"
                    value={cuenta.numero_cuenta_intl}
                    onChange={e => setCuenta({...cuenta, numero_cuenta_intl: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Número de Ruta (ABA)</label>
                  <input
                    type="text"
                    placeholder="Routing number"
                    value={cuenta.numero_ruta_aba}
                    onChange={e => setCuenta({...cuenta, numero_ruta_aba: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Código SWIFT</label>
                  <input
                    type="text"
                    placeholder="Ej. CITIUS33"
                    value={cuenta.codigo_swift}
                    onChange={e => setCuenta({...cuenta, codigo_swift: e.target.value})}
                  />
                </div>
              </>
            )}

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Guardar Cuenta Bancaria'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loadingCuentasBancarias ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando cuentas...</p>
        </div>
      ) : cuentasBancarias.length === 0 ? (
        <div className="placeholder-card">
          <Landmark className="placeholder-icon" />
          <h3>No hay cuentas bancarias registradas</h3>
          <p>Crea cuentas para gestionar los pagos e ingresos.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Banco</th>
                  <th>Titular</th>
                  <th>Tipo y Moneda</th>
                  <th>Datos de Cobro</th>
                  <th>Propiedad</th>
                  <th style={{ width: '90px' }}></th>
                </tr>
              </thead>
              <tbody>
                 {cuentasBancarias.map((c) => (
                  <tr key={c.id}>
                    <td onClick={() => abrirEdicion(c)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: '500' }}>{c.banco}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.nombre_interno}</div>
                    </td>
                    <td onClick={() => abrirEdicion(c)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: '500' }}>{c.titular || '-'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.cuit}</div>
                    </td>
                    <td onClick={() => abrirEdicion(c)} style={{ cursor: 'pointer' }}>
                      {c.tipo_cuenta} ({c.moneda})
                    </td>
                    <td onClick={() => abrirEdicion(c)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                        {c.cbu && <span>CBU: <strong style={{ color: 'var(--color-text)' }}>{c.cbu}</strong></span>}
                        {c.alias && <span>Alias: <strong style={{ color: 'var(--color-text)' }}>{c.alias}</strong></span>}
                        {c.wallet_address && <span>{c.red || 'Wallet'}: <strong style={{ color: 'var(--color-text)' }}>{c.wallet_address}</strong></span>}
                        {c.numero_cuenta_intl && <span>Cuenta: <strong style={{ color: 'var(--color-text)' }}>{c.numero_cuenta_intl}</strong></span>}
                        {c.codigo_swift && c.codigo_swift !== '-' && <span>SWIFT: <strong style={{ color: 'var(--color-text)' }}>{c.codigo_swift}</strong></span>}
                        {c.numero_ruta_aba && <span>ABA: <strong style={{ color: 'var(--color-text)' }}>{c.numero_ruta_aba}</strong></span>}
                        {!c.cbu && !c.alias && !c.wallet_address && !c.numero_cuenta_intl && '-'}
                      </div>
                    </td>
                    <td onClick={() => abrirEdicion(c)} style={{ cursor: 'pointer' }}>
                      <span className="badge badge-green">Propia</span>
                    </td>
                    <td>
                      {eliminandoId === c.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px', color: 'var(--color-danger)', fontSize: '11px' }}
                            onClick={() => confirmarEliminar(c.id)}
                          >
                            Confirmar
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px' }}
                            onClick={() => setEliminandoId(null)}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px', borderColor: 'transparent', background: 'transparent' }}
                            onClick={() => abrirEdicion(c)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px', color: 'var(--color-danger)', borderColor: 'transparent', background: 'transparent' }}
                            onClick={() => setEliminandoId(c.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

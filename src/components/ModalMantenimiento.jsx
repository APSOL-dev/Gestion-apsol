import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Wrench, Trash2, Plus } from 'lucide-react'
import moment from 'moment'
import { useData } from '../context/DataContext'
import {
  getConfigMantenimiento, guardarItemMantenimiento, borrarItemMantenimiento,
  getMantenimientoPorMes, crearMantenimientoMes, borrarMantenimientoMes,
} from '../services/mantenimiento'
import { mesActual } from '../utils/mantenimiento'
import { prospectosFiltrables } from '../utils/cronogramaFiltros'

const fmtHoras = (h) => {
  const n = Number(h) || 0
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}
const mesLegible = (mes) => {
  const m = moment(mes, 'YYYY-MM', true)
  return m.isValid() ? m.format('MMMM YYYY') : mes
}

/**
 * "Sumar mantenimiento": carga las horas de mantenimiento del mes al
 * cronograma (una actividad por cliente, día 1 a las 00:00, responsable
 * "Mantenimiento", descripción "Mantenimiento Activos"). Solo se monta para
 * el admin (ver Cronograma.jsx). `onAplicado` refresca el cronograma + el
 * panel de saldo.
 */
export default function ModalMantenimiento({ abierto, onClose, onAplicado }) {
  const { prospectos } = useData()
  const [mes, setMes] = useState(mesActual())
  const [config, setConfig] = useState([])
  const [porMes, setPorMes] = useState({})
  const [horasEdit, setHorasEdit] = useState({})       // prospecto_id -> string (input)
  const [cargando, setCargando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [modoLista, setModoLista] = useState(false)
  const [nuevoPid, setNuevoPid] = useState('')
  const [nuevoHoras, setNuevoHoras] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const nombreDe = useCallback(
    (pid) => prospectos.find(p => p.id === pid)?.nombre || '(cliente)',
    [prospectos]
  )

  const cargado = porMes[mes]                         // { total, porProspecto } | undefined
  const yaCargado = useCallback((pid) => cargado?.porProspecto?.[pid] != null, [cargado])

  const recargarEstado = useCallback(async () => {
    setError('')
    try {
      const [cfg, pm] = await Promise.all([getConfigMantenimiento(), getMantenimientoPorMes()])
      setConfig(cfg)
      setPorMes(pm)
      setHorasEdit(Object.fromEntries(cfg.map(r => [r.prospecto_id, fmtHoras(r.horas)])))
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar la configuración de mantenimiento.')
    }
  }, [])

  useEffect(() => {
    if (!abierto) return undefined
    let vivo = true
    ;(async () => {
      setOk(''); setError(''); setModoLista(false); setCargando(true)
      try { await recargarEstado() } finally { if (vivo) setCargando(false) }
    })()
    return () => { vivo = false }
  // recargarEstado depende de `mes`; se re-evalúa al abrir y al cambiar el mes
  }, [abierto, mes, recargarEstado])

  // Se cargan los clientes ACTIVOS (tildados) que todavía no estén cargados
  // ese mes. Destildar un cliente lo pausa (persiste activo=false) -> no
  // vuelve a entrar hasta que se lo vuelva a tildar.
  const itemsParaAgregar = useMemo(() => (
    config
      .filter(r => r.activo && !yaCargado(r.prospecto_id))
      .map(r => ({
        prospecto_id: r.prospecto_id,
        horas: Number(String(horasEdit[r.prospecto_id] ?? r.horas).replace(',', '.')) || 0,
      }))
      .filter(i => i.horas > 0)
  ), [config, horasEdit, yaCargado])

  const totalAgregar = itemsParaAgregar.reduce((s, i) => s + i.horas, 0)

  // Para agregar un cliente NUEVO a la lista fija, solo se ofrecen los
  // prospectos "6A - En producción" (mismo criterio que el filtro del
  // Cronograma con "Ver histórico" apagado) y los que no están ya en la lista.
  const prospectosDisponibles = useMemo(() => {
    const enLista = new Set(config.map(r => r.prospecto_id))
    return prospectosFiltrables(prospectos, false)
      .filter(p => !enLista.has(p.id))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
  }, [prospectos, config])

  if (!abierto) return null

  // Tildar/destildar = activar/pausar el cliente en la lista fija. Persiste:
  // un cliente pausado no vuelve a venir tildado (ni ese mes ni los siguientes).
  async function toggleActivo(row) {
    const activo = !row.activo
    setConfig(prev => prev.map(r => r.id === row.id ? { ...r, activo } : r))
    try {
      await guardarItemMantenimiento({
        prospecto_id: row.prospecto_id,
        horas: Number(String(horasEdit[row.prospecto_id] ?? row.horas).replace(',', '.')) || row.horas,
        activo,
        orden: row.orden,
      })
    } catch (e) {
      console.error(e)
      setError('No se pudo guardar el cambio.')
      setConfig(prev => prev.map(r => r.id === row.id ? { ...r, activo: !activo } : r)) // revertir
    }
  }

  async function persistHoras(row) {
    const val = Number(String(horasEdit[row.prospecto_id] ?? '').replace(',', '.'))
    if (!Number.isFinite(val) || val <= 0 || val === Number(row.horas)) return
    try {
      await guardarItemMantenimiento({ prospecto_id: row.prospecto_id, horas: val, activo: row.activo, orden: row.orden })
      setConfig(prev => prev.map(r => r.prospecto_id === row.prospecto_id ? { ...r, horas: val } : r))
    } catch (e) {
      console.error(e); setError('No se pudo guardar las horas.')
    }
  }

  async function quitarDeLista(row) {
    if (!window.confirm(`Sacar "${nombreDe(row.prospecto_id)}" de la lista fija? (no borra actividades ya cargadas)`)) return
    try {
      await borrarItemMantenimiento(row.id)
      setConfig(prev => prev.filter(r => r.id !== row.id))
    } catch (e) {
      console.error(e); setError('No se pudo sacar el cliente de la lista.')
    }
  }

  async function agregarALista() {
    const h = Number(String(nuevoHoras).replace(',', '.'))
    if (!nuevoPid || !Number.isFinite(h) || h <= 0) { setError('Elegí un cliente y unas horas válidas.'); return }
    try {
      const orden = (config.at(-1)?.orden || config.length) + 1
      const nuevo = await guardarItemMantenimiento({ prospecto_id: nuevoPid, horas: h, activo: true, orden })
      setConfig(prev => [...prev, nuevo])
      setHorasEdit(prev => ({ ...prev, [nuevoPid]: fmtHoras(h) }))
      setNuevoPid(''); setNuevoHoras(''); setError('')
    } catch (e) {
      console.error(e); setError('No se pudo agregar el cliente a la lista.')
    }
  }

  async function aplicarAgregar() {
    const msg =
      `Vas a agregar ${itemsParaAgregar.length} actividad(es) de mantenimiento a ${mesLegible(mes)}:\n\n` +
      itemsParaAgregar.map(i => `• ${nombreDe(i.prospecto_id)} — ${fmtHoras(i.horas)} h`).join('\n') +
      `\n\nTotal: ${fmtHoras(totalAgregar)} h`
    if (!window.confirm(msg)) return
    setAplicando(true); setError(''); setOk('')
    try {
      const n = await crearMantenimientoMes({ mes, items: itemsParaAgregar })
      await recargarEstado()
      onAplicado?.()
      setOk(`Se agregaron ${n} actividad(es) de mantenimiento a ${mesLegible(mes)}.`)
    } catch (e) {
      console.error(e); setError(`No se pudo cargar el mantenimiento: ${e.message || 'error'}`)
    } finally {
      setAplicando(false)
    }
  }

  async function aplicarBorrar() {
    if (!cargado) return
    const msg =
      `Vas a BORRAR el mantenimiento de ${mesLegible(mes)}:\n\n` +
      Object.entries(cargado.porProspecto).map(([pid, h]) => `• ${nombreDe(pid)} — ${fmtHoras(h)} h`).join('\n') +
      `\n\nTotal: ${fmtHoras(cargado.total)} h. Esta acción no se puede deshacer.`
    if (!window.confirm(msg)) return
    setAplicando(true); setError(''); setOk('')
    try {
      const n = await borrarMantenimientoMes({ mes })
      await recargarEstado()
      onAplicado?.()
      setOk(`Se borraron ${n} actividad(es) de mantenimiento de ${mesLegible(mes)}.`)
    } catch (e) {
      console.error(e); setError(`No se pudo borrar el mantenimiento: ${e.message || 'error'}`)
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content premium" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wrench size={20} /> Sumar mantenimiento</h2>
            <p className="modal-subtitle">
              Carga las horas de mantenimiento del mes al cronograma: una actividad por cliente,
              día 1 a las 00:00, responsable “Mantenimiento”.
            </p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ maxWidth: 220 }}>
            <label>Mes</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} />
          </div>

          {cargado && (
            <div className="alert alert-warning">
              ⚠️ Ya cargaste mantenimiento en {mesLegible(mes)} — {fmtHoras(cargado.total)} h
              en {Object.keys(cargado.porProspecto).length} cliente(s). Revisá antes de agregar.
            </div>
          )}
          {error && <div className="alert alert-error">{error}</div>}
          {ok && <div className="alert alert-success">{ok}</div>}

          {cargando ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando…</p>
          ) : (
            <div className="mant-list">
              {config.map(row => {
                const ya = yaCargado(row.prospecto_id)
                const pausado = !row.activo
                return (
                  <div key={row.id} className={`mant-row${ya ? ' mant-row--ya' : ''}${pausado ? ' mant-row--pausado' : ''}`}>
                    <label className="checkbox-label mant-nombre">
                      <input
                        type="checkbox"
                        disabled={ya}
                        checked={!ya && row.activo}
                        onChange={() => toggleActivo(row)}
                        title={pausado ? 'Pausado — tildá para volver a incluirlo' : 'Tildado — entra en la carga mensual'}
                      />
                      <span className="mant-nombre-txt">
                        {nombreDe(row.prospecto_id)}
                        {pausado && <em className="mant-pausa"> · pausado</em>}
                      </span>
                    </label>

                    {ya ? (
                      <span className="mant-ya">ya cargado ({fmtHoras(cargado.porProspecto[row.prospecto_id])} h)</span>
                    ) : (
                      <>
                        <input
                          type="number" min="0" step="0.5"
                          value={horasEdit[row.prospecto_id] ?? ''}
                          onChange={e => setHorasEdit(prev => ({ ...prev, [row.prospecto_id]: e.target.value }))}
                          onBlur={() => persistHoras(row)}
                          className="mant-horas"
                          title="Horas de este cliente (se guarda como valor fijo)"
                        />
                        <span className="mant-h">h</span>
                      </>
                    )}

                    {modoLista && (
                      <button type="button" className="mant-quitar" onClick={() => quitarDeLista(row)}>
                        Quitar
                      </button>
                    )}
                  </div>
                )
              })}
              {config.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 12 }}>La lista está vacía. Agregá clientes abajo.</p>
              )}
            </div>
          )}

          <div>
            <button type="button" className="btn-sec" style={{ fontSize: 13, padding: '6px 12px' }}
              onClick={() => setModoLista(v => !v)}>
              {modoLista ? 'Listo' : 'Editar lista fija'}
            </button>
          </div>

          {modoLista && (
            <div className="mant-add">
              <select value={nuevoPid} onChange={e => setNuevoPid(e.target.value)}>
                <option value="">— Elegir cliente —</option>
                {prospectosDisponibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input type="number" min="0" step="0.5" placeholder="horas"
                value={nuevoHoras} onChange={e => setNuevoHoras(e.target.value)} style={{ width: 90 }} />
              <button type="button" className="btn-sec" onClick={agregarALista}>
                <Plus size={14} /> Agregar
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-danger-ghost"
            disabled={!cargado || aplicando}
            onClick={aplicarBorrar}
          >
            <Trash2 size={16} /> Borrar mantenimiento de {mesLegible(mes)}
          </button>
          <button
            type="button"
            className="btn-pri"
            disabled={itemsParaAgregar.length === 0 || aplicando}
            onClick={aplicarAgregar}
          >
            {aplicando ? 'Aplicando…' : `Agregar ${itemsParaAgregar.length} ${itemsParaAgregar.length === 1 ? 'actividad' : 'actividades'} (Σ ${fmtHoras(totalAgregar)} h)`}
          </button>
        </div>
      </div>
    </div>
  )
}

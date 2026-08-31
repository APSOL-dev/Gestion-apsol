import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { getFacturas } from '../services/facturacion'
import { getProspectos } from '../services/prospectos'
import { getColaboradores } from '../services/colaboradores'
import { getEmpresas } from '../services/empresas'
import { getContactos } from '../services/contactos'
import { getProyectos } from '../services/proyectos'
import { getTickets, getPreventivos } from '../services/operaciones'
import { getCapacitaciones } from '../services/capacitacion'
import { getPlanes } from '../services/planificacion'
import { getCredenciales } from '../services/credenciales'
import { getValoresUVA } from '../services/valoresUva'
import { sincronizarHistoricoUVA } from '../services/sincronizacionUva'
import { getCuentasBancarias } from '../services/cuentasBancarias'
import { crearRefrescador } from '../utils/precargaModulo'
import { useAuth } from './AuthContext'

const DataContext = createContext({})

// Cuánto vale una precarga antes de re-consultar la red. Ir y volver entre
// pantallas dentro de esta ventana NO dispara más requests: usa lo cacheado.
// Módulos que se precargan al iniciar sesión, para que moverse entre
// pantallas se sienta instantáneo. Se precargan TODOS: mandar las consultas
// en paralelo dejó de ser peligroso al restaurar el lock de auth
// (ver src/lib/supabase.js) — el cuelgue nunca fue por volumen.
export const MODULOS_PRECARGA_LOGIN = [
  "facturas", "prospectos", "colaboradores", "empresas", "contactos",
  "proyectos", "tickets", "preventivos", "capacitaciones", "planes",
  "credenciales", "cuentasBancarias"
]

const TTL_MS = 90_000
// Corte para que una request colgada (cliente de Supabase trabado en un
// refresh de token) no deje una pantalla en "Cargando..." para siempre.
const TIMEOUT_MS = 12_000

export function DataProvider({ children }) {
  const { user } = useAuth()

  // 13 módulos de datos
  const [facturas, setFacturas] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [contactos, setContactos] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [tickets, setTickets] = useState([])
  const [preventivos, setPreventivos] = useState([])
  const [capacitaciones, setCapacitaciones] = useState([])
  const [planes, setPlanes] = useState([])
  const [credenciales, setCredenciales] = useState([])
  const [valoresUVA, setValoresUVA] = useState([])
  const [cuentasBancarias, setCuentasBancarias] = useState([])

  // Estados de carga individual
  const [loadingFacturas, setLoadingFacturas] = useState(false)
  const [loadingProspectos, setLoadingProspectos] = useState(false)
  const [loadingColaboradores, setLoadingColaboradores] = useState(false)
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)
  const [loadingContactos, setLoadingContactos] = useState(false)
  const [loadingProyectos, setLoadingProyectos] = useState(false)
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [loadingPreventivos, setLoadingPreventivos] = useState(false)
  const [loadingCapacitaciones, setLoadingCapacitaciones] = useState(false)
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [loadingCredenciales, setLoadingCredenciales] = useState(false)
  const [loadingValoresUVA, setLoadingValoresUVA] = useState(false)
  const [loadingCuentasBancarias, setLoadingCuentasBancarias] = useState(false)

  // Estados de error individual (para que una pantalla pueda ofrecer
  // "Reintentar" en vez de spinner infinito o lista vacía muda)
  const [errorFacturas, setErrorFacturas] = useState(false)
  const [errorProspectos, setErrorProspectos] = useState(false)
  const [errorColaboradores, setErrorColaboradores] = useState(false)
  const [errorEmpresas, setErrorEmpresas] = useState(false)
  const [errorContactos, setErrorContactos] = useState(false)
  const [errorProyectos, setErrorProyectos] = useState(false)
  const [errorTickets, setErrorTickets] = useState(false)
  const [errorPreventivos, setErrorPreventivos] = useState(false)
  const [errorCapacitaciones, setErrorCapacitaciones] = useState(false)
  const [errorPlanes, setErrorPlanes] = useState(false)
  const [errorCredenciales, setErrorCredenciales] = useState(false)
  const [errorValoresUVA, setErrorValoresUVA] = useState(false)
  const [errorCuentasBancarias, setErrorCuentasBancarias] = useState(false)

  // Metadata de caché por módulo (no es estado: no queremos re-render al tocarla)
  const cacheMeta = useRef({})
  function metaDe(clave) {
    return cacheMeta.current[clave] || (cacheMeta.current[clave] = { ultimaCargaOk: 0, enVuelo: null })
  }
  function nuevoRefrescador(clave, getter, setData, setLoading, setError) {
    return crearRefrescador({
      clave, getter, meta: metaDe(clave), setData, setLoading, setError,
      ttlMs: TTL_MS, timeoutMs: TIMEOUT_MS
    })
  }

  const refreshFacturas = nuevoRefrescador('facturas', getFacturas, setFacturas, setLoadingFacturas, setErrorFacturas)
  const refreshProspectos = nuevoRefrescador('prospectos', () => getProspectos({ soloActivos: false }), setProspectos, setLoadingProspectos, setErrorProspectos)
  const refreshColaboradores = nuevoRefrescador('colaboradores', getColaboradores, setColaboradores, setLoadingColaboradores, setErrorColaboradores)
  const refreshEmpresas = nuevoRefrescador('empresas', getEmpresas, setEmpresas, setLoadingEmpresas, setErrorEmpresas)
  const refreshContactos = nuevoRefrescador('contactos', getContactos, setContactos, setLoadingContactos, setErrorContactos)
  const refreshProyectos = nuevoRefrescador('proyectos', getProyectos, setProyectos, setLoadingProyectos, setErrorProyectos)
  const refreshTickets = nuevoRefrescador('tickets', getTickets, setTickets, setLoadingTickets, setErrorTickets)
  const refreshPreventivos = nuevoRefrescador('preventivos', getPreventivos, setPreventivos, setLoadingPreventivos, setErrorPreventivos)
  const refreshCapacitaciones = nuevoRefrescador('capacitaciones', getCapacitaciones, setCapacitaciones, setLoadingCapacitaciones, setErrorCapacitaciones)
  const refreshPlanes = nuevoRefrescador('planes', getPlanes, setPlanes, setLoadingPlanes, setErrorPlanes)
  const refreshCredenciales = nuevoRefrescador('credenciales', getCredenciales, setCredenciales, setLoadingCredenciales, setErrorCredenciales)
  const refreshValoresUVA = nuevoRefrescador('valoresUVA', getValoresUVA, setValoresUVA, setLoadingValoresUVA, setErrorValoresUVA)
  const refreshCuentasBancarias = nuevoRefrescador('cuentasBancarias', getCuentasBancarias, setCuentasBancarias, setLoadingCuentasBancarias, setErrorCuentasBancarias)

  // Indexados por la misma clave que usa MODULOS_PRECARGA_LOGIN
  const refrescadores = {
    facturas: refreshFacturas,
    prospectos: refreshProspectos,
    colaboradores: refreshColaboradores,
    empresas: refreshEmpresas,
    contactos: refreshContactos,
    proyectos: refreshProyectos,
    tickets: refreshTickets,
    preventivos: refreshPreventivos,
    capacitaciones: refreshCapacitaciones,
    planes: refreshPlanes,
    credenciales: refreshCredenciales,
    cuentasBancarias: refreshCuentasBancarias
  }

  // Sincroniza en segundo plano las cotizaciones UVA faltantes desde la API
  // pública (Argentina Datos) al abrir la app. Solo inserta fechas que
  // todavía no existen en la base, así nunca duplica un día ya cargado.
  async function sincronizarValoresUVA() {
    try {
      const { insertados } = await sincronizarHistoricoUVA()
      if (insertados > 0) {
        await refreshValoresUVA({ silencioso: true, forzar: true })
      }
    } catch (err) {
      console.error('Error al sincronizar histórico de valores UVA:', err)
    }
  }

  // Precarga al iniciar sesión: TODOS los módulos, en paralelo. Cada uno
  // pasa por crearRefrescador (TTL + single-flight + timeout), así que
  // navegar después no vuelve a consultar la red dentro del TTL.
  useEffect(() => {
    if (user) {
      for (const clave of MODULOS_PRECARGA_LOGIN) {
        refrescadores[clave]?.({ silencioso: true, forzar: true })
      }
      sincronizarValoresUVA()
    } else {
      // Limpiar datos y metadata de caché al cerrar sesión
      cacheMeta.current = {}
      setFacturas([]); setProspectos([]); setColaboradores([]); setEmpresas([])
      setContactos([]); setProyectos([]); setTickets([]); setPreventivos([])
      setCapacitaciones([]); setPlanes([]); setCredenciales([]); setValoresUVA([])
      setCuentasBancarias([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <DataContext.Provider value={{
      facturas, loadingFacturas, errorFacturas, refreshFacturas,
      prospectos, loadingProspectos, errorProspectos, refreshProspectos,
      colaboradores, loadingColaboradores, errorColaboradores, refreshColaboradores,
      empresas, loadingEmpresas, errorEmpresas, refreshEmpresas,
      contactos, loadingContactos, errorContactos, refreshContactos,
      proyectos, loadingProyectos, errorProyectos, refreshProyectos,
      tickets, loadingTickets, errorTickets, refreshTickets,
      preventivos, loadingPreventivos, errorPreventivos, refreshPreventivos,
      capacitaciones, loadingCapacitaciones, errorCapacitaciones, refreshCapacitaciones,
      planes, loadingPlanes, errorPlanes, refreshPlanes,
      credenciales, loadingCredenciales, errorCredenciales, refreshCredenciales,
      valoresUVA, loadingValoresUVA, errorValoresUVA, refreshValoresUVA,
      cuentasBancarias, loadingCuentasBancarias, errorCuentasBancarias, refreshCuentasBancarias
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}

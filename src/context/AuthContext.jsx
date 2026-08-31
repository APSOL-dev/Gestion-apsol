import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  async function cargarPerfil(userId, email) {
    const emailStr = email || ''
    const nombreDefecto = emailStr ? emailStr.split('@')[0] : 'Usuario'
    try {
      const { data, error } = await supabase
        .from('apsol_usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('No se pudo obtener el perfil:', error.message)
        return { cargo: 'Colaborador', nombre: nombreDefecto, email: emailStr }
      }

      // Team Lead no es un cargo aparte (usuarios.cargo sigue siendo solo
      // Admin/Colaborador): es un flag sobre la ficha de colaborador, así
      // que cualquier usuario con ficha puede tenerlo, sea cual sea su cargo.
      const { data: colab } = await supabase
        .from('apsol_colaboradores')
        .select('es_team_lead')
        .eq('usuario_id', userId)
        .maybeSingle()

      return { ...data, es_team_lead: colab?.es_team_lead === true }
    } catch (err) {
      console.error('Error al cargar perfil:', err)
      return { cargo: 'Colaborador', nombre: nombreDefecto, email: emailStr }
    }
  }

  useEffect(() => {
    let activo = true
    let inicializado = false

    // Timeout de seguridad de 3 segundos
    const timeout = setTimeout(() => {
      if (activo && !inicializado) {
        console.warn('[Auth] Timeout de seguridad — forzando fin de carga')
        inicializado = true
        setLoading(false)
      }
    }, 3000)

    async function inicializar() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!activo) return
        if (session?.user) {
          setUser(session.user)
          const prof = await cargarPerfil(session.user.id, session.user.email)
          if (!activo) return
          setPerfil(prof)
        } else {
          setUser(null)
          setPerfil(null)
        }
      } catch (err) {
        console.error('[Auth] Error al inicializar sesión:', err)
      } finally {
        if (activo && !inicializado) {
          inicializado = true
          setLoading(false)
        }
      }
    }

    inicializar()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Si ya inicializó getSession, ignoramos el INITIAL_SESSION duplicado
      if (event === 'INITIAL_SESSION' && inicializado) return

      console.log('[Auth] Evento de sesión:', event)
      if (!activo) return

      try {
        if (session?.user) {
          setUser(session.user)
          const prof = await cargarPerfil(session.user.id, session.user.email)
          if (!activo) return
          setPerfil(prof)
        } else {
          setUser(null)
          setPerfil(null)
        }
      } catch (err) {
        console.error('[Auth] Error en cambio de estado de sesión:', err)
      } finally {
        if (activo) {
          inicializado = true
          setLoading(false)
        }
      }
    })

    return () => {
      activo = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }
    return { error: null }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  const esDuenio = perfil?.cargo === 'Admin' || perfil?.cargo === 'Dueño'
  const esColaborador = perfil?.cargo === 'Colaborador'
  const esTeamLead = perfil?.es_team_lead === true

  return (
    <AuthContext.Provider value={{ user, perfil, loading, login, logout, signOut: logout, esDuenio, esColaborador, esTeamLead }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

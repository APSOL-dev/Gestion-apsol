import { createClient } from '@supabase/supabase-js'

// Desactivar Web Locks API para evitar bloqueos por candados huérfanos en Chrome
if (typeof window !== 'undefined' && window.navigator) {
  try {
    Object.defineProperty(window.navigator, 'locks', {
      get() { return undefined; },
      configurable: true
    });
  } catch (e) {
    console.warn('No se pudo desactivar navigator.locks:', e);
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

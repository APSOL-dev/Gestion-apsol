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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kursvmadozcqxoaeaccd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cnN2bWFkb3pjcXhvYWVhY2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTY2NDgsImV4cCI6MjA5OTE5MjY0OH0.3dJfV8prVkgWqoGV1baJdBYTpPasWA1iidvMnRkBqXs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export { supabaseUrl }

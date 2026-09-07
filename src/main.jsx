import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// El service worker está en registerType 'autoUpdate' (vite.config.js): cuando
// detecta un sw.js nuevo, se activa y recarga la página solo. Eso pasa al
// cargar/navegar; para las pestañas que quedan abiertas horas, forzamos un
// chequeo cada 30 min así también se ponen al día sin cerrar y volver a abrir.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then(reg => setInterval(() => { reg.update().catch(() => {}) }, 30 * 60 * 1000))
    .catch(() => {})
}

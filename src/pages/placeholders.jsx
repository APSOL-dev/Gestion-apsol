// Páginas placeholder — se implementan en cada fase

export function Facturacion() {
  return <PlaceholderPage titulo="Facturación" fase="Fase 1" />
}
export function Prospectos() {
  return <PlaceholderPage titulo="Prospectos" fase="Fase 1 y 2" />
}
export function Empresas() {
  return <PlaceholderPage titulo="Empresas" fase="Fase 1" />
}
export function Contactos() {
  return <PlaceholderPage titulo="Contactos" fase="Fase 1" />
}
export function Colaboradores() {
  return <PlaceholderPage titulo="Colaboradores" fase="Fase 2" />
}
export function Proyectos() {
  return <PlaceholderPage titulo="Proyectos" fase="Fase 3" />
}
export function Tickets() {
  return <PlaceholderPage titulo="Tickets" fase="Fase 3" />
}
export function Preventivos() {
  return <PlaceholderPage titulo="Preventivos" fase="Fase 3" />
}
export function Capacitacion() {
  return <PlaceholderPage titulo="Capacitación" fase="Fase 4" />
}
export function Cronograma() {
  return <PlaceholderPage titulo="Agenda / Cronograma" fase="Fase 4" />
}
export function Credenciales() {
  return <PlaceholderPage titulo="Credenciales" fase="Fase 4" />
}

function PlaceholderPage({ titulo, fase }) {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{titulo}</h1>
      </div>
      <div className="placeholder-card">
        <div className="placeholder-icon">🚧</div>
        <h3>En construcción</h3>
        <p>Este módulo se implementa en la <strong>{fase}</strong>.</p>
      </div>
    </div>
  )
}

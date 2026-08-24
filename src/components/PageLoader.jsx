// Spinner minimalista que aparece mientras se carga una ruta con React.lazy
export default function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100%',
      background: 'var(--color-bg)',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        border: '2.5px solid var(--color-border)',
        borderTopColor: 'var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite'
      }} />
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Cargando...</span>
    </div>
  )
}

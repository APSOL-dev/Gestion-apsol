import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'
import { preguntarAsistenteIA } from '../services/capacitacion'

export default function CapacitacionChat() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const listaRef = useRef(null)

  useEffect(() => {
    if (listaRef.current) {
      listaRef.current.scrollTop = listaRef.current.scrollHeight
    }
  }, [mensajes, enviando])

  async function handleEnviar(e) {
    e.preventDefault()
    const texto = input.trim()
    if (!texto || enviando) return

    const historialParaApi = mensajes.map(m => ({ role: m.role, content: m.content }))
    setMensajes(m => [...m, { role: 'user', content: texto }])
    setInput('')
    setError('')
    setEnviando(true)

    try {
      const reply = await preguntarAsistenteIA(texto, historialParaApi)
      setMensajes(m => [...m, { role: 'assistant', content: reply }])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al consultar el asistente')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(!abierto)}
        title="Preguntale a la IA sobre capacitación"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 200,
          width: '52px', height: '52px', borderRadius: '50%', border: 'none',
          background: 'var(--color-primary)', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
        }}
      >
        {abierto ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {abierto && (
        <div
          style={{
            position: 'fixed', bottom: '88px', right: '24px', zIndex: 200,
            width: '360px', maxWidth: 'calc(100vw - 48px)', height: '480px', maxHeight: 'calc(100vh - 140px)',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}
        >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface2)' }}>
            <Sparkles size={18} className="text-primary" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Asistente de Capacitación</div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>Preguntá o buscá contenido relacionado</div>
            </div>
          </div>

          <div ref={listaRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mensajes.length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '20px' }}>
                Ej: "¿tenemos algo sobre Evolution API?" o "resumime cómo se organiza N8N"
              </p>
            )}
            {mensajes.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface2)',
                  color: m.role === 'user' ? '#fff' : 'var(--color-text)',
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13.5px',
                  whiteSpace: 'pre-wrap', lineHeight: '1.4'
                }}
              >
                {m.content}
              </div>
            ))}
            {enviando && (
              <div style={{ alignSelf: 'flex-start', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Pensando...
              </div>
            )}
            {error && (
              <div className="alert alert-error" style={{ fontSize: '12.5px' }}>{error}</div>
            )}
          </div>

          <form onSubmit={handleEnviar} style={{ display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid var(--color-border)' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribí tu pregunta..."
              style={{ flex: 1 }}
              disabled={enviando}
            />
            <button type="submit" className="btn btn-primary" disabled={enviando || !input.trim()} style={{ padding: '8px 12px' }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

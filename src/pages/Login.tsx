import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Icon } from '@/components/ui'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="brand-mark" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>CadenaSuministro</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>OPCI · Suite</div>
          </div>
        </div>

        <form className="login-fields" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">Correo electrónico</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              required
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%' }}
            />
          </div>
          {error && (
            <div className="form-error" style={{ padding: '8px 10px', background: 'var(--bad-soft)', borderRadius: 6, fontSize: 12.5 }}>
              {error}
            </div>
          )}
          <button
            className="btn primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', height: 36, marginTop: 4 }}
          >
            {loading ? (
              <>
                <Icon name="spinner" size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Ingresando…
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>
          Plataforma de gestión de cadena de suministro
        </div>
      </div>
    </div>
  )
}

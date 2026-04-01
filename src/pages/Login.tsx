import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Onjuist e-mailadres of wachtwoord.')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Van den Elzen Plants</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Licentiekosten</div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="naam@example.com"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg, #fef2f2)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid #fecaca' }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Inloggen…' : 'Inloggen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

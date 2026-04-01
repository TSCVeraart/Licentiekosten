import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_PERMISSIONS } from '../lib/auth'

type Tab = 'login' | 'aanvragen'

export default function Login() {
  const [tab, setTab] = useState<Tab>('login')

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

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
          {(['login', 'aanvragen'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: tab === t ? 600 : 400,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === t ? 'var(--primary)' : 'var(--muted)',
                marginBottom: -1,
              }}
            >
              {t === 'login' ? 'Inloggen' : 'Toegang aanvragen'}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 28, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          {tab === 'login' ? <LoginForm /> : <AanvraagForm onDone={() => setTab('login')} />}
        </div>
      </div>
    </div>
  )
}

function LoginForm() {
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
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group">
        <label>E-mailadres</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="naam@example.com" required autoFocus />
      </div>
      <div className="form-group">
        <label>Wachtwoord</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••" required />
      </div>
      {error && <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg, #fef2f2)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid #fecaca' }}>{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
        {loading ? 'Inloggen…' : 'Inloggen'}
      </button>
    </form>
  )
}

function AanvraagForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== password2) { setError('Wachtwoorden komen niet overeen.'); return }
    if (password.length < 6) { setError('Wachtwoord moet minimaal 6 tekens zijn.'); return }
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (userId) {
      await supabase.from('user_profiles').insert({
        id: userId,
        email,
        status: 'pending',
        is_admin: false,
        permissions: DEFAULT_PERMISSIONS,
      })
      await supabase.auth.signOut()
    }

    setLoading(false)
    setSuccess(true)
    setTimeout(onDone, 3000)
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text)', fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Aanvraag ingediend</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Je ontvangt toegang zodra de beheerder je aanvraag goedkeurt.</div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group">
        <label>E-mailadres</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="naam@example.com" required autoFocus />
      </div>
      <div className="form-group">
        <label>Wachtwoord</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Minimaal 6 tekens" required />
      </div>
      <div className="form-group">
        <label>Wachtwoord herhalen</label>
        <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
          placeholder="••••••••" required />
      </div>
      {error && <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg, #fef2f2)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid #fecaca' }}>{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
        {loading ? 'Aanvraag indienen…' : 'Toegang aanvragen'}
      </button>
    </form>
  )
}

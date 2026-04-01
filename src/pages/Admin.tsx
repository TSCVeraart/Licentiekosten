import { useEffect, useState } from 'react'
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { type UserProfile, type PagePermissions, PAGE_LABELS, FULL_PERMISSIONS, DEFAULT_PERMISSIONS } from '../lib/auth'

type StatusTab = 'pending' | 'active' | 'rejected'

export default function Admin() {
  const [tab, setTab] = useState<StatusTab>('pending')
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { toast.error('Fout bij laden gebruikers'); setLoading(false); return }
    setUsers((data ?? []) as UserProfile[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u => u.status === tab)

  const setStatus = async (id: string, status: 'active' | 'rejected') => {
    const permissions = status === 'active' ? FULL_PERMISSIONS : DEFAULT_PERMISSIONS
    const { error } = await supabase
      .from('user_profiles')
      .update({ status, permissions })
      .eq('id', id)
    if (error) { toast.error('Fout bij opslaan'); return }
    toast.success(status === 'active' ? 'Gebruiker goedgekeurd' : 'Gebruiker afgewezen')
    load()
  }

  const updatePermissions = async (id: string, permissions: PagePermissions) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ permissions })
      .eq('id', id)
    if (error) { toast.error('Fout bij opslaan'); return }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, permissions } : u))
    toast.success('Rechten opgeslagen')
  }

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const TAB_LABELS: Record<StatusTab, string> = { pending: 'Wachtend', active: 'Actief', rejected: 'Afgewezen' }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Gebruikersbeheer</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Beheer toegangsaanvragen en gebruikersrechten.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['pending', 'active', 'rejected'] as StatusTab[]).map(t => {
          const count = users.filter(u => u.status === t).length
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn ${tab === t ? 'btn-primary' : ''}`}
              style={{ fontSize: 13 }}
            >
              {TAB_LABELS[t]}
              {count > 0 && (
                <span style={{
                  marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9,
                  background: tab === t ? 'rgba(255,255,255,0.3)' : 'var(--border)',
                  color: tab === t ? '#fff' : 'var(--muted)',
                  fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: 16 }}>Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 24, color: 'var(--muted)', fontSize: 14 }}>
          Geen gebruikers in deze categorie.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(user => (
            <UserCard
              key={user.id}
              user={user}
              isExpanded={expanded.has(user.id)}
              onToggle={() => toggleExpanded(user.id)}
              onApprove={() => setStatus(user.id, 'active')}
              onReject={() => setStatus(user.id, 'rejected')}
              onRestore={() => setStatus(user.id, 'active')}
              onPermissionsChange={p => updatePermissions(user.id, p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function UserCard({
  user, isExpanded, onToggle, onApprove, onReject, onRestore, onPermissionsChange,
}: {
  user: UserProfile
  isExpanded: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  onRestore: () => void
  onPermissionsChange: (p: PagePermissions) => void
}) {
  const [perms, setPerms] = useState<PagePermissions>(user.permissions)

  useEffect(() => { setPerms(user.permissions) }, [user.permissions])

  const STATUS_COLOR: Record<string, string> = {
    pending: '#f59e0b',
    active: '#22c55e',
    rejected: 'var(--danger)',
  }
  const STATUS_LABEL: Record<string, string> = {
    pending: 'Wachtend',
    active: 'Actief',
    rejected: 'Afgewezen',
  }

  const setPermKey = (key: keyof PagePermissions, val: boolean) => {
    setPerms(prev => ({ ...prev, [key]: val }))
  }

  const hasChanges = JSON.stringify(perms) !== JSON.stringify(user.permissions)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        onClick={onToggle}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.email}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            <span style={{ color: STATUS_COLOR[user.status], fontWeight: 600 }}>{STATUS_LABEL[user.status]}</span>
            {user.is_admin && <span style={{ marginLeft: 8, color: '#6366f1', fontWeight: 600 }}>Beheerder</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {user.status === 'pending' && (
            <>
              <button
                className="btn btn-primary"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={e => { e.stopPropagation(); onApprove() }}
              >
                <Check size={13} /> Goedkeuren
              </button>
              <button
                className="btn"
                style={{ padding: '4px 10px', fontSize: 12, color: 'var(--danger)' }}
                onClick={e => { e.stopPropagation(); onReject() }}
              >
                <X size={13} /> Afwijzen
              </button>
            </>
          )}
          {user.status === 'rejected' && (
            <button
              className="btn btn-primary"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={e => { e.stopPropagation(); onRestore() }}
            >
              <Check size={13} /> Herstellen
            </button>
          )}
          {isExpanded ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
        </div>
      </div>

      {isExpanded && !user.is_admin && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Paginatoegang
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px 16px', marginBottom: 16 }}>
            {PAGE_LABELS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={perms[key]}
                  onChange={e => setPermKey(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bewerken
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={perms.can_edit}
              onChange={e => setPermKey('can_edit', e.target.checked)}
            />
            Mag gegevens bewerken / importeren
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: 13 }}
              disabled={!hasChanges}
              onClick={() => onPermissionsChange(perms)}
            >
              Opslaan
            </button>
            <button
              className="btn"
              style={{ fontSize: 13 }}
              onClick={() => { setPerms(FULL_PERMISSIONS); onPermissionsChange(FULL_PERMISSIONS) }}
            >
              Alles aan
            </button>
            <button
              className="btn"
              style={{ fontSize: 13 }}
              onClick={() => { setPerms({ ...DEFAULT_PERMISSIONS }); onPermissionsChange({ ...DEFAULT_PERMISSIONS }) }}
            >
              Alles uit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

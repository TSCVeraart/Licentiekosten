import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Leaf, Package, TrendingUp, Tag, Euro, AlertCircle, ClipboardList, LogOut, ShieldCheck } from 'lucide-react'
import { type Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { AuthContext, type UserProfile, ADMIN_EMAIL, FULL_PERMISSIONS, DEFAULT_PERMISSIONS } from './lib/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Debiteuren from './pages/Debiteuren'
import Licentiehouders from './pages/Licentiehouders'
import Rassen from './pages/Rassen'
import Omzetrekeningen from './pages/Omzetrekeningen'
import Artikelen from './pages/Artikelen'
import LicentiekostenPage from './pages/Licentiekosten'
import OntbrekendeKosten from './pages/OntbrekendeKosten'
import Checklist from './pages/Checklist'
import Admin from './pages/Admin'

function useDebiteurenBadge() {
  const [count, setCount] = useState(0)

  const refresh = async () => {
    const { count } = await supabase
      .from('omzetrekeningen')
      .select('debiteur_nr', { count: 'exact', head: true })
      .is('land_debiteur', null)
      .not('debiteur_nr', 'is', null)
    setCount(count ?? 0)
  }

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return count
}

const CHECKLIST_ITEMS = 9

function prevMonthStr() {
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function useChecklistBadge() {
  const [open, setOpen] = useState(0)

  const refresh = async () => {
    if (new Date().getDate() < 10) { setOpen(0); return }
    const { count } = await supabase
      .from('checklist_maand')
      .select('item', { count: 'exact', head: true })
      .eq('maand', prevMonthStr())
      .eq('afgevinkt', true)
    const afgevinkt = count ?? 0
    setOpen(CHECKLIST_ITEMS - afgevinkt)
  }

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return open
}

function useOntbrekendBadge() {
  const [count, setCount] = useState(0)

  const refresh = async () => {
    const { count } = await supabase
      .from('omzetrekeningen')
      .select('id', { count: 'exact', head: true })
      .is('totaal_licentiekosten', null)
      .is('kleur', null)
    setCount(count ?? 0)
  }

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return count
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); return }

    const email = session.user.email ?? ''

    // Admin gets full permissions without needing a DB row
    if (email === ADMIN_EMAIL) {
      setProfile({
        id: session.user.id,
        email,
        status: 'active',
        is_admin: true,
        permissions: FULL_PERMISSIONS,
      })
      return
    }

    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          // No profile yet — create one as pending
          supabase.from('user_profiles').insert({
            id: session.user.id,
            email,
            status: 'pending',
            is_admin: false,
            permissions: DEFAULT_PERMISSIONS,
          }).then(() => {
            supabase.auth.signOut()
            setStatusMsg('Je aanvraag is ingediend. Wacht op goedkeuring van de beheerder.')
          })
          return
        }
        if (data.status === 'pending') {
          supabase.auth.signOut()
          setStatusMsg('Je aanvraag wacht nog op goedkeuring.')
          return
        }
        if (data.status === 'rejected') {
          supabase.auth.signOut()
          setStatusMsg('Je toegangsaanvraag is afgewezen. Neem contact op met de beheerder.')
          return
        }
        setProfile(data as UserProfile)
      })
  }, [session])

  if (session === undefined || profile === undefined) return null

  if (statusMsg) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Van den Elzen Plants</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Licentiekosten</div>
          </div>
          <div className="card" style={{ padding: 28, textAlign: 'center', fontSize: 14, color: 'var(--text)' }}>
            <div style={{ marginBottom: 16 }}>{statusMsg}</div>
            <button className="btn" style={{ fontSize: 13 }} onClick={() => setStatusMsg(null)}>Terug naar inloggen</button>
          </div>
        </div>
      </div>
    )
  }

  if (session === null || profile === null) return <Login />

  return (
    <AuthContext.Provider value={{ profile }}>
      <AppInner profile={profile} />
    </AuthContext.Provider>
  )
}

function AppInner({ profile }: { profile: UserProfile }) {
  const ontbrekendCount = useOntbrekendBadge()
  const debiteurenCount = useDebiteurenBadge()
  const checklistOpen   = useChecklistBadge()
  const p = profile.permissions

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">Van den Elzen Plants<span>Licentiekosten</span></div>
        <nav>
          <div className="nav-section">Overzicht</div>
          {p.dashboard && <NavLink to="/" end className={({isActive}) => `nav-link ${isActive?'active':''}`}><LayoutDashboard />Dashboard</NavLink>}
          <div className="nav-section">Stamgegevens</div>
          {p.debiteuren && (
            <NavLink to="/debiteuren" className={({isActive}) => `nav-link ${isActive?'active':''}`}>
              <Users />
              Debiteuren
              {debiteurenCount > 0 && (
                <span style={{
                  marginLeft: 'auto', minWidth: 20, height: 20, borderRadius: 10,
                  background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', lineHeight: 1,
                }}>
                  {debiteurenCount > 99 ? '99+' : debiteurenCount}
                </span>
              )}
            </NavLink>
          )}
          {p.licentiehouders && <NavLink to="/licentiehouders" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Leaf />Licentiehouders</NavLink>}
          {p.rassen && <NavLink to="/rassen" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Package />Rassen</NavLink>}
          {p.artikelen && <NavLink to="/artikelen" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Tag />Artikelen</NavLink>}
          <div className="nav-section">Boekingen</div>
          {p.omzetrekeningen && <NavLink to="/omzetrekeningen" className={({isActive}) => `nav-link ${isActive?'active':''}`}><TrendingUp />Omzetrekeningen</NavLink>}
          {p.ontbrekende_kosten && (
            <NavLink to="/ontbrekende-kosten" className={({isActive}) => `nav-link ${isActive?'active':''}`}>
              <AlertCircle />
              Ontbrekende kosten
              {ontbrekendCount > 0 && (
                <span style={{
                  marginLeft: 'auto', minWidth: 20, height: 20, borderRadius: 10,
                  background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', lineHeight: 1,
                }}>
                  {ontbrekendCount > 99 ? '99+' : ontbrekendCount}
                </span>
              )}
            </NavLink>
          )}
          <div className="nav-section">Beheer</div>
          {p.checklist && (
            <NavLink to="/checklist" className={({isActive}) => `nav-link ${isActive?'active':''}`}>
              <ClipboardList />
              Maandchecklist
              {checklistOpen > 0 && (
                <span style={{
                  marginLeft: 'auto', minWidth: 20, height: 20, borderRadius: 10,
                  background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', lineHeight: 1,
                }}>
                  {checklistOpen}
                </span>
              )}
            </NavLink>
          )}
          {p.licentiekosten && <NavLink to="/licentiekosten" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Euro />Licentiekosten</NavLink>}
          {profile.is_admin && <NavLink to="/admin" className={({isActive}) => `nav-link ${isActive?'active':''}`}><ShieldCheck />Gebruikers</NavLink>}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="nav-link"
          style={{ width: '100%', textAlign: 'left', marginTop: 'auto', borderTop: '1px solid var(--border)', borderRadius: 0, color: 'var(--muted)' }}
        >
          <LogOut size={16} /> Uitloggen
        </button>
      </aside>
      <main className="main">
        <div className="page">
          <Routes>
            {p.dashboard && <Route path="/" element={<Dashboard />} />}
            {p.debiteuren && <Route path="/debiteuren" element={<Debiteuren />} />}
            {p.licentiehouders && <Route path="/licentiehouders" element={<Licentiehouders />} />}
            {p.rassen && <Route path="/rassen" element={<Rassen />} />}
            {p.omzetrekeningen && <Route path="/omzetrekeningen" element={<Omzetrekeningen />} />}
            {p.ontbrekende_kosten && <Route path="/ontbrekende-kosten" element={<OntbrekendeKosten />} />}
            {p.artikelen && <Route path="/artikelen" element={<Artikelen />} />}
            {p.licentiekosten && <Route path="/licentiekosten" element={<LicentiekostenPage />} />}
            {p.checklist && <Route path="/checklist" element={<Checklist />} />}
            {profile.is_admin && <Route path="/admin" element={<Admin />} />}
          </Routes>
        </div>
      </main>
    </div>
  )
}

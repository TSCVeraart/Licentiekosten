import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Leaf, Package, TrendingUp, Tag, Euro, AlertCircle, ClipboardList, LogOut } from 'lucide-react'
import { type Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (session === null) return <Login />

  return <AppInner />
}

function AppInner() {
  const ontbrekendCount = useOntbrekendBadge()
  const debiteurenCount = useDebiteurenBadge()
  const checklistOpen   = useChecklistBadge()

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">Van den Elzen Plants<span>Licentiekosten</span></div>
        <nav>
          <div className="nav-section">Overzicht</div>
          <NavLink to="/" end className={({isActive}) => `nav-link ${isActive?'active':''}`}><LayoutDashboard />Dashboard</NavLink>
          <div className="nav-section">Stamgegevens</div>
          <NavLink to="/debiteuren" className={({isActive}) => `nav-link ${isActive?'active':''}`}>
            <Users />
            Debiteuren
            {debiteurenCount > 0 && (
              <span style={{
                marginLeft: 'auto',
                minWidth: 20, height: 20,
                borderRadius: 10,
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px',
                lineHeight: 1,
              }}>
                {debiteurenCount > 99 ? '99+' : debiteurenCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/licentiehouders" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Leaf />Licentiehouders</NavLink>
          <NavLink to="/rassen" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Package />Rassen</NavLink>
          <NavLink to="/artikelen" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Tag />Artikelen</NavLink>
          <div className="nav-section">Boekingen</div>
<NavLink to="/omzetrekeningen" className={({isActive}) => `nav-link ${isActive?'active':''}`}><TrendingUp />Omzetrekeningen</NavLink>
          <NavLink to="/ontbrekende-kosten" className={({isActive}) => `nav-link ${isActive?'active':''}`}>
            <AlertCircle />
            Ontbrekende kosten
            {ontbrekendCount > 0 && (
              <span style={{
                marginLeft: 'auto',
                minWidth: 20, height: 20,
                borderRadius: 10,
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px',
                lineHeight: 1,
              }}>
                {ontbrekendCount > 99 ? '99+' : ontbrekendCount}
              </span>
            )}
          </NavLink>
          <div className="nav-section">Beheer</div>
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
          <NavLink to="/licentiekosten" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Euro />Licentiekosten</NavLink>
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
            <Route path="/" element={<Dashboard />} />
            <Route path="/debiteuren" element={<Debiteuren />} />
            <Route path="/licentiehouders" element={<Licentiehouders />} />
            <Route path="/rassen" element={<Rassen />} />
<Route path="/omzetrekeningen" element={<Omzetrekeningen />} />
            <Route path="/ontbrekende-kosten" element={<OntbrekendeKosten />} />
            <Route path="/artikelen" element={<Artikelen />} />
            <Route path="/licentiekosten" element={<LicentiekostenPage />} />
            <Route path="/checklist" element={<Checklist />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

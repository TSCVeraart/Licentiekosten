import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Leaf, Package, BookOpen, TrendingUp, Tag, Euro, AlertCircle } from 'lucide-react'
import { supabase } from './lib/supabase'
import { LS_KLEUREN } from './pages/OntbrekendeKosten'
import Dashboard from './pages/Dashboard'
import Debiteuren from './pages/Debiteuren'
import Licentiehouders from './pages/Licentiehouders'
import Rassen from './pages/Rassen'
import Grootboek from './pages/Grootboek'
import Omzetrekeningen from './pages/Omzetrekeningen'
import Artikelen from './pages/Artikelen'
import LicentiekostenPage from './pages/Licentiekosten'
import OntbrekendeKosten from './pages/OntbrekendeKosten'

function useOntbrekendBadge() {
  const [count, setCount] = useState(0)

  const refresh = async () => {
    const { count: total } = await supabase
      .from('omzetrekeningen')
      .select('id', { count: 'exact', head: true })
      .is('totaal_licentiekosten', null)
    const kleuren: Record<number, string> = JSON.parse(localStorage.getItem(LS_KLEUREN) ?? '{}')
    const nietToegewezen = Math.max(0, (total ?? 0) - Object.keys(kleuren).length)
    setCount(nietToegewezen)
  }

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    const onKleurenChanged = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener('ontbrekend-kleuren-changed', onKleurenChanged)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('ontbrekend-kleuren-changed', onKleurenChanged)
    }
  }, [])

  return count
}

export default function App() {
  const ontbrekendCount = useOntbrekendBadge()

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">Van den Elzen Plants<span>Licentiekosten</span></div>
        <nav>
          <div className="nav-section">Overzicht</div>
          <NavLink to="/" end className={({isActive}) => `nav-link ${isActive?'active':''}`}><LayoutDashboard />Dashboard</NavLink>
          <div className="nav-section">Stamgegevens</div>
          <NavLink to="/debiteuren" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Users />Debiteuren</NavLink>
          <NavLink to="/licentiehouders" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Leaf />Licentiehouders</NavLink>
          <NavLink to="/rassen" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Package />Rassen</NavLink>
          <div className="nav-section">Boekingen</div>
          <NavLink to="/grootboek" className={({isActive}) => `nav-link ${isActive?'active':''}`}><BookOpen />Grootboek 1955</NavLink>
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
          <NavLink to="/artikelen" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Tag />Artikelen</NavLink>
          <NavLink to="/licentiekosten" className={({isActive}) => `nav-link ${isActive?'active':''}`}><Euro />Licentiekosten</NavLink>
        </nav>
      </aside>
      <main className="main">
        <div className="page">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/debiteuren" element={<Debiteuren />} />
            <Route path="/licentiehouders" element={<Licentiehouders />} />
            <Route path="/rassen" element={<Rassen />} />
            <Route path="/grootboek" element={<Grootboek />} />
            <Route path="/omzetrekeningen" element={<Omzetrekeningen />} />
            <Route path="/ontbrekende-kosten" element={<OntbrekendeKosten />} />
            <Route path="/artikelen" element={<Artikelen />} />
            <Route path="/licentiekosten" element={<LicentiekostenPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

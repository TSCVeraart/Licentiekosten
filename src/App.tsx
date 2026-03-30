import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Leaf, Package, BookOpen, TrendingUp, Tag, Euro } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Debiteuren from './pages/Debiteuren'
import Licentiehouders from './pages/Licentiehouders'
import Rassen from './pages/Rassen'
import Grootboek from './pages/Grootboek'
import Omzetrekeningen from './pages/Omzetrekeningen'
import Artikelen from './pages/Artikelen'
import LicentiekostenPage from './pages/Licentiekosten'

export default function App() {
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
            <Route path="/artikelen" element={<Artikelen />} />
            <Route path="/licentiekosten" element={<LicentiekostenPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

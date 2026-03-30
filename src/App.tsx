import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Leaf, Package, ArrowUpDown, BookOpen } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Debiteuren from './pages/Debiteuren'
import Licentiehouders from './pages/Licentiehouders'
import Rassen from './pages/Rassen'
import Transacties from './pages/Transacties'
import Grootboek from './pages/Grootboek'

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
          <NavLink to="/transacties" className={({isActive}) => `nav-link ${isActive?'active':''}`}><ArrowUpDown />Transacties</NavLink>
          <NavLink to="/grootboek" className={({isActive}) => `nav-link ${isActive?'active':''}`}><BookOpen />Grootboek 1955</NavLink>
        </nav>
      </aside>
      <main className="main">
        <div className="page">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/debiteuren" element={<Debiteuren />} />
            <Route path="/licentiehouders" element={<Licentiehouders />} />
            <Route path="/rassen" element={<Rassen />} />
            <Route path="/transacties" element={<Transacties />} />
            <Route path="/grootboek" element={<Grootboek />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

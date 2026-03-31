import { useEffect, useState } from 'react'
import { usePersistedState } from '../lib/usePersistedState'
import { Plus, Trash2, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Grootboek1955, type Licentiehouder, type GrbType } from '../lib/supabase'

const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
const fmt = (v: number) => (v < 0 ? '– ' : '') + '€\u00a0' + Math.abs(Math.round(v)).toLocaleString('nl-NL')
const currentMaand = () => { const d = new Date(); return `${MONTHS[d.getMonth()]}-${d.getFullYear()}` }

const EMPTY = {
  datum: new Date().toISOString().slice(0,10),
  factuurnr: '', uw_referentie: '', omschrijving: '', vv_bedrag: '',
  licentiehouder_id: 0, artikel_type: 'Voorschot' as GrbType,
  maand: currentMaand(), jaar: new Date().getFullYear(),
}

export default function Grootboek() {
  const [rows, setRows] = useState<Grootboek1955[]>([])
  const [lhList, setLhList] = useState<Licentiehouder[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filterMaand, setFilterMaand] = usePersistedState('f-grb-maand', '')
  const [filterLh,    setFilterLh]    = usePersistedState('f-grb-lh', '')
  const [filterType,  setFilterType]  = usePersistedState('f-grb-type', '')
  const [search,      setSearch]      = usePersistedState('f-grb-search', '')

  const load = async () => {
    const [{ data:g },{ data:lh }] = await Promise.all([
      supabase.from('grootboek_1955').select('*, licentiehouders(naam)').order('datum',{ ascending:false }).limit(500),
      supabase.from('licentiehouders').select('id,naam').order('naam'),
    ])
    setRows((g ?? []) as Grootboek1955[])
    setLhList((lh ?? []) as Licentiehouder[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    return (!q || (r.omschrijving??'').toLowerCase().includes(q) || (r.licentiehouders?.naam??'').toLowerCase().includes(q)) &&
      (!filterMaand || r.maand === filterMaand) &&
      (!filterLh || String(r.licentiehouder_id) === filterLh) &&
      (!filterType || r.artikel_type === filterType)
  })

  const totaal       = filtered.filter(r => r.artikel_type !== 'Reservering').reduce((s,r) => s+r.vv_bedrag, 0)
  const totVoorschot = filtered.filter(r => r.artikel_type === 'Voorschot').reduce((s,r) => s+r.vv_bedrag, 0)
  const totEind      = filtered.filter(r => r.artikel_type === 'Eindafrekening').reduce((s,r) => s+r.vv_bedrag, 0)

  const save = async () => {
    if (!form.omschrijving.trim() || !form.vv_bedrag) { toast.error('Omschrijving en bedrag zijn verplicht'); return }
    setSaving(true)
    const { error } = await supabase.from('grootboek_1955').insert({
      datum: form.datum, factuurnr: form.factuurnr||null, uw_referentie: form.uw_referentie||null,
      omschrijving: form.omschrijving, vv_bedrag: parseFloat(String(form.vv_bedrag)),
      licentiehouder_id: form.licentiehouder_id||null, artikel_type: form.artikel_type,
      maand: form.maand, jaar: form.jaar,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Boeking opgeslagen')
    setSaving(false); setModal(false); setForm(EMPTY); load()
  }

  const remove = async (id: number) => {
    if (!confirm('Boeking verwijderen?')) return
    await supabase.from('grootboek_1955').delete().eq('id', id)
    toast.success('Verwijderd'); load()
  }

  const maanden = [...new Set(rows.map(r => r.maand))].sort().reverse()

  const typeBadge = (t: string|null) => {
    if (!t) return null
    const cls = t==='Voorschot' ? 'badge-voorschot' : t==='Eindafrekening' ? 'badge-eindafrekening' : 'badge-reservering'
    return <span className={`badge ${cls}`}>{t}</span>
  }

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Grootboek 1955</div><div className="page-sub">NTOF inzake licentiegelden</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus /> Boeking invoeren</button>
      </div>

      <div className="stats" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:20 }}>
        <div className="stat"><div className="stat-label">Totaal betaald</div><div className="stat-value">{fmt(totaal)}</div><div className="stat-sub">excl. reserveringen</div></div>
        <div className="stat"><div className="stat-label">Voorschotten</div><div className="stat-value">{fmt(totVoorschot)}</div></div>
        <div className="stat"><div className="stat-label">Eindafrekeingen</div><div className="stat-value">{fmt(totEind)}</div></div>
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex:1, maxWidth:260 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek omschrijving…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterMaand} onChange={e => setFilterMaand(e.target.value)}>
          <option value="">Alle maanden</option>
          {maanden.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterLh} onChange={e => setFilterLh(e.target.value)}>
          <option value="">Alle licentiehouders</option>
          {lhList.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Alle types</option>
          <option>Voorschot</option><option>Eindafrekening</option><option>Reservering</option><option>Overige</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Datum</th><th>Factuurnr</th><th>Omschrijving</th><th>Licentiehouder</th><th>Type</th><th className="num">Bedrag</th><th>Maand</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} className="empty">Geen boekingen gevonden</td></tr>}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="mono" style={{ whiteSpace:'nowrap' }}>{r.datum}</td>
                  <td className="mono text-muted" style={{ fontSize:12 }}>{r.factuurnr??'–'}</td>
                  <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.omschrijving}</td>
                  <td>{r.licentiehouders?.naam??'–'}</td>
                  <td>{typeBadge(r.artikel_type)}</td>
                  <td className={`num ${r.vv_bedrag < 0 ? 'text-danger' : 'text-success'}`}>{fmt(r.vv_bedrag)}</td>
                  <td className="text-muted" style={{ fontSize:12 }}>{r.maand}</td>
                  <td><button className="btn btn-ghost" onClick={() => remove(r.id)}><Trash2 /></button></td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && <tfoot><tr><td colSpan={5}>Totaal ({filtered.length} boekingen)</td><td className="num">{fmt(filtered.reduce((s,r) => s+r.vv_bedrag, 0))}</td><td colSpan={2}></td></tr></tfoot>}
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Boeking invoeren — Grb 1955</span>
              <button className="btn btn-ghost" onClick={() => setModal(false)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Datum *</label><input type="date" value={form.datum} onChange={e => setForm(f => ({...f,datum:e.target.value}))} /></div>
                <div className="form-group"><label>Maand *</label><input value={form.maand} onChange={e => setForm(f => ({...f,maand:e.target.value}))} placeholder="jan-2026" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Factuurnummer</label><input value={form.factuurnr} onChange={e => setForm(f => ({...f,factuurnr:e.target.value}))} placeholder="80103452" /></div>
                <div className="form-group"><label>Uw referentie</label><input value={form.uw_referentie} onChange={e => setForm(f => ({...f,uw_referentie:e.target.value}))} /></div>
              </div>
              <div className="form-group"><label>Omschrijving *</label><input value={form.omschrijving} onChange={e => setForm(f => ({...f,omschrijving:e.target.value}))} placeholder="bijv. Monthly Deposit 2026-01" autoFocus /></div>
              <div className="form-row">
                <div className="form-group">
                  <label>Licentiehouder</label>
                  <select value={form.licentiehouder_id} onChange={e => setForm(f => ({...f,licentiehouder_id:Number(e.target.value)}))}>
                    <option value={0}>— Selecteer —</option>
                    {lhList.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.artikel_type} onChange={e => setForm(f => ({...f,artikel_type:e.target.value as GrbType}))}>
                    <option>Voorschot</option><option>Eindafrekening</option><option>Reservering</option><option>Overige</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Bedrag (€) *</label><input type="number" step="0.01" value={form.vv_bedrag} onChange={e => setForm(f => ({...f,vv_bedrag:e.target.value}))} placeholder="115000.00" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Annuleren</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

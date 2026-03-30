import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Transactie, type Licentiehouder, type Debiteur, type Ras, type SoortPlant } from '../lib/supabase'

const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
const fmt  = (v: number|null) => v != null ? '€\u00a0'+Math.round(v).toLocaleString('nl-NL') : '–'
const fmtN = (v: number) => Math.round(v).toLocaleString('nl-NL')
const currentMaand = () => { const d = new Date(); return `${MONTHS[d.getMonth()]}-${d.getFullYear()}` }

const EMPTY = {
  datum: new Date().toISOString().slice(0,10),
  debiteur_id: 0, licentiehouder_id: 0, ras_id: 0,
  soort: 'Aardbei' as SoortPlant, aantal: '', licentiekost_per_plant: '',
  omschrijving: '', rekening: '8301', maand: currentMaand(), jaar: new Date().getFullYear(),
}

export default function Transacties() {
  const [rows, setRows] = useState<Transactie[]>([])
  const [lhList, setLhList] = useState<Licentiehouder[]>([])
  const [debList, setDebList] = useState<Debiteur[]>([])
  const [rasList, setRasList] = useState<Ras[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filterMaand, setFilterMaand] = useState('')
  const [filterLh, setFilterLh] = useState('')
  const [search, setSearch] = useState('')

  const load = async () => {
    const [{ data:t },{ data:lh },{ data:deb },{ data:ras }] = await Promise.all([
      supabase.from('transacties').select('*, debiteuren(nummer,naam,land), licentiehouders(naam), rassen(naam,soort)').order('datum',{ ascending:false }).limit(500),
      supabase.from('licentiehouders').select('id,naam').order('naam'),
      supabase.from('debiteuren').select('id,nummer,naam,land').eq('actief',true).order('naam'),
      supabase.from('rassen').select('id,naam,soort,tarief,licentiehouder_id').eq('actief',true).order('naam'),
    ])
    setRows((t ?? []) as Transactie[])
    setLhList((lh ?? []) as Licentiehouder[])
    setDebList((deb ?? []) as Debiteur[])
    setRasList((ras ?? []) as Ras[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filteredRassen = rasList.filter(r => !form.licentiehouder_id || r.licentiehouder_id === form.licentiehouder_id)

  const handleRasChange = (rasId: number) => {
    const ras = rasList.find(r => r.id === rasId)
    setForm(f => ({ ...f, ras_id:rasId, soort:ras?.soort ?? f.soort, licentiekost_per_plant:ras ? String(ras.tarief) : f.licentiekost_per_plant }))
  }

  const totaalLk = () => (parseFloat(String(form.aantal))||0) * (parseFloat(String(form.licentiekost_per_plant))||0)

  const save = async () => {
    if (!form.debiteur_id || !form.aantal || !form.maand) { toast.error('Debiteur, aantal en maand zijn verplicht'); return }
    setSaving(true)
    const { error } = await supabase.from('transacties').insert({
      datum: form.datum, rekening: form.rekening, omschrijving: form.omschrijving || null,
      debiteur_id: form.debiteur_id || null, licentiehouder_id: form.licentiehouder_id || null,
      ras_id: form.ras_id || null, soort: form.soort,
      aantal: parseInt(String(form.aantal))||0,
      licentiekost_per_plant: parseFloat(String(form.licentiekost_per_plant))||null,
      totaal_licentiekosten: totaalLk()||null,
      maand: form.maand, jaar: form.jaar,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Transactie opgeslagen')
    setSaving(false); setModal(false); setForm(EMPTY); load()
  }

  const remove = async (id: number) => {
    if (!confirm('Transactie verwijderen?')) return
    await supabase.from('transacties').delete().eq('id', id)
    toast.success('Verwijderd'); load()
  }

  const maanden = [...new Set(rows.map(r => r.maand))].sort().reverse()
  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    return (!q || (r.debiteuren?.naam??'').toLowerCase().includes(q) || (r.omschrijving??'').toLowerCase().includes(q)) &&
      (!filterMaand || r.maand === filterMaand) && (!filterLh || String(r.licentiehouder_id) === filterLh)
  })
  const totLk = filtered.reduce((s,r) => s+(r.totaal_licentiekosten??0), 0)

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Transacties</div><div className="page-sub">{rows.length} regels</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus /> Transactie invoeren</button>
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex:1, maxWidth:260 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek debiteur of omschrijving…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterMaand} onChange={e => setFilterMaand(e.target.value)}>
          <option value="">Alle maanden</option>
          {maanden.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterLh} onChange={e => setFilterLh(e.target.value)}>
          <option value="">Alle licentiehouders</option>
          {lhList.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Datum</th><th>Debiteur</th><th>Land</th><th>Licentiehouder</th><th>Ras</th><th>Soort</th><th className="num">Aantal</th><th className="num">Tarief</th><th className="num">Licentiekost</th><th>Maand</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={11} className="empty">Geen transacties gevonden</td></tr>}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="mono" style={{ whiteSpace:'nowrap' }}>{r.datum}</td>
                  <td><div style={{ fontWeight:500 }}>{r.debiteuren?.naam??'–'}</div><div className="text-muted mono" style={{ fontSize:11 }}>{r.debiteuren?.nummer}</div></td>
                  <td>{r.debiteuren?.land}</td>
                  <td className="text-muted">{r.licentiehouders?.naam??'–'}</td>
                  <td>{r.rassen?.naam??'–'}</td>
                  <td>{r.soort && <span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span>}</td>
                  <td className="num">{fmtN(r.aantal)}</td>
                  <td className="num">{r.licentiekost_per_plant != null ? `€ ${r.licentiekost_per_plant.toFixed(4)}` : '–'}</td>
                  <td className="num">{fmt(r.totaal_licentiekosten)}</td>
                  <td className="text-muted" style={{ fontSize:12 }}>{r.maand}</td>
                  <td><button className="btn btn-ghost" onClick={() => remove(r.id)}><Trash2 /></button></td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && <tfoot><tr><td colSpan={8}>Totaal ({filtered.length} regels)</td><td className="num">{fmt(totLk)}</td><td colSpan={2}></td></tr></tfoot>}
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth:600 }}>
            <div className="modal-header">
              <span className="modal-title">Transactie invoeren</span>
              <button className="btn btn-ghost" onClick={() => setModal(false)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Datum *</label><input type="date" value={form.datum} onChange={e => setForm(f => ({...f,datum:e.target.value}))} /></div>
                <div className="form-group"><label>Maand *</label><input value={form.maand} onChange={e => setForm(f => ({...f,maand:e.target.value}))} placeholder="jan-2026" /></div>
              </div>
              <div className="form-group">
                <label>Debiteur *</label>
                <select value={form.debiteur_id} onChange={e => setForm(f => ({...f,debiteur_id:Number(e.target.value)}))}>
                  <option value={0}>— Selecteer debiteur —</option>
                  {debList.map(d => <option key={d.id} value={d.id}>{d.naam} ({d.nummer} · {d.land})</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Licentiehouder</label>
                  <select value={form.licentiehouder_id} onChange={e => setForm(f => ({...f,licentiehouder_id:Number(e.target.value),ras_id:0}))}>
                    <option value={0}>— Selecteer —</option>
                    {lhList.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ras</label>
                  <select value={form.ras_id} onChange={e => handleRasChange(Number(e.target.value))}>
                    <option value={0}>— Selecteer ras —</option>
                    {filteredRassen.map(r => <option key={r.id} value={r.id}>{r.naam}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label>Soort</label>
                  <select value={form.soort} onChange={e => setForm(f => ({...f,soort:e.target.value as SoortPlant}))}>
                    <option>Aardbei</option><option>Framboos</option><option>Braam</option>
                  </select>
                </div>
                <div className="form-group"><label>Aantal planten *</label><input type="number" value={form.aantal} onChange={e => setForm(f => ({...f,aantal:e.target.value}))} placeholder="99840" /></div>
                <div className="form-group"><label>Tarief / plant (€)</label><input type="number" step="0.0001" value={form.licentiekost_per_plant} onChange={e => setForm(f => ({...f,licentiekost_per_plant:e.target.value}))} placeholder="0.0350" /></div>
              </div>
              {totaalLk() > 0 && (
                <div style={{ background:'var(--accent-bg)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color:'var(--accent)' }}>Totaal licentiekosten</span>
                  <span style={{ fontWeight:500, fontFamily:"'DM Mono',monospace" }}>€ {totaalLk().toLocaleString('nl-NL',{ minimumFractionDigits:2, maximumFractionDigits:2 })}</span>
                </div>
              )}
              <div className="form-group"><label>Omschrijving</label><input value={form.omschrijving} onChange={e => setForm(f => ({...f,omschrijving:e.target.value}))} placeholder="bijv. 2026 Aardbeien 573" /></div>
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

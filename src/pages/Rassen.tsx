import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Ras, type Licentiehouder, type SoortPlant } from '../lib/supabase'

const EMPTY_RAS = { licentiehouder_id:0, naam:'', soort:'Aardbei' as SoortPlant, tarief:0, actief:true }

export default function Rassen() {
  const [rassen, setRassen] = useState<(Ras & { licentiehouder_naam?: string })[]>([])
  const [lhList, setLhList] = useState<Licentiehouder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLh, setFilterLh] = useState('')
  const [filterSoort, setFilterSoort] = useState('')
  const [modal, setModal] = useState<'add'|'edit'|null>(null)
  const [form, setForm] = useState(EMPTY_RAS)
  const [editId, setEditId] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data:r }, { data:lh }] = await Promise.all([
      supabase.from('rassen').select('*, licentiehouders(naam)').order('naam'),
      supabase.from('licentiehouders').select('id, naam').order('naam'),
    ])
    setRassen((r ?? []).map((x: any) => ({ ...x, licentiehouder_naam: x.licentiehouders?.naam })))
    setLhList((lh ?? []) as Licentiehouder[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rassen.filter(r => {
    const q = search.toLowerCase()
    return (!q || r.naam.toLowerCase().includes(q)) &&
      (!filterLh || r.licentiehouder_id === Number(filterLh)) &&
      (!filterSoort || r.soort === filterSoort)
  })

  const save = async () => {
    if (!form.naam.trim() || !form.licentiehouder_id) { toast.error('Ras en licentiehouder zijn verplicht'); return }
    setSaving(true)
    const op = modal === 'add' ? supabase.from('rassen').insert(form) : supabase.from('rassen').update(form).eq('id', editId!)
    const { error } = await op
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Opgeslagen'); setSaving(false); setModal(null); load()
  }

  const remove = async (id: number, naam: string) => {
    if (!confirm(`Ras "${naam}" verwijderen?`)) return
    const { error } = await supabase.from('rassen').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Verwijderd'); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Rassen</div>
          <div className="page-sub">{rassen.length} rassen</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY_RAS, licentiehouder_id:lhList[0]?.id ?? 0 }); setEditId(null); setModal('add') }}>
          <Plus /> Nieuw ras
        </button>
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex:1, maxWidth:260 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek ras…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterLh} onChange={e => setFilterLh(e.target.value)}>
          <option value="">Alle licentiehouders</option>
          {lhList.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
        </select>
        <select value={filterSoort} onChange={e => setFilterSoort(e.target.value)}>
          <option value="">Alle soorten</option>
          <option>Aardbei</option><option>Framboos</option><option>Braam</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ras</th><th>Licentiehouder</th><th>Soort</th><th className="num">Tarief / plant</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="empty">Geen rassen gevonden</td></tr>}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight:500 }}>{r.naam}</td>
                  <td className="text-muted">{r.licentiehouder_naam}</td>
                  <td><span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span></td>
                  <td className="num">{r.tarief > 0 ? `€ ${r.tarief.toFixed(4)}` : <span className="text-muted">–</span>}</td>
                  <td>{r.actief ? <span className="badge badge-voorschot">Actief</span> : <span className="badge badge-reservering">Inactief</span>}</td>
                  <td><div className="actions">
                    <button className="btn btn-ghost" onClick={() => { setForm({ licentiehouder_id:r.licentiehouder_id, naam:r.naam, soort:r.soort, tarief:r.tarief, actief:r.actief }); setEditId(r.id); setModal('edit') }}><Pencil /></button>
                    <button className="btn btn-ghost" onClick={() => remove(r.id, r.naam)}><Trash2 /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal === 'add' ? 'Nieuw ras' : 'Ras bewerken'}</span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Licentiehouder *</label>
                <select value={form.licentiehouder_id} onChange={e => setForm(f => ({ ...f, licentiehouder_id:Number(e.target.value) }))}>
                  {lhList.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rasnaam *</label>
                  <input value={form.naam} onChange={e => setForm(f => ({ ...f, naam:e.target.value }))} placeholder="bijv. Favori" autoFocus />
                </div>
                <div className="form-group">
                  <label>Soort *</label>
                  <select value={form.soort} onChange={e => setForm(f => ({ ...f, soort:e.target.value as SoortPlant }))}>
                    <option>Aardbei</option><option>Framboos</option><option>Braam</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tarief per plant (€)</label>
                  <input type="number" step="0.0001" min="0" value={form.tarief} onChange={e => setForm(f => ({ ...f, tarief:parseFloat(e.target.value)||0 }))} placeholder="0.0350" />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.actief ? 'actief' : 'inactief'} onChange={e => setForm(f => ({ ...f, actief:e.target.value==='actief' }))}>
                    <option value="actief">Actief</option><option value="inactief">Inactief</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

import { useEffect, useState } from 'react'
import { usePersistedState } from '../lib/usePersistedState'
import { Plus, Pencil, Trash2, X, Search, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Ras, type Licentiehouder, type SoortPlant } from '../lib/supabase'
import { exportCsv } from '../lib/exportCsv'

const LANDEN = ['NL','BE','LU','DE','GB','IE','FR','PL','AT','CH','IT','DK','SE','FI','NO','EE','LV','LT','ES','PT','MT','RO','AR','MA','TN','BY','AM','GR','HU','SK','DZ','HR','BG','SI','RU','AE']

const EMPTY_RAS = { licentiehouder_id: 0, naam: '', soort: 'Aardbei' as SoortPlant, actief: true }

export default function Rassen() {
  const [rassen, setRassen] = useState<(Ras & { licentiehouder_naam?: string; landen?: string[] })[]>([])
  const [lhList, setLhList] = useState<Licentiehouder[]>([])
  const [loading, setLoading] = useState(true)
  const [search,      setSearch]      = usePersistedState('f-ras-search', '')
  const [filterLh,    setFilterLh]    = usePersistedState('f-ras-lh', '')
  const [filterSoort, setFilterSoort] = usePersistedState('f-ras-soort', '')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState(EMPTY_RAS)
  const [selectedLanden, setSelectedLanden] = useState<string[]>([])
  const [extraLanden, setExtraLanden] = useState<string[]>([])
  const [nieuwLand, setNieuwLand] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [sortCol, setSortCol] = usePersistedState<'naam' | 'licentiehouder_naam' | 'soort' | 'landen' | 'actief'>('f-ras-sortcol', 'naam')
  const [sortDir, setSortDir] = usePersistedState<'asc' | 'desc'>('f-ras-sortdir', 'asc')

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const load = async () => {
    const [{ data: r }, { data: lh }] = await Promise.all([
      supabase.from('rassen').select('*, licentiehouders(naam), ras_landen(land)').order('naam').limit(10000),
      supabase.from('licentiehouders').select('id, naam').order('naam').limit(10000),
    ])
    const mapped = (r ?? []).map((x: any) => ({
      ...x,
      licentiehouder_naam: x.licentiehouders?.naam,
      landen: (x.ras_landen ?? []).map((l: any) => l.land),
    }))
    setRassen(mapped)
    setLhList((lh ?? []) as Licentiehouder[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rassen.filter(r => {
    const q = search.toLowerCase()
    return (!q || r.naam.toLowerCase().includes(q)) &&
      (!filterLh || r.licentiehouder_id === Number(filterLh)) &&
      (!filterSoort || r.soort === filterSoort)
  }).sort((a, b) => {
    let av: string | number, bv: string | number
    if (sortCol === 'landen') { av = a.landen?.length ?? 0; bv = b.landen?.length ?? 0 }
    else if (sortCol === 'actief') { av = a.actief ? 1 : 0; bv = b.actief ? 1 : 0 }
    else { av = (a[sortCol] ?? '').toString().toLowerCase(); bv = (b[sortCol] ?? '').toString().toLowerCase() }
    return sortDir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0)
  })

  const toggleLand = (land: string) => {
    setSelectedLanden(prev =>
      prev.includes(land) ? prev.filter(l => l !== land) : [...prev, land]
    )
  }

  const openAdd = () => {
    setForm({ ...EMPTY_RAS, licentiehouder_id: lhList[0]?.id ?? 0 })
    setSelectedLanden([])
    setExtraLanden([])
    setNieuwLand('')
    setEditId(null)
    setModal('add')
  }

  const openEdit = (r: Ras & { landen?: string[] }) => {
    setForm({ licentiehouder_id: r.licentiehouder_id, naam: r.naam, soort: r.soort, actief: r.actief })
    const bestaand = r.landen ?? []
    setSelectedLanden(bestaand)
    setExtraLanden(bestaand.filter(l => !LANDEN.includes(l)))
    setNieuwLand('')
    setEditId(r.id)
    setModal('edit')
  }

  const alleLanden = [...LANDEN, ...extraLanden]

  const addNieuwLand = () => {
    const code = nieuwLand.trim().toUpperCase()
    if (!code || alleLanden.includes(code)) { setNieuwLand(''); return }
    setExtraLanden(prev => [...prev, code])
    setSelectedLanden(prev => [...prev, code])
    setNieuwLand('')
  }

  const save = async () => {
    if (!form.naam.trim() || !form.licentiehouder_id) { toast.error('Ras en licentiehouder zijn verplicht'); return }
    setSaving(true)

    let rasId = editId
    if (modal === 'add') {
      const { data, error } = await supabase.from('rassen').insert({ ...form, tarief: 0 }).select().single()
      if (error) { toast.error(error.message); setSaving(false); return }
      rasId = data.id
    } else {
      const { error } = await supabase.from('rassen').update({ ...form }).eq('id', editId!)
      if (error) { toast.error(error.message); setSaving(false); return }
    }

    // Sync landen
    const { error: deleteError } = await supabase.from('ras_landen').delete().eq('ras_id', rasId!)
    if (deleteError) { toast.error('Fout bij opslaan landen: ' + deleteError.message); setSaving(false); return }
    for (const land of selectedLanden) {
      const { error: insertError } = await supabase.from('ras_landen').insert({ ras_id: rasId!, land })
      if (insertError) { toast.error(`Fout bij opslaan land ${land}: ` + insertError.message); setSaving(false); return }
    }

    toast.success('Opgeslagen'); setSaving(false); setModal(null); load()
  }

  const remove = async (id: number, naam: string) => {
    if (!confirm(`Ras "${naam}" verwijderen?`)) return
    await supabase.from('code_groep_config').delete().eq('ras_id', id)
    await supabase.from('ras_landen').delete().eq('ras_id', id)
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => exportCsv(
            `rassen-${new Date().toISOString().slice(0,10)}.csv`,
            ['Ras','Soort','Licentiehouder','Landen','Actief'],
            filtered.map(r => [r.naam, r.soort, r.licentiehouder_naam ?? '', (r.landen ?? []).join(', '), r.actief ? 'Ja' : 'Nee'])
          )}>
            <Download size={14} /> Exporteren
          </button>
          <button className="btn btn-primary" onClick={openAdd}><Plus /> Nieuw ras</button>
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 260 }}>
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
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table>
            <thead><tr>
              {([['naam','Ras'],['licentiehouder_naam','Licentiehouder'],['soort','Soort'],['landen','Landen'],['actief','Status']] as const).map(([col, label]) => (
                <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
                </th>
              ))}
              <th></th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="empty">Geen rassen gevonden</td></tr>}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.naam}</td>
                  <td className="text-muted">{r.licentiehouder_naam}</td>
                  <td><span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span></td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {(r.landen ?? []).length === 0
                        ? <span className="text-muted" style={{ fontSize: 12 }}>–</span>
                        : (r.landen ?? []).map(l => (
                          <span key={l} style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>{l}</span>
                        ))}
                    </div>
                  </td>
                  <td>{r.actief ? <span className="badge badge-voorschot">Actief</span> : <span className="badge badge-reservering">Inactief</span>}</td>
                  <td><div className="actions">
                    <button className="btn btn-ghost" onClick={() => openEdit(r)}><Pencil /></button>
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
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <span className="modal-title">{modal === 'add' ? 'Nieuw ras' : 'Ras bewerken'}</span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Licentiehouder *</label>
                <select value={form.licentiehouder_id} onChange={e => setForm(f => ({ ...f, licentiehouder_id: Number(e.target.value) }))}>
                  {lhList.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rasnaam *</label>
                  <input value={form.naam} onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} placeholder="bijv. Favori" autoFocus />
                </div>
                <div className="form-group">
                  <label>Soort *</label>
                  <select value={form.soort} onChange={e => setForm(f => ({ ...f, soort: e.target.value as SoortPlant }))}>
                    <option>Aardbei</option><option>Framboos</option><option>Braam</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ margin: 0 }}>Landen</label>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '2px 8px' }}
                    onClick={() => setSelectedLanden(selectedLanden.length === alleLanden.length ? [] : [...alleLanden])}
                  >
                    {selectedLanden.length === alleLanden.length ? 'Niets selecteren' : 'Alles selecteren'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {alleLanden.map(land => (
                    <div
                      key={land}
                      onClick={() => toggleLand(land)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: selectedLanden.includes(land) ? 'var(--accent)' : 'var(--border-md)',
                        background: selectedLanden.includes(land) ? 'var(--accent-bg)' : 'var(--surface)',
                        color: selectedLanden.includes(land) ? 'var(--accent)' : 'var(--muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {land}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      value={nieuwLand}
                      onChange={e => setNieuwLand(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNieuwLand() } }}
                      placeholder="+ land"
                      maxLength={3}
                      style={{ width: 60, padding: '4px 8px', fontSize: 12, borderRadius: 6 }}
                    />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.actief ? 'actief' : 'inactief'} onChange={e => setForm(f => ({ ...f, actief: e.target.value === 'actief' }))}>
                  <option value="actief">Actief</option><option value="inactief">Inactief</option>
                </select>
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

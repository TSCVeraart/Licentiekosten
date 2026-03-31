import { useEffect, useState } from 'react'
import { usePersistedState } from '../lib/usePersistedState'
import { Plus, Search, Pencil, Trash2, X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Debiteur, type DebiteurType } from '../lib/supabase'

const LANDEN = ['NL','BE','DE','GB','FR','IT','ES','AT','CH','DK','SE','FI','PL','CZ','GR','IE','LV','BY','AM','AE','MA','US','CA','Other']
const EMPTY: Omit<Debiteur,'id'|'created_at'|'updated_at'> = { nummer:'', naam:'', land:'NL', type:'Extern', actief:true }

export default function Debiteuren() {
  const [rows, setRows] = useState<Debiteur[]>([])
  const [loading, setLoading] = useState(true)
  const [search,      setSearch]      = usePersistedState('f-deb-search', '')
  const [filterLand,  setFilterLand]  = usePersistedState('f-deb-land', '')
  const [modal, setModal] = useState<'add'|'edit'|'import'|null>(null)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const [importRows, setImportRows] = useState<{nummer:string,naam:string,land:string}[]>([])
  const [importing, setImporting] = useState(false)
  const [paste, setPaste] = useState('')
  const [sortCol, setSortCol] = usePersistedState<'nummer'|'naam'|'land'|'actief'>('f-deb-sortcol', 'naam')
  const [sortDir, setSortDir] = usePersistedState<'asc'|'desc'>('f-deb-sortdir', 'asc')
  const [ontbrekend, setOntbrekend] = useState<{debiteur_nr: number; debiteur_naam: string}[]>([])

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const load = async () => {
    const pageSize = 1000
    let all: Debiteur[] = []
    let from = 0
    while (true) {
      const { data } = await supabase.from('debiteuren').select('*').order('naam').range(from, from + pageSize - 1)
      if (!data?.length) break
      all = [...all, ...data as Debiteur[]]
      if (data.length < pageSize) break
      from += pageSize
    }
    setRows(all); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const loadOntbrekend = async () => {
    const { data } = await supabase
      .from('omzetrekeningen')
      .select('debiteur_nr, debiteur_naam')
      .is('land_debiteur', null)
      .not('debiteur_nr', 'is', null)
    if (!data?.length) { setOntbrekend([]); return }
    const uniek = [...new Map(
      (data as {debiteur_nr: number; debiteur_naam: string}[])
        .filter(r => r.debiteur_nr != null)
        .map(r => [r.debiteur_nr, r])
    ).values()]
    setOntbrekend(uniek)
  }
  useEffect(() => { loadOntbrekend() }, [])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    return (!q || r.naam.toLowerCase().includes(q) || r.nummer.includes(q)) &&
      (!filterLand || r.land === filterLand)
  }).sort((a, b) => {
    let av: string | number, bv: string | number
    if (sortCol === 'actief') { av = a.actief ? 1 : 0; bv = b.actief ? 1 : 0 }
    else if (sortCol === 'nummer') { av = parseInt(a.nummer) || 0; bv = parseInt(b.nummer) || 0 }
    else { av = (a[sortCol] ?? '').toLowerCase(); bv = (b[sortCol] ?? '').toLowerCase() }
    return sortDir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0)
  })

  const save = async () => {
    if (!form.nummer.trim() || !form.naam.trim()) { toast.error('Nummer en naam zijn verplicht'); return }
    setSaving(true)
    const op = modal === 'add' ? supabase.from('debiteuren').insert(form) : supabase.from('debiteuren').update(form).eq('id', editId!)
    const { error } = await op
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(modal === 'add' ? 'Debiteur toegevoegd' : 'Opgeslagen')
    setSaving(false); setModal(null); load(); loadOntbrekend()
  }

  const remove = async (id: number, naam: string) => {
    if (!confirm(`Debiteur "${naam}" verwijderen?`)) return
    const { error } = await supabase.from('debiteuren').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Verwijderd'); load()
  }

  const parsePaste = () => {
    const lines = paste.trim().split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim())
    if (!lines.length) { toast.error('Geen data geplakt'); return }
    const parsed = lines.map(line => {
      const c = line.split('\t')
      return {
        nummer: (c[0] ?? '').trim(),
        naam:   (c[1] ?? '').trim(),
        land:   (c[2] ?? '').trim().toUpperCase().slice(0, 2) || 'NL',
      }
    }).filter(r => r.nummer && r.naam)
    if (!parsed.length) { toast.error('Geen geldige rijen gevonden'); return }
    const deduped = [...new Map(parsed.map(r => [r.nummer, r])).values()]
    setImportRows(deduped)
    setModal('import')
    toast.success(`${parsed.length} regels herkend`)
  }

  const doImport = async () => {
    if (importRows.length === 0) return
    setImporting(true)
    const payload = importRows.map(r => ({
      nummer: r.nummer, naam: r.naam,
      land: r.land || 'NL', type: 'Extern' as DebiteurType, actief: true
    }))
    const { error } = await supabase.from('debiteuren').upsert(payload, { onConflict: 'nummer' })
    if (error) { toast.error(error.message); setImporting(false); return }
    toast.success(`${importRows.length} debiteuren geïmporteerd`)
    setImporting(false); setModal(null); setImportRows([]); setPaste(''); load()
  }

  const lands = [...new Set(rows.map(r => r.land))].sort()

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Debiteuren</div>
          <div className="page-sub">{rows.length} debiteuren</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {rows.length > 0 && (
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={async () => {
              if (!confirm(`Alle ${rows.length} debiteuren verwijderen?`)) return
              const { error } = await supabase.from('debiteuren').delete().gte('id', 0)
              if (error) { toast.error(error.message); return }
              toast.success('Alle debiteuren verwijderd'); load()
            }}>
              <Trash2 size={15} /> Alles verwijderen
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setEditId(null); setModal('add') }}>
            <Plus /> Nieuwe debiteur
          </button>
        </div>
      </div>

      {ontbrekend.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: 16, borderLeft: '4px solid var(--danger)' }}>
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 10, color: 'var(--danger)' }}>
            {ontbrekend.length} debiteur{ontbrekend.length !== 1 ? 'en' : ''} zonder land in omzetrekeningen
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ontbrekend.map(r => (
              <div key={r.debiteur_nr} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span className="mono text-muted" style={{ fontSize: 12, minWidth: 60 }}>{r.debiteur_nr}</span>
                <span style={{ flex: 1 }}>{r.debiteur_naam ?? '–'}</span>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '3px 10px' }}
                  onClick={() => {
                    setForm({ ...EMPTY, nummer: String(r.debiteur_nr), naam: r.debiteur_naam ?? '' })
                    setEditId(null)
                    setModal('add')
                  }}
                >
                  Toevoegen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>Excel data plakken</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Kolommen A→C: Debnr · Naam · Land (bijv. NL)
        </div>
        <textarea
          value={paste}
          onChange={e => { setPaste(e.target.value); setImportRows([]) }}
          placeholder="Kopieer vanuit Excel en plak hier (Ctrl+V)…"
          style={{ width: '100%', minHeight: 90, fontFamily: "'DM Mono', monospace", fontSize: 12, padding: '10px 12px', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button className="btn btn-secondary" onClick={parsePaste} disabled={!paste.trim()}>Verwerk</button>
          {importRows.length > 0 && (
            <>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{importRows.length} regels klaar</span>
              <button className="btn btn-primary" onClick={doImport} disabled={importing} style={{ marginLeft: 'auto' }}>
                <Upload size={14} /> {importing ? 'Importeren…' : `${importRows.length} regels importeren`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex:1, maxWidth:300 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek op naam of nummer…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterLand} onChange={e => setFilterLand(e.target.value)}>
          <option value="">Alle landen</option>
          {lands.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
          <table>
            <thead><tr>
              {([['nummer','Nummer'],['naam','Naam'],['land','Land'],['actief','Status']] as const).map(([col, label]) => (
                <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
                </th>
              ))}
              <th></th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} className="empty">Geen debiteuren gevonden</td></tr>}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.nummer}</td>
                  <td>{r.naam}</td>
                  <td>{r.land}</td>
                  <td>{r.actief ? <span className="badge badge-voorschot">Actief</span> : <span className="badge badge-reservering">Inactief</span>}</td>
                  <td><div className="actions">
                    <button className="btn btn-ghost" onClick={() => { setForm({nummer:r.nummer,naam:r.naam,land:r.land,type:r.type,actief:r.actief}); setEditId(r.id); setModal('edit') }}><Pencil /></button>
                    <button className="btn btn-ghost" onClick={() => remove(r.id, r.naam)}><Trash2 /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toevoegen / bewerken modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal === 'add' ? 'Nieuwe debiteur' : 'Debiteur bewerken'}</span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Debiteursnummer *</label>
                  <input value={form.nummer} onChange={e => setForm(f => ({...f,nummer:e.target.value}))} placeholder="bijv. 3223" />
                </div>
                <div className="form-group">
                  <label>Land *</label>
                  <select value={form.land} onChange={e => setForm(f => ({...f,land:e.target.value}))}>
                    {LANDEN.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Naam *</label>
                <input value={form.naam} onChange={e => setForm(f => ({...f,naam:e.target.value}))} placeholder="Bedrijfsnaam of naam" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.actief ? 'actief' : 'inactief'} onChange={e => setForm(f => ({...f,actief:e.target.value==='actief'}))}>
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

      {/* Import preview modal */}
      {modal === 'import' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth:640 }}>
            <div className="modal-header">
              <span className="modal-title">{importRows.length} debiteuren gevonden</span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X /></button>
            </div>
            <div style={{ maxHeight:360, overflowY:'auto' }}>
              <table>
                <thead><tr><th>Nummer</th><th>Naam</th><th>Land</th></tr></thead>
                <tbody>
                  {importRows.map((r,i) => (
                    <tr key={i}>
                      <td className="mono">{r.nummer}</td>
                      <td>{r.naam}</td>
                      <td>{r.land}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <span className="text-muted" style={{ fontSize:12, flex:1 }}>Bestaande debiteuren worden bijgewerkt op basis van nummer</span>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn btn-primary" onClick={doImport} disabled={importing}>
                {importing ? 'Importeren…' : `${importRows.length} importeren`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

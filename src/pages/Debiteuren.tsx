import { useEffect, useState, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Debiteur, type DebiteurType } from '../lib/supabase'

const LANDEN = ['NL','BE','DE','GB','FR','IT','ES','AT','CH','DK','SE','FI','PL','CZ','GR','IE','LV','BY','AM','AE','MA','US','CA','Other']
const EMPTY: Omit<Debiteur,'id'|'created_at'|'updated_at'> = { nummer:'', naam:'', land:'NL', type:'Extern', actief:true }

export default function Debiteuren() {
  const [rows, setRows] = useState<Debiteur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLand, setFilterLand] = useState('')
  const [modal, setModal] = useState<'add'|'edit'|'import'|null>(null)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const [importRows, setImportRows] = useState<{nummer:string,naam:string,land:string}[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { data } = await supabase.from('debiteuren').select('*').order('naam')
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    return (!q || r.naam.toLowerCase().includes(q) || r.nummer.includes(q)) &&
      (!filterLand || r.land === filterLand)
  })

  const save = async () => {
    if (!form.nummer.trim() || !form.naam.trim()) { toast.error('Nummer en naam zijn verplicht'); return }
    setSaving(true)
    const op = modal === 'add' ? supabase.from('debiteuren').insert(form) : supabase.from('debiteuren').update(form).eq('id', editId!)
    const { error } = await op
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(modal === 'add' ? 'Debiteur toegevoegd' : 'Opgeslagen')
    setSaving(false); setModal(null); load()
  }

  const remove = async (id: number, naam: string) => {
    if (!confirm(`Debiteur "${naam}" verwijderen?`)) return
    const { error } = await supabase.from('debiteuren').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Verwijderd'); load()
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(/[,;	]/)
        return {
          nummer: (cols[0] ?? '').trim().replace(/"/g,''),
          naam:   (cols[1] ?? '').trim().replace(/"/g,''),
          land:   (cols[2] ?? '').trim().replace(/"/g,'').toUpperCase().slice(0,2),
        }
      }).filter(r => r.nummer && r.naam)
      setImportRows(parsed)
      setModal('import')
    }
    reader.readAsText(file)
    e.target.value = ''
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
    setImporting(false); setModal(null); setImportRows([]); load()
  }

  const lands = [...new Set(rows.map(r => r.land))].sort()

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" style={{ display:'none' }} onChange={handleFile} />

      <div className="page-header">
        <div>
          <div className="page-title">Debiteuren</div>
          <div className="page-sub">{rows.length} debiteuren</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload /> Excel importeren
          </button>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setEditId(null); setModal('add') }}>
            <Plus /> Nieuwe debiteur
          </button>
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
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nummer</th><th>Naam</th><th>Land</th><th>Status</th><th></th></tr></thead>
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

import { useEffect, useState } from 'react'
import { Upload, Trash2, Search, Plus, X, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { exportCsv } from '../lib/exportCsv'

interface ArtikelCode {
  id: number
  artikel: number | null
  omschrijving: string | null
  code_groep: string | null
  created_at: string
}

type RawRow = Omit<ArtikelCode, 'id' | 'created_at'>

export default function Artikelen() {
  const [rows, setRows] = useState<ArtikelCode[]>([])
  const [loading, setLoading] = useState(true)
  const [paste, setPaste] = useState('')
  const [preview, setPreview] = useState<RawRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ artikel: '', omschrijving: '', code_groep: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const pageSize = 1000
    let all: ArtikelCode[] = []
    let from = 0
    while (true) {
      const { data } = await supabase.from('artikel_codes').select('*').order('artikel').range(from, from + pageSize - 1)
      if (!data?.length) break
      all = [...all, ...data as ArtikelCode[]]
      if (data.length < pageSize) break
      from += pageSize
    }
    setRows(all)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const parsePaste = () => {
    const lines = paste.trim().split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim())
    if (!lines.length) { toast.error('Geen data geplakt'); return }
    const parsed: RawRow[] = lines.map(line => {
      const c = line.split('\t')
      return {
        artikel: c[0]?.trim() ? parseInt(c[0]) || null : null,
        omschrijving: c[1]?.trim() || null,
        code_groep: c[2]?.trim() || null,
      }
    })
    setPreview(parsed)
    toast.success(`${parsed.length} regels herkend`)
  }

  const importRows = async () => {
    if (!preview?.length) return
    setImporting(true)
    const { error } = await supabase.from('artikel_codes').upsert(preview, { onConflict: 'artikel' })
    if (error) { toast.error(error.message); setImporting(false); return }
    toast.success(`${preview.length} regels geïmporteerd`)
    setImporting(false)
    setPaste('')
    setPreview(null)
    load()
  }

  const remove = async (id: number) => {
    if (!confirm('Artikel verwijderen?')) return
    await supabase.from('artikel_codes').delete().eq('id', id)
    toast.success('Verwijderd'); load()
  }

  const saveCodeGroep = async (id: number) => {
    const val = editVal.trim() || null
    const { error } = await supabase.from('artikel_codes').update({ code_groep: val }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setEditingId(null)
    setRows(prev => prev.map(r => r.id === id ? { ...r, code_groep: val } : r))
  }

  const saveManual = async () => {
    if (!form.artikel.trim()) { toast.error('Artikelnummer is verplicht'); return }
    setSaving(true)
    const { error } = await supabase.from('artikel_codes').upsert({
      artikel: parseInt(form.artikel) || null,
      omschrijving: form.omschrijving.trim() || null,
      code_groep: form.code_groep.trim() || null,
    }, { onConflict: 'artikel' })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Opgeslagen')
    setSaving(false)
    setModal(false)
    setForm({ artikel: '', omschrijving: '', code_groep: '' })
    load()
  }

  const removeAll = async () => {
    if (!confirm(`Alle ${rows.length} artikelen verwijderen?`)) return
    const { error } = await supabase.from('artikel_codes').delete().gte('id', 0)
    if (error) { toast.error(error.message); return }
    toast.success('Alle data verwijderd'); load()
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    return !q ||
      String(r.artikel ?? '').includes(q) ||
      (r.omschrijving ?? '').toLowerCase().includes(q) ||
      String(r.code_groep ?? '').includes(q)
  })

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Artikelen</div>
          <div className="page-sub">{rows.length} artikelen</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {rows.length > 0 && (
            <>
              <button className="btn btn-ghost" onClick={() => exportCsv(
                `artikelen-${new Date().toISOString().slice(0,10)}.csv`,
                ['Artikel','Omschrijving','Code groep'],
                filtered.map(r => [r.artikel, r.omschrijving, r.code_groep])
              )}>
                <Download size={14} /> Exporteren
              </button>
              <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={removeAll}>
                <Trash2 size={15} /> Alles verwijderen
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={() => { setForm({ artikel: '', omschrijving: '', code_groep: '' }); setModal(true) }}>
            <Plus /> Artikel toevoegen
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>Excel data plakken</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Kolommen A→C: Artikel (code) · Omschrijving · Code groep
        </div>
        <textarea
          value={paste}
          onChange={e => { setPaste(e.target.value); setPreview(null) }}
          placeholder="Kopieer vanuit Excel en plak hier (Ctrl+V)…"
          style={{
            width: '100%', minHeight: 90, fontFamily: "'DM Mono', monospace", fontSize: 12,
            padding: '10px 12px', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)',
            background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button className="btn btn-secondary" onClick={parsePaste} disabled={!paste.trim()}>
            Verwerk
          </button>
          {preview && (
            <>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{preview.length} regels klaar</span>
              <button className="btn btn-primary" onClick={importRows} disabled={importing} style={{ marginLeft: 'auto' }}>
                <Upload size={14} /> {importing ? 'Importeren…' : `${preview.length} regels importeren`}
              </button>
            </>
          )}
        </div>

        {preview && (
          <div style={{ marginTop: 14, overflowX: 'auto', overflowY: 'auto', maxHeight: 280, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <table style={{ fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  {['Artikel', 'Omschrijving', 'Code groep'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--card, var(--surface))', zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 8px', fontFamily: "'DM Mono', monospace" }}>{r.artikel ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.omschrijving ?? '–'}</td>
                    <td style={{ padding: '4px 8px', fontFamily: "'DM Mono', monospace" }}>{r.code_groep ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek artikel of omschrijving…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
          <table>
            <thead>
              <tr>
                <th>Artikel</th>
                <th>Omschrijving</th>
                <th>Code groep</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={4} className="empty">Geen artikelen gevonden</td></tr>}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.artikel ?? '–'}</td>
                  <td>{r.omschrijving ?? '–'}</td>
                  <td onClick={() => { setEditingId(r.id); setEditVal(r.code_groep != null ? String(r.code_groep) : '') }} style={{ cursor: 'pointer', minWidth: 100 }}>
                    {editingId === r.id
                      ? <input
                          type="text"
                          value={editVal}
                          autoFocus
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => saveCodeGroep(r.id)}
                          onKeyDown={e => { if (e.key === 'Enter') saveCodeGroep(r.id); if (e.key === 'Escape') setEditingId(null) }}
                          style={{ width: 90, padding: '2px 6px', fontSize: 13 }}
                          onClick={e => e.stopPropagation()}
                        />
                      : r.code_groep != null
                        ? <span className="mono">{r.code_groep}</span>
                        : <span className="text-muted" style={{ fontSize: 12 }}>klik om in te vullen</span>
                    }
                  </td>
                  <td><button className="btn btn-ghost" onClick={() => remove(r.id)}><Trash2 /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Artikel toevoegen</span>
              <button className="btn btn-ghost" onClick={() => setModal(false)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Artikelnummer *</label>
                  <input type="number" value={form.artikel} onChange={e => setForm(f => ({ ...f, artikel: e.target.value }))} placeholder="bijv. 12345" autoFocus />
                </div>
                <div className="form-group">
                  <label>Code groep</label>
                  <input type="text" value={form.code_groep} onChange={e => setForm(f => ({ ...f, code_groep: e.target.value }))} placeholder="bijv. Tulameen 2C" />
                </div>
              </div>
              <div className="form-group">
                <label>Omschrijving</label>
                <input value={form.omschrijving} onChange={e => setForm(f => ({ ...f, omschrijving: e.target.value }))} placeholder="bijv. Aardbeien NL" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Annuleren</button>
              <button className="btn btn-primary" onClick={saveManual} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

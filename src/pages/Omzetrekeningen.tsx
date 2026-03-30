import { useEffect, useState } from 'react'
import { Upload, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type SoortPlant } from '../lib/supabase'

interface Omzetrekening {
  id: number
  datum: string | null
  rekening: string | null
  omschrijving: string | null
  debet_eur: number | null
  credit_eur: number | null
  vv_bedrag: number | null
  debiteur_nr: number | null
  debiteur_naam: string | null
  land_debiteur: string | null
  artikel_omschrijving: string | null
  artikel: number | null
  aantal: number | null
  soort: SoortPlant | null
  created_at: string
}

type RawRow = Omit<Omzetrekening, 'id' | 'created_at'>

const REKENING_SOORT: Record<string, SoortPlant> = {
  '8301': 'Aardbei',
  '8304': 'Framboos',
  '8305': 'Braam',
}

const parseNum = (s: string) => {
  if (!s.trim()) return null
  const clean = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

const parseDate = (s: string) => {
  if (!s.trim()) return null
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s.trim() || null
}

const fmt = (v: number | null) =>
  v != null ? '€\u00a0' + v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'

export default function Omzetrekeningen() {
  const [rows, setRows] = useState<Omzetrekening[]>([])
  const [debLandMap, setDebLandMap] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [paste, setPaste] = useState('')
  const [preview, setPreview] = useState<RawRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    const [{ data }, { data: deb }] = await Promise.all([
      supabase.from('omzetrekeningen').select('*').order('datum', { ascending: false }).limit(2000),
      supabase.from('debiteuren').select('nummer, land'),
    ])
    setRows((data ?? []) as Omzetrekening[])
    const map: Record<number, string> = {}
    for (const d of (deb ?? []) as { nummer: string; land: string }[]) {
      const nr = parseInt(d.nummer)
      if (!isNaN(nr)) map[nr] = d.land
    }
    setDebLandMap(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const parsePaste = () => {
    const lines = paste.trim().split('\n').filter(l => l.trim())
    if (!lines.length) { toast.error('Geen data geplakt'); return }
    const parsed: RawRow[] = lines.map(line => {
      const c = line.split('\t')
      const rekening = c[1]?.trim() || null
      const debiteur_nr = c[6]?.trim() ? parseInt(c[6]) || null : null
      return {
        datum: parseDate(c[0] ?? ''),
        rekening,
        omschrijving: c[2]?.trim() || null,
        debet_eur: parseNum(c[3] ?? ''),
        credit_eur: parseNum(c[4] ?? ''),
        vv_bedrag: parseNum(c[5] ?? ''),
        debiteur_nr,
        debiteur_naam: c[7]?.trim() || null,
        land_debiteur: debiteur_nr != null ? (debLandMap[debiteur_nr] ?? null) : null,
        artikel_omschrijving: c[8]?.trim() || null,
        artikel: c[9]?.trim() ? parseInt(c[9]) || null : null,
        aantal: c[10]?.trim() ? parseInt(c[10]) || null : null,
        soort: rekening ? (REKENING_SOORT[rekening] ?? null) : null,
      }
    })
    setPreview(parsed)
    toast.success(`${parsed.length} regels herkend`)
  }

  const importRows = async () => {
    if (!preview?.length) return
    setImporting(true)
    const { error } = await supabase.from('omzetrekeningen').insert(preview)
    if (error) { toast.error(error.message); setImporting(false); return }
    toast.success(`${preview.length} regels geïmporteerd`)
    setImporting(false)
    setPaste('')
    setPreview(null)
    load()
  }

  const remove = async (id: number) => {
    if (!confirm('Regel verwijderen?')) return
    await supabase.from('omzetrekeningen').delete().eq('id', id)
    toast.success('Verwijderd'); load()
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    return !q ||
      (r.debiteur_naam ?? '').toLowerCase().includes(q) ||
      (r.omschrijving ?? '').toLowerCase().includes(q) ||
      (r.rekening ?? '').includes(q) ||
      String(r.debiteur_nr ?? '').includes(q)
  })

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Omzetrekeningen</div>
          <div className="page-sub">{rows.length} regels</div>
        </div>
      </div>

      {/* Import */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>Excel data plakken</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Kolommen A→K: Datum · Rekening · Omschrijving · Debet EUR · Credit EUR · V.V.-bedrag · Debiteur · Debiteur: Naam · Artikelomschrijving · Artikel · Aantal
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
          <div style={{ marginTop: 14, overflowX: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <table style={{ fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  {['Datum','Rekening','Omschrijving','Debet','Credit','V.V.','Deb. nr','Deb. naam','Land','Soort','Artikel omschr.','Artikel','Aantal'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', fontFamily: "'DM Mono',monospace" }}>{r.datum ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.rekening ?? '–'}</td>
                    <td style={{ padding: '4px 8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.omschrijving ?? '–'}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{fmt(r.debet_eur)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{fmt(r.credit_eur)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{fmt(r.vv_bedrag)}</td>
                    <td style={{ padding: '4px 8px' }}>{r.debiteur_nr ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.debiteur_naam ?? '–'}</td>
                    <td style={{ padding: '4px 8px', fontWeight: r.land_debiteur ? 500 : undefined }}>{r.land_debiteur ?? <span style={{ color: 'var(--muted)' }}>–</span>}</td>
                    <td style={{ padding: '4px 8px' }}>{r.soort ? <span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span> : '–'}</td>
                    <td style={{ padding: '4px 8px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.artikel_omschrijving ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.artikel ?? '–'}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.aantal ?? '–'}</td>
                  </tr>
                ))}
                {preview.length > 10 && (
                  <tr><td colSpan={13} style={{ padding: '6px 8px', color: 'var(--muted)', fontStyle: 'italic' }}>… en nog {preview.length - 10} regels</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek debiteur, omschrijving of rekening…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Rekening</th>
                <th>Omschrijving</th>
                <th className="num">Debet EUR</th>
                <th className="num">Credit EUR</th>
                <th className="num">V.V.-bedrag</th>
                <th>Debiteur</th>
                <th>Naam</th>
                <th>Land</th>
                <th>Soort</th>
                <th>Artikel</th>
                <th className="num">Aantal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={13} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={13} className="empty">Geen regels gevonden</td></tr>}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.datum ?? '–'}</td>
                  <td className="mono text-muted" style={{ fontSize: 12 }}>{r.rekening ?? '–'}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.omschrijving ?? '–'}</td>
                  <td className="num">{fmt(r.debet_eur)}</td>
                  <td className="num">{fmt(r.credit_eur)}</td>
                  <td className="num">{fmt(r.vv_bedrag)}</td>
                  <td className="mono text-muted" style={{ fontSize: 12 }}>{r.debiteur_nr ?? '–'}</td>
                  <td>{r.debiteur_naam ?? '–'}</td>
                  <td>{r.land_debiteur ?? <span className="text-muted">–</span>}</td>
                  <td>{r.soort ? <span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span> : <span className="text-muted">–</span>}</td>
                  <td className="mono text-muted" style={{ fontSize: 12 }}>{r.artikel ?? '–'}</td>
                  <td className="num">{r.aantal?.toLocaleString('nl-NL') ?? '–'}</td>
                  <td><button className="btn btn-ghost" onClick={() => remove(r.id)}><Trash2 /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

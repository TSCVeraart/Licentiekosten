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
  code_groep: number | null
  ras_naam: string | null
  licentiehouder_naam: string | null
  licentiekosten: number | null
  totaal_licentiekosten: number | null
  intern_extern: string | null
  created_at: string
}

type RawRow = Omit<Omzetrekening, 'id' | 'created_at'>

const REKENING_SOORT: Record<string, SoortPlant> = {
  '8301': 'Aardbei',
  '8304': 'Framboos',
  '8305': 'Braam',
}

const internExtern = (debiteur_nr: number | null, lh_naam: string | null): string => {
  if (debiteur_nr === 1870) return 'Intern'
  if (debiteur_nr === 2413 && (lh_naam ?? '').toLowerCase().includes('royakkers')) return 'Royakkers'
  if (debiteur_nr === 2435 && (lh_naam ?? '').toLowerCase().includes('berryworld')) return 'BerryWorld'
  return 'Extern'
}

const soortVanRekening = (rekening: string | null): SoortPlant | null => {
  if (!rekening) return null
  return REKENING_SOORT[rekening.trim()] ?? null
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

const fmtTarief = (v: number | null) =>
  v != null ? `€ ${v.toFixed(4)}` : '–'

const COLS: { key: string; label: string; num?: boolean }[] = [
  { key: 'datum',              label: 'Datum' },
  { key: 'rekening',          label: 'Rekening' },
  { key: 'omschrijving',      label: 'Omschrijving' },
  { key: 'debet_eur',         label: 'Debet EUR',      num: true },
  { key: 'credit_eur',        label: 'Credit EUR',     num: true },
  { key: 'vv_bedrag',         label: 'V.V.-bedrag',    num: true },
  { key: 'debiteur_nr',       label: 'Debiteur' },
  { key: 'debiteur_naam',     label: 'Naam' },
  { key: 'land_debiteur',     label: 'Land' },
  { key: 'soort',             label: 'Soort' },
  { key: 'artikel',           label: 'Artikel' },
  { key: 'code_groep',        label: 'Code groep' },
  { key: 'ras_naam',          label: 'Ras' },
  { key: 'licentiehouder_naam', label: 'Licentiehouder' },
  { key: 'licentiekosten',    label: 'Tarief' },
  { key: 'totaal_licentiekosten', label: 'Totaal LK',  num: true },
  { key: 'intern_extern',     label: 'Type' },
  { key: 'aantal',            label: 'Aantal',         num: true },
]
const COL_KEYS = COLS.map(c => c.key)

export default function Omzetrekeningen() {
  const [rows, setRows] = useState<Omzetrekening[]>([])
  const [debLandMap, setDebLandMap] = useState<Record<number, string>>({})
  const [artikelGroepMap, setArtikelGroepMap] = useState<Record<number, number>>({})
  const [codeGroepRasMap, setCodeGroepRasMap] = useState<Record<number, { naam: string; lh_naam: string }>>({})
  const [tarievenMap, setTarievenMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [paste, setPaste] = useState('')
  const [preview, setPreview] = useState<RawRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [colOrder, setColOrder] = useState<string[]>(
    () => JSON.parse(localStorage.getItem('omzet-col-order') ?? 'null') ?? COL_KEYS
  )
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [filterRekening, setFilterRekening] = useState('')
  const [filterSoort, setFilterSoort] = useState('')
  const [filterLand, setFilterLand] = useState('')
  const [filterRas, setFilterRas] = useState('')
  const [filterLh, setFilterLh] = useState('')
  const [filterType, setFilterType] = useState('')
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const orderedCols = colOrder.map(k => COLS.find(c => c.key === k)).filter(Boolean) as typeof COLS

  const onDrop = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) { setDragKey(null); setDragOverKey(null); return }
    const order = [...colOrder]
    const from = order.indexOf(dragKey)
    const to = order.indexOf(targetKey)
    order.splice(from, 1)
    order.splice(to, 0, dragKey)
    setColOrder(order)
    localStorage.setItem('omzet-col-order', JSON.stringify(order))
    setDragKey(null)
    setDragOverKey(null)
  }

  const renderCell = (r: Omzetrekening, key: string) => {
    switch (key) {
      case 'datum':              return <td key={key} className="mono" style={{ whiteSpace: 'nowrap' }}>{r.datum ?? '–'}</td>
      case 'rekening':           return <td key={key} className="mono text-muted" style={{ fontSize: 12 }}>{r.rekening ?? '–'}</td>
      case 'omschrijving':       return <td key={key} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.omschrijving ?? '–'}</td>
      case 'debet_eur':          return <td key={key} className="num">{fmt(r.debet_eur)}</td>
      case 'credit_eur':         return <td key={key} className="num">{fmt(r.credit_eur)}</td>
      case 'vv_bedrag':          return <td key={key} className="num">{fmt(r.vv_bedrag)}</td>
      case 'debiteur_nr':        return <td key={key} className="mono text-muted" style={{ fontSize: 12 }}>{r.debiteur_nr ?? '–'}</td>
      case 'debiteur_naam':      return <td key={key}>{r.debiteur_naam ?? '–'}</td>
      case 'land_debiteur':      return <td key={key}>{r.land_debiteur ?? <span className="text-muted">–</span>}</td>
      case 'soort':              return <td key={key}>{r.soort ? <span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span> : <span className="text-muted">–</span>}</td>
      case 'artikel':            return <td key={key} className="mono text-muted" style={{ fontSize: 12 }}>{r.artikel ?? '–'}</td>
      case 'code_groep':         return <td key={key} className="mono text-muted" style={{ fontSize: 12 }}>{r.code_groep ?? '–'}</td>
      case 'ras_naam':           return <td key={key}>{r.ras_naam ?? <span className="text-muted">–</span>}</td>
      case 'licentiehouder_naam':return <td key={key} className="text-muted" style={{ fontSize: 12 }}>{r.licentiehouder_naam ?? '–'}</td>
      case 'licentiekosten':     return <td key={key} className="mono" style={{ fontSize: 12 }}>{fmtTarief(r.licentiekosten)}</td>
      case 'totaal_licentiekosten': return <td key={key} className="num" style={{ fontWeight: 500 }}>{fmt(r.totaal_licentiekosten)}</td>
      case 'intern_extern':      return <td key={key}>{r.intern_extern ?? <span className="text-muted">–</span>}</td>
      case 'aantal':             return <td key={key} className="num">{r.aantal?.toLocaleString('nl-NL') ?? '–'}</td>
      default:                   return <td key={key}>–</td>
    }
  }

  const fetchAllOmzet = async (): Promise<Omzetrekening[]> => {
    const pageSize = 1000
    let all: Omzetrekening[] = []
    let from = 0
    while (true) {
      const { data } = await supabase.from('omzetrekeningen').select('*').order('datum', { ascending: false }).range(from, from + pageSize - 1)
      if (!data?.length) break
      all = [...all, ...data as Omzetrekening[]]
      if (data.length < pageSize) break
      from += pageSize
    }
    return all
  }

  const load = async () => {
    const [omzetData, { data: deb }, { data: art }, { data: cgc }, { data: r }, { data: lh }, { data: lk }] = await Promise.all([
      fetchAllOmzet(),
      supabase.from('debiteuren').select('nummer, land'),
      supabase.from('artikel_codes').select('artikel, code_groep'),
      supabase.from('code_groep_config').select('code_groep, ras_id'),
      supabase.from('rassen').select('id, naam, licentiehouder_id'),
      supabase.from('licentiehouders').select('id, naam'),
      supabase.from('licentiekosten').select('code_groep, land, tarief'),
    ])
    setRows(omzetData)

    // Debiteur → land
    const debMap: Record<number, string> = {}
    for (const d of (deb ?? []) as { nummer: string; land: string }[]) {
      const nr = parseInt(d.nummer)
      if (!isNaN(nr)) debMap[nr] = d.land
    }
    setDebLandMap(debMap)

    // Artikel → code_groep
    const artMap: Record<number, number> = {}
    for (const a of (art ?? []) as { artikel: number; code_groep: number | null }[])
      if (a.artikel != null && a.code_groep != null) artMap[a.artikel] = a.code_groep
    setArtikelGroepMap(artMap)

    // Licentiehouder naam map
    const lhMap: Record<number, string> = {}
    for (const l of (lh ?? []) as { id: number; naam: string }[]) lhMap[l.id] = l.naam

    // Ras map: id → naam + lh_naam
    const rasMap: Record<number, { naam: string; lh_naam: string }> = {}
    for (const ras of (r ?? []) as { id: number; naam: string; licentiehouder_id: number }[])
      rasMap[ras.id] = { naam: ras.naam, lh_naam: lhMap[ras.licentiehouder_id] ?? '–' }

    // code_groep → ras info
    const cgRasMap: Record<number, { naam: string; lh_naam: string }> = {}
    for (const c of (cgc ?? []) as { code_groep: number; ras_id: number | null }[])
      if (c.ras_id != null && rasMap[c.ras_id]) cgRasMap[c.code_groep] = rasMap[c.ras_id]
    setCodeGroepRasMap(cgRasMap)

    // Tarievenmap: `${code_groep}_${land}` → tarief
    const tkMap: Record<string, number> = {}
    for (const t of (lk ?? []) as { code_groep: number; land: string; tarief: number | null }[])
      if (t.tarief != null) tkMap[`${t.code_groep}_${t.land}`] = t.tarief
    setTarievenMap(tkMap)

    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const parsePaste = () => {
    const lines = paste.trim().split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim())
    if (!lines.length) { toast.error('Geen data geplakt'); return }
    const parsed: RawRow[] = lines.map(line => {
      const c = line.split('\t')
      const rekening = c[1]?.trim() || null
      const debiteur_nr = c[6]?.trim() ? parseInt(c[6]) || null : null
      const artikel = c[9]?.trim() ? parseInt(c[9]) || null : null
      const aantal = c[10]?.trim() ? parseInt(c[10]) || null : null
      const land_debiteur = debiteur_nr != null ? (debLandMap[debiteur_nr] ?? null) : null
      const code_groep = artikel != null ? (artikelGroepMap[artikel] ?? null) : null
      const rasInfo = code_groep != null ? (codeGroepRasMap[code_groep] ?? null) : null
      const licentiekosten = (code_groep != null && land_debiteur != null)
        ? (tarievenMap[`${code_groep}_${land_debiteur}`] ?? null)
        : null
      const totaal_licentiekosten = (aantal != null && licentiekosten != null)
        ? aantal * licentiekosten
        : null
      return {
        datum: parseDate(c[0] ?? ''),
        rekening,
        omschrijving: c[2]?.trim() || null,
        debet_eur: parseNum(c[3] ?? ''),
        credit_eur: parseNum(c[4] ?? ''),
        vv_bedrag: parseNum(c[5] ?? ''),
        debiteur_nr,
        debiteur_naam: c[7]?.trim() || null,
        land_debiteur,
        artikel_omschrijving: c[8]?.trim() || null,
        artikel,
        aantal,
        soort: soortVanRekening(rekening),
        code_groep,
        ras_naam: rasInfo?.naam ?? null,
        licentiehouder_naam: rasInfo?.lh_naam ?? null,
        licentiekosten,
        totaal_licentiekosten,
        intern_extern: internExtern(debiteur_nr, rasInfo?.lh_naam ?? null),
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
    setImporting(false); setPaste(''); setPreview(null); load()
  }

  const remove = async (id: number) => {
    if (!confirm('Regel verwijderen?')) return
    await supabase.from('omzetrekeningen').delete().eq('id', id)
    toast.success('Verwijderd'); load()
  }

  const removeAll = async () => {
    if (!confirm(`Alle ${rows.length} regels verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return
    const { error } = await supabase.from('omzetrekeningen').delete().gte('id', 0)
    if (error) { toast.error(error.message); return }
    toast.success('Alle data verwijderd'); load()
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    return (
      (!q || (r.debiteur_naam ?? '').toLowerCase().includes(q) || (r.omschrijving ?? '').toLowerCase().includes(q) || (r.rekening ?? '').includes(q) || (r.ras_naam ?? '').toLowerCase().includes(q) || (r.licentiehouder_naam ?? '').toLowerCase().includes(q) || String(r.debiteur_nr ?? '').includes(q)) &&
      (!filterRekening || r.rekening === filterRekening) &&
      (!filterSoort || r.soort === filterSoort) &&
      (!filterLand || r.land_debiteur === filterLand) &&
      (!filterRas || r.ras_naam === filterRas) &&
      (!filterLh || r.licentiehouder_naam === filterLh) &&
      (!filterType || r.intern_extern === filterType)
    )
  })

  const totaalLk = filtered.reduce((s, r) => s + (r.totaal_licentiekosten ?? 0), 0)

  const previewHeaders = ['Datum','Rekening','Omschrijving','Debet','Credit','V.V.','Deb. nr','Deb. naam','Land','Soort','Artikel omschr.','Artikel','Code groep','Ras','Licentiehouder','Tarief','Totaal LK','Type','Aantal']

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Omzetrekeningen</div>
          <div className="page-sub">{rows.length} regels</div>
        </div>
        {rows.length > 0 && (
          <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={removeAll}>
            <Trash2 size={15} /> Alles verwijderen
          </button>
        )}
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
          <button className="btn btn-secondary" onClick={parsePaste} disabled={!paste.trim()}>Verwerk</button>
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
          <div style={{ marginTop: 14, overflowX: 'auto', overflowY: 'auto', maxHeight: 320, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <table style={{ fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  {previewHeaders.map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', fontFamily: "'DM Mono',monospace" }}>{r.datum ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.rekening ?? '–'}</td>
                    <td style={{ padding: '4px 8px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.omschrijving ?? '–'}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{fmt(r.debet_eur)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{fmt(r.credit_eur)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{fmt(r.vv_bedrag)}</td>
                    <td style={{ padding: '4px 8px' }}>{r.debiteur_nr ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.debiteur_naam ?? '–'}</td>
                    <td style={{ padding: '4px 8px', fontWeight: r.land_debiteur ? 500 : undefined }}>{r.land_debiteur ?? <span style={{ color: 'var(--muted)' }}>–</span>}</td>
                    <td style={{ padding: '4px 8px' }}>{r.soort ? <span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span> : '–'}</td>
                    <td style={{ padding: '4px 8px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.artikel_omschrijving ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.artikel ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.code_groep ?? '–'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.ras_naam ?? <span style={{ color: 'var(--muted)' }}>–</span>}</td>
                    <td style={{ padding: '4px 8px' }}>{r.licentiehouder_naam ?? <span style={{ color: 'var(--muted)' }}>–</span>}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{fmtTarief(r.licentiekosten)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{fmt(r.totaal_licentiekosten)}</td>
                    <td style={{ padding: '4px 8px' }}>{r.intern_extern ?? '–'}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.aantal ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 260 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek debiteur, ras, licentiehouder…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterRekening} onChange={e => setFilterRekening(e.target.value)}>
          <option value="">Alle rekeningen</option>
          {[...new Set(rows.map(r => r.rekening).filter(Boolean))].sort().map(v => <option key={v!} value={v!}>{v}</option>)}
        </select>
        <select value={filterSoort} onChange={e => setFilterSoort(e.target.value)}>
          <option value="">Alle soorten</option>
          {[...new Set(rows.map(r => r.soort).filter(Boolean))].sort().map(v => <option key={v!} value={v!}>{v}</option>)}
        </select>
        <select value={filterLand} onChange={e => setFilterLand(e.target.value)}>
          <option value="">Alle landen</option>
          {[...new Set(rows.map(r => r.land_debiteur).filter(Boolean))].sort().map(v => <option key={v!} value={v!}>{v}</option>)}
        </select>
        <select value={filterRas} onChange={e => setFilterRas(e.target.value)}>
          <option value="">Alle rassen</option>
          {[...new Set(rows.map(r => r.ras_naam).filter(Boolean))].sort().map(v => <option key={v!} value={v!}>{v}</option>)}
        </select>
        <select value={filterLh} onChange={e => setFilterLh(e.target.value)}>
          <option value="">Alle licentiehouders</option>
          {[...new Set(rows.map(r => r.licentiehouder_naam).filter(Boolean))].sort().map(v => <option key={v!} value={v!}>{v}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Alle types</option>
          {[...new Set(rows.map(r => r.intern_extern).filter(Boolean))].sort().map(v => <option key={v!} value={v!}>{v}</option>)}
        </select>
        {(filterRekening || filterSoort || filterLand || filterRas || filterLh || filterType) && (
          <button className="btn btn-ghost" onClick={() => { setFilterRekening(''); setFilterSoort(''); setFilterLand(''); setFilterRas(''); setFilterLh(''); setFilterType('') }}>Wis filters</button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
          <table>
            <thead>
              <tr>
                {orderedCols.map(col => (
                  <th
                    key={col.key}
                    className={col.num ? 'num' : ''}
                    draggable
                    onDragStart={() => setDragKey(col.key)}
                    onDragOver={e => { e.preventDefault(); setDragOverKey(col.key) }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={() => onDrop(col.key)}
                    style={{
                      position: 'sticky', top: 0, zIndex: 1,
                      cursor: 'grab',
                      opacity: dragKey === col.key ? 0.4 : 1,
                      background: dragOverKey === col.key ? 'var(--accent-bg)' : undefined,
                      userSelect: 'none',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                <th style={{ position: 'sticky', top: 0, zIndex: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={orderedCols.length + 1} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={orderedCols.length + 1} className="empty">Geen regels gevonden</td></tr>}
              {filtered.map(r => (
                <tr key={r.id}>
                  {orderedCols.map(col => renderCell(r, col.key))}
                  <td><button className="btn btn-ghost" onClick={() => remove(r.id)}><Trash2 /></button></td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={orderedCols.length - 1}>Totaal ({filtered.length} regels)</td>
                  <td className="num">{fmt(totaalLk)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}

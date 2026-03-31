import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, Search, RefreshCw, Download } from 'lucide-react'
import { MultiSelect } from '../lib/MultiSelect'
import toast from 'react-hot-toast'
import { supabase, type SoortPlant } from '../lib/supabase'
import { getKleurHex } from './OntbrekendeKosten'
import { exportCsv } from '../lib/exportCsv'
import { usePersistedState } from '../lib/usePersistedState'

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
  artikel: string | null
  aantal: number | null
  soort: SoortPlant | null
  code_groep: number | null
  ras_naam: string | null
  licentiehouder_naam: string | null
  licentiekosten: number | null
  totaal_licentiekosten: number | null
  intern_extern: string | null
  kleur: string | null
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

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  datum: 105, rekening: 80, artikel_omschrijving: 200, debet_eur: 110, credit_eur: 110,
  vv_bedrag: 110, debiteur_nr: 80, land_debiteur: 90, intern_extern: 110, debiteur_naam: 160,
  omschrijving: 200, soort: 90, ras_naam: 140, licentiehouder_naam: 150,
  artikel: 80, code_groep: 120, aantal: 80, licentiekosten: 150, totaal_licentiekosten: 150,
}

const COLS: { key: string; label: string; num?: boolean }[] = [
  { key: 'datum',                   label: 'Datum' },
  { key: 'rekening',                label: 'Rekening' },
  { key: 'artikel_omschrijving',    label: 'Artikelomschrijving' },
  { key: 'debet_eur',               label: 'Debet EUR',                num: true },
  { key: 'credit_eur',              label: 'Credit EUR',               num: true },
  { key: 'vv_bedrag',               label: 'V.V.-bedrag',              num: true },
  { key: 'debiteur_nr',             label: 'Debiteur' },
  { key: 'land_debiteur',           label: 'Country' },
  { key: 'intern_extern',           label: 'Intern / Extern' },
  { key: 'debiteur_naam',           label: 'Debiteur: Naam' },
  { key: 'omschrijving',            label: 'Omschrijving' },
  { key: 'soort',                   label: 'Soort' },
  { key: 'ras_naam',                label: 'Ras' },
  { key: 'licentiehouder_naam',     label: 'Licentiehouder' },
  { key: 'artikel',                 label: 'Artikel' },
  { key: 'code_groep',              label: 'Artikelcode groep' },
  { key: 'aantal',                  label: 'Aantal',                   num: true },
  { key: 'licentiekosten',          label: 'Licentiekosten per plant' },
  { key: 'totaal_licentiekosten',   label: 'Totaal licentiekosten',    num: true },
]
const COL_KEYS = COLS.map(c => c.key)

export default function Omzetrekeningen() {
  const [rows, setRows] = useState<Omzetrekening[]>([])
  const [debLandMap, setDebLandMap] = useState<Record<number, string>>({})
  const [artikelGroepMap, setArtikelGroepMap] = useState<Record<string, number>>({})
  const [codeGroepRasMap, setCodeGroepRasMap] = useState<Record<number, { naam: string; lh_naam: string }>>({})
  const [tarievenMap, setTarievenMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [paste, setPaste] = useState('')
  const [preview, setPreview] = useState<RawRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [herberekening, setHerberekening] = useState(false)
  const [herberekeningVoortgang, setHerberekeningVoortgang] = useState<{gedaan: number; totaal: number} | null>(null)
  const [search, setSearch] = usePersistedState('f-omzet-search', '')
  const [colOrder, setColOrder] = useState<string[]>(() => {
    const stored = JSON.parse(localStorage.getItem('omzet-col-order') ?? 'null') as string[] | null
    if (!stored) return COL_KEYS
    const missing = COL_KEYS.filter(k => !stored.includes(k))
    return [...stored.filter(k => COL_KEYS.includes(k)), ...missing]
  })
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [filterSoort,    setFilterSoort]    = usePersistedState<string[]>('f-omzet-soort', [])
  const [filterLand,     setFilterLand]     = usePersistedState<string[]>('f-omzet-land', [])
  const [filterRas,      setFilterRas]      = usePersistedState<string[]>('f-omzet-ras', [])
  const [filterLh,       setFilterLh]       = usePersistedState<string[]>('f-omzet-lh', [])
  const [filterType,     setFilterType]     = usePersistedState<string[]>('f-omzet-type', [])
  const [filterDatumVan, setFilterDatumVan] = usePersistedState('f-omzet-datumvan', '')
  const [filterDatumTot, setFilterDatumTot] = usePersistedState('f-omzet-datumtot', '')
  const [sortCol,        setSortCol]        = usePersistedState<string | null>('f-omzet-sortcol', null)
  const [sortDir,        setSortDir]        = usePersistedState<'asc' | 'desc'>('f-omzet-sortdir', 'asc')
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    () => JSON.parse(localStorage.getItem('omzet-col-widths') ?? 'null') ?? {}
  )
  const wasDragged = useRef(false)
  const isResizing = useRef(false)
  const colGroupRef = useRef<HTMLTableColElement[]>([])

  const handleSort = (key: string) => {
    if (wasDragged.current) { wasDragged.current = false; return }
    if (isResizing.current) return
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

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

  const onResizeMouseDown = (e: React.MouseEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    const colIdx = orderedCols.findIndex(c => c.key === key)
    const colEl = colGroupRef.current[colIdx]
    const startX = e.clientX
    const startWidth = colWidths[key] ?? DEFAULT_COL_WIDTHS[key] ?? 100

    const onMouseMove = (ev: MouseEvent) => {
      const w = Math.max(60, startWidth + (ev.clientX - startX))
      if (colEl) colEl.style.width = w + 'px'
    }
    const onMouseUp = (ev: MouseEvent) => {
      const w = Math.max(60, startWidth + (ev.clientX - startX))
      setColWidths(prev => {
        const next = { ...prev, [key]: w }
        localStorage.setItem('omzet-col-widths', JSON.stringify(next))
        return next
      })
      setTimeout(() => { isResizing.current = false }, 0)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const renderCell = (r: Omzetrekening, key: string) => {
    switch (key) {
      case 'datum':              return <td key={key} className="mono" style={{ whiteSpace: 'nowrap' }}>{r.datum ?? '–'}</td>
      case 'rekening':               return <td key={key} className="mono text-muted" style={{ fontSize: 12 }}>{r.rekening ?? '–'}</td>
      case 'artikel_omschrijving':   return <td key={key} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.artikel_omschrijving ?? <span className="text-muted">–</span>}</td>
      case 'omschrijving':           return <td key={key} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.omschrijving ?? '–'}</td>
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

  const fetchAllLk = async () => {
    type LkRow = { code_groep: number; land: string; tarief: number | null }
    const pageSize = 1000
    let all: LkRow[] = []
    let from = 0
    while (true) {
      const { data } = await supabase.from('licentiekosten').select('code_groep, land, tarief').range(from, from + pageSize - 1)
      if (!data?.length) break
      all = [...all, ...data as LkRow[]]
      if (data.length < pageSize) break
      from += pageSize
    }
    return all
  }

  const buildTkMap = (lk: { code_groep: number; land: string; tarief: number | null }[]): Record<string, number> => {
    const map: Record<string, number> = {}
    for (const t of lk) if (t.tarief != null) map[`${t.code_groep}_${t.land}`] = t.tarief
    return map
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
    const [omzetData, { data: deb }, { data: art }, { data: cgc }, { data: r }, { data: lh }, lk] = await Promise.all([
      fetchAllOmzet(),
      supabase.from('debiteuren').select('nummer, land'),
      supabase.from('artikel_codes').select('artikel, code_groep'),
      supabase.from('code_groep_config').select('code_groep, ras_id'),
      supabase.from('rassen').select('id, naam, licentiehouder_id'),
      supabase.from('licentiehouders').select('id, naam'),
      fetchAllLk(),
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
    const artMap: Record<string, number> = {}
    for (const a of (art ?? []) as { artikel: number | string; code_groep: number | null }[])
      if (a.artikel != null && a.code_groep != null) artMap[String(a.artikel)] = a.code_groep
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

    setTarievenMap(buildTkMap(lk))

    setLoading(false)
  }
  useEffect(() => { load() }, [])


  const parsePaste = async () => {
    const lines = paste.trim().split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim())
    if (!lines.length) { toast.error('Geen data geplakt'); return }

    // Haal verse referentiedata op — debiteuren gepagineerd want >1000 mogelijk
    const allDeb: { nummer: string; land: string }[] = []
    let debFrom = 0
    while (true) {
      const { data } = await supabase.from('debiteuren').select('nummer, land').range(debFrom, debFrom + 999)
      if (!data?.length) break
      allDeb.push(...data as { nummer: string; land: string }[])
      if (data.length < 1000) break
      debFrom += 1000
    }

    const [{ data: freshArt }, { data: freshCgc }, { data: freshR }, { data: freshLh }, freshLk] = await Promise.all([
      supabase.from('artikel_codes').select('artikel, code_groep'),
      supabase.from('code_groep_config').select('code_groep, ras_id'),
      supabase.from('rassen').select('id, naam, licentiehouder_id'),
      supabase.from('licentiehouders').select('id, naam'),
      fetchAllLk(),
    ])
    const freshDebMap: Record<number, string> = {}
    for (const d of allDeb) {
      const nr = parseInt(d.nummer); if (!isNaN(nr)) freshDebMap[nr] = d.land
    }
    const freshArtMap: Record<string, number> = {}
    for (const a of (freshArt ?? []) as { artikel: number | string; code_groep: number | null }[])
      if (a.artikel != null && a.code_groep != null) freshArtMap[String(a.artikel)] = a.code_groep
    const freshLhMap: Record<number, string> = {}
    for (const l of (freshLh ?? []) as { id: number; naam: string }[]) freshLhMap[l.id] = l.naam
    const freshRasMap: Record<number, { naam: string; lh_naam: string }> = {}
    for (const ras of (freshR ?? []) as { id: number; naam: string; licentiehouder_id: number }[])
      freshRasMap[ras.id] = { naam: ras.naam, lh_naam: freshLhMap[ras.licentiehouder_id] ?? '–' }
    const freshCgRasMap: Record<number, { naam: string; lh_naam: string }> = {}
    for (const c of (freshCgc ?? []) as { code_groep: number; ras_id: number | null }[])
      if (c.ras_id != null && freshRasMap[c.ras_id]) freshCgRasMap[c.code_groep] = freshRasMap[c.ras_id]
    const freshTkMap = buildTkMap(freshLk)

    const parsed: RawRow[] = lines.map(line => {
      const c = line.split('\t')
      const rekening = c[1]?.trim() || null
      const parseIntNL = (s: string) => { const n = parseInt(s.replace(/\./g, ''), 10); return isNaN(n) ? null : n }
      const debiteur_nr = c[6]?.trim() ? parseIntNL(c[6]) : null
      const artikel = c[9]?.trim() || null
      const aantal = c[10]?.trim() ? parseIntNL(c[10]) : null
      const land_debiteur = debiteur_nr != null ? (freshDebMap[debiteur_nr] ?? null) : null
      const code_groep = artikel != null ? (freshArtMap[artikel] ?? null) : null
      const rasInfo = code_groep != null ? (freshCgRasMap[code_groep] ?? null) : null
      const licentiekosten = (code_groep != null && land_debiteur != null)
        ? (freshTkMap[`${code_groep}_${land_debiteur}`] ?? null)
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
        kleur: null,
      }
    })
    setPreview(parsed)
    toast.success(`${parsed.length} regels herkend`)
  }

  const herbereken = async () => {
    if (!confirm(`Alle ${rows.length} regels opnieuw berekenen op basis van huidige referentiedata (debiteuren, artikelen, tarieven)?`)) return
    setHerberekening(true)
    setHerberekeningVoortgang({ gedaan: 0, totaal: rows.length })

    // Laad verse referentiedata
    const allDeb: { nummer: string; land: string }[] = []
    let debFrom = 0
    while (true) {
      const { data } = await supabase.from('debiteuren').select('nummer, land').range(debFrom, debFrom + 999)
      if (!data?.length) break
      allDeb.push(...data as typeof allDeb)
      if (data.length < 1000) break
      debFrom += 1000
    }
    const [{ data: art }, { data: cgc }, { data: r }, { data: lh }, lk] = await Promise.all([
      supabase.from('artikel_codes').select('artikel, code_groep'),
      supabase.from('code_groep_config').select('code_groep, ras_id'),
      supabase.from('rassen').select('id, naam, licentiehouder_id'),
      supabase.from('licentiehouders').select('id, naam'),
      fetchAllLk(),
    ])

    const debMap: Record<number, string> = {}
    for (const d of allDeb) { const nr = parseInt(d.nummer); if (!isNaN(nr)) debMap[nr] = d.land }
    const artMap: Record<string, number> = {}
    for (const a of (art ?? []) as { artikel: number | string; code_groep: number | null }[])
      if (a.artikel != null && a.code_groep != null) artMap[String(a.artikel)] = a.code_groep
    const lhMap: Record<number, string> = {}
    for (const l of (lh ?? []) as { id: number; naam: string }[]) lhMap[l.id] = l.naam
    const rasMap: Record<number, { naam: string; lh_naam: string }> = {}
    for (const ras of (r ?? []) as { id: number; naam: string; licentiehouder_id: number }[])
      rasMap[ras.id] = { naam: ras.naam, lh_naam: lhMap[ras.licentiehouder_id] ?? '–' }
    const cgRasMap: Record<number, { naam: string; lh_naam: string }> = {}
    for (const c of (cgc ?? []) as { code_groep: number; ras_id: number | null }[])
      if (c.ras_id != null && rasMap[c.ras_id]) cgRasMap[c.code_groep] = rasMap[c.ras_id]
    const tkMap = buildTkMap(lk)

    // Bereken updates per rij
    const updates = rows.map(r => {
      const land_debiteur = r.debiteur_nr != null ? (debMap[r.debiteur_nr] ?? r.land_debiteur) : r.land_debiteur
      const code_groep    = r.artikel != null ? (artMap[r.artikel] ?? r.code_groep) : r.code_groep
      const rasInfo       = code_groep != null ? (cgRasMap[code_groep] ?? null) : null
      const licentiekosten = (code_groep != null && land_debiteur != null)
        ? (tkMap[`${code_groep}_${land_debiteur}`] ?? null)
        : null
      const totaal_licentiekosten = (r.aantal != null && licentiekosten != null) ? r.aantal * licentiekosten : null
      return {
        id: r.id,
        land_debiteur,
        code_groep,
        ras_naam: rasInfo?.naam ?? null,
        licentiehouder_naam: rasInfo?.lh_naam ?? null,
        licentiekosten,
        totaal_licentiekosten,
        intern_extern: internExtern(r.debiteur_nr, rasInfo?.lh_naam ?? null),
        kleur: totaal_licentiekosten != null ? null : r.kleur,
      }
    })

    // Verwerk in batches van 50
    const batchSize = 50
    let gedaan = 0
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      await Promise.all(batch.map(u => {
        const { id, ...fields } = u
        return supabase.from('omzetrekeningen').update(fields).eq('id', id)
      }))
      gedaan += batch.length
      setHerberekeningVoortgang({ gedaan, totaal: updates.length })
    }

    toast.success(`${updates.length} regels herberekend`)
    setHerberekening(false)
    setHerberekeningVoortgang(null)
    load()
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
      (!filterSoort.length || filterSoort.includes(r.soort ?? '')) &&
      (!filterLand.length  || filterLand.includes(r.land_debiteur ?? '')) &&
      (!filterRas.length   || filterRas.includes(r.ras_naam ?? '')) &&
      (!filterLh.length    || filterLh.includes(r.licentiehouder_naam ?? '')) &&
      (!filterType.length  || filterType.includes(r.intern_extern ?? '')) &&
      (!filterDatumVan || (r.datum ?? '') >= filterDatumVan) &&
      (!filterDatumTot || (r.datum ?? '') <= filterDatumTot)
    )
  }).sort((a, b) => {
    if (!sortCol) return 0
    const numCols = ['debet_eur','credit_eur','vv_bedrag','aantal','licentiekosten','totaal_licentiekosten','debiteur_nr','artikel','code_groep']
    const av = numCols.includes(sortCol) ? ((a as any)[sortCol] ?? -Infinity) : ((a as any)[sortCol] ?? '').toString().toLowerCase()
    const bv = numCols.includes(sortCol) ? ((b as any)[sortCol] ?? -Infinity) : ((b as any)[sortCol] ?? '').toString().toLowerCase()
    return sortDir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0)
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={() => exportCsv(
              `omzetrekeningen-${new Date().toISOString().slice(0,10)}.csv`,
              orderedCols.map(c => c.label),
              filtered.map(r => orderedCols.map(c => (r as any)[c.key]))
            )}>
              <Download size={14} /> Exporteren
            </button>
            <button className="btn btn-secondary" onClick={herbereken} disabled={herberekening}>
              <RefreshCw size={14} style={{ animation: herberekening ? 'spin 1s linear infinite' : undefined }} />
              {herberekening && herberekeningVoortgang
                ? `Herberekenen… ${herberekeningVoortgang.gedaan}/${herberekeningVoortgang.totaal}`
                : 'Herbereken alles'}
            </button>
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={removeAll}>
              <Trash2 size={15} /> Alles verwijderen
            </button>
          </div>
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
        <div className="search-wrap" style={{ flex: 1, maxWidth: 240 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek debiteur, ras, licentiehouder…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <input type="date" value={filterDatumVan} onChange={e => setFilterDatumVan(e.target.value)} style={{ width: 'auto' }} title="Datum van" />
        <input type="date" value={filterDatumTot} onChange={e => setFilterDatumTot(e.target.value)} style={{ width: 'auto' }} title="Datum tot" />
        <MultiSelect label="Soorten"          options={[...new Set(rows.map(r => r.soort).filter(Boolean) as string[])].sort()}            selected={filterSoort} onChange={setFilterSoort} />
        <MultiSelect label="Landen"           options={[...new Set(rows.map(r => r.land_debiteur).filter(Boolean) as string[])].sort()}     selected={filterLand}  onChange={setFilterLand} />
        <MultiSelect label="Rassen"           options={[...new Set(rows.map(r => r.ras_naam).filter(Boolean) as string[])].sort()}          selected={filterRas}   onChange={setFilterRas} />
        <MultiSelect label="Licentiehouders"  options={[...new Set(rows.map(r => r.licentiehouder_naam).filter(Boolean) as string[])].sort()} selected={filterLh}  onChange={setFilterLh} />
        <MultiSelect label="Types"            options={[...new Set(rows.map(r => r.intern_extern).filter(Boolean) as string[])].sort()}      selected={filterType}  onChange={setFilterType} />
        {(filterSoort.length || filterLand.length || filterRas.length || filterLh.length || filterType.length || filterDatumVan || filterDatumTot) && (
          <button className="btn btn-ghost" onClick={() => { setFilterSoort([]); setFilterLand([]); setFilterRas([]); setFilterLh([]); setFilterType([]); setFilterDatumVan(''); setFilterDatumTot('') }}>Wis filters</button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
          <table style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
            <colgroup>
              {orderedCols.map((col, i) => (
                <col
                  key={col.key}
                  ref={el => { if (el) colGroupRef.current[i] = el }}
                  style={{ width: colWidths[col.key] ?? DEFAULT_COL_WIDTHS[col.key] ?? 100 }}
                />
              ))}
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              <tr>
                {orderedCols.map(col => (
                  <th
                    key={col.key}
                    className={col.num ? 'num' : ''}
                    draggable
                    onDragStart={() => { wasDragged.current = true; setDragKey(col.key) }}
                    onDragOver={e => { e.preventDefault(); setDragOverKey(col.key) }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={() => onDrop(col.key)}
                    onClick={() => handleSort(col.key)}
                    style={{
                      position: 'sticky', top: 0, zIndex: 1,
                      cursor: 'pointer',
                      opacity: dragKey === col.key ? 0.4 : 1,
                      background: dragOverKey === col.key ? 'var(--accent-bg)' : 'var(--surface)',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      paddingRight: 18,
                      boxSizing: 'border-box',
                    }}
                  >
                    {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
                    <span
                      onMouseDown={e => onResizeMouseDown(e, col.key)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
                        cursor: 'col-resize', zIndex: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span style={{ width: 2, height: '60%', background: 'var(--border-md)', borderRadius: 1, pointerEvents: 'none' }} />
                    </span>
                  </th>
                ))}
                <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={orderedCols.length + 1} className="empty">Laden…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={orderedCols.length + 1} className="empty">Geen regels gevonden</td></tr>}
              {filtered.map(r => {
                const kleurId = r.kleur
                const hex = kleurId ? getKleurHex(kleurId) : null
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderLeft: hex ? `4px solid ${hex}` : undefined,
                      background: hex ? hex + '0d' : undefined,
                    }}
                  >
                    {orderedCols.map(col => renderCell(r, col.key))}
                    <td><button className="btn btn-ghost" onClick={() => remove(r.id)}><Trash2 /></button></td>
                  </tr>
                )
              })}
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

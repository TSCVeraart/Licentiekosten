import { useEffect, useRef, useState } from 'react'
import { usePersistedState } from '../lib/usePersistedState'
import { Check, ChevronDown, ChevronRight, Search, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Ras, type Licentiehouder } from '../lib/supabase'
import { exportCsv } from '../lib/exportCsv'

interface CodeGroep { code_groep: number; omschrijving: string | null }
interface RasDetail extends Ras { lh_naam: string; landen: string[] }

export default function Licentiekosten() {
  const [codeGroepen, setCodeGroepen] = useState<CodeGroep[]>([])
  const [rasConfigs, setRasConfigs] = useState<Record<number, number | null>>({})
  const [rassen, setRassen] = useState<RasDetail[]>([])
  const [tarieven, setTarieven] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  // expanded bijhouden (niet collapsed) — default leeg = alles dicht
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    try { const s = localStorage.getItem('lk_expanded_ras'); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
  })
  const [search,             setSearch]             = usePersistedState('f-lk-search', '')
  const [filterNietIngevuld, setFilterNietIngevuld] = usePersistedState('f-lk-niet-ingevuld', false)
  const [filterRas,          setFilterRas]          = usePersistedState('f-lk-ras', '')
  const [filterLh,           setFilterLh]           = usePersistedState('f-lk-lh', '')
  const [filterSoort,        setFilterSoort]        = usePersistedState('f-lk-soort', '')
  const [bulkVal, setBulkVal] = useState<Record<number, string>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const savingRef = useRef(false)

  const toggleCollapse = (key: number) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem('lk_expanded_ras', JSON.stringify([...next]))
      return next
    })

  const fetchAllLk = async () => {
    const pageSize = 1000
    let all: { code_groep: number; land: string; tarief: number | null }[] = []
    let from = 0
    while (true) {
      const { data } = await supabase.from('licentiekosten').select('code_groep, land, tarief').range(from, from + pageSize - 1)
      if (!data?.length) break
      all = [...all, ...data as typeof all]
      if (data.length < pageSize) break
      from += pageSize
    }
    return all
  }

  const load = async () => {
    const [{ data: ak }, { data: cgc }, { data: r }, { data: lh }, lk] = await Promise.all([
      supabase.from('artikel_codes').select('code_groep, omschrijving').not('code_groep', 'is', null),
      supabase.from('code_groep_config').select('*'),
      supabase.from('rassen').select('*, ras_landen(land)'),
      supabase.from('licentiehouders').select('id, naam'),
      fetchAllLk(),
    ])

    const seen = new Set<number>()
    const cg: CodeGroep[] = []
    for (const row of (ak ?? []) as { code_groep: number; omschrijving: string | null }[]) {
      if (!seen.has(row.code_groep)) { seen.add(row.code_groep); cg.push(row) }
    }
    cg.sort((a, b) => a.code_groep - b.code_groep)
    setCodeGroepen(cg)

    const cfgMap: Record<number, number | null> = {}
    for (const c of (cgc ?? []) as { code_groep: number; ras_id: number | null }[]) cfgMap[c.code_groep] = c.ras_id
    setRasConfigs(cfgMap)

    const lhMap: Record<number, string> = {}
    for (const l of (lh ?? []) as Licentiehouder[]) lhMap[l.id] = l.naam
    setRassen(((r ?? []) as any[]).map(ras => ({
      ...ras,
      lh_naam: lhMap[ras.licentiehouder_id] ?? '–',
      landen: (ras.ras_landen ?? []).map((l: any) => l.land).sort(),
    })))

    const tkMap: Record<string, number | null> = {}
    for (const t of lk)
      if (!((`${t.code_groep}_${t.land}`) in tkMap))
        tkMap[`${t.code_groep}_${t.land}`] = t.tarief
    setTarieven(tkMap)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const saveRasLink = async (code_groep: number, ras_id: number | null) => {
    setRasConfigs(prev => ({ ...prev, [code_groep]: ras_id }))
    const { error: delErr } = await supabase.from('code_groep_config').delete().eq('code_groep', code_groep)
    if (delErr) { toast.error('Fout bij opslaan ras: ' + delErr.message); return }
    const { error: insErr } = await supabase.from('code_groep_config').insert({ code_groep, ras_id })
    if (insErr) toast.error('Fout bij opslaan ras: ' + insErr.message)
  }

  const saveTarief = async (code_groep: number, land: string, val: string) => {
    if (savingRef.current) return
    savingRef.current = true
    const tarief = val.trim() ? parseFloat(val.replace(',', '.')) : null
    setTarieven(prev => ({ ...prev, [`${code_groep}_${land}`]: tarief }))
    setEditingKey(null)
    const { error: delErr } = await supabase.from('licentiekosten').delete().eq('code_groep', code_groep).eq('land', land)
    if (delErr) { toast.error('Fout bij opslaan: ' + delErr.message); savingRef.current = false; return }
    const { error: insErr } = await supabase.from('licentiekosten').insert({ code_groep, land, tarief })
    if (insErr) toast.error('Fout bij opslaan: ' + insErr.message)
    else toast.success(`${land} opgeslagen`)
    savingRef.current = false
  }

  const applyBulk = async (code_groep: number, landen: string[]) => {
    const val = bulkVal[code_groep]
    if (!val?.trim()) return
    const tarief = parseFloat(val.replace(',', '.'))
    const { error: delErr } = await supabase.from('licentiekosten').delete().eq('code_groep', code_groep).in('land', landen)
    if (delErr) { toast.error('Fout bij opslaan: ' + delErr.message); return }
    const { error: insErr } = await supabase.from('licentiekosten').insert(landen.map(land => ({ code_groep, land, tarief })))
    if (insErr) { toast.error('Fout bij opslaan: ' + insErr.message); return }
    setTarieven(prev => { const next = { ...prev }; for (const land of landen) next[`${code_groep}_${land}`] = tarief; return next })
    setBulkVal(prev => { const next = { ...prev }; delete next[code_groep]; return next })
    toast.success('Tarief toegepast')
  }

  if (loading) return <div className="empty">Laden…</div>

  const filteredCg = codeGroepen.filter(cg => {
    const rasId = rasConfigs[cg.code_groep] ?? null
    const ras = rassen.find(r => r.id === rasId) ?? null
    return (
      (!search || cg.code_groep.toString().includes(search) || (cg.omschrijving ?? '').toLowerCase().includes(search.toLowerCase())) &&
      (!filterNietIngevuld || !rasId) &&
      (!filterRas || ras?.naam === filterRas) &&
      (!filterLh || ras?.lh_naam === filterLh) &&
      (!filterSoort || ras?.soort === filterSoort)
    )
  })

  // Groepeer per ras
  const byRas = new Map<number, CodeGroep[]>()
  const ungrouped: CodeGroep[] = []
  for (const cg of filteredCg) {
    const rasId = rasConfigs[cg.code_groep] ?? null
    if (rasId != null) {
      if (!byRas.has(rasId)) byRas.set(rasId, [])
      byRas.get(rasId)!.push(cg)
    } else {
      ungrouped.push(cg)
    }
  }

  // Sorteer rassen op naam
  const rasGroepen = [...byRas.entries()]
    .map(([rasId, cgs]) => ({ rasId, cgs, ras: rassen.find(r => r.id === rasId)! }))
    .filter(g => g.ras)
    .sort((a, b) => a.ras.naam.localeCompare(b.ras.naam, 'nl'))

  const linkedRassen = rassen.filter(r => Object.values(rasConfigs).includes(r.id))

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Licentiekosten</div>
          <div className="page-sub">{codeGroepen.length} artikelcode groepen</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="search-wrap" style={{ width: 240 }}>
            <Search className="search-icon" />
            <input placeholder="Zoek code of omschrijving…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className={`btn ${filterNietIngevuld ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterNietIngevuld(f => !f)}>
            Niet ingevuld
          </button>
          <button className="btn btn-ghost" onClick={() => {
            const exportRows: unknown[][] = []
            for (const cg of codeGroepen) {
              const ras = rassen.find(r => r.id === (rasConfigs[cg.code_groep] ?? null))
              for (const land of (ras?.landen ?? []))
                exportRows.push([cg.code_groep, cg.omschrijving, ras?.naam ?? '', land, tarieven[`${cg.code_groep}_${land}`] ?? ''])
            }
            exportCsv(`licentiekosten-${new Date().toISOString().slice(0,10)}.csv`, ['Code groep','Omschrijving','Ras','Land','Tarief'], exportRows)
          }}>
            <Download size={14} /> Exporteren
          </button>
          <button className="btn btn-secondary" onClick={() => {
            setExpanded(new Set())
            localStorage.setItem('lk_expanded_ras', JSON.stringify([]))
          }}>Alles dichtklappen</button>
        </div>
      </div>

      <div className="filters">
        <select value={filterRas} onChange={e => setFilterRas(e.target.value)}>
          <option value="">Alle rassen</option>
          {[...new Set(linkedRassen.map(r => r.naam))].sort().map(n => <option key={n}>{n}</option>)}
        </select>
        <select value={filterLh} onChange={e => setFilterLh(e.target.value)}>
          <option value="">Alle licentiehouders</option>
          {[...new Set(linkedRassen.map(r => r.lh_naam))].sort().map(n => <option key={n}>{n}</option>)}
        </select>
        <select value={filterSoort} onChange={e => setFilterSoort(e.target.value)}>
          <option value="">Alle soorten</option>
          <option>Aardbei</option><option>Framboos</option><option>Braam</option>
        </select>
        {(filterRas || filterLh || filterSoort) && (
          <button className="btn btn-ghost" onClick={() => { setFilterRas(''); setFilterLh(''); setFilterSoort('') }}>Wis filters</button>
        )}
      </div>

      {codeGroepen.length === 0 && (
        <div className="card"><div className="empty">Geen artikelcode groepen gevonden — importeer eerst artikelen.</div></div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Gekoppelde rassen — matrix per ras */}
        {rasGroepen.map(({ rasId, cgs, ras }) => {
          const isCollapsed = !expanded.has(rasId)
          const landen = ras.landen
          const allFilled = cgs.every(cg => landen.every(l => tarieven[`${cg.code_groep}_${l}`] != null))

          return (
            <div key={rasId} className="card">
              {/* Header */}
              <div
                onClick={() => toggleCollapse(rasId)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', userSelect: 'none', borderBottom: isCollapsed ? undefined : '1px solid var(--border)' }}
              >
                {isCollapsed ? <ChevronRight size={15} color="var(--muted)" /> : <ChevronDown size={15} color="var(--muted)" />}
                <span style={{ fontWeight: 600, fontSize: 13 }}>{ras.naam}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ras.lh_naam}</span>
                <span className={`badge badge-${ras.soort.toLowerCase()}`} style={{ marginLeft: 2 }}>{ras.soort}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                  {cgs.length} code{cgs.length !== 1 ? 's' : ''} · {landen.length} land{landen.length !== 1 ? 'en' : ''}
                  {allFilled && <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 500 }}>✓ volledig</span>}
                </span>
              </div>

              {/* Matrix */}
              {!isCollapsed && landen.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 80 }}>Code</th>
                        <th style={{ minWidth: 180 }}>Omschrijving</th>
                        {landen.map(land => (
                          <th key={land} className="num" style={{ minWidth: 90, whiteSpace: 'nowrap' }}>{land}</th>
                        ))}
                        <th style={{ minWidth: 150, color: 'var(--muted)', fontWeight: 400 }}>Snel invullen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cgs.map(cg => {
                        const rowFilled = landen.every(l => tarieven[`${cg.code_groep}_${l}`] != null)
                        return (
                          <tr key={cg.code_groep} style={{ background: rowFilled ? '#f0fdf420' : undefined }}>
                            <td className="mono" style={{ fontWeight: 600, color: 'var(--muted)' }}>{cg.code_groep}</td>
                            <td>{cg.omschrijving ?? '–'}</td>
                            {landen.map(land => {
                              const key = `${cg.code_groep}_${land}`
                              const tarief = tarieven[key]
                              const isEditing = editingKey === key
                              return (
                                <td key={land} className="num">
                                  {isEditing
                                    ? <input
                                        type="number" step="0.0001" value={editVal} autoFocus
                                        onChange={e => setEditVal(e.target.value)}
                                        onBlur={() => saveTarief(cg.code_groep, land, editVal)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') saveTarief(cg.code_groep, land, editVal)
                                          if (e.key === 'Escape') setEditingKey(null)
                                        }}
                                        style={{ width: 72, fontSize: 12, padding: '2px 4px', textAlign: 'right' }}
                                      />
                                    : <span
                                        onClick={() => { setEditingKey(key); setEditVal(tarief != null ? String(tarief) : '') }}
                                        style={{ cursor: 'pointer', color: tarief != null ? 'var(--text)' : 'var(--muted)', fontFamily: "'DM Mono', monospace" }}
                                        title="Klik om te bewerken"
                                      >
                                        {tarief != null ? `€\u00a0${tarief.toFixed(4)}` : '–'}
                                      </span>
                                  }
                                </td>
                              )
                            })}
                            <td>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input
                                  type="number" step="0.0001" placeholder="0.0000"
                                  value={bulkVal[cg.code_groep] ?? ''}
                                  onChange={e => setBulkVal(prev => ({ ...prev, [cg.code_groep]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') applyBulk(cg.code_groep, landen) }}
                                  style={{ width: 80, fontSize: 12, padding: '3px 6px' }}
                                />
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: 11, padding: '3px 8px' }}
                                  onClick={() => applyBulk(cg.code_groep, landen)}
                                  title="Alle landen"
                                >
                                  <Check size={11} /> Alle
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!isCollapsed && landen.length === 0 && (
                <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted)' }}>
                  Geen landen gekoppeld aan dit ras — configureer landen via Rassen.
                </div>
              )}
            </div>
          )
        })}

        {/* Niet-gekoppelde code groepen */}
        {ungrouped.length > 0 && (
          <div className="card">
            <div
              onClick={() => toggleCollapse(0)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', userSelect: 'none', borderBottom: expanded.has(0) ? '1px solid var(--border)' : undefined }}
            >
              {expanded.has(0) ? <ChevronDown size={15} color="var(--muted)" /> : <ChevronRight size={15} color="var(--muted)" />}
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--muted)' }}>Niet gekoppeld aan ras</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{ungrouped.length} code{ungrouped.length !== 1 ? 's' : ''}</span>
            </div>
            {expanded.has(0) && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 80 }}>Code</th>
                      <th style={{ minWidth: 200 }}>Omschrijving</th>
                      <th style={{ minWidth: 200 }}>Koppel ras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ungrouped.map(cg => (
                      <tr key={cg.code_groep}>
                        <td className="mono" style={{ fontWeight: 600, color: 'var(--muted)' }}>{cg.code_groep}</td>
                        <td>{cg.omschrijving ?? '–'}</td>
                        <td>
                          <select
                            value={rasConfigs[cg.code_groep] ?? ''}
                            onChange={e => saveRasLink(cg.code_groep, e.target.value ? Number(e.target.value) : null)}
                            style={{ width: 'auto', minWidth: 180, fontSize: 12, padding: '4px 8px' }}
                          >
                            <option value="">— Koppel ras —</option>
                            {rassen.map(r => <option key={r.id} value={r.id}>{r.naam} · {r.lh_naam}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

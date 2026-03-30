import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Ras, type Licentiehouder } from '../lib/supabase'

interface CodeGroep { code_groep: number; omschrijving: string | null }
interface RasDetail extends Ras { lh_naam: string; landen: string[] }

export default function Licentiekosten() {
  const [codeGroepen, setCodeGroepen] = useState<CodeGroep[]>([])
  const [rasConfigs, setRasConfigs] = useState<Record<number, number | null>>({})
  const [rassen, setRassen] = useState<RasDetail[]>([])
  const [tarieven, setTarieven] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    try { const s = localStorage.getItem('lk_collapsed'); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
  })
  const [search, setSearch] = useState('')
  const [bulkVal, setBulkVal] = useState<Record<number, string>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  const toggleCollapse = (code_groep: number) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(code_groep) ? next.delete(code_groep) : next.add(code_groep)
      localStorage.setItem('lk_collapsed', JSON.stringify([...next]))
      return next
    })

  const load = async () => {
    const [{ data: ak }, { data: cgc }, { data: r }, { data: rl }, { data: lh }, { data: lk }] = await Promise.all([
      supabase.from('artikel_codes').select('code_groep, omschrijving').not('code_groep', 'is', null),
      supabase.from('code_groep_config').select('*'),
      supabase.from('rassen').select('*'),
      supabase.from('ras_landen').select('*'),
      supabase.from('licentiehouders').select('id, naam'),
      supabase.from('licentiekosten').select('code_groep, land, tarief'),
    ])

    // Distinct code_groepen sorted
    const seen = new Set<number>()
    const cg: CodeGroep[] = []
    for (const row of (ak ?? []) as { code_groep: number; omschrijving: string | null }[]) {
      if (!seen.has(row.code_groep)) { seen.add(row.code_groep); cg.push(row) }
    }
    cg.sort((a, b) => a.code_groep - b.code_groep)
    setCodeGroepen(cg)

    // Ras config map
    const cfgMap: Record<number, number | null> = {}
    for (const c of (cgc ?? []) as { code_groep: number; ras_id: number | null }[]) cfgMap[c.code_groep] = c.ras_id
    setRasConfigs(cfgMap)

    // Rassen with licentiehouder and landen
    const lhMap: Record<number, string> = {}
    for (const l of (lh ?? []) as Licentiehouder[]) lhMap[l.id] = l.naam
    const rasLanden = (rl ?? []) as { ras_id: number; land: string }[]
    setRassen(((r ?? []) as Ras[]).map(ras => ({
      ...ras,
      lh_naam: lhMap[ras.licentiehouder_id] ?? '–',
      landen: rasLanden.filter(l => l.ras_id === ras.id).map(l => l.land).sort(),
    })))

    // Tarieven map
    const tkMap: Record<string, number | null> = {}
    for (const t of (lk ?? []) as { code_groep: number; land: string; tarief: number | null }[])
      tkMap[`${t.code_groep}_${t.land}`] = t.tarief
    setTarieven(tkMap)

    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const saveRasLink = async (code_groep: number, ras_id: number | null) => {
    setRasConfigs(prev => ({ ...prev, [code_groep]: ras_id }))
    await supabase.from('code_groep_config').upsert({ code_groep, ras_id }, { onConflict: 'code_groep' })
  }

  const saveTarief = async (code_groep: number, land: string, val: string) => {
    const tarief = val.trim() ? parseFloat(val.replace(',', '.')) || null : null
    setTarieven(prev => ({ ...prev, [`${code_groep}_${land}`]: tarief }))
    setEditingKey(null)
    await supabase.from('licentiekosten').upsert({ code_groep, land, tarief }, { onConflict: 'code_groep,land' })
  }

  const applyBulk = async (code_groep: number, landen: string[]) => {
    const val = bulkVal[code_groep]
    if (!val?.trim()) return
    const tarief = parseFloat(val.replace(',', '.')) || null
    await supabase.from('licentiekosten').upsert(
      landen.map(land => ({ code_groep, land, tarief })),
      { onConflict: 'code_groep,land' }
    )
    setTarieven(prev => {
      const next = { ...prev }
      for (const land of landen) next[`${code_groep}_${land}`] = tarief
      return next
    })
    toast.success('Tarief toegepast')
  }

  if (loading) return <div className="empty">Laden…</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Licentiekosten</div>
          <div className="page-sub">{codeGroepen.length} artikelcode groepen</div>
        </div>
        <div className="search-wrap" style={{ width: 260 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek op code of omschrijving…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {codeGroepen.length === 0 && (
        <div className="card"><div className="empty">Geen artikelcode groepen gevonden — importeer eerst artikelen.</div></div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {codeGroepen.filter(cg =>
          !search ||
          cg.code_groep.toString().includes(search) ||
          cg.omschrijving?.toLowerCase().includes(search.toLowerCase())
        ).map(cg => {
          const rasId = rasConfigs[cg.code_groep] ?? null
          const ras = rassen.find(r => r.id === rasId) ?? null
          const landen = ras?.landen ?? []
          const isCollapsed = collapsed.has(cg.code_groep)

          return (
            <div key={cg.code_groep} className="card">
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap', borderBottom: ras && !isCollapsed ? '1px solid var(--border)' : undefined }}>
                <span onClick={() => toggleCollapse(cg.code_groep)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isCollapsed ? <ChevronRight size={15} color="var(--muted)" /> : <ChevronDown size={15} color="var(--muted)" />}
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{cg.code_groep}</span>
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{cg.omschrijving ?? '–'}</span>
                <select
                  value={rasId ?? ''}
                  onChange={e => saveRasLink(cg.code_groep, e.target.value ? Number(e.target.value) : null)}
                  style={{ width: 'auto', minWidth: 160, fontSize: 12, padding: '4px 8px' }}
                >
                  <option value="">— Koppel ras —</option>
                  {rassen.map(r => <option key={r.id} value={r.id}>{r.naam} · {r.lh_naam}</option>)}
                </select>
                {ras && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ras.lh_naam}</span>
                )}
              </div>

              {/* Landen & tarieven */}
              {ras && landen.length > 0 && !isCollapsed && (
                <div style={{ padding: '10px 16px' }}>
                  {/* Snel invullen */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Snel invullen:</span>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="0.0350"
                      value={bulkVal[cg.code_groep] ?? ''}
                      onChange={e => setBulkVal(prev => ({ ...prev, [cg.code_groep]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') applyBulk(cg.code_groep, landen) }}
                      style={{ width: 110, fontSize: 12, padding: '4px 8px' }}
                    />
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => applyBulk(cg.code_groep, landen)}
                    >
                      <Check size={12} /> Alle landen
                    </button>
                  </div>

                  {/* Landen */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {landen.map(land => {
                      const key = `${cg.code_groep}_${land}`
                      const tarief = tarieven[key]
                      const isEditing = editingKey === key
                      return (
                        <div
                          key={land}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: tarief != null ? 'var(--accent-bg)' : 'var(--bg)',
                            border: `1px solid ${tarief != null ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 6, padding: '4px 8px', minWidth: 120,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 24, color: tarief != null ? 'var(--accent)' : 'var(--muted)' }}>{land}</span>
                          {isEditing
                            ? <input
                                type="number"
                                step="0.0001"
                                value={editVal}
                                autoFocus
                                onChange={e => setEditVal(e.target.value)}
                                onBlur={() => saveTarief(cg.code_groep, land, editVal)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveTarief(cg.code_groep, land, editVal)
                                  if (e.key === 'Escape') setEditingKey(null)
                                }}
                                style={{ width: 75, fontSize: 12, padding: '2px 4px' }}
                              />
                            : <span
                                onClick={() => { setEditingKey(key); setEditVal(tarief != null ? String(tarief) : '') }}
                                style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: 'pointer', color: tarief != null ? 'var(--text)' : 'var(--muted)' }}
                              >
                                {tarief != null ? `€ ${tarief.toFixed(4)}` : 'klik…'}
                              </span>
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {ras && landen.length === 0 && !isCollapsed && (
                <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted)' }}>
                  Geen landen gekoppeld aan dit ras
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

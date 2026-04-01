import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MultiSelect } from '../lib/MultiSelect'
import { usePersistedState } from '../lib/usePersistedState'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

interface OmzetRow {
  datum: string | null
  soort: string | null
  land_debiteur: string | null
  aantal: number | null
  ras_naam: string | null
  licentiehouder_naam: string | null
  totaal_licentiekosten: number | null
  intern_extern: string | null
}

const fmt  = (v: number) => '€\u00a0' + v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtN = (v: number) => Math.round(v).toLocaleString('nl-NL')
const fmtK = (v: number) => v >= 1000 ? `€\u00a0${(v / 1000).toFixed(0)}K` : `€\u00a0${v.toFixed(0)}`

const fmtMaand = (m: string) => {
  const [y, mo] = m.split('-')
  const namen = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `${namen[parseInt(mo) - 1]} '${y.slice(2)}`
}

const SOORTEN = ['Aardbei', 'Framboos', 'Braam']
const SOORT_COLORS: Record<string, string> = { Aardbei: '#f43f5e', Framboos: '#a855f7', Braam: '#334155' }
const LH_COLORS = ['#6366f1','#f97316','#22c55e','#ef4444','#eab308','#06b6d4','#ec4899','#84cc16']

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const totaal = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.filter((p: any) => p.value > 0).map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
          <span style={{ color: p.fill }}>{p.name}</span>
          <span style={{ fontFamily: 'monospace' }}>{fmt(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 20, fontWeight: 600 }}>
        <span>Totaal</span><span style={{ fontFamily: 'monospace' }}>{fmt(totaal)}</span>
      </div>}
    </div>
  )
}

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
      <div style={{ fontWeight: 600 }}>{payload[0].name}</div>
      <div>{fmt(payload[0].value)}</div>
    </div>
  )
}

type GroupBy = 'maand' | 'licentiehouder' | 'ras' | 'soort' | 'land' | 'type'

const GROUPS: { key: GroupBy; label: string }[] = [
  { key: 'maand',          label: 'Maand' },
  { key: 'licentiehouder', label: 'Licentiehouder' },
  { key: 'ras',            label: 'Ras' },
  { key: 'soort',          label: 'Soort' },
  { key: 'land',           label: 'Land' },
  { key: 'type',           label: 'Type' },
]

export default function Dashboard() {
  const [rows, setRows] = useState<OmzetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDatumVan, setFilterDatumVan] = usePersistedState('f-dash-datumvan', '')
  const [filterDatumTot, setFilterDatumTot] = usePersistedState('f-dash-datumtot', '')
  const [filterLh,       setFilterLh]       = usePersistedState<string[]>('f-dash-lh', [])
  const [filterSoort,    setFilterSoort]    = usePersistedState<string[]>('f-dash-soort', [])
  const [filterRas,      setFilterRas]      = usePersistedState<string[]>('f-dash-ras', [])
  const [filterLand,     setFilterLand]     = usePersistedState<string[]>('f-dash-land', [])
  const [filterType,     setFilterType]     = usePersistedState<string[]>('f-dash-type', [])
  const [groupBy,        setGroupBy]        = usePersistedState<GroupBy>('f-dash-groupby', 'maand')

  useEffect(() => {
    const fetch = async () => {
      const pageSize = 1000
      let all: OmzetRow[] = []
      let from = 0
      while (true) {
        const { data } = await supabase
          .from('omzetrekeningen')
          .select('datum,soort,land_debiteur,aantal,ras_naam,licentiehouder_naam,totaal_licentiekosten,intern_extern')
          .range(from, from + pageSize - 1)
        if (!data?.length) break
        all = [...all, ...data as OmzetRow[]]
        if (data.length < pageSize) break
        from += pageSize
      }
      setRows(all)
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = useMemo(() => rows.filter(r =>
    (!filterDatumVan || (r.datum ?? '') >= filterDatumVan) &&
    (!filterDatumTot || (r.datum ?? '') <= filterDatumTot) &&
    (!filterLh.length    || filterLh.includes(r.licentiehouder_naam ?? '')) &&
    (!filterSoort.length || filterSoort.includes(r.soort ?? '')) &&
    (!filterRas.length   || filterRas.includes(r.ras_naam ?? '')) &&
    (!filterLand.length  || filterLand.includes(r.land_debiteur ?? '')) &&
    (!filterType.length  || filterType.includes(r.intern_extern ?? ''))
  ), [rows, filterDatumVan, filterDatumTot, filterLh, filterSoort, filterRas, filterLand, filterType])

  const totLk     = useMemo(() => filtered.reduce((s, r) => s + (r.totaal_licentiekosten ?? 0), 0), [filtered])
  const totAantal = useMemo(() => filtered.reduce((s, r) => s + (r.aantal ?? 0), 0), [filtered])

  // Bar chart: maand × soort (gestapeld)
  const maandChartData = useMemo(() => {
    const map = new Map<string, Record<string, number>>()
    for (const r of filtered) {
      if (!r.datum || !r.totaal_licentiekosten) continue
      const m = r.datum.slice(0, 7)
      if (!map.has(m)) map.set(m, {})
      const entry = map.get(m)!
      const s = r.soort ?? 'Onbekend'
      entry[s] = (entry[s] ?? 0) + r.totaal_licentiekosten
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, s]) => ({ maand: fmtMaand(m), ...s }))
  }, [filtered])

  const activeSoorten = useMemo(() =>
    SOORTEN.filter(s => maandChartData.some(d => (d as any)[s] > 0))
  , [maandChartData])

  // Pie chart: top licentiehouders
  const lhPieData = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filtered)
      if (r.totaal_licentiekosten)
        map.set(r.licentiehouder_naam ?? '–', (map.get(r.licentiehouder_naam ?? '–') ?? 0) + r.totaal_licentiekosten)
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
    if (sorted.length <= 8) return sorted.map(([name, value]) => ({ name, value }))
    const overige = sorted.slice(7).reduce((s, [, v]) => s + v, 0)
    return [...sorted.slice(0, 7).map(([name, value]) => ({ name, value })), { name: 'Overige', value: overige }]
  }, [filtered])

  // Pivot: licentiehouder × maand
  const pivotData = useMemo(() => {
    const maanden = [...new Set(filtered.filter(r => r.datum).map(r => r.datum!.slice(0, 7)))].sort()
    const lhMap = new Map<string, Map<string, number>>()
    for (const r of filtered) {
      if (!r.totaal_licentiekosten || !r.datum) continue
      const lh = r.licentiehouder_naam ?? '–'
      const m = r.datum.slice(0, 7)
      if (!lhMap.has(lh)) lhMap.set(lh, new Map())
      const mm = lhMap.get(lh)!
      mm.set(m, (mm.get(m) ?? 0) + r.totaal_licentiekosten)
    }
    const lhRows = [...lhMap.entries()]
      .map(([lh, mMap]) => ({ lh, totaal: [...mMap.values()].reduce((s, v) => s + v, 0), data: mMap }))
      .sort((a, b) => b.totaal - a.totaal)
    const maandTotalen = new Map<string, number>()
    for (const { data } of lhRows)
      for (const [m, v] of data) maandTotalen.set(m, (maandTotalen.get(m) ?? 0) + v)
    return { maanden, lhRows, maandTotalen }
  }, [filtered])

  // Groepeer tabel
  const getKey = (r: OmzetRow): string => {
    if (groupBy === 'maand')          return r.datum ? r.datum.slice(0, 7) : '–'
    if (groupBy === 'licentiehouder') return r.licentiehouder_naam ?? '–'
    if (groupBy === 'ras')            return r.ras_naam ?? '–'
    if (groupBy === 'soort')          return r.soort ?? '–'
    if (groupBy === 'land')           return r.land_debiteur ?? '–'
    if (groupBy === 'type')           return r.intern_extern ?? '–'
    return '–'
  }
  const groupMap = new Map<string, { lk: number; aantal: number }>()
  for (const r of filtered) {
    const key = getKey(r)
    const e = groupMap.get(key) ?? { lk: 0, aantal: 0 }
    groupMap.set(key, { lk: e.lk + (r.totaal_licentiekosten ?? 0), aantal: e.aantal + (r.aantal ?? 0) })
  }
  const groups = [...groupMap.entries()]
    .sort((a, b) => groupBy === 'maand' ? b[0].localeCompare(a[0]) : b[1].lk - a[1].lk)

  const uniq = (fn: (r: OmzetRow) => string | null) =>
    [...new Set(rows.map(fn).filter(Boolean) as string[])].sort()

  const hasFilters = filterDatumVan || filterDatumTot || filterLh.length || filterSoort.length || filterRas.length || filterLand.length || filterType.length
  const clearFilters = () => { setFilterDatumVan(''); setFilterDatumTot(''); setFilterLh([]); setFilterSoort([]); setFilterRas([]); setFilterLand([]); setFilterType([]) }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{loading ? 'Laden…' : `${filtered.length.toLocaleString('nl-NL')} regels`}</div>
        </div>
      </div>

      <div className="filters">
        <input type="date" value={filterDatumVan} onChange={e => setFilterDatumVan(e.target.value)} style={{ width: 'auto' }} title="Datum van" />
        <input type="date" value={filterDatumTot} onChange={e => setFilterDatumTot(e.target.value)} style={{ width: 'auto' }} title="Datum tot" />
        <MultiSelect label="Licentiehouders" options={uniq(r => r.licentiehouder_naam)} selected={filterLh} onChange={setFilterLh} />
        <MultiSelect label="Soorten" options={uniq(r => r.soort)} selected={filterSoort} onChange={setFilterSoort} />
        <MultiSelect label="Rassen" options={uniq(r => r.ras_naam)} selected={filterRas} onChange={setFilterRas} />
        <MultiSelect label="Landen" options={uniq(r => r.land_debiteur)} selected={filterLand} onChange={setFilterLand} />
        <MultiSelect label="Types" options={uniq(r => r.intern_extern)} selected={filterType} onChange={setFilterType} />
        {hasFilters && <button className="btn btn-ghost" onClick={clearFilters}>Wis filters</button>}
      </div>

      {/* KPI stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Totaal licentiekosten</div>
          <div className="stat-value">{loading ? '–' : fmt(totLk)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Totaal planten</div>
          <div className="stat-value">{loading ? '–' : fmtN(totAantal)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Licentiehouders</div>
          <div className="stat-value">{loading ? '–' : lhPieData.length}</div>
        </div>
      </div>

      {/* Charts */}
      {!loading && maandChartData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Bar chart maand */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16, fontSize: 13, fontWeight: 600 }}>Licentiekosten per maand</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={maandChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="maand" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={64} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--accent-bg)' }} />
                {activeSoorten.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {activeSoorten.map(s => (
                  <Bar key={s} dataKey={s} stackId="a" fill={SOORT_COLORS[s] ?? '#94a3b8'} radius={activeSoorten[activeSoorten.length - 1] === s ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Donut chart licentiehouder */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16, fontSize: 13, fontWeight: 600 }}>Verdeling licentiehouders</div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={lhPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                  {lhPieData.map((_, i) => <Cell key={i} fill={LH_COLORS[i % LH_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {lhPieData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: LH_COLORS[i % LH_COLORS.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 11 }}>{totLk > 0 ? (d.value / totLk * 100).toFixed(1) + '%' : '–'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pivot: licentiehouder × maand */}
      {!loading && pivotData.lhRows.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '14px 20px 10px', fontWeight: 600, fontSize: 13 }}>Licentiekosten per licentiehouder per maand</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2, minWidth: 160, textAlign: 'left' }}>Licentiehouder</th>
                  {pivotData.maanden.map(m => (
                    <th key={m} className="num" style={{ whiteSpace: 'nowrap', minWidth: 90 }}>{fmtMaand(m)}</th>
                  ))}
                  <th className="num" style={{ whiteSpace: 'nowrap', minWidth: 100, fontWeight: 700 }}>Totaal</th>
                </tr>
              </thead>
              <tbody>
                {pivotData.lhRows.map(({ lh, totaal, data }) => (
                  <tr key={lh}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', fontWeight: 500, zIndex: 1 }}>{lh}</td>
                    {pivotData.maanden.map(m => {
                      const v = data.get(m) ?? null
                      return (
                        <td key={m} className="num" style={{ color: v ? 'var(--text)' : 'var(--muted)' }}>
                          {v != null ? fmt(v) : '–'}
                        </td>
                      )
                    })}
                    <td className="num" style={{ fontWeight: 700 }}>{fmt(totaal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-md)' }}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', fontWeight: 700, zIndex: 1 }}>Totaal</td>
                  {pivotData.maanden.map(m => (
                    <td key={m} className="num" style={{ fontWeight: 700 }}>
                      {pivotData.maandTotalen.get(m) ? fmt(pivotData.maandTotalen.get(m)!) : '–'}
                    </td>
                  ))}
                  <td className="num" style={{ fontWeight: 700 }}>{fmt(totLk)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Groepeer tabel */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Groeperen op</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {GROUPS.map(g => (
              <button
                key={g.key}
                className={`btn ${groupBy === g.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setGroupBy(g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{GROUPS.find(g => g.key === groupBy)?.label}</th>
                <th className="num">Planten</th>
                <th className="num">Licentiekosten</th>
                <th className="num">% van totaal</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="empty">Laden…</td></tr>}
              {!loading && groups.length === 0 && <tr><td colSpan={4} className="empty">Geen data — importeer eerst omzetrekeningen.</td></tr>}
              {groups.map(([key, val]) => (
                <tr key={key}>
                  <td style={{ fontWeight: 500 }}>{key}</td>
                  <td className="num">{fmtN(val.aantal)}</td>
                  <td className="num">{fmt(val.lk)}</td>
                  <td className="num" style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {totLk > 0 ? (val.lk / totLk * 100).toFixed(1) + '%' : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
            {groups.length > 1 && (
              <tfoot>
                <tr>
                  <td>Totaal ({groups.length})</td>
                  <td className="num">{fmtN(totAantal)}</td>
                  <td className="num">{fmt(totLk)}</td>
                  <td className="num">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}

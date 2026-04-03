import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MultiSelect } from '../lib/MultiSelect'
import { usePersistedState } from '../lib/usePersistedState'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
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

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const multi = payload.length > 1
  const totaal = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
      {label && <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>}
      {payload.filter((p: any) => (p.value ?? 0) > 0).map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
          {multi && <span style={{ color: p.fill }}>{p.name}</span>}
          <span style={{ fontFamily: 'monospace' }}>{fmt(p.value)}</span>
        </div>
      ))}
      {multi && totaal > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 20, fontWeight: 600 }}>
          <span>Totaal</span><span style={{ fontFamily: 'monospace' }}>{fmt(totaal)}</span>
        </div>
      )}
    </div>
  )
}

// Compact stacked bar chart voor maand
function MaandChart({ data, soorten, totaal }: { data: any[]; soorten: string[]; totaal: number }) {
  const last12 = data.slice(-18)
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={last12} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="maand" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--accent-bg)' }} />
        {soorten.map((s, i) => (
          <Bar key={s} dataKey={s} stackId="a" fill={SOORT_COLORS[s] ?? '#94a3b8'} radius={i === soorten.length - 1 ? [3,3,0,0] : [0,0,0,0]}>
            {i === soorten.length - 1 && (
              <LabelList content={(props: any) => {
                const row = last12[props.index]
                if (!row) return null
                const tot = soorten.reduce((s, k) => s + (row[k] ?? 0), 0)
                if (tot === 0) return null
                const pct = totaal > 0 ? (tot / totaal * 100).toFixed(0) : '0'
                return <text x={props.x + props.width / 2} y={props.y - 5} textAnchor="middle" fontSize={9} fill="var(--muted)">{fmtK(tot)} · {pct}%</text>
              }} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// Horizontale bar chart voor licentiehouder / ras / land
function HorizontalChart({ groups, totaal, color }: { groups: [string, { lk: number }][]; totaal: number; color: string }) {
  const data = groups.slice(0, 10).map(([name, val]) => ({
    name: name.length > 22 ? name.slice(0, 20) + '…' : name,
    lk: val.lk,
  }))
  const barH = 22
  const chartH = Math.max(80, data.length * (barH + 6) + 8)
  return (
    <ResponsiveContainer width="100%" height={chartH}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 150, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text)' }} width={150} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--accent-bg)' }} />
        <Bar dataKey="lk" fill={color} radius={[0, 4, 4, 0]} barSize={barH}>
          <LabelList content={(props: any) => {
            const pct = totaal > 0 ? (props.value / totaal * 100).toFixed(1) : '0'
            return <text x={props.x + props.width + 8} y={props.y + props.height / 2 + 4} fontSize={11} fill="var(--muted)">{fmtK(props.value)} · {pct}%</text>
          }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Donut chart voor soort / type
function DonutChart({ groups, totaal }: { groups: [string, { lk: number }][]; totaal: number }) {
  const data = groups.map(([name, val]) => ({ name, value: val.lk }))
  const colors = [...SOORT_COLORS ? Object.values(SOORT_COLORS) : [], ...LH_COLORS]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <ResponsiveContainer width={160} height={140}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={2}
            label={({ percent }: { percent?: number }) => (percent ?? 0) > 0.04 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''}
            labelLine={false}
          >
            {data.map((entry, i) => {
              const col = SOORT_COLORS[entry.name] ?? LH_COLORS[i % LH_COLORS.length]
              return <Cell key={i} fill={col} />
            })}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => {
          const col = SOORT_COLORS[d.name] ?? LH_COLORS[i % LH_COLORS.length]
          const pct = totaal > 0 ? (d.value / totaal * 100).toFixed(1) : '0'
          return (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: col, flexShrink: 0 }} />
              <span>{d.name}</span>
              <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 11 }}>{fmt(d.value)} · {pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type GroupBy = 'maand' | 'licentiehouder' | 'ras' | 'soort' | 'land' | 'type' | 'afloop'

const GROUPS: { key: GroupBy; label: string }[] = [
  { key: 'maand',          label: 'Maand' },
  { key: 'licentiehouder', label: 'Licentiehouder' },
  { key: 'ras',            label: 'Ras' },
  { key: 'soort',          label: 'Soort' },
  { key: 'land',           label: 'Land' },
  { key: 'type',           label: 'Type' },
  { key: 'afloop',         label: 'Afloop licentiehouders' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<OmzetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDatumVan, setFilterDatumVan] = usePersistedState('f-dash-datumvan', '')
  const [filterDatumTot, setFilterDatumTot] = usePersistedState('f-dash-datumtot', '')
  const [filterLh,    setFilterLh]    = usePersistedState<string[]>('f-dash-lh', [])
  const [filterSoort, setFilterSoort] = usePersistedState<string[]>('f-dash-soort', [])
  const [filterRas,   setFilterRas]   = usePersistedState<string[]>('f-dash-ras', [])
  const [filterLand,  setFilterLand]  = usePersistedState<string[]>('f-dash-land', [])
  const [filterType,  setFilterType]  = usePersistedState<string[]>('f-dash-type', [])
  const [groupBy,     setGroupBy]     = usePersistedState<GroupBy>('f-dash-groupby', 'maand')

  useEffect(() => {
    const doFetch = async () => {
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
    doFetch()
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

  // Groepeer data
  const getKey = (r: OmzetRow): string => {
    if (groupBy === 'maand')          return r.datum ? r.datum.slice(0, 7) : '–'
    if (groupBy === 'licentiehouder') return r.licentiehouder_naam ?? '–'
    if (groupBy === 'ras')            return r.ras_naam ?? '–'
    if (groupBy === 'soort')          return r.soort ?? '–'
    if (groupBy === 'land')           return r.land_debiteur ?? '–'
    if (groupBy === 'type')           return r.intern_extern ?? '–'
    if (groupBy === 'afloop')         return r.licentiehouder_naam ?? '–'
    return '–'
  }
  const groups = useMemo(() => {
    const map = new Map<string, { lk: number; aantal: number }>()
    for (const r of filtered) {
      const key = getKey(r)
      const e = map.get(key) ?? { lk: 0, aantal: 0 }
      map.set(key, { lk: e.lk + (r.totaal_licentiekosten ?? 0), aantal: e.aantal + (r.aantal ?? 0) })
    }
    return [...map.entries()]
      .sort((a, b) => groupBy === 'maand' ? b[0].localeCompare(a[0]) : b[1].lk - a[1].lk)
  }, [filtered, groupBy])

  // Maand chart data
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
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, s]) => ({ maand: fmtMaand(m), ...s }))
  }, [filtered])

  const activeSoorten = useMemo(() =>
    SOORTEN.filter(s => maandChartData.some(d => (d as any)[s] > 0))
  , [maandChartData])

  // Pivot licentiehouder × maand
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

  const uniq = (fn: (r: OmzetRow) => string | null) =>
    [...new Set(rows.map(fn).filter(Boolean) as string[])].sort()

  const hasFilters = filterDatumVan || filterDatumTot || filterLh.length || filterSoort.length || filterRas.length || filterLand.length || filterType.length
  const clearFilters = () => { setFilterDatumVan(''); setFilterDatumTot(''); setFilterLh([]); setFilterSoort([]); setFilterRas([]); setFilterLand([]); setFilterType([]) }

  const drillDown = (key: string) => {
    // Kopieer bestaande dashboard-filters naar omzetrekeningen-filters
    let van  = filterDatumVan
    let tot  = filterDatumTot
    let soort = [...filterSoort]
    let land  = [...filterLand]
    let ras   = [...filterRas]
    let lh    = [...filterLh]
    let type  = [...filterType]

    // Voeg groep-specifiek filter toe
    if (key !== '–') {
      if (groupBy === 'maand') {
        const [y, m] = key.split('-')
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
        van = `${y}-${m}-01`
        tot = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
      } else if (groupBy === 'licentiehouder' || groupBy === 'afloop') {
        if (!lh.includes(key)) lh = [key]
      } else if (groupBy === 'ras') {
        if (!ras.includes(key)) ras = [key]
      } else if (groupBy === 'soort') {
        if (!soort.includes(key)) soort = [key]
      } else if (groupBy === 'land') {
        if (!land.includes(key)) land = [key]
      } else if (groupBy === 'type') {
        if (!type.includes(key)) type = [key]
      }
    }

    localStorage.setItem('f-omzet-datumvan', JSON.stringify(van))
    localStorage.setItem('f-omzet-datumtot', JSON.stringify(tot))
    localStorage.setItem('f-omzet-soort',    JSON.stringify(soort))
    localStorage.setItem('f-omzet-land',     JSON.stringify(land))
    localStorage.setItem('f-omzet-ras',      JSON.stringify(ras))
    localStorage.setItem('f-omzet-lh',       JSON.stringify(lh))
    localStorage.setItem('f-omzet-type',     JSON.stringify(type))
    localStorage.setItem('f-omzet-search',   JSON.stringify(''))
    navigate('/omzetrekeningen')
  }

  const chartColor = (key: GroupBy) => {
    if (key === 'licentiehouder') return '#6366f1'
    if (key === 'ras')  return '#22c55e'
    if (key === 'land') return '#06b6d4'
    return '#6366f1'
  }

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
          <div className="stat-label">Groepen</div>
          <div className="stat-value">{loading ? '–' : groups.length}</div>
        </div>
      </div>

      <div className="card">
        {/* Tab selector */}
        <div className="card-header">
          <span className="card-title">Groeperen op</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {GROUPS.map(g => (
              <button key={g.key} className={`btn ${groupBy === g.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setGroupBy(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compacte visual — niet bij afloop */}
        {!loading && groups.length > 0 && groupBy !== 'afloop' && (
          <div style={{ padding: '12px 20px 4px', borderBottom: '1px solid var(--border)' }}>
            {groupBy === 'maand' && activeSoorten.length > 0 && (
              <MaandChart data={maandChartData} soorten={activeSoorten} totaal={totLk} />
            )}
            {(groupBy === 'soort' || groupBy === 'type') && (
              <DonutChart groups={groups} totaal={totLk} />
            )}
            {(groupBy === 'licentiehouder' || groupBy === 'ras' || groupBy === 'land') && (
              <HorizontalChart groups={groups} totaal={totLk} color={chartColor(groupBy)} />
            )}
          </div>
        )}

        {/* Groepeer tabel — niet bij afloop */}
        {groupBy !== 'afloop' && (
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
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
                  <tr key={key} onClick={() => drillDown(key)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ fontWeight: 500 }}>
                      {groupBy === 'maand' && key !== '–' ? fmtMaand(key) : key}
                    </td>
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
        )}

        {/* Pivot afloop licentiehouders */}
        {groupBy === 'afloop' && (
          <div style={{ overflowX: 'auto' }}>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Laden…</div>}
            {!loading && pivotData.lhRows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Geen data — importeer eerst omzetrekeningen.</div>}
            {!loading && pivotData.lhRows.length > 0 && (
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
                    <tr key={lh} onClick={() => drillDown(lh)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', fontWeight: 500, zIndex: 1 }}>{lh}</td>
                      {pivotData.maanden.map(m => {
                        const v = data.get(m) ?? null
                        return <td key={m} className="num" style={{ color: v ? 'var(--text)' : 'var(--muted)' }}>{v != null ? fmt(v) : '–'}</td>
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
            )}
          </div>
        )}
      </div>
    </>
  )
}

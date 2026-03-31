import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MultiSelect } from '../lib/MultiSelect'
import { usePersistedState } from '../lib/usePersistedState'

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

type GroupBy = 'maand' | 'licentiehouder' | 'ras' | 'soort' | 'land' | 'type'

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

  const filtered = rows.filter(r =>
    (!filterDatumVan || (r.datum ?? '') >= filterDatumVan) &&
    (!filterDatumTot || (r.datum ?? '') <= filterDatumTot) &&
    (!filterLh.length    || filterLh.includes(r.licentiehouder_naam ?? '')) &&
    (!filterSoort.length || filterSoort.includes(r.soort ?? '')) &&
    (!filterRas.length   || filterRas.includes(r.ras_naam ?? '')) &&
    (!filterLand.length  || filterLand.includes(r.land_debiteur ?? '')) &&
    (!filterType.length  || filterType.includes(r.intern_extern ?? ''))
  )

  const totLk    = filtered.reduce((s, r) => s + (r.totaal_licentiekosten ?? 0), 0)
  const totAantal = filtered.reduce((s, r) => s + (r.aantal ?? 0), 0)

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

  const GROUPS: { key: GroupBy; label: string }[] = [
    { key: 'maand',          label: 'Maand' },
    { key: 'licentiehouder', label: 'Licentiehouder' },
    { key: 'ras',            label: 'Ras' },
    { key: 'soort',          label: 'Soort' },
    { key: 'land',           label: 'Land' },
    { key: 'type',           label: 'Type' },
  ]

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

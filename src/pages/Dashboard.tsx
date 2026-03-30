import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface MaandStat {
  maand: string
  jaar: number
  licentiehouder: string
  totaal_aantal: number
  totaal_licentiekosten: number
  betaald_grootboek: number
}

const fmt  = (v: number) => '€\u00a0' + Math.round(v).toLocaleString('nl-NL')
const fmtN = (v: number) => Math.round(v).toLocaleString('nl-NL')

export default function Dashboard() {
  const [stats, setStats] = useState<MaandStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('v_maand_overzicht').select('*').order('jaar', { ascending: false })
      .then(({ data }) => { setStats(data ?? []); setLoading(false) })
  }, [])

  const totLk      = stats.reduce((s, r) => s + (r.totaal_licentiekosten ?? 0), 0)
  const totBetaald = stats.reduce((s, r) => s + (r.betaald_grootboek ?? 0), 0)
  const totPlanten = stats.reduce((s, r) => s + (r.totaal_aantal ?? 0), 0)
  const maanden    = [...new Set(stats.map(r => r.maand))]

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Licentiekosten overzicht</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Totaal licentiekosten</div>
          <div className="stat-value">{loading ? '–' : fmt(totLk)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Betaald (grb 1955)</div>
          <div className="stat-value">{loading ? '–' : fmt(totBetaald)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Openstaand</div>
          <div className="stat-value" style={{ color: totLk - totBetaald > 0 ? 'var(--warning)' : 'var(--accent)' }}>
            {loading ? '–' : fmt(totLk - totBetaald)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Totaal planten</div>
          <div className="stat-value">{loading ? '–' : fmtN(totPlanten)}</div>
        </div>
      </div>

      {maanden.map(maand => {
        const rows = stats.filter(r => r.maand === maand).sort((a, b) => b.totaal_licentiekosten - a.totaal_licentiekosten)
        const totMaand = rows.reduce((s, r) => s + r.totaal_licentiekosten, 0)
        return (
          <div className="card" key={maand} style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">{maand}</span>
              <span className="mono">{fmt(totMaand)}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Licentiehouder</th>
                  <th className="num">Planten</th>
                  <th className="num">Licentiekosten</th>
                  <th className="num">Betaald</th>
                  <th className="num">Openstaand</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.licentiehouder}>
                      <td>{r.licentiehouder}</td>
                      <td className="num">{fmtN(r.totaal_aantal)}</td>
                      <td className="num">{fmt(r.totaal_licentiekosten)}</td>
                      <td className="num text-success">{fmt(r.betaald_grootboek)}</td>
                      <td className="num" style={{ color: r.totaal_licentiekosten - r.betaald_grootboek > 0 ? 'var(--warning)' : undefined }}>
                        {fmt(r.totaal_licentiekosten - r.betaald_grootboek)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <td>Totaal</td>
                  <td className="num">{fmtN(rows.reduce((s,r) => s+r.totaal_aantal, 0))}</td>
                  <td className="num">{fmt(totMaand)}</td>
                  <td className="num">{fmt(rows.reduce((s,r) => s+r.betaald_grootboek, 0))}</td>
                  <td className="num">{fmt(rows.reduce((s,r) => s+r.totaal_licentiekosten-r.betaald_grootboek, 0))}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )
      })}

      {!loading && maanden.length === 0 && (
        <div className="card"><div className="empty">Nog geen transacties ingevoerd.</div></div>
      )}
    </>
  )
}

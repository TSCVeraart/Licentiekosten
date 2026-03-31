import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const ITEMS: { id: string; label: string }[] = [
  { id: 'gb_8301',        label: 'Grootboek 8301 uploaden' },
  { id: 'gb_8304',        label: 'Grootboek 8304 uploaden' },
  { id: 'gb_8305',        label: 'Grootboek 8305 uploaden' },
  { id: 'debiteuren',     label: 'Debiteuren toegevoegd' },
  { id: 'licentiehouders',label: 'Licentiehouders onderhouden' },
  { id: 'rassen',         label: 'Rassen onderhouden' },
  { id: 'artikelen',      label: 'Artikelen onderhouden' },
  { id: 'licentiekosten', label: 'Licentiekosten onderhouden' },
  { id: 'ontbrekend',     label: 'Ontbrekende kosten verwerkt' },
]

const MAANDEN = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']

const prevMonthStr = (): string => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const formatMaand = (m: string) => {
  const [y, mo] = m.split('-')
  return `${MAANDEN[parseInt(mo) - 1]} ${y}`
}

const addMonths = (m: string, n: number): string => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface Regel {
  afgevinkt: boolean
  opmerking: string
}

export default function Checklist() {
  const [maand, setMaand] = useState(prevMonthStr)
  const [data, setData] = useState<Record<string, Regel>>({})
  const [loading, setLoading] = useState(true)
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = async (m: string) => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('checklist_maand')
      .select('item, afgevinkt, opmerking')
      .eq('maand', m)
    const map: Record<string, Regel> = {}
    for (const r of (rows ?? []) as { item: string; afgevinkt: boolean; opmerking: string | null }[])
      map[r.item] = { afgevinkt: r.afgevinkt, opmerking: r.opmerking ?? '' }
    setData(map)
    setLoading(false)
  }

  useEffect(() => { load(maand) }, [maand])

  const save = async (item: string, patch: Partial<Regel>) => {
    const current = data[item] ?? { afgevinkt: false, opmerking: '' }
    const next = { ...current, ...patch }
    setData(prev => ({ ...prev, [item]: next }))
    const { error } = await supabase.from('checklist_maand').upsert(
      { maand, item, afgevinkt: next.afgevinkt, opmerking: next.opmerking },
      { onConflict: 'maand,item' }
    )
    if (error) toast.error('Fout bij opslaan')
  }

  const saveDebounced = (item: string, patch: Partial<Regel>) => {
    // Update local state immediately
    setData(prev => ({ ...prev, [item]: { ...(prev[item] ?? { afgevinkt: false, opmerking: '' }), ...patch } }))
    clearTimeout(debounceRefs.current[item])
    debounceRefs.current[item] = setTimeout(async () => {
      const current = { ...(data[item] ?? { afgevinkt: false, opmerking: '' }), ...patch }
      const { error } = await supabase.from('checklist_maand').upsert(
        { maand, item, afgevinkt: current.afgevinkt, opmerking: current.opmerking },
        { onConflict: 'maand,item' }
      )
      if (error) toast.error('Fout bij opslaan')
    }, 800)
  }

  const afgevinkt = ITEMS.filter(i => data[i.id]?.afgevinkt).length
  const isDeadline = new Date().getDate() >= 10
  const allDone = afgevinkt === ITEMS.length

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Maandchecklist</div>
          <div className="page-sub">{afgevinkt} / {ITEMS.length} afgevinkt</div>
        </div>
        {isDeadline && !allDone && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 'var(--radius)',
            background: '#fef2f2', border: '1px solid #fca5a5',
            fontSize: 13, color: '#dc2626',
          }}>
            De deadline van de 10e is verstreken — {ITEMS.length - afgevinkt} punt{ITEMS.length - afgevinkt !== 1 ? 'en' : ''} openstaand
          </div>
        )}
        {allDone && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 'var(--radius)',
            background: '#f0fdf4', border: '1px solid #86efac',
            fontSize: 13, color: '#16a34a',
          }}>
            <Check size={15} /> Alle punten afgevinkt
          </div>
        )}
      </div>

      {/* Maandnavigatie */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={() => setMaand(m => addMonths(m, -1))}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 600, fontSize: 15, minWidth: 160, textAlign: 'center' }}>{formatMaand(maand)}</span>
        <button className="btn btn-ghost" onClick={() => setMaand(m => addMonths(m, 1))}><ChevronRight size={16} /></button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Laden…</div>}
        {!loading && ITEMS.map((item, idx) => {
          const regel = data[item.id] ?? { afgevinkt: false, opmerking: '' }
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', gap: 16, padding: '16px 20px',
                borderBottom: idx < ITEMS.length - 1 ? '1px solid var(--border)' : undefined,
                background: regel.afgevinkt ? 'var(--accent-bg)' : undefined,
                transition: 'background 0.15s',
              }}
            >
              {/* Checkbox */}
              <div style={{ paddingTop: 2, flexShrink: 0 }}>
                <button
                  onClick={() => save(item.id, { afgevinkt: !regel.afgevinkt })}
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${regel.afgevinkt ? 'var(--accent)' : 'var(--border-md)'}`,
                    background: regel.afgevinkt ? 'var(--accent)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {regel.afgevinkt && <Check size={13} color="#fff" strokeWidth={3} />}
                </button>
              </div>

              {/* Label + opmerking */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500,
                  color: regel.afgevinkt ? 'var(--muted)' : 'var(--text)',
                  textDecoration: regel.afgevinkt ? 'line-through' : undefined,
                  marginBottom: 8,
                }}>
                  {item.label}
                </div>
                <textarea
                  value={regel.opmerking}
                  onChange={e => saveDebounced(item.id, { opmerking: e.target.value })}
                  placeholder="Opmerking…"
                  rows={2}
                  style={{
                    width: '100%', fontFamily: 'inherit', fontSize: 12,
                    padding: '7px 10px', border: '1px solid var(--border-md)',
                    borderRadius: 'var(--radius)', background: 'var(--surface)',
                    color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

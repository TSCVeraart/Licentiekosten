import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

interface Item { id: string; label: string; href: string }

const GROEPEN: { label: string; items: Item[] }[] = [
  {
    label: 'Omzet',
    items: [
      { id: 'gb_8301', label: 'Grootboek 8301 uploaden', href: '/omzetrekeningen' },
      { id: 'gb_8304', label: 'Grootboek 8304 uploaden', href: '/omzetrekeningen' },
      { id: 'gb_8305', label: 'Grootboek 8305 uploaden', href: '/omzetrekeningen' },
    ],
  },
  {
    label: 'Stamgegevens',
    items: [
      { id: 'debiteuren',      label: 'Debiteuren toegevoegd',        href: '/debiteuren' },
      { id: 'licentiehouders', label: 'Licentiehouders onderhouden',  href: '/licentiehouders' },
      { id: 'rassen',          label: 'Rassen onderhouden',           href: '/rassen' },
    ],
  },
  {
    label: 'Tarieven & verwerking',
    items: [
      { id: 'artikelen',      label: 'Artikelen onderhouden',       href: '/artikelen' },
      { id: 'licentiekosten', label: 'Licentiekosten onderhouden',  href: '/licentiekosten' },
      { id: 'ontbrekend',     label: 'Ontbrekende kosten verwerkt', href: '/ontbrekende-kosten' },
    ],
  },
]

const ALL_ITEMS = GROEPEN.flatMap(g => g.items)

const MAANDEN = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']

const prevMonthStr = (): string => {
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() - 1)
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

interface Regel { afgevinkt: boolean; opmerking: string }

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
    const next = { ...(data[item] ?? { afgevinkt: false, opmerking: '' }), ...patch }
    setData(prev => ({ ...prev, [item]: next }))
    const { error } = await supabase.from('checklist_maand').upsert(
      { maand, item, afgevinkt: next.afgevinkt, opmerking: next.opmerking },
      { onConflict: 'maand,item' }
    )
    if (error) toast.error('Fout bij opslaan')
  }

  const saveDebounced = (item: string, opmerking: string) => {
    setData(prev => ({ ...prev, [item]: { ...(prev[item] ?? { afgevinkt: false, opmerking: '' }), opmerking } }))
    clearTimeout(debounceRefs.current[item])
    debounceRefs.current[item] = setTimeout(async () => {
      const afgevinkt = data[item]?.afgevinkt ?? false
      const { error } = await supabase.from('checklist_maand').upsert(
        { maand, item, afgevinkt, opmerking },
        { onConflict: 'maand,item' }
      )
      if (error) toast.error('Fout bij opslaan')
    }, 800)
  }

  const afgevinkt = ALL_ITEMS.filter(i => data[i.id]?.afgevinkt).length
  const allDone = afgevinkt === ALL_ITEMS.length

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Maandchecklist</div>
          <div className="page-sub">{afgevinkt} / {ALL_ITEMS.length} afgevinkt</div>
        </div>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Laden…</div>}
          {!loading && GROEPEN.map(groep => {
            const gedaan = groep.items.filter(i => data[i.id]?.afgevinkt).length
            return (
              <div key={groep.label} className="card" style={{ padding: 0 }}>
                <div style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{groep.label}</span>
                  <span style={{ fontSize: 12, color: gedaan === groep.items.length ? '#16a34a' : 'var(--muted)' }}>
                    {gedaan} / {groep.items.length}
                  </span>
                </div>
                {groep.items.map((item, idx) => {
                  const regel = data[item.id] ?? { afgevinkt: false, opmerking: '' }
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', gap: 16, padding: '14px 20px',
                        borderBottom: idx < groep.items.length - 1 ? '1px solid var(--border)' : undefined,
                        background: regel.afgevinkt ? 'var(--accent-bg)' : undefined,
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ paddingTop: 2, flexShrink: 0 }}>
                        <button
                          onClick={() => save(item.id, { afgevinkt: !regel.afgevinkt })}
                          style={{
                            width: 22, height: 22, borderRadius: 6,
                            border: `2px solid ${regel.afgevinkt ? 'var(--accent)' : 'var(--border-md)'}`,
                            background: regel.afgevinkt ? 'var(--accent)' : 'transparent',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {regel.afgevinkt && <Check size={13} color="#fff" strokeWidth={3} />}
                        </button>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 500,
                            color: regel.afgevinkt ? 'var(--muted)' : 'var(--text)',
                            textDecoration: regel.afgevinkt ? 'line-through' : undefined,
                          }}>
                            {item.label}
                          </span>
                          <Link to={item.href} style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center' }} title={`Ga naar ${item.label}`}>
                            <ExternalLink size={13} />
                          </Link>
                        </div>
                        <textarea
                          value={regel.opmerking}
                          onChange={e => saveDebounced(item.id, e.target.value)}
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
            )
          })}
        </div>
    </>
  )
}

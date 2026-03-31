import { useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}

export function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen]       = useState(false)
  const [flipLeft, setFlipLeft] = useState(false)
  const [search, setSearch]   = useState('')
  const ref                   = useRef<HTMLDivElement>(null)
  const searchRef             = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setFlipLeft(rect.left + 220 > window.innerWidth - 16)
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  const allSelected = filtered.length > 0 && filtered.every(o => selected.includes(o))
  const toggleAll = () => onChange(allSelected ? selected.filter(o => !filtered.includes(o)) : [...new Set([...selected, ...filtered])])

  const displayText = selected.length === 0 ? label
    : selected.length <= 2 ? selected.join(', ')
    : `${selected.length} geselecteerd`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px',
          border: `1px solid ${selected.length ? 'var(--accent)' : 'var(--border-md)'}`,
          borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit',
          color: selected.length ? 'var(--accent)' : 'var(--muted)',
          background: selected.length ? 'var(--accent-bg)' : 'var(--surface)',
          cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 140,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{displayText}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)',
          left: flipLeft ? 'auto' : 0,
          right: flipLeft ? 0 : 'auto',
          zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: 220,
        }}>
          {/* Zoekbalk */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoeken…"
              style={{
                width: '100%', padding: '5px 8px', fontSize: 12,
                border: '1px solid var(--border-md)', borderRadius: 6,
                background: 'var(--bg)', color: 'var(--text)',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            <div
              onClick={toggleAll}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              <input type="checkbox" checked={allSelected} onChange={() => {}} style={{ cursor: 'pointer' }} />
              {allSelected ? 'Alles deselecteren' : 'Alles selecteren'}
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Geen resultaten</div>
            )}
            {filtered.map(o => (
              <div
                key={o}
                onClick={() => toggle(o)}
                style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selected.includes(o) ? 'var(--accent-bg)' : undefined }}
              >
                <input type="checkbox" checked={selected.includes(o)} onChange={() => {}} style={{ cursor: 'pointer' }} />
                {o}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

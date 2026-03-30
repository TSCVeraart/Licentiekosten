import { useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}

export function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  const allSelected = options.length > 0 && options.every(o => selected.includes(o))
  const toggleAll = () => onChange(allSelected ? [] : [...options])

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
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: 200, maxHeight: 300, overflowY: 'auto',
        }}>
          <div
            onClick={toggleAll}
            style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            <input type="checkbox" checked={allSelected} onChange={() => {}} style={{ cursor: 'pointer' }} />
            {allSelected ? 'Alles deselecteren' : 'Alles selecteren'}
          </div>
          {options.map(o => (
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
      )}
    </div>
  )
}

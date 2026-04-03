import { useEffect, useRef, useState } from 'react'
import { usePersistedState } from '../lib/usePersistedState'
import { Search, Pencil, Check, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { MultiSelect } from '../lib/MultiSelect'
import { exportCsv } from '../lib/exportCsv'

interface OmzetRij {
  id: number
  datum: string | null
  rekening: string | null
  omschrijving: string | null
  artikel_omschrijving: string | null
  debiteur_nr: number | null
  debiteur_naam: string | null
  land_debiteur: string | null
  soort: string | null
  artikel: number | null
  code_groep: string | null
  ras_naam: string | null
  licentiehouder_naam: string | null
  intern_extern: string | null
  aantal: number | null
  kleur: string | null
}

export const KLEUREN = [
  { id: 'rood',        hex: '#ef4444', defaultLabel: 'Brondata aanpassen' },
  { id: 'oranje',      hex: '#f97316', defaultLabel: 'Geen tarief geconfigureerd' },
  { id: 'geel',        hex: '#eab308', defaultLabel: 'Geen ras gekoppeld' },
  { id: 'groen',       hex: '#22c55e', defaultLabel: 'Intern / geen kosten verwacht' },
  { id: 'codegroep',   hex: '#06b6d4', defaultLabel: 'Geen code groep' },
  { id: 'lh',          hex: '#8b5cf6', defaultLabel: 'Geen licentiehouder' },
  { id: 'landlicent',  hex: '#f43f5e', defaultLabel: 'Land geen licentie' },
  { id: 'paars',       hex: '#a855f7', defaultLabel: 'Overige reden' },
]

export const LS_LEGENDA  = 'ontbrekend-legenda'

const loadLegenda = (): Record<string, string> =>
  JSON.parse(localStorage.getItem(LS_LEGENDA) ?? '{}')

export const getKleurHex = (kleurId: string) =>
  KLEUREN.find(k => k.id === kleurId)?.hex ?? '#94a3b8'

const suggestKleur = (r: OmzetRij, landenMetTarief: Set<string>): string => {
  if (r.intern_extern !== 'Extern') return 'groen'
  if (r.land_debiteur === null || r.artikel === null) return 'rood'
  if (r.code_groep === null) return 'codegroep'
  if (r.ras_naam === null) return 'geel'
  if (r.licentiehouder_naam === null) return 'lh'
  if (!landenMetTarief.has(r.land_debiteur)) return 'landlicent'
  return 'oranje'
}

export default function OntbrekendeKosten() {
  const [rows, setRows]             = useState<OmzetRij[]>([])
  const [loading, setLoading]       = useState(true)
  const [landenMetTarief, setLandenMetTarief] = useState<Set<string>>(new Set())
  const [search,         setSearch]         = usePersistedState('f-ontb-search', '')
  const [filterKleur,    setFilterKleur]    = usePersistedState('f-ontb-kleur', 'alle')
  const [filterDebiteur, setFilterDebiteur] = usePersistedState<string[]>('f-ontb-debiteur', [])
  const [filterRas,      setFilterRas]      = usePersistedState<string[]>('f-ontb-ras', [])
  const [filterLh,       setFilterLh]       = usePersistedState<string[]>('f-ontb-lh', [])
  const [legenda, setLegenda]       = useState<Record<string, string>>(loadLegenda)
  const [editLabel, setEditLabel]   = useState<string | null>(null)
  const [editVal, setEditVal]       = useState('')
  const [popover, setPopover]       = useState<number | null>(null)
  const [selected, setSelected]               = useState<Set<number>>(new Set())
  const [sortCol, setSortCol] = usePersistedState<string | null>('f-ontb-sortcol', null)
  const [sortDir, setSortDir] = usePersistedState<'asc' | 'desc'>('f-ontb-sortdir', 'asc')
  const popoverRef                  = useRef<HTMLDivElement>(null)

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  useEffect(() => {
    const fetchAll = async () => {
      const pageSize = 1000
      let all: OmzetRij[] = []
      let from = 0
      while (true) {
        const { data } = await supabase
          .from('omzetrekeningen')
          .select('id,datum,rekening,omschrijving,artikel_omschrijving,debiteur_nr,debiteur_naam,land_debiteur,soort,artikel,code_groep,ras_naam,licentiehouder_naam,intern_extern,aantal,kleur')
          .is('totaal_licentiekosten', null)
          .order('datum', { ascending: false })
          .range(from, from + pageSize - 1)
        if (!data?.length) break
        all = [...all, ...data as OmzetRij[]]
        if (data.length < pageSize) break
        from += pageSize
      }
      setRows(all)

      const { data: lkData } = await supabase.from('licentiekosten').select('land').not('tarief', 'is', null)
      setLandenMetTarief(new Set((lkData ?? []).map((l: { land: string }) => l.land)))

      setLoading(false)
    }
    fetchAll()
  }, [])

  // Sluit popover bij klik buiten
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setPopover(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const kleuren: Record<number, string> = {}
  for (const r of rows) if (r.kleur) kleuren[r.id] = r.kleur

  const setKleur = async (id: number, kleurId: string | null) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, kleur: kleurId } : r))
    setPopover(null)
    const { error } = await supabase.from('omzetrekeningen').update({ kleur: kleurId }).eq('id', id)
    if (error) toast.error('Fout bij opslaan kleur')
  }

  const setBulkKleur = async (kleurId: string | null) => {
    const ids = [...selected]
    setRows(prev => prev.map(r => ids.includes(r.id) ? { ...r, kleur: kleurId } : r))
    setSelected(new Set())
    const { error } = await supabase.from('omzetrekeningen').update({ kleur: kleurId }).in('id', ids)
    if (error) toast.error('Fout bij opslaan kleuren')
  }

  const saveLabel = (kleurId: string) => {
    setLegenda(prev => {
      const next = { ...prev, [kleurId]: editVal }
      localStorage.setItem(LS_LEGENDA, JSON.stringify(next))
      return next
    })
    setEditLabel(null)
  }

  const getLabel = (kleurId: string) =>
    legenda[kleurId] ?? KLEUREN.find(k => k.id === kleurId)?.defaultLabel ?? kleurId

  // Debiteur opties: unieke "nr – naam" strings, gesorteerd op naam
  const debiteurOpties = [...new Map(
    rows
      .filter(r => r.debiteur_naam)
      .map(r => [`${r.debiteur_nr} – ${r.debiteur_naam}`, r])
  ).keys()].sort((a, b) => {
    const nA = a.split(' – ')[1] ?? ''
    const nB = b.split(' – ')[1] ?? ''
    return nA.localeCompare(nB, 'nl')
  })

  const rasOpties = [...new Set(rows.map(r => r.ras_naam).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'nl'))
  const lhOpties  = [...new Set(rows.map(r => r.licentiehouder_naam).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'nl'))

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q ||
      (r.debiteur_naam ?? '').toLowerCase().includes(q) ||
      (r.omschrijving ?? '').toLowerCase().includes(q) ||
      (r.artikel_omschrijving ?? '').toLowerCase().includes(q) ||
      (r.ras_naam ?? '').toLowerCase().includes(q) ||
      (r.licentiehouder_naam ?? '').toLowerCase().includes(q) ||
      String(r.debiteur_nr ?? '').includes(q) ||
      (r.land_debiteur ?? '').toLowerCase().includes(q) ||
      (r.artikel != null ? String(r.artikel).includes(q) : false)
    const matchKleur = filterKleur === 'alle'
      ? true
      : filterKleur === 'geen'
        ? !kleuren[r.id]
        : kleuren[r.id] === filterKleur
    const matchDeb = filterDebiteur.length === 0 ||
      filterDebiteur.includes(`${r.debiteur_nr} – ${r.debiteur_naam}`)
    const matchRas = filterRas.length === 0 || filterRas.includes(r.ras_naam ?? '')
    const matchLh  = filterLh.length === 0  || filterLh.includes(r.licentiehouder_naam ?? '')
    return matchQ && matchKleur && matchDeb && matchRas && matchLh
  })

  const sortedFiltered = sortCol ? [...filtered].sort((a, b) => {
    const numCols = ['debiteur_nr', 'artikel', 'aantal']
    if (numCols.includes(sortCol)) {
      const av = (a as any)[sortCol] ?? -Infinity
      const bv = (b as any)[sortCol] ?? -Infinity
      return sortDir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0)
    }
    const av: string | null = (a as any)[sortCol] ?? null
    const bv: string | null = (b as any)[sortCol] ?? null
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return sortDir === 'asc'
      ? av.localeCompare(bv, 'nl', { sensitivity: 'base', numeric: true })
      : bv.localeCompare(av, 'nl', { sensitivity: 'base', numeric: true })
  }) : filtered

  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))
  const someSelected = selected.size > 0

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(r => next.delete(r.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(r => next.add(r.id))
        return next
      })
    }
  }

  const toggleRow = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const aantalPerKleur = (kleurId: string) => rows.filter(r => kleuren[r.id] === kleurId).length
  const aantalZonderKleur = rows.filter(r => !kleuren[r.id]).length
  const hasFilters = filterKleur !== 'alle' || filterDebiteur.length > 0 || filterRas.length > 0 || filterLh.length > 0

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Ontbrekende licentiekosten</div>
          <div className="page-sub">{rows.length} regels zonder licentiekosten</div>
        </div>
        <button className="btn btn-secondary" onClick={async () => {
          const ongekleurd = rows.filter(r => !r.kleur)
          if (!ongekleurd.length) { toast('Alle regels hebben al een kleur'); return }
          const updates = ongekleurd.map(r => ({ id: r.id, kleur: suggestKleur(r, landenMetTarief) }))
          setRows(prev => prev.map(r => {
            const u = updates.find(u => u.id === r.id)
            return u ? { ...r, kleur: u.kleur } : r
          }))
          for (let i = 0; i < updates.length; i += 100) {
            const batch = updates.slice(i, i + 100)
            await Promise.all(batch.map(u => supabase.from('omzetrekeningen').update({ kleur: u.kleur }).eq('id', u.id)))
          }
          toast.success(`${updates.length} regels geclassificeerd`)
        }}>
          Voorstel toepassen
        </button>
        <button className="btn btn-ghost" onClick={() => exportCsv(
          `ontbrekende-kosten-${new Date().toISOString().slice(0,10)}.csv`,
          ['Datum','Rekening','Debiteur','Country','Intern / Extern','Debiteur: Naam','Artikelomschrijving','Soort','Ras','Licentiehouder','Artikel','Artikelcode groep','Aantal','Kleur'],
          sortedFiltered.map(r => [r.datum,r.rekening,r.debiteur_nr,r.land_debiteur,r.intern_extern,r.debiteur_naam,r.artikel_omschrijving,r.soort,r.ras_naam,r.licentiehouder_naam,r.artikel,r.code_groep,r.aantal,r.kleur])
        )}>
          <Download size={14} /> Exporteren
        </button>
      </div>

      {/* Legenda */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 10 }}>
          Kleurlegenda <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>— klik om te filteren · potlood om label te bewerken</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {KLEUREN.map(k => (
            <div
              key={k.id}
              onClick={() => setFilterKleur(prev => prev === k.id ? 'alle' : k.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px', borderRadius: 'var(--radius)',
                border: `2px solid ${filterKleur === k.id ? k.hex : 'transparent'}`,
                background: filterKleur === k.id ? k.hex + '18' : 'var(--bg)',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: k.hex, flexShrink: 0 }} />
              {editLabel === k.id ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveLabel(k.id); if (e.key === 'Escape') setEditLabel(null) }}
                    style={{ fontSize: 12, padding: '2px 6px', border: '1px solid var(--border-md)', borderRadius: 4, width: 180, background: 'var(--surface)', color: 'var(--text)' }}
                  />
                  <button className="btn btn-ghost" style={{ padding: '2px 4px' }} onClick={() => saveLabel(k.id)}><Check size={13} /></button>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{getLabel(k.id)}</span>
                  <span
                    style={{ color: 'var(--muted)', opacity: 0.6, cursor: 'text' }}
                    onClick={e => { e.stopPropagation(); setEditLabel(k.id); setEditVal(getLabel(k.id)) }}
                  >
                    <Pencil size={11} />
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>({aantalPerKleur(k.id)})</span>
                </span>
              )}
            </div>
          ))}
          <div
            onClick={() => setFilterKleur(prev => prev === 'geen' ? 'alle' : 'geen')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px', borderRadius: 'var(--radius)',
              border: `2px solid ${filterKleur === 'geen' ? 'var(--border-md)' : 'transparent'}`,
              background: 'var(--bg)', cursor: 'pointer', userSelect: 'none',
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px dashed var(--muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nog niet beoordeeld ({aantalZonderKleur})</span>
          </div>
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 280 }}>
          <Search className="search-icon" />
          <input placeholder="Zoek debiteur, ras, land…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <MultiSelect label="Debiteuren"     options={debiteurOpties} selected={filterDebiteur} onChange={setFilterDebiteur} />
        <MultiSelect label="Rassen"          options={rasOpties}      selected={filterRas}      onChange={setFilterRas} />
        <MultiSelect label="Licentiehouders" options={lhOpties}       selected={filterLh}       onChange={setFilterLh} />
        {hasFilters && (
          <button className="btn btn-ghost" onClick={() => { setFilterKleur('alle'); setFilterDebiteur([]); setFilterRas([]); setFilterLh([]) }}>Wis filters</button>
        )}
      </div>

      {/* Bulkactiebalk */}
      {someSelected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '10px 14px', marginBottom: 8,
          background: 'var(--accent-bg)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', fontSize: 13,
        }}>
          <span style={{ fontWeight: 500, marginRight: 4 }}>{selected.size} geselecteerd — kleur toekennen:</span>
          {KLEUREN.map(k => (
            <button
              key={k.id}
              onClick={() => setBulkKleur(k.id)}
              title={getLabel(k.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 20,
                background: k.hex + '22', border: `1.5px solid ${k.hex}`,
                cursor: 'pointer', fontSize: 12, color: 'var(--text)',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: k.hex, flexShrink: 0 }} />
              {getLabel(k.id)}
            </button>
          ))}
          <button
            onClick={() => setBulkKleur(null)}
            style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: '1px solid var(--border-md)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer' }}
          >
            Verwijder kleur
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Deselecteer
          </button>
        </div>
      )}

      <div className="card">
        <div className="table-wrap" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
          <table>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allFilteredSelected }}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                    title="Alles selecteren"
                  />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, width: 40 }}>Kleur</th>
                {([
                  ['datum',               'Datum'],
                  ['rekening',            'Rekening'],
                  ['debiteur_nr',         'Debiteur'],
                  ['land_debiteur',       'Country'],
                  ['intern_extern',       'Intern / Extern'],
                  ['debiteur_naam',       'Debiteur: Naam'],
                  ['artikel_omschrijving', 'Artikelomschrijving'],
                  ['soort',               'Soort'],
                  ['ras_naam',            'Ras'],
                  ['licentiehouder_naam', 'Licentiehouder'],
                  ['artikel',             'Artikel'],
                  ['code_groep',          'Artikelcode groep'],
                  ['aantal',              'Aantal'],
                ] as [string, string][]).map(([col, label]) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={col === 'aantal' ? 'num' : ''}
                    style={{ position: 'sticky', top: 0, zIndex: 1, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  >
                    {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={15} className="empty">Laden…</td></tr>}
              {!loading && sortedFiltered.length === 0 && <tr><td colSpan={15} className="empty">Geen regels gevonden</td></tr>}
              {sortedFiltered.map(r => {
                const kleurId = kleuren[r.id] ?? null
                const hex = kleurId ? getKleurHex(kleurId) : null
                const voorstel = suggestKleur(r, landenMetTarief)
                const voorstelHex = getKleurHex(voorstel)
                const isSelected = selected.has(r.id)
                return (
                  <tr
                    key={r.id}
                    onClick={() => toggleRow(r.id)}
                    style={{
                      borderLeft: `4px solid ${hex ?? 'transparent'}`,
                      background: isSelected
                        ? 'var(--accent-bg)'
                        : hex ? hex + '10' : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(r.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    {/* Kleurknop */}
                    <td style={{ position: 'relative', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setPopover(prev => prev === r.id ? null : r.id)}
                        style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: hex ?? voorstelHex + '40',
                          border: hex ? `2px solid ${hex}` : `2px dashed ${voorstelHex}`,
                          cursor: 'pointer',
                          display: 'inline-block', verticalAlign: 'middle',
                        }}
                        title={kleurId ? getLabel(kleurId) : `Voorstel: ${getLabel(voorstel)}`}
                      />
                      {popover === r.id && (
                        <div
                          ref={popoverRef}
                          style={{
                            position: 'absolute', top: '100%', left: 0, zIndex: 50,
                            background: 'var(--surface)', border: '1px solid var(--border-md)',
                            borderRadius: 'var(--radius)', padding: 10, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
                            display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220,
                          }}
                        >
                          {!kleurId && (
                            <>
                              <div style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 8px 4px', fontWeight: 500 }}>Voorstel</div>
                              <button
                                onClick={() => setKleur(r.id, voorstel)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  background: voorstelHex + '20',
                                  border: `1px solid ${voorstelHex}`,
                                  borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                                  textAlign: 'left', width: '100%',
                                }}
                              >
                                <span style={{ width: 14, height: 14, borderRadius: '50%', background: voorstelHex, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: 'var(--text)' }}>{getLabel(voorstel)}</span>
                              </button>
                              <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                            </>
                          )}
                          {KLEUREN.map(k => (
                            <button
                              key={k.id}
                              onClick={() => setKleur(r.id, kleurId === k.id ? null : k.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: kleurId === k.id ? k.hex + '20' : 'transparent',
                                border: `1px solid ${kleurId === k.id ? k.hex : 'transparent'}`,
                                borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                                textAlign: 'left', width: '100%',
                              }}
                            >
                              <span style={{ width: 14, height: 14, borderRadius: '50%', background: k.hex, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: 'var(--text)' }}>{getLabel(k.id)}</span>
                              {kleurId === k.id && <Check size={12} style={{ marginLeft: 'auto', color: k.hex }} />}
                            </button>
                          ))}
                          {kleurId && (
                            <button
                              onClick={() => setKleur(r.id, null)}
                              style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 8px' }}
                            >
                              Kleur verwijderen
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r.datum ?? '–'}</td>
                    <td className="mono text-muted" style={{ fontSize: 12 }}>{r.rekening ?? '–'}</td>
                    <td className="mono text-muted" style={{ fontSize: 12 }}>{r.debiteur_nr ?? '–'}</td>
                    <td>{r.land_debiteur ?? <span className="text-muted">–</span>}</td>
                    <td>{r.intern_extern ?? <span className="text-muted">–</span>}</td>
                    <td>{r.debiteur_naam ?? '–'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>{r.artikel_omschrijving ?? '–'}</td>
                    <td>{r.soort ? <span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span> : <span className="text-muted">–</span>}</td>
                    <td>{r.ras_naam ?? <span className="text-muted">–</span>}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.licentiehouder_naam ?? '–'}</td>
                    <td className="mono text-muted" style={{ fontSize: 12 }}>{r.artikel ?? '–'}</td>
                    <td className="mono text-muted" style={{ fontSize: 12 }}>{r.code_groep ?? '–'}</td>
                    <td className="num">{r.aantal?.toLocaleString('nl-NL') ?? '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

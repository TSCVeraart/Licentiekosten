import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Upload, FileText, X, CheckCircle2, XCircle, ChevronDown, ChevronRight, AlertTriangle, AlertCircle, ChevronsUpDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Contract, type Licentiehouder } from '../lib/supabase'

interface RasInfo { id: number; naam: string; soort: string; licentiehouder_id: number; actief: boolean }
interface LhMet extends Licentiehouder { actieveRassen: number }

const EMPTY_FORM = {
  licentiehouder_id: 0,
  ras_id: 0,
  soort: '',
  datum_van: '',
  datum_tot: '',
  actief: true,
  notities: '',
}

const fmtDate = (d: string | null) => {
  if (!d) return '–'
  const [y, m, dag] = d.split('-')
  return `${dag}-${m}-${y}`
}

const today = () => new Date().toISOString().slice(0, 10)

const dagenTot = (datum_tot: string | null): number | null => {
  if (!datum_tot) return null
  const ms = new Date(datum_tot).getTime() - new Date(today()).getTime()
  return Math.ceil(ms / 86400000)
}

const SOORT_KLEUR: Record<string, string> = { Aardbei: '#f43f5e', Framboos: '#a855f7', Braam: '#334155' }

export default function Contracten() {
  const [contracten, setContracten] = useState<Contract[]>([])
  const [licentiehouders, setLicentiehouders] = useState<LhMet[]>([])
  const [rassen, setRassen] = useState<RasInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const initialLoadDone = useRef(false)

  const load = async (resetExpanded = false) => {
    const [{ data: c }, { data: lh }, { data: r }] = await Promise.all([
      supabase.from('contracten').select('*').order('datum_van', { ascending: false }).limit(2000),
      supabase.from('licentiehouders').select('id,naam').order('naam').limit(500),
      supabase.from('rassen').select('id,naam,soort,licentiehouder_id,actief').order('naam').limit(5000),
    ])
    const rassenLijst = (r ?? []) as RasInfo[]
    const actievePerLh = new Map<number, number>()
    for (const ras of rassenLijst)
      if (ras.actief) actievePerLh.set(ras.licentiehouder_id, (actievePerLh.get(ras.licentiehouder_id) ?? 0) + 1)

    setContracten((c ?? []) as Contract[])
    setRassen(rassenLijst)
    setLicentiehouders((lh ?? []).map((l: any) => ({ ...l, actieveRassen: actievePerLh.get(l.id) ?? 0 })))
    if (resetExpanded) setExpanded(new Set())
    setLoading(false)
    initialLoadDone.current = true
  }

  useEffect(() => { load(true) }, [])

  const contractenPerLh = useMemo(() => {
    const map = new Map<number, Contract[]>()
    for (const c of contracten) {
      const lijst = map.get(c.licentiehouder_id) ?? []
      lijst.push(c)
      map.set(c.licentiehouder_id, lijst)
    }
    return map
  }, [contracten])

  const rassenPerLh = useMemo(() => {
    const map = new Map<number, RasInfo[]>()
    for (const r of rassen) {
      const lijst = map.get(r.licentiehouder_id) ?? []
      lijst.push(r)
      map.set(r.licentiehouder_id, lijst)
    }
    return map
  }, [rassen])

  const geenContractWaarschuwingen = useMemo(() =>
    licentiehouders.filter(lh => lh.actieveRassen > 0 && !(contractenPerLh.get(lh.id)?.length))
  , [licentiehouders, contractenPerLh])

  const verlopenBinnenkort = useMemo(() => {
    const t = today()
    return contracten
      .filter(c => c.actief && c.datum_tot && c.datum_tot >= t)
      .map(c => ({ ...c, dagen: dagenTot(c.datum_tot)! }))
      .filter(c => c.dagen <= 90)
      .sort((a, b) => a.dagen - b.dagen)
  }, [contracten])

  const allExpanded = licentiehouders.length > 0 && expanded.size === licentiehouders.length
  const toggleAll = () => {
    if (allExpanded) setExpanded(new Set())
    else setExpanded(new Set(licentiehouders.map(l => l.id)))
  }
  const toggleExpanded = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const openAdd = (lhId: number, rasId: number) => {
    setForm({ ...EMPTY_FORM, licentiehouder_id: lhId, ras_id: rasId })
    setEditId(null)
    setModal('add')
  }

  const openEdit = (c: Contract) => {
    setForm({
      licentiehouder_id: c.licentiehouder_id,
      ras_id:    c.ras_id    ?? 0,
      soort:     c.soort     ?? '',
      datum_van: c.datum_van ?? '',
      datum_tot: c.datum_tot ?? '',
      actief:    c.actief,
      notities:  c.notities  ?? '',
    })
    setEditId(c.id)
    setModal('edit')
  }

  const save = async () => {
    if (!form.licentiehouder_id) { toast.error('Kies een licentiehouder'); return }
    setSaving(true)
    const payload = {
      licentiehouder_id: form.licentiehouder_id,
      ras_id:     form.ras_id    || null,
      soort:      form.soort     || null,
      datum_van:  form.datum_van || null,
      datum_tot:  form.datum_tot || null,
      actief:     form.actief,
      notities:   form.notities  || null,
      updated_at: new Date().toISOString(),
    }
    const op = modal === 'add'
      ? supabase.from('contracten').insert(payload)
      : supabase.from('contracten').update(payload).eq('id', editId!)
    const { error } = await op
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Opgeslagen'); setSaving(false); setModal(null)
    load(false) // expanded state bewaren
  }

  const remove = async (c: Contract) => {
    const lhNaam = licentiehouders.find(l => l.id === c.licentiehouder_id)?.naam ?? ''
    if (!confirm(`Contract "${c.soort ?? 'zonder type'}" van "${lhNaam}" verwijderen?`)) return
    if (c.bestand_pad) await supabase.storage.from('contracten').remove([c.bestand_pad])
    const { error } = await supabase.from('contracten').delete().eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success('Verwijderd'); load(false)
  }

  const uploadPdf = async (contractId: number, file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Alleen PDF-bestanden toegestaan'); return }
    setUploading(contractId)
    const existing = contracten.find(c => c.id === contractId)
    if (existing?.bestand_pad) await supabase.storage.from('contracten').remove([existing.bestand_pad])
    const pad = `${contractId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: ue } = await supabase.storage.from('contracten').upload(pad, file, { contentType: 'application/pdf', upsert: false })
    if (ue) { toast.error(ue.message); setUploading(null); return }
    const { error } = await supabase.from('contracten')
      .update({ bestand_naam: file.name, bestand_pad: pad, updated_at: new Date().toISOString() })
      .eq('id', contractId)
    if (error) { toast.error(error.message); setUploading(null); return }
    toast.success('PDF geüpload'); setUploading(null); load(false)
  }

  const downloadPdf = async (c: Contract) => {
    if (!c.bestand_pad) return
    const { data, error } = await supabase.storage.from('contracten').createSignedUrl(c.bestand_pad, 60)
    if (error || !data?.signedUrl) { toast.error('Kan bestand niet ophalen'); return }
    window.open(data.signedUrl, '_blank')
  }

  const removePdf = async (c: Contract) => {
    if (!c.bestand_pad || !confirm('PDF verwijderen?')) return
    const { error: se } = await supabase.storage.from('contracten').remove([c.bestand_pad])
    if (se) { toast.error(se.message); return }
    const { error } = await supabase.from('contracten')
      .update({ bestand_naam: null, bestand_pad: null, updated_at: new Date().toISOString() })
      .eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success('PDF verwijderd'); load(false)
  }

  const contractStatus = (c: Contract): 'verlopen' | 'kritiek' | 'aandacht' | 'ok' => {
    const d = dagenTot(c.datum_tot)
    if (d === null) return 'ok'
    if (d < 0)   return 'verlopen'
    if (d <= 30) return 'kritiek'
    if (d <= 90) return 'aandacht'
    return 'ok'
  }
  const statusKleur = (s: ReturnType<typeof contractStatus>) => {
    if (s === 'verlopen') return 'var(--danger)'
    if (s === 'kritiek')  return '#f97316'
    if (s === 'aandacht') return '#eab308'
    return undefined
  }

  // Tabel met contracten voor één ras (of ras=null)
  const ContractenTabel = ({ list }: { list: Contract[] }) => {
    if (list.length === 0) return null
    return (
      <table style={{ width: '100%', fontSize: 13, marginBottom: 2 }}>
        <thead>
          <tr>
            <th style={{ paddingLeft: 48 }}>Soort contract</th>
            <th>Van</th>
            <th>Tot</th>
            <th>Status</th>
            <th>PDF</th>
            <th>Notities</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(c => {
            const status = contractStatus(c)
            const datumKleur = statusKleur(status)
            const dagen = dagenTot(c.datum_tot)
            return (
              <tr key={c.id}>
                <td style={{ paddingLeft: 48, fontWeight: 500 }}>
                  {c.soort ?? <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>–</span>}
                </td>
                <td>{fmtDate(c.datum_van)}</td>
                <td>
                  <span style={{ color: datumKleur }}>{fmtDate(c.datum_tot)}</span>
                  {status === 'verlopen' && <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--danger)', fontWeight: 600 }}>verlopen</span>}
                  {(status === 'kritiek' || status === 'aandacht') && dagen !== null && (
                    <span style={{ fontSize: 11, marginLeft: 6, color: datumKleur, fontWeight: 600 }}>nog {dagen}d</span>
                  )}
                </td>
                <td>
                  {c.actief
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 12 }}><CheckCircle2 size={13} /> Actief</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 12 }}><XCircle size={13} /> Inactief</span>}
                </td>
                <td>
                  {c.bestand_pad ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => downloadPdf(c)} title={c.bestand_naam ?? 'PDF'}>
                        <FileText size={12} />
                        {c.bestand_naam && c.bestand_naam.length > 18 ? c.bestand_naam.slice(0, 16) + '…' : (c.bestand_naam ?? 'PDF')}
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '2px 5px', color: 'var(--muted)' }}
                        onClick={() => removePdf(c)}><X size={11} /></button>
                    </div>
                  ) : (
                    <>
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }}
                        disabled={uploading === c.id} onClick={() => fileRefs.current[c.id]?.click()}>
                        <Upload size={12} />{uploading === c.id ? 'Uploaden…' : 'Upload PDF'}
                      </button>
                      <input ref={el => { fileRefs.current[c.id] = el }}
                        type="file" accept="application/pdf" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(c.id, f); e.target.value = '' }} />
                    </>
                  )}
                </td>
                <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.notities ?? ''}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost" onClick={() => openEdit(c)}><Pencil size={13} /></button>
                  <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => remove(c)}><Trash2 size={13} /></button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Contracten</div>
          <div className="page-sub">{loading ? 'Laden…' : `${contracten.length} contracten · ${licentiehouders.length} licentiehouders`}</div>
        </div>
        {!loading && licentiehouders.length > 0 && (
          <button className="btn btn-ghost" onClick={toggleAll}>
            <ChevronsUpDown size={14} />
            {allExpanded ? 'Alles inklappen' : 'Alles uitklappen'}
          </button>
        )}
      </div>

      {/* Waarschuwingen */}
      {!loading && (geenContractWaarschuwingen.length > 0 || verlopenBinnenkort.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {geenContractWaarschuwingen.length > 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertCircle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 4 }}>Licentiehouders met actieve rassen maar geen contract</div>
                <div style={{ fontSize: 12, color: '#92400e', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  {geenContractWaarschuwingen.map(lh => (
                    <span key={lh.id}>{lh.naam} <span style={{ opacity: 0.7 }}>({lh.actieveRassen} {lh.actieveRassen === 1 ? 'ras' : 'rassen'})</span></span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {verlopenBinnenkort.length > 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#9a3412', marginBottom: 6 }}>Contracten die binnenkort aflopen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {verlopenBinnenkort.map(c => {
                    const lhNaam = licentiehouders.find(l => l.id === c.licentiehouder_id)?.naam ?? '–'
                    const rasNaam = rassen.find(r => r.id === c.ras_id)?.naam
                    const kleur = c.dagen <= 30 ? '#dc2626' : '#d97706'
                    return (
                      <div key={c.id} style={{ fontSize: 12, color: '#9a3412', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{lhNaam}</span>
                        {rasNaam && <span style={{ opacity: 0.7 }}>· {rasNaam}</span>}
                        {c.soort && <span style={{ opacity: 0.7 }}>· {c.soort}</span>}
                        <span>· verloopt {fmtDate(c.datum_tot)}</span>
                        <span style={{ fontWeight: 700, color: kleur }}>
                          ({c.dagen === 0 ? 'vandaag' : `nog ${c.dagen} dag${c.dagen !== 1 ? 'en' : ''}`})
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Licentiehouders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Laden…</div>}

        {!loading && licentiehouders.map(lh => {
          const lhContracten = contractenPerLh.get(lh.id) ?? []
          const lhRassen = rassenPerLh.get(lh.id) ?? []
          const isOpen = expanded.has(lh.id)
          const heeftWaarschuwing = geenContractWaarschuwingen.some(w => w.id === lh.id)
          const heeftAflopend = lhContracten.some(c => { const s = contractStatus(c); return s === 'kritiek' || s === 'aandacht' })

          return (
            <div key={lh.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* LH header */}
              <div onClick={() => toggleExpanded(lh.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                cursor: 'pointer', userSelect: 'none',
                background: isOpen ? 'var(--accent-bg)' : undefined,
                borderBottom: isOpen ? '1px solid var(--border)' : undefined,
              }}>
                {isOpen
                  ? <ChevronDown size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  : <ChevronRight size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{lh.naam}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {lhContracten.length} {lhContracten.length === 1 ? 'contract' : 'contracten'}
                </span>
                {lh.actieveRassen > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 999, padding: '2px 8px' }}>
                    {lh.actieveRassen} {lh.actieveRassen === 1 ? 'actief ras' : 'actieve rassen'}
                  </span>
                )}
                {heeftWaarschuwing && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#d97706', background: '#fef3c7', borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>
                    <AlertCircle size={11} /> geen contract
                  </span>
                )}
                {heeftAflopend && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#ea580c', background: '#fff7ed', borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>
                    <AlertTriangle size={11} /> loopt af
                  </span>
                )}
              </div>

              {/* Uitgeklapt: rassen met hun contracten */}
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {lhRassen.length === 0 ? (
                    /* Geen rassen — toon algemene contracten + knop */
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 10, borderBottom: lhContracten.length > 0 ? '1px solid var(--border)' : undefined }}>
                        <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1, fontStyle: 'italic' }}>Geen rassen gekoppeld</span>
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }}
                          onClick={() => openAdd(lh.id, 0)}>
                          <Plus size={13} /> Contract
                        </button>
                      </div>
                      <ContractenTabel list={lhContracten} />
                    </div>
                  ) : (
                    lhRassen.map((ras, rasIdx) => {
                      const rasContracten = lhContracten.filter(c => c.ras_id === ras.id)
                      const kleur = SOORT_KLEUR[ras.soort] ?? '#94a3b8'
                      const isLast = rasIdx === lhRassen.length - 1
                      return (
                        <div key={ras.id} style={{ borderBottom: isLast ? undefined : '1px solid var(--border)' }}>
                          {/* Ras rij */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', background: 'var(--surface-2)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ras.actief ? kleur : 'var(--muted)', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: ras.actief ? 'var(--text)' : 'var(--muted)', textDecoration: ras.actief ? undefined : 'line-through' }}>
                              {ras.naam}
                            </span>
                            <span style={{ fontSize: 11, color: kleur, background: kleur + '18', borderRadius: 999, padding: '1px 7px' }}>{ras.soort}</span>
                            {!ras.actief && <span style={{ fontSize: 11, color: 'var(--muted)' }}>inactief</span>}
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {rasContracten.length} {rasContracten.length === 1 ? 'contract' : 'contracten'}
                            </span>
                            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 10px' }}
                              onClick={() => openAdd(lh.id, ras.id)}>
                              <Plus size={13} /> Contract
                            </button>
                          </div>
                          {/* Contracten van dit ras */}
                          <ContractenTabel list={rasContracten} />
                          {rasContracten.length === 0 && (
                            <div style={{ padding: '8px 48px', fontSize: 12, color: 'var(--muted)' }}>
                              Nog geen contracten voor dit ras.
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (() => {
        const lhNaam = licentiehouders.find(l => l.id === form.licentiehouder_id)?.naam ?? ''
        const rasNaam = rassen.find(r => r.id === form.ras_id)?.naam
        return (
          <div className="modal-backdrop" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 460 }}>
              <div className="modal-header">
                <span>
                  {modal === 'add'
                    ? `Contract toevoegen${rasNaam ? ` — ${rasNaam}` : ''} (${lhNaam})`
                    : 'Contract bewerken'}
                </span>
                <button className="btn btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {modal === 'edit' && (
                  <div>
                    <label className="field-label">Licentiehouder</label>
                    <select className="field-input" value={form.licentiehouder_id}
                      onChange={e => setForm(f => ({ ...f, licentiehouder_id: Number(e.target.value), ras_id: 0 }))}>
                      {licentiehouders.map(lh => <option key={lh.id} value={lh.id}>{lh.naam}</option>)}
                    </select>
                  </div>
                )}
                {modal === 'edit' && (
                  <div>
                    <label className="field-label">Ras <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optioneel)</span></label>
                    <select className="field-input" value={form.ras_id}
                      onChange={e => setForm(f => ({ ...f, ras_id: Number(e.target.value) }))}>
                      <option value={0}>— Geen specifiek ras —</option>
                      {rassen.filter(r => r.licentiehouder_id === form.licentiehouder_id).map(r => (
                        <option key={r.id} value={r.id}>{r.naam}{!r.actief ? ' (inactief)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="field-label">Soort contract</label>
                  <input type="text" className="field-input" value={form.soort}
                    onChange={e => setForm(f => ({ ...f, soort: e.target.value }))}
                    placeholder="bijv. Licentieovereenkomst, Teeltlicentie, NDA…" autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label">Datum van</label>
                    <input type="date" className="field-input" value={form.datum_van}
                      onChange={e => setForm(f => ({ ...f, datum_van: e.target.value }))} />
                  </div>
                  <div>
                    <label className="field-label">Datum tot</label>
                    <input type="date" className="field-input" value={form.datum_tot}
                      onChange={e => setForm(f => ({ ...f, datum_tot: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.actief}
                      onChange={e => setForm(f => ({ ...f, actief: e.target.checked }))} />
                    Contract is actief
                  </label>
                </div>
                <div>
                  <label className="field-label">Notities</label>
                  <textarea className="field-input" value={form.notities}
                    onChange={e => setForm(f => ({ ...f, notities: e.target.value }))}
                    rows={3} placeholder="Optionele opmerkingen…" style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Annuleren</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Opslaan…' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}

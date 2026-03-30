import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Licentiehouder, type Ras, type SoortPlant } from '../lib/supabase'

const EMPTY_RAS = { naam: '', soort: 'Aardbei' as SoortPlant, tarief: 0, actief: true }

export default function Licentiehouders() {
  const [rows, setRows] = useState<(Licentiehouder & { rassen?: Ras[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [modal, setModal] = useState<'lh-add' | 'lh-edit' | 'ras-add' | null>(null)
  const [form, setForm] = useState({ naam: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [rasForm, setRasForm] = useState({ ...EMPTY_RAS, licentiehouder_id: 0 })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('licentiehouders')
      .select('*, rassen(*)')
      .order('naam')
    setRows((data as any[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const saveLh = async () => {
    if (!form.naam.trim()) { toast.error('Naam is verplicht'); return }
    setSaving(true)
    const op = modal === 'lh-add'
      ? supabase.from('licentiehouders').insert({ naam: form.naam })
      : supabase.from('licentiehouders').update({ naam: form.naam }).eq('id', editId!)
    const { error } = await op
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Opgeslagen'); setSaving(false); setModal(null); load()
  }

  const deleteLh = async (id: number, naam: string) => {
    if (!confirm(`"${naam}" verwijderen?`)) return
    const { error } = await supabase.from('licentiehouders').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Verwijderd'); load()
  }

  const saveRas = async () => {
    if (!rasForm.naam.trim()) { toast.error('Rasnaam is verplicht'); return }
    setSaving(true)
    const { error } = await supabase.from('rassen').insert({
      licentiehouder_id: rasForm.licentiehouder_id,
      naam: rasForm.naam,
      soort: rasForm.soort,
      tarief: rasForm.tarief,
      actief: rasForm.actief,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Ras toegevoegd'); setSaving(false); setModal(null); load()
  }

  const deleteRas = async (id: number, naam: string) => {
    if (!confirm(`Ras "${naam}" verwijderen?`)) return
    const { error } = await supabase.from('rassen').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Verwijderd'); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Licentiehouders</div>
          <div className="page-sub">{rows.length} licentiehouders</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ naam: '' }); setEditId(null); setModal('lh-add') }}>
          <Plus /> Nieuwe licentiehouder
        </button>
      </div>

      <div className="card">
        {loading && <div className="empty">Laden…</div>}
        {!loading && rows.map(lh => {
          const isOpen = expanded === lh.id
          const rassen = (lh.rassen ?? []) as Ras[]
          return (
            <div key={lh.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 10 }}
                onClick={() => setExpanded(isOpen ? null : lh.id)}
              >
                {isOpen ? <ChevronDown size={15} color="var(--muted)" /> : <ChevronRight size={15} color="var(--muted)" />}
                <span style={{ fontWeight: 500, flex: 1 }}>{lh.naam}</span>
                <span className="text-muted" style={{ fontSize: 12 }}>{rassen.length} {rassen.length === 1 ? 'ras' : 'rassen'}</span>
                <div className="actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost" onClick={() => { setForm({ naam: lh.naam }); setEditId(lh.id); setModal('lh-edit') }}><Pencil /></button>
                  <button className="btn btn-ghost" onClick={() => deleteLh(lh.id, lh.naam)}><Trash2 /></button>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: '0 16px 14px 40px', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rassen</span>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => { setRasForm({ ...EMPTY_RAS, licentiehouder_id: lh.id }); setModal('ras-add') }}
                    >
                      <Plus size={12} /> Ras toevoegen
                    </button>
                  </div>
                  {rassen.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>Nog geen rassen gekoppeld</div>}
                  {rassen.length > 0 && (
                    <table style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ras</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Soort</th>
                          <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tarief</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rassen.map(r => (
                          <tr key={r.id}>
                            <td style={{ padding: '6px 8px', fontWeight: 500 }}>{r.naam}</td>
                            <td style={{ padding: '6px 8px' }}><span className={`badge badge-${r.soort.toLowerCase()}`}>{r.soort}</span></td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                              {r.tarief > 0 ? `€ ${r.tarief.toFixed(4)}` : <span className="text-muted">–</span>}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                              <button className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={() => deleteRas(r.id, r.naam)}><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* LH modal */}
      {(modal === 'lh-add' || modal === 'lh-edit') && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal === 'lh-add' ? 'Nieuwe licentiehouder' : 'Bewerken'}</span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Naam / codering *</label>
                <input value={form.naam} onChange={e => setForm({ naam: e.target.value })} placeholder="bijv. Flevo Berry" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn btn-primary" onClick={saveLh} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ras modal */}
      {modal === 'ras-add' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Ras toevoegen</span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Rasnaam *</label>
                <input value={rasForm.naam} onChange={e => setRasForm(f => ({ ...f, naam: e.target.value }))} placeholder="bijv. Favori" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn btn-primary" onClick={saveRas} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Upload, FileText, Download, X, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Contract, type Licentiehouder } from '../lib/supabase'

const EMPTY_FORM = {
  licentiehouder_id: 0,
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

export default function Contracten() {
  const [contracten, setContracten] = useState<Contract[]>([])
  const [licentiehouders, setLicentiehouders] = useState<Licentiehouder[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const load = async () => {
    const [{ data: c }, { data: lh }] = await Promise.all([
      supabase
        .from('contracten')
        .select('*, licentiehouders(naam)')
        .order('actief', { ascending: false })
        .order('datum_van', { ascending: false })
        .limit(1000),
      supabase.from('licentiehouders').select('id,naam').order('naam').limit(500),
    ])
    setContracten((c ?? []) as Contract[])
    setLicentiehouders((lh ?? []) as Licentiehouder[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, licentiehouder_id: licentiehouders[0]?.id ?? 0 })
    setEditId(null)
    setModal('add')
  }

  const openEdit = (c: Contract) => {
    setForm({
      licentiehouder_id: c.licentiehouder_id,
      datum_van: c.datum_van ?? '',
      datum_tot: c.datum_tot ?? '',
      actief: c.actief,
      notities: c.notities ?? '',
    })
    setEditId(c.id)
    setModal('edit')
  }

  const save = async () => {
    if (!form.licentiehouder_id) { toast.error('Kies een licentiehouder'); return }
    setSaving(true)
    const payload = {
      licentiehouder_id: form.licentiehouder_id,
      datum_van:  form.datum_van  || null,
      datum_tot:  form.datum_tot  || null,
      actief:     form.actief,
      notities:   form.notities   || null,
      updated_at: new Date().toISOString(),
    }
    const op = modal === 'add'
      ? supabase.from('contracten').insert(payload)
      : supabase.from('contracten').update(payload).eq('id', editId!)
    const { error } = await op
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Opgeslagen')
    setSaving(false)
    setModal(null)
    load()
  }

  const remove = async (c: Contract) => {
    if (!confirm(`Contract van "${c.licentiehouders?.naam}" verwijderen?`)) return
    if (c.bestand_pad) {
      await supabase.storage.from('contracten').remove([c.bestand_pad])
    }
    const { error } = await supabase.from('contracten').delete().eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success('Verwijderd')
    load()
  }

  const uploadPdf = async (contractId: number, file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Alleen PDF-bestanden toegestaan'); return }
    setUploading(contractId)

    // Verwijder oud bestand indien aanwezig
    const existing = contracten.find(c => c.id === contractId)
    if (existing?.bestand_pad) {
      await supabase.storage.from('contracten').remove([existing.bestand_pad])
    }

    const pad = `${contractId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadError } = await supabase.storage
      .from('contracten')
      .upload(pad, file, { contentType: 'application/pdf', upsert: false })

    if (uploadError) { toast.error(uploadError.message); setUploading(null); return }

    const { error: updateError } = await supabase
      .from('contracten')
      .update({ bestand_naam: file.name, bestand_pad: pad, updated_at: new Date().toISOString() })
      .eq('id', contractId)

    if (updateError) { toast.error(updateError.message); setUploading(null); return }

    toast.success('PDF geüpload')
    setUploading(null)
    load()
  }

  const downloadPdf = async (c: Contract) => {
    if (!c.bestand_pad) return
    const { data, error } = await supabase.storage
      .from('contracten')
      .createSignedUrl(c.bestand_pad, 60)
    if (error || !data?.signedUrl) { toast.error('Kan bestand niet ophalen'); return }
    window.open(data.signedUrl, '_blank')
  }

  const removePdf = async (c: Contract) => {
    if (!c.bestand_pad) return
    if (!confirm('PDF verwijderen?')) return
    const { error: storageError } = await supabase.storage.from('contracten').remove([c.bestand_pad])
    if (storageError) { toast.error(storageError.message); return }
    const { error } = await supabase
      .from('contracten')
      .update({ bestand_naam: null, bestand_pad: null, updated_at: new Date().toISOString() })
      .eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success('PDF verwijderd')
    load()
  }

  const isVerlopen = (c: Contract) => {
    if (!c.datum_tot) return false
    return c.datum_tot < new Date().toISOString().slice(0, 10)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Contracten</div>
          <div className="page-sub">{loading ? 'Laden…' : `${contracten.length} contracten`}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} /> Nieuw contract
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Licentiehouder</th>
                <th>Van</th>
                <th>Tot</th>
                <th>Status</th>
                <th>PDF</th>
                <th>Notities</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="empty">Laden…</td></tr>}
              {!loading && contracten.length === 0 && (
                <tr><td colSpan={7} className="empty">Nog geen contracten. Klik op "Nieuw contract" om te beginnen.</td></tr>
              )}
              {contracten.map(c => {
                const verlopen = isVerlopen(c)
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>
                      {c.licentiehouders?.naam ?? `#${c.licentiehouder_id}`}
                    </td>
                    <td>{fmtDate(c.datum_van)}</td>
                    <td style={{ color: verlopen ? 'var(--danger)' : undefined }}>
                      {fmtDate(c.datum_tot)}
                      {verlopen && <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--danger)' }}>verlopen</span>}
                    </td>
                    <td>
                      {c.actief
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 13 }}><CheckCircle2 size={14} /> Actief</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 13 }}><XCircle size={14} /> Inactief</span>
                      }
                    </td>
                    <td>
                      {c.bestand_pad ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
                            onClick={() => downloadPdf(c)} title={c.bestand_naam ?? 'Download PDF'}>
                            <FileText size={13} /> {c.bestand_naam && c.bestand_naam.length > 22
                              ? c.bestand_naam.slice(0, 20) + '…'
                              : (c.bestand_naam ?? 'PDF')}
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '3px 6px', color: 'var(--muted)' }}
                            onClick={() => removePdf(c)} title="PDF verwijderen">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
                            disabled={uploading === c.id}
                            onClick={() => fileRefs.current[c.id]?.click()}>
                            <Upload size={13} />
                            {uploading === c.id ? 'Uploaden…' : 'Upload PDF'}
                          </button>
                          <input
                            ref={el => { fileRefs.current[c.id] = el }}
                            type="file" accept="application/pdf" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(c.id, f); e.target.value = '' }}
                          />
                        </>
                      )}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.notities ?? ''}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost" onClick={() => openEdit(c)} title="Bewerken"><Pencil size={14} /></button>
                      <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => remove(c)} title="Verwijderen"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
            <div className="modal-header">
              <span>{modal === 'add' ? 'Nieuw contract' : 'Contract bewerken'}</span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Licentiehouder</label>
                <select
                  className="field-input"
                  value={form.licentiehouder_id}
                  onChange={e => setForm(f => ({ ...f, licentiehouder_id: Number(e.target.value) }))}
                >
                  <option value={0} disabled>Kies licentiehouder…</option>
                  {licentiehouders.map(lh => (
                    <option key={lh.id} value={lh.id}>{lh.naam}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Datum van</label>
                  <input
                    type="date" className="field-input"
                    value={form.datum_van}
                    onChange={e => setForm(f => ({ ...f, datum_van: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label">Datum tot</label>
                  <input
                    type="date" className="field-input"
                    value={form.datum_tot}
                    onChange={e => setForm(f => ({ ...f, datum_tot: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.actief}
                    onChange={e => setForm(f => ({ ...f, actief: e.target.checked }))}
                  />
                  Contract is actief
                </label>
              </div>
              <div>
                <label className="field-label">Notities</label>
                <textarea
                  className="field-input"
                  value={form.notities}
                  onChange={e => setForm(f => ({ ...f, notities: e.target.value }))}
                  rows={3}
                  placeholder="Optionele opmerkingen…"
                  style={{ resize: 'vertical' }}
                />
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
      )}
    </>
  )
}

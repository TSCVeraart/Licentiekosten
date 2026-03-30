import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, type Licentiehouder, type LicentiehouderBedrijf } from '../lib/supabase'

export default function Licentiehouders() {
  const [rows, setRows] = useState<Licentiehouder[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number|null>(null)
  const [modal, setModal] = useState<'lh-add'|'lh-edit'|'bedrijf-add'|null>(null)
  const [form, setForm] = useState({ naam:'' })
  const [editId, setEditId] = useState<number|null>(null)
  const [bedrijfForm, setBedrijfForm] = useState({ bedrijfsnaam:'', lh_id:0 })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('licentiehouders').select('*, bedrijven:licentiehouder_bedrijven(*)').order('naam')
    setRows((data as Licentiehouder[]) ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const saveLh = async () => {
    if (!form.naam.trim()) { toast.error('Naam is verplicht'); return }
    setSaving(true)
    const op = modal === 'lh-add' ? supabase.from('licentiehouders').insert({ naam:form.naam }) : supabase.from('licentiehouders').update({ naam:form.naam }).eq('id', editId!)
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

  const saveBedrijf = async () => {
    if (!bedrijfForm.bedrijfsnaam.trim()) { toast.error('Naam is verplicht'); return }
    setSaving(true)
    const { error } = await supabase.from('licentiehouder_bedrijven').insert({ licentiehouder_id:bedrijfForm.lh_id, bedrijfsnaam:bedrijfForm.bedrijfsnaam })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Bedrijf toegevoegd'); setSaving(false); setModal(null); load()
  }

  const deleteBedrijf = async (id: number) => {
    const { error } = await supabase.from('licentiehouder_bedrijven').delete().eq('id', id)
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
        <button className="btn btn-primary" onClick={() => { setForm({ naam:'' }); setEditId(null); setModal('lh-add') }}>
          <Plus /> Nieuwe licentiehouder
        </button>
      </div>

      <div className="card">
        {loading && <div className="empty">Laden…</div>}
        {!loading && rows.map(lh => {
          const isOpen = expanded === lh.id
          const bedrijven = (lh.bedrijven ?? []) as LicentiehouderBedrijf[]
          return (
            <div key={lh.id} style={{ borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', cursor:'pointer', gap:10 }}
                onClick={() => setExpanded(isOpen ? null : lh.id)}>
                {isOpen ? <ChevronDown size={15} color="var(--muted)" /> : <ChevronRight size={15} color="var(--muted)" />}
                <span style={{ fontWeight:500, flex:1 }}>{lh.naam}</span>
                <span className="text-muted" style={{ fontSize:12 }}>{bedrijven.length} {bedrijven.length === 1 ? 'bedrijf' : 'bedrijven'}</span>
                <div className="actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost" onClick={() => { setForm({ naam:lh.naam }); setEditId(lh.id); setModal('lh-edit') }}><Pencil /></button>
                  <button className="btn btn-ghost" onClick={() => deleteLh(lh.id, lh.naam)}><Trash2 /></button>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding:'0 16px 14px 40px', background:'var(--bg)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:12, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Gekoppelde bedrijven</span>
                    <button className="btn btn-secondary" style={{ fontSize:12, padding:'4px 10px' }}
                      onClick={() => { setBedrijfForm({ bedrijfsnaam:'', lh_id:lh.id }); setModal('bedrijf-add') }}>
                      <Plus size={12} /> Bedrijf toevoegen
                    </button>
                  </div>
                  {bedrijven.length === 0 && <div style={{ fontSize:13, color:'var(--muted)', padding:'8px 0' }}>Nog geen bedrijven gekoppeld</div>}
                  {bedrijven.map(b => (
                    <div key={b.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                      <Building2 size={13} color="var(--muted)" />
                      <span style={{ flex:1, fontSize:13 }}>{b.bedrijfsnaam}</span>
                      <button className="btn btn-ghost" style={{ padding:'2px 6px' }} onClick={() => deleteBedrijf(b.id)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

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
                <input value={form.naam} onChange={e => setForm({ naam:e.target.value })} placeholder="bijv. Flevo Berry" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn btn-primary" onClick={saveLh} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'bedrijf-add' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Bedrijf toevoegen</span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Bedrijfsnaam *</label>
                <input value={bedrijfForm.bedrijfsnaam} onChange={e => setBedrijfForm(f => ({...f, bedrijfsnaam:e.target.value}))} placeholder="bijv. Flevo Berry B.V." autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn btn-primary" onClick={saveBedrijf} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

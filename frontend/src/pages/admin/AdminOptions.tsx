import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Upload, X, ChevronDown, ChevronUp, ImagePlus } from 'lucide-react'
import {
  listOptionsAdmin, createOption, updateOption, deleteOption, uploadOptionImage, BASE
} from '../../services/api'

const CATEGORIES = [
  { id: 'CAT001', name: 'Space Customisations' },
  { id: 'CAT002', name: 'Flooring Upgrades' },
  { id: 'CAT003', name: 'Bathroom Upgrades' },
  { id: 'CAT004', name: 'Lift Interior' },
  { id: 'CAT005', name: 'Landscape' },
  { id: 'CAT006', name: 'Smart Home' },
  { id: 'CAT007', name: 'VRF Cooling' },
  { id: 'CAT008', name: 'Home Theatre' },
]

interface ImgItem { path: string; label: string; code?: string; product_name?: string }

interface OptionDoc {
  id: string
  option_id: string
  category_id: string
  option_name?: string
  sub_section?: string
  location_id?: string
  floor?: string
  space?: string
  standard_spec?: string
  upgrade_spec?: string
  has_upgrade: boolean
  is_active: boolean
  sort_order: number
  price_status: string
  price_inr?: number
  price_unit?: string
  description?: string
  notes?: string
  images?: {
    standard?: string
    standard_list?: ImgItem[]
    upgrade?: string
    upgrade_list?: ImgItem[]
  }
}

const BLANK_FORM = {
  option_id: '',
  option_name: '',
  sub_section: '',
  location_id: '',
  floor: '',
  space: '',
  standard_spec: '',
  upgrade_spec: '',
  has_upgrade: false,
  is_active: true,
  sort_order: 1,
  price_status: 'tbd',
  price_inr: '',
  price_unit: '',
  description: '',
  notes: '',
  std_single: '',
  upg_single: '',
  std_list: [] as ImgItem[],
  upg_list: [] as ImgItem[],
}

function imgUrl(path?: string) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${BASE}${path}`
}

/* ── Small image-list editor ── */
function ImgListEditor({
  items, onChange, categoryId, showCode = false,
}: {
  items: ImgItem[]
  onChange: (items: ImgItem[]) => void
  categoryId: string
  showCode?: boolean
}) {
  const [uploading, setUploading] = useState(false)

  const update = (idx: number, patch: Partial<ImgItem>) => {
    const next = items.map((it, i) => i === idx ? { ...it, ...patch } : it)
    onChange(next)
  }
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))
  const add = () => onChange([...items, { path: '', label: '' }])

  const handleUpload = async (idx: number, file: File) => {
    setUploading(true)
    try {
      const res = await uploadOptionImage(file, categoryId)
      update(idx, { path: res.path })
    } catch { alert('Upload failed') }
    finally { setUploading(false) }
  }

  return (
    <div className="ao-img-list">
      {items.map((it, idx) => (
        <div key={idx} className="ao-img-row">
          <div className="ao-img-preview">
            {it.path
              ? <img src={imgUrl(it.path)} alt={it.label} onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
              : <div className="ao-img-empty"><ImagePlus size={18} /></div>
            }
          </div>
          <div className="ao-img-fields">
            <div className="ao-img-path-row">
              <input
                className="admin-input ao-input-sm"
                placeholder="Image path  e.g. /static/options/CAT003/file.png"
                value={it.path}
                onChange={e => update(idx, { path: e.target.value })}
              />
              <label className="ao-upload-btn" title="Upload file">
                {uploading ? '…' : <Upload size={13} />}
                <input
                  type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(idx, f) }}
                />
              </label>
            </div>
            <input
              className="admin-input ao-input-sm"
              placeholder="Label (e.g. Wash Basin)"
              value={it.label}
              onChange={e => update(idx, { label: e.target.value })}
            />
            {showCode && (
              <>
                <input
                  className="admin-input ao-input-sm"
                  placeholder="Product code (optional)"
                  value={it.code ?? ''}
                  onChange={e => update(idx, { code: e.target.value })}
                />
                <input
                  className="admin-input ao-input-sm"
                  placeholder="Product name (optional)"
                  value={it.product_name ?? ''}
                  onChange={e => update(idx, { product_name: e.target.value })}
                />
              </>
            )}
          </div>
          <button className="ao-img-remove" onClick={() => remove(idx)} title="Remove"><X size={13} /></button>
        </div>
      ))}
      <button className="ao-add-img-btn" onClick={add}><Plus size={12} /> Add image</button>
    </div>
  )
}

/* ── Single-image upload row ── */
function SingleImgUpload({
  value, onChange, categoryId, placeholder,
}: {
  value: string; onChange: (p: string) => void; categoryId: string; placeholder: string
}) {
  const [uploading, setUploading] = useState(false)
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const res = await uploadOptionImage(file, categoryId)
      onChange(res.path)
    } catch { alert('Upload failed') }
    finally { setUploading(false) }
  }
  return (
    <div className="ao-single-img-row">
      {value && <img className="ao-single-preview" src={imgUrl(value)} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
      <input
        className="admin-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <label className="ao-upload-btn" title="Upload">
        {uploading ? '…' : <Upload size={13} />}
        <input type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
      </label>
    </div>
  )
}

/* ── Collapsible section ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="ao-section">
      <button className="ao-section-header" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="ao-section-body">{children}</div>}
    </div>
  )
}

/* ════════════════════════════════════════ MAIN PAGE ═══════════════════════ */
export default function AdminOptions() {
  const [activeCat, setActiveCat] = useState('CAT001')
  const [options, setOptions] = useState<OptionDoc[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<OptionDoc | null>(null)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = async (catId: string) => {
    setLoading(true)
    try {
      const data = await listOptionsAdmin(catId)
      setOptions(data)
    } catch { setOptions([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(activeCat) }, [activeCat])

  const visibleOptions = showInactive ? options : options.filter(o => o.is_active)

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...BLANK_FORM, option_id: `OPT-${activeCat.replace('CAT', 'C')}-${Date.now().toString().slice(-4)}` })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (opt: OptionDoc) => {
    setEditTarget(opt)
    setForm({
      option_id: opt.option_id,
      option_name: opt.option_name ?? '',
      sub_section: opt.sub_section ?? '',
      location_id: opt.location_id ?? '',
      floor: opt.floor ?? '',
      space: opt.space ?? '',
      standard_spec: opt.standard_spec ?? '',
      upgrade_spec: opt.upgrade_spec ?? '',
      has_upgrade: opt.has_upgrade,
      is_active: opt.is_active,
      sort_order: opt.sort_order ?? 1,
      price_status: opt.price_status ?? 'tbd',
      price_inr: opt.price_inr?.toString() ?? '',
      price_unit: opt.price_unit ?? '',
      description: opt.description ?? '',
      notes: opt.notes ?? '',
      std_single: opt.images?.standard ?? '',
      upg_single: opt.images?.upgrade ?? '',
      std_list: opt.images?.standard_list ?? [],
      upg_list: opt.images?.upgrade_list ?? [],
    })
    setError('')
    setModalOpen(true)
  }

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload: any = {
        option_name: form.option_name || undefined,
        sub_section: form.sub_section || undefined,
        location_id: form.location_id || undefined,
        floor: form.floor || undefined,
        space: form.space || undefined,
        standard_spec: form.standard_spec || undefined,
        upgrade_spec: form.upgrade_spec || undefined,
        has_upgrade: form.has_upgrade,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 1,
        price_status: form.price_status,
        price_inr: form.price_inr !== '' ? Number(form.price_inr) : undefined,
        price_unit: form.price_unit || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
        images: {
          standard: form.std_single || undefined,
          upgrade: form.upg_single || undefined,
          standard_list: form.std_list.length ? form.std_list : undefined,
          upgrade_list: form.upg_list.length ? form.upg_list : undefined,
        },
      }

      if (editTarget) {
        await updateOption(editTarget.option_id, payload)
      } else {
        await createOption({ ...payload, option_id: form.option_id, category_id: activeCat })
      }
      setModalOpen(false)
      load(activeCat)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Save failed')
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteOption(deleteId)
      setDeleteId(null)
      load(activeCat)
    } catch { alert('Delete failed') }
  }

  return (
    <div className="admin-options-page">

      {/* ── Category tabs ── */}
      <div className="ao-cat-tabs">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            className={`ao-cat-tab ${activeCat === c.id ? 'ao-cat-tab--active' : ''}`}
            onClick={() => setActiveCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="ao-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="ao-count">
            {visibleOptions.length} option{visibleOptions.length !== 1 ? 's' : ''}
            {options.filter(o => !o.is_active).length > 0 && (
              <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>
                ({options.filter(o => !o.is_active).length} inactive)
              </span>
            )}
          </span>
          <label className="ao-checkbox" style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            <span>Show inactive</span>
          </label>
        </div>
        <button className="admin-btn admin-btn--primary admin-btn--sm" onClick={openAdd}>
          <Plus size={13} /> Add Option
        </button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="admin-loading">Loading…</div>
      ) : visibleOptions.length === 0 ? (
        <div className="admin-table-empty">
          {options.length > 0
            ? 'All options are inactive. Check "Show inactive" to see them.'
            : 'No options found for this category.'}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Option ID</th>
                <th>Name</th>
                <th>Sub-section</th>
                <th>Location</th>
                <th>Has Upgrade</th>
                <th>Active</th>
                <th>Sort</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...visibleOptions].sort((a, b) => (a.sort_order ?? 1) - (b.sort_order ?? 1)).map(opt => (
                <tr key={opt.option_id} style={!opt.is_active ? { opacity: 0.45 } : undefined}>
                  <td><code style={{ fontSize: 11 }}>{opt.option_id}</code></td>
                  <td style={{ fontWeight: 500 }}>{opt.option_name ?? '—'}</td>
                  <td><span className="ao-sub">{opt.sub_section ?? '—'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opt.space ?? opt.location_id ?? '—'}</td>
                  <td>
                    <span className={`badge ${opt.has_upgrade ? 'badge--active' : 'badge--inactive'}`}>
                      {opt.has_upgrade ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${opt.is_active ? 'badge--active' : 'badge--inactive'}`}>
                      {opt.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{opt.sort_order ?? 1}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => openEdit(opt)}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteId(opt.option_id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {modalOpen && (
        <div className="admin-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="admin-modal ao-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{editTarget ? `Edit — ${editTarget.option_id}` : 'Add New Option'}</h3>
              <button className="admin-modal-close" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>

            <div className="admin-modal-body ao-modal-body">

              {/* Basic Info */}
              <Section title="Basic Info">
                <div className="ao-grid-2">
                  {!editTarget && (
                    <label className="ao-field">
                      <span>Option ID *</span>
                      <input className="admin-input" value={form.option_id} onChange={e => set('option_id', e.target.value)} placeholder="e.g. OPT-SC-001" />
                    </label>
                  )}
                  <label className="ao-field">
                    <span>Option Name</span>
                    <input className="admin-input" value={form.option_name} onChange={e => set('option_name', e.target.value)} placeholder="e.g. Gourmet Kitchen" />
                  </label>
                  <label className="ao-field">
                    <span>Sub-section</span>
                    <input className="admin-input" value={form.sub_section} onChange={e => set('sub_section', e.target.value)} placeholder="e.g. kitchen / sanitaryware / individual" />
                  </label>
                  <label className="ao-field">
                    <span>Sort Order</span>
                    <input className="admin-input" type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} />
                  </label>
                </div>
                <div className="ao-grid-2" style={{ marginTop: 10 }}>
                  <label className="ao-checkbox">
                    <input type="checkbox" checked={form.has_upgrade} onChange={e => set('has_upgrade', e.target.checked)} />
                    <span>Has Upgrade</span>
                  </label>
                  <label className="ao-checkbox">
                    <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                    <span>Active</span>
                  </label>
                </div>
              </Section>

              {/* Location */}
              <Section title="Location">
                <div className="ao-grid-3">
                  <label className="ao-field">
                    <span>Location ID</span>
                    <input className="admin-input" value={form.location_id} onChange={e => set('location_id', e.target.value)} placeholder="e.g. LOC004" />
                  </label>
                  <label className="ao-field">
                    <span>Floor</span>
                    <input className="admin-input" value={form.floor} onChange={e => set('floor', e.target.value)} placeholder="e.g. Ground Floor" />
                  </label>
                  <label className="ao-field">
                    <span>Space / Room</span>
                    <input className="admin-input" value={form.space} onChange={e => set('space', e.target.value)} placeholder="e.g. Toilet — Bedroom 1" />
                  </label>
                </div>
              </Section>

              {/* Specs */}
              <Section title="Specs & Description">
                <div className="ao-grid-2">
                  <label className="ao-field">
                    <span>Standard Spec</span>
                    <input className="admin-input" value={form.standard_spec} onChange={e => set('standard_spec', e.target.value)} placeholder="e.g. Standard Kitchen Layout" />
                  </label>
                  <label className="ao-field">
                    <span>Upgrade Spec / Series Name</span>
                    <input className="admin-input" value={form.upgrade_spec} onChange={e => set('upgrade_spec', e.target.value)} placeholder="e.g. Happy D2 Series" />
                  </label>
                </div>
                <label className="ao-field" style={{ marginTop: 10 }}>
                  <span>Description</span>
                  <textarea className="admin-input ao-textarea" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detailed description…" rows={2} />
                </label>
                <label className="ao-field" style={{ marginTop: 10 }}>
                  <span>Notes</span>
                  <textarea className="admin-input ao-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes…" rows={2} />
                </label>
              </Section>

              {/* Pricing */}
              <Section title="Pricing">
                <div className="ao-grid-3">
                  <label className="ao-field">
                    <span>Price Status</span>
                    <select className="admin-input" value={form.price_status} onChange={e => set('price_status', e.target.value)}>
                      <option value="tbd">TBD</option>
                      <option value="on_request">On Request</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </label>
                  <label className="ao-field">
                    <span>Price (₹)</span>
                    <input className="admin-input" type="number" value={form.price_inr} onChange={e => set('price_inr', e.target.value)} placeholder="Amount" />
                  </label>
                  <label className="ao-field">
                    <span>Unit</span>
                    <input className="admin-input" value={form.price_unit} onChange={e => set('price_unit', e.target.value)} placeholder="e.g. per sq ft" />
                  </label>
                </div>
              </Section>

              {/* Images */}
              <Section title="Standard Images">
                <label className="ao-field">
                  <span>Single standard image (fallback)</span>
                  <SingleImgUpload
                    value={form.std_single} onChange={v => set('std_single', v)}
                    categoryId={activeCat} placeholder="/static/options/CAT003/std_wash_basin.png"
                  />
                </label>
                <div style={{ marginTop: 12 }}>
                  <span className="ao-field-label">Standard image list (for comparison card)</span>
                  <ImgListEditor
                    items={form.std_list} onChange={v => set('std_list', v)}
                    categoryId={activeCat}
                  />
                </div>
              </Section>

              <Section title="Upgrade Images">
                <label className="ao-field">
                  <span>Single upgrade image (fallback)</span>
                  <SingleImgUpload
                    value={form.upg_single} onChange={v => set('upg_single', v)}
                    categoryId={activeCat} placeholder="/static/options/CAT003/upg_wash_basin.png"
                  />
                </label>
                <div style={{ marginTop: 12 }}>
                  <span className="ao-field-label">Upgrade image list (for comparison card)</span>
                  <ImgListEditor
                    items={form.upg_list} onChange={v => set('upg_list', v)}
                    categoryId={activeCat} showCode
                  />
                </div>
              </Section>

            </div>

            {error && <div className="admin-error" style={{ margin: '0 24px 8px' }}>{error}</div>}

            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn--ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Option'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="admin-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="admin-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Delete Option</h3>
              <button className="admin-modal-close" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <div className="admin-modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Are you sure you want to delete <strong>{deleteId}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn--ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="admin-btn admin-btn--danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

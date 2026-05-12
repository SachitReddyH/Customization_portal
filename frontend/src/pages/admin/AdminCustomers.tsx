import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Eye, X } from 'lucide-react'
import {
  listCustomers,
  createCustomer,
  deleteCustomer,
  listAllVillas,
} from '../../services/api'

interface Customer {
  id: string
  email: string
  full_name: string
  phone?: string
  role: string
  villa_id?: string
  is_active: boolean
  customization_deadline?: string
  created_at: string
}

interface Villa {
  id: string
  villa_number: string
  villa_name?: string
  villa_type?: string
  facing?: string
  block?: string
  plot_number?: string
  area_sqft?: number
  is_assigned: boolean
}

interface CreateForm {
  full_name: string
  email: string
  password: string
  phone: string
  villa_id: string
  customization_deadline: string
}

const EMPTY_FORM: CreateForm = {
  full_name: '',
  email: '',
  password: '',
  phone: '',
  villa_id: '',
  customization_deadline: '',
}

function formatVilla(villa: Villa): string {
  const parts = [villa.villa_number]
  if (villa.villa_type) parts.push(villa.villa_type)
  if (villa.facing) parts.push(villa.facing)
  if (villa.block) parts.push(`Blk ${villa.block}`)
  return parts.join(' – ')
}

export default function AdminCustomers() {
  const navigate = useNavigate()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [villas, setVillas] = useState<Villa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [c, v] = await Promise.all([listCustomers(), listAllVillas()])
      setCustomers(c)
      setVillas(v)
    } catch {
      setError('Failed to load customers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const getVilla = (villaId?: string): Villa | undefined =>
    villaId ? villas.find(v => v.id === villaId) : undefined

  const unassignedVillas = villas.filter(v => !v.is_assigned)

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return }
    if (!form.email.trim()) { setFormError('Email is required.'); return }
    if (!form.password) { setFormError('Password is required.'); return }

    setSubmitting(true)
    try {
      const payload: any = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      }
      if (form.phone) payload.phone = form.phone.trim()
      if (form.villa_id) payload.villa_id = form.villa_id
      if (form.customization_deadline) payload.customization_deadline = form.customization_deadline

      await createCustomer(payload)
      setShowModal(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create customer.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCustomer(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch {
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const formatDeadline = (d?: string) => {
    if (!d) return '—'
    const utc = d.endsWith('Z') || d.includes('+') ? d : d + 'Z'
    return new Date(utc).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'Asia/Kolkata'
    })
  }

  return (
    <div>
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <span className="admin-table-title">Customers</span>
          <button
            className="admin-btn admin-btn--primary admin-btn--sm"
            onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowModal(true) }}
          >
            <Plus size={14} />
            Add Customer
          </button>
        </div>

        {loading ? (
          <div className="admin-loading">Loading customers…</div>
        ) : error ? (
          <div className="admin-error" style={{ margin: '16px' }}>{error}</div>
        ) : customers.length === 0 ? (
          <div className="admin-table-empty">No customers yet. Add one to get started.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Villa</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const villa = getVilla(c.villa_id)
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.email}</td>
                    <td>{c.phone || '—'}</td>
                    <td>
                      {villa ? (
                        <span style={{ fontSize: 12 }}>{formatVilla(villa)}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add Customer Modal ── */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Add New Customer</h3>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="admin-modal-body">
                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <label>Full Name *</label>
                    <input
                      name="full_name"
                      type="text"
                      placeholder="Ravi Kumar"
                      value={form.full_name}
                      onChange={handleFormChange}
                      autoComplete="off"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Phone</label>
                    <input
                      name="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                <div className="admin-form-field">
                  <label>Email *</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="customer@example.com"
                    value={form.email}
                    onChange={handleFormChange}
                    autoComplete="off"
                  />
                </div>

                <div className="admin-form-field">
                  <label>Password *</label>
                  <input
                    name="password"
                    type="password"
                    placeholder="Set initial password"
                    value={form.password}
                    onChange={handleFormChange}
                    autoComplete="new-password"
                  />
                </div>

                <div className="admin-form-field">
                  <label>Assign Villa</label>
                  <select
                    name="villa_id"
                    value={form.villa_id}
                    onChange={handleFormChange}
                  >
                    <option value="">— No villa assigned —</option>
                    {unassignedVillas.map(v => (
                      <option key={v.id} value={v.id}>
                        {formatVilla(v)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-field">
                  <label>Customisation Deadline</label>
                  <input
                    name="customization_deadline"
                    type="date"
                    value={form.customization_deadline}
                    onChange={handleFormChange}
                  />
                </div>

                {formError && (
                  <div className="admin-error" style={{ margin: 0 }}>{formError}</div>
                )}
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating…' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null) }}>
          <div className="admin-modal" style={{ maxWidth: 400 }}>
            <div className="admin-modal-header">
              <h3>Delete Customer</h3>
              <button
                className="admin-modal-close"
                onClick={() => !deleting && setDeleteTarget(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                Are you sure you want to delete{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {deleteTarget.full_name}
                </strong>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                className="admin-btn admin-btn--ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="admin-btn admin-btn--danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{ background: '#c0392b', color: '#fff', borderColor: '#c0392b' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

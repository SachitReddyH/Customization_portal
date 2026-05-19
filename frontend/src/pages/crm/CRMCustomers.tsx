import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { listCustomers, createCustomer, listAllVillas } from '../../services/api'

interface Customer {
  id: string
  email: string
  full_name: string
  phone?: string
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
  full_name: '', email: '', password: '', phone: '', villa_id: '', customization_deadline: '',
}

function formatVilla(v: Villa): string {
  const parts = [v.villa_number]
  if (v.villa_type) parts.push(v.villa_type)
  if (v.facing)     parts.push(v.facing)
  if (v.block)      parts.push(`Blk ${v.block}`)
  return parts.join(' – ')
}

export default function CRMCustomers() {
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [villas, setVillas]         = useState<Villa[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [form, setForm]             = useState<CreateForm>(EMPTY_FORM)
  const [formError, setFormError]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [c, v] = await Promise.all([listCustomers(), listAllVillas()])
      setCustomers(c); setVillas(v)
    } catch { setError('Failed to load customers.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const getVilla = (id?: string) => id ? villas.find(v => v.id === id) : undefined
  const unassignedVillas = villas.filter(v => !v.is_assigned)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return }
    if (!form.email.trim())     { setFormError('Email is required.'); return }
    if (!form.password)         { setFormError('Password is required.'); return }
    setSubmitting(true)
    try {
      const payload: any = {
        full_name: form.full_name.trim(),
        email:     form.email.trim(),
        password:  form.password,
      }
      if (form.phone)                    payload.phone = form.phone.trim()
      if (form.villa_id)                 payload.villa_id = form.villa_id
      if (form.customization_deadline)   payload.customization_deadline = form.customization_deadline
      await createCustomer(payload)
      setShowModal(false); setForm(EMPTY_FORM); await load()
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create customer.')
    } finally { setSubmitting(false) }
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
            <Plus size={14} /> Add Customer
          </button>
        </div>

        {loading ? (
          <div className="admin-loading">Loading customers…</div>
        ) : error ? (
          <div className="admin-error" style={{ margin: 16 }}>{error}</div>
        ) : customers.length === 0 ? (
          <div className="admin-table-empty">No customers yet.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Villa</th>
                <th>Status</th>
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
                      {villa
                        ? <span style={{ fontSize: 12 }}>{formatVilla(villa)}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                      }
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 4,
                        background: c.is_active ? '#e6f9ef' : '#fde8e8',
                        color: c.is_active ? '#1a7a47' : '#c0392b',
                      }}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
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
                    <input name="full_name" type="text" placeholder="Ravi Kumar"
                      value={form.full_name}
                      onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                      autoComplete="off" />
                  </div>
                  <div className="admin-form-field">
                    <label>Phone</label>
                    <input name="phone" type="tel" placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="admin-form-field">
                  <label>Email *</label>
                  <input name="email" type="email" placeholder="customer@example.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    autoComplete="off" />
                </div>
                <div className="admin-form-field">
                  <label>Password *</label>
                  <input name="password" type="password" placeholder="Set initial password"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    autoComplete="new-password" />
                </div>
                <div className="admin-form-field">
                  <label>Assign Villa</label>
                  <select name="villa_id" value={form.villa_id}
                    onChange={e => setForm(p => ({ ...p, villa_id: e.target.value }))}>
                    <option value="">— No villa assigned —</option>
                    {unassignedVillas.map(v => (
                      <option key={v.id} value={v.id}>{formatVilla(v)}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-field">
                  <label>Customisation Deadline</label>
                  <input name="customization_deadline" type="date"
                    value={form.customization_deadline}
                    onChange={e => setForm(p => ({ ...p, customization_deadline: e.target.value }))} />
                </div>
                {formError && <div className="admin-error" style={{ margin: 0 }}>{formError}</div>}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

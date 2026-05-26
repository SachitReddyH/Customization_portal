import { useEffect, useState } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import { listStaff, createStaff, deleteStaff } from '../../services/api'

interface StaffUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at?: string
}

const ROLE_LABELS: Record<string, string> = {
  design_admin: 'Design Admin',
  crm_admin:    'CRM Admin',
}
const ROLE_COLORS: Record<string, React.CSSProperties> = {
  design_admin: { background: '#f3e8ff', color: '#7c3aed', border: '1px solid #d8b4fe' },
  crm_admin:    { background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' },
}

const BLANK = { email: '', password: '', full_name: '', role: 'design_admin' }

export default function AdminStaff() {
  const [staff,   setStaff]   = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState({ ...BLANK })
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState('')

  const [deletingId, setDeletingId] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true); setError('')
    try { setStaff(await listStaff()) }
    catch (e: any) { setError(e?.response?.data?.detail || 'Failed to load staff') }
    finally { setLoading(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.full_name) {
      setFormError('All fields are required'); return
    }
    setSubmitting(true); setFormError('')
    try {
      const created = await createStaff(form)
      setStaff(prev => [created, ...prev])
      setForm({ ...BLANK })
      setShowForm(false)
    } catch (e: any) {
      setFormError(e?.response?.data?.detail || 'Failed to create user')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (s: StaffUser) => {
    if (!window.confirm(`Remove ${s.full_name} (${s.email})?`)) return
    setDeletingId(s.id)
    try {
      await deleteStaff(s.id)
      setStaff(prev => prev.filter(x => x.id !== s.id))
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to delete')
    } finally { setDeletingId('') }
  }

  return (
    <div className="admin-table-wrap">
      <div className="admin-table-header">
        <span className="admin-table-title">Staff Users</span>
        <button className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? <><X size={13} /> Cancel</> : <><Plus size={13} /> Add Staff</>}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} style={{
          margin: '0 0 0 0', padding: '20px 24px', background: '#faf9f7',
          borderBottom: '1px solid #ece9e4', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 180 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Full Name *</label>
            <input
              className="admin-input"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="e.g. Ravi Kumar"
              style={{ padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 200 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Email *</label>
            <input
              type="email"
              className="admin-input"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="ravi@capstonelife.in"
              style={{ padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Password *</label>
            <input
              type="password"
              className="admin-input"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              style={{ padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Role *</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, background: '#fff' }}
            >
              <option value="design_admin">Design Admin</option>
              <option value="crm_admin">CRM Admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {formError && <p style={{ fontSize: 12, color: '#d94f4f', margin: 0 }}>{formError}</p>}
            <button className="admin-btn admin-btn--primary" type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="admin-loading">Loading staff…</div>
      ) : error ? (
        <div className="admin-error">{error}</div>
      ) : staff.length === 0 ? (
        <div className="admin-table-empty">No staff users yet. Add one above.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.full_name}</td>
                <td style={{ color: '#555', fontSize: 13 }}>{s.email}</td>
                <td>
                  <span style={{
                    display: 'inline-flex', padding: '3px 10px', borderRadius: 20, fontSize: 12,
                    ...(ROLE_COLORS[s.role] ?? {}),
                  }}>
                    {ROLE_LABELS[s.role] ?? s.role}
                  </span>
                </td>
                <td>
                  <button
                    className="admin-btn admin-btn--danger admin-btn--sm"
                    onClick={() => handleDelete(s)}
                    disabled={deletingId === s.id}
                  >
                    <Trash2 size={12} /> {deletingId === s.id ? 'Removing…' : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

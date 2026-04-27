import { useEffect, useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'
import { listQuotes, updateQuote, markQuoteRead } from '../../services/api'

interface Quote {
  id: string
  customer_id: string
  customer_name: string
  villa_name?: string
  status: string
  notification_type?: string | null   // 'new' | 'updated' | null
  customer_notes?: string
  admin_notes?: string
  quoted_price?: number
  requested_at: string
  updated_at?: string
  selection_snapshot?: any[]
}

/** Resolve a snapshot entry's display name.
 *  Handles real option names, synthetic addon IDs (OPT-BP-001-ADN-BAT), etc. */
function resolveSnapshotName(s: any): string {
  if (s.option_name) return s.option_name
  const id: string = s.option_id ?? ''
  const adnMatch = id.match(/^(.+)-ADN-([A-Z]+)$/)
  if (adnMatch) {
    const code = adnMatch[2]
    return code === 'BAT' ? 'Bathtub' : code === 'JAC' ? 'Jacuzzi' : code
  }
  return id
}

interface EditState {
  status: string
  admin_notes: string
  quoted_price: string
}

const STATUS_OPTIONS = ['pending', 'reviewed', 'quoted', 'accepted', 'rejected']

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge--${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

function NotifBadge({ type }: { type?: string | null }) {
  if (!type) return null
  return (
    <span className={`notif-badge notif-badge--${type}`}>
      {type === 'new' ? '🔴 New' : '🟡 Updated'}
    </span>
  )
}

export default function AdminQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editStates, setEditStates] = useState<Record<string, EditState>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true); setError('')
    try { setQuotes(await listQuotes()) }
    catch { setError('Failed to load quotes.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const getEditState = (q: Quote): EditState =>
    editStates[q.id] ?? {
      status: q.status,
      admin_notes: q.admin_notes || '',
      quoted_price: q.quoted_price != null ? String(q.quoted_price) : '',
    }

  const setEditField = (id: string, field: keyof EditState, value: string) => {
    const q = quotes.find(q => q.id === id)!
    setEditStates(prev => ({ ...prev, [id]: { ...getEditState(q), [field]: value } }))
  }

  const handleToggle = async (id: string) => {
    const q = quotes.find(q => q.id === id)!
    if (expandedId !== id) {
      // Initialise edit state
      setEditStates(prev => ({
        ...prev,
        [id]: { status: q.status, admin_notes: q.admin_notes || '', quoted_price: q.quoted_price != null ? String(q.quoted_price) : '' }
      }))
      // Auto-mark as seen if notification exists
      if (q.notification_type) {
        try {
          const updated = await markQuoteRead(id)
          setQuotes(prev => prev.map(qq => qq.id === id ? { ...qq, notification_type: updated.notification_type } : qq))
        } catch { /* non-critical */ }
      }
    }
    setExpandedId(prev => prev === id ? null : id)
    setSaveError(prev => ({ ...prev, [id]: '' }))
  }

  const handleSave = async (id: string) => {
    const es = editStates[id]; if (!es) return
    setSaving(id); setSaveError(prev => ({ ...prev, [id]: '' }))
    try {
      const payload: { status: string; admin_notes?: string; quoted_price?: number } = { status: es.status }
      if (es.admin_notes.trim()) payload.admin_notes = es.admin_notes.trim()
      if (es.quoted_price !== '') { const n = parseFloat(es.quoted_price); if (!isNaN(n)) payload.quoted_price = n }
      await updateQuote(id, payload)
      await load(); setExpandedId(null)
    } catch (err: any) {
      setSaveError(prev => ({ ...prev, [id]: err.response?.data?.detail || 'Failed to save.' }))
    } finally { setSaving(null) }
  }

  const fmtDate = (d?: string) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  const fmtPrice = (p?: number) => p != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p)
    : '—'

  // Split into sections
  const newQuotes     = quotes.filter(q => q.notification_type === 'new')
  const updatedQuotes = quotes.filter(q => q.notification_type === 'updated')
  const seenQuotes    = quotes.filter(q => !q.notification_type)

  const renderRow = (q: Quote) => {
    const isOpen = expandedId === q.id
    const es = getEditState(q)
    const snapshotCount = Array.isArray(q.selection_snapshot) ? q.selection_snapshot.length : 0

    return (
      <Fragment key={q.id}>
        <tr className={q.notification_type ? `quote-row--${q.notification_type}` : ''}>
          <td style={{ fontWeight: 600 }}>
            {q.customer_name}
            {q.notification_type && <NotifBadge type={q.notification_type} />}
          </td>
          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q.villa_name || '—'}</td>
          <td><StatusBadge status={q.status} /></td>
          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {snapshotCount > 0 ? `${snapshotCount} item${snapshotCount !== 1 ? 's' : ''}` : '—'}
          </td>
          <td style={{ fontSize: 13 }}>{fmtPrice(q.quoted_price)}</td>
          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <div>{fmtDate(q.requested_at)}</div>
            {q.updated_at && (
              <div style={{ color: '#c8a96e', fontSize: 11, marginTop: 2 }}>
                Updated {fmtDate(q.updated_at)}
              </div>
            )}
          </td>
          <td>
            <button
              className={`admin-btn admin-btn--sm ${isOpen ? 'admin-btn--primary' : 'admin-btn--ghost'}`}
              onClick={() => handleToggle(q.id)}
            >
              {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Review
            </button>
          </td>
        </tr>

        {isOpen && (
          <tr key={`${q.id}-expand`}>
            <td colSpan={7} style={{ padding: 0 }}>
              <div className="quote-expand-panel">
                <div className="quote-expand-inner">

                  {/* Selections snapshot */}
                  {Array.isArray(q.selection_snapshot) && q.selection_snapshot.length > 0 && (
                    <div className="quote-snapshot">
                      <p className="quote-snapshot-title">Customer Selections</p>
                      {(() => {
                        const groups: Record<string, typeof q.selection_snapshot> = {}
                        q.selection_snapshot!.forEach((s: any) => {
                          const key = s.category_name ?? s.category_id ?? 'Other'
                          if (!groups[key]) groups[key] = []
                          groups[key].push(s)
                        })
                        return Object.entries(groups).map(([cat, items]) => (
                          <div key={cat} className="quote-snapshot-group">
                            <p className="quote-snapshot-cat">{cat}</p>
                            {items.map((s: any, i: number) => (
                              <div key={i} className="quote-snapshot-row">
                                <span className="quote-snapshot-name">{resolveSnapshotName(s)}</span>
                                <span className={`quote-snapshot-type ${s.selection_type}`}>
                                  {s.selection_type === 'upgrade' ? 'Upgrade' : 'Standard'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))
                      })()}
                    </div>
                  )}

                  {/* Customer notes */}
                  {q.customer_notes && (
                    <div className="quote-customer-notes">
                      <p className="quote-snapshot-title">Customer Notes</p>
                      <p className="quote-customer-notes-body">{q.customer_notes}</p>
                    </div>
                  )}

                  {/* Admin update fields */}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                    <div className="admin-form-field" style={{ flex: '0 0 180px' }}>
                      <label>Status</label>
                      <select value={es.status} onChange={e => setEditField(q.id, 'status', e.target.value)}>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-form-field" style={{ flex: '0 0 180px' }}>
                      <label>Quoted Price (INR)</label>
                      <input
                        type="number" placeholder="e.g. 250000"
                        value={es.quoted_price}
                        onChange={e => setEditField(q.id, 'quoted_price', e.target.value)}
                        min={0} step={1000}
                      />
                    </div>
                  </div>

                  <div className="admin-form-field">
                    <label>Admin Notes</label>
                    <textarea
                      placeholder="Add internal notes or comments…"
                      value={es.admin_notes}
                      onChange={e => setEditField(q.id, 'admin_notes', e.target.value)}
                      rows={3}
                    />
                  </div>

                  {saveError[q.id] && <div className="admin-error" style={{ margin: 0 }}>{saveError[q.id]}</div>}

                  <div className="quote-expand-actions">
                    <button className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => handleSave(q.id)} disabled={saving === q.id}>
                      <Save size={13} /> {saving === q.id ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setExpandedId(null)} disabled={saving === q.id}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  const tableHead = (
    <thead>
      <tr>
        <th>Customer</th><th>Villa</th><th>Status</th>
        <th>Selections</th><th>Quoted Price</th><th>Date</th><th>Actions</th>
      </tr>
    </thead>
  )

  return (
    <div>
      {loading ? (
        <div className="admin-loading">Loading quotes…</div>
      ) : error ? (
        <div className="admin-error" style={{ margin: 16 }}>{error}</div>
      ) : quotes.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-table-empty">No quote requests yet.</div>
        </div>
      ) : (
        <>
          {/* ── NEW section ── */}
          {newQuotes.length > 0 && (
            <div className="admin-table-wrap quote-section--new" style={{ marginBottom: 20 }}>
              <div className="admin-table-header">
                <span className="admin-table-title">🔴 New Requests</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{newQuotes.length} new</span>
              </div>
              <table className="admin-table">{tableHead}<tbody>{newQuotes.map(renderRow)}</tbody></table>
            </div>
          )}

          {/* ── UPDATED section ── */}
          {updatedQuotes.length > 0 && (
            <div className="admin-table-wrap quote-section--updated" style={{ marginBottom: 20 }}>
              <div className="admin-table-header">
                <span className="admin-table-title">🟡 Updated Requests</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{updatedQuotes.length} updated</span>
              </div>
              <table className="admin-table">{tableHead}<tbody>{updatedQuotes.map(renderRow)}</tbody></table>
            </div>
          )}

          {/* ── ALL OTHERS section ── */}
          {seenQuotes.length > 0 && (
            <div className="admin-table-wrap">
              <div className="admin-table-header">
                <span className="admin-table-title">All Requests</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{seenQuotes.length} total</span>
              </div>
              <table className="admin-table">{tableHead}<tbody>{seenQuotes.map(renderRow)}</tbody></table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

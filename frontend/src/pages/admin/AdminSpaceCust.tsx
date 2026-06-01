import { useEffect, useState, useRef } from 'react'
import {
  listSpaceCustRequests,
  respondToSpaceCustRequest,
  reopenSpaceCustRequest,
} from '../../services/api'

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  quoted:      'Quoted',
  negotiating: 'Negotiating',
  accepted:    'Accepted',
  denied:      'Denied',
}

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  pending:     { background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' },
  quoted:      { background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9' },
  negotiating: { background: '#fce4ec', color: '#b71c1c', border: '1px solid #f48fb1', fontWeight: 700 },
  accepted:    { background: '#e8f5e9', color: '#1b5e20', border: '1px solid #a5d6a7' },
  denied:      { background: '#f5f5f5', color: '#757575', border: '1px solid #e0e0e0' },
}

interface SpaceCustRequest {
  id: string
  customer_id: string
  customer_name?: string
  customer_email?: string
  villa_id?: string
  villa_number?: string
  villa_name?: string
  status: string
  selection_snapshot: any[]
  quoted_price?: number | null
  admin_notes?: string | null
  customer_notes?: string | null
  customer_notification?: string | null
  admin_notification?: string | null
  requested_at: string
  updated_at?: string | null
  responded_at?: string | null
}

export default function AdminSpaceCust() {
  const isDesignAdmin = sessionStorage.getItem('user_role') === 'design_admin'

  const [requests, setRequests] = useState<SpaceCustRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Per-row form state
  const [formData, setFormData] = useState<Record<string, { price: string; notes: string; file: File | null }>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [rowError,   setRowError]   = useState<Record<string, string>>({})
  const [rowSuccess, setRowSuccess] = useState<Record<string, boolean>>({})

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listSpaceCustRequests()
      setRequests(data)
      // Initialise form data for each request
      const initialForm: Record<string, { price: string; notes: string; file: File | null }> = {}
      data.forEach((r: SpaceCustRequest) => {
        initialForm[r.id] = { price: '', notes: '', file: null }
      })
      setFormData(initialForm)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load space customisation requests')
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const updateForm = (id: string, field: 'price' | 'notes', value: string) => {
    setFormData(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const setFile = (id: string, file: File | null) => {
    setFormData(prev => ({ ...prev, [id]: { ...prev[id], file } }))
  }

  const handleRespond = async (req: SpaceCustRequest) => {
    const form = formData[req.id]

    // Design admin only uploads floor plan — price is not required
    if (!isDesignAdmin) {
      if (!form?.price) {
        setRowError(prev => ({ ...prev, [req.id]: 'Please enter a price' }))
        return
      }
      const price = parseFloat(form.price)
      if (isNaN(price) || price <= 0) {
        setRowError(prev => ({ ...prev, [req.id]: 'Please enter a valid price' }))
        return
      }
    }

    if (isDesignAdmin && !form?.file) {
      setRowError(prev => ({ ...prev, [req.id]: 'Please select a floor plan file to upload' }))
      return
    }

    const price = parseFloat(form?.price || '0')

    setSubmitting(prev => ({ ...prev, [req.id]: true }))
    setRowError(prev => ({ ...prev, [req.id]: '' }))

    try {
      const fd = new FormData()
      if (!isDesignAdmin && price > 0) fd.append('quoted_price', String(price))
      if (!isDesignAdmin && form.notes) fd.append('admin_notes', form.notes)
      if (form.file) fd.append('floor_plan', form.file)

      const updated = await respondToSpaceCustRequest(req.id, fd)
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...updated } : r))
      // Reset form and show success
      setFormData(prev => ({ ...prev, [req.id]: { price: '', notes: '', file: null } }))
      if (fileInputRefs.current[req.id]) fileInputRefs.current[req.id]!.value = ''
      setRowSuccess(prev => ({ ...prev, [req.id]: true }))
      setTimeout(() => setRowSuccess(prev => ({ ...prev, [req.id]: false })), 4000)
      setExpandedRows(prev => { const n = new Set(prev); n.delete(req.id); return n })
    } catch (e: any) {
      setRowError(prev => ({
        ...prev,
        [req.id]: e?.response?.data?.detail || 'Failed to send response',
      }))
    } finally {
      setSubmitting(prev => ({ ...prev, [req.id]: false }))
    }
  }

  const handleReopen = async (req: SpaceCustRequest) => {
    setSubmitting(prev => ({ ...prev, [req.id]: true }))
    setRowError(prev => ({ ...prev, [req.id]: '' }))
    try {
      await reopenSpaceCustRequest(req.id)
      setRequests(prev =>
        prev.map(r =>
          r.id === req.id
            ? { ...r, status: 'pending', quoted_price: null, admin_notes: null, customer_notification: null, admin_notification: null, responded_at: null }
            : r
        )
      )
    } catch (e: any) {
      setRowError(prev => ({
        ...prev,
        [req.id]: e?.response?.data?.detail || 'Failed to reopen',
      }))
    } finally {
      setSubmitting(prev => ({ ...prev, [req.id]: false }))
    }
  }

  if (loading) return <div className="admin-loading">Loading space customisation requests…</div>
  if (error) return <div className="admin-error">{error}</div>

  return (
    <div className="admin-table-wrap">
      <div className="admin-table-header">
        <span className="admin-table-title">
          Space Customisation Requests
          {requests.length > 0 && (
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 500, color: '#888' }}>
              ({requests.length})
            </span>
          )}
        </span>
      </div>

      {requests.length === 0 ? (
        <div style={{ padding: '32px 24px', color: '#aaa', fontSize: 14 }}>
          No space customisation requests yet.
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Villa</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Selections</th>
              <th>Quoted Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => {
              const isExpanded  = expandedRows.has(req.id)
              const form        = formData[req.id] || { price: '', notes: '', file: null }
              const isSubmitting = submitting[req.id] || false
              const rowErr      = rowError[req.id] || ''
              const didSucceed  = rowSuccess[req.id] || false
              const canRespond  = req.status === 'pending' || req.status === 'negotiating'
              const isLocked    = req.status === 'quoted' || req.status === 'accepted' || req.status === 'denied'

              return (
                <>
                  <tr key={req.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        {req.villa_number ?? '—'}
                      </span>
                      {req.villa_name && (
                        <span style={{ display: 'block', fontSize: 11, color: '#888', marginTop: 2 }}>
                          {req.villa_name}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{req.customer_name ?? '—'}</span>
                      {req.customer_email && (
                        <span style={{ display: 'block', fontSize: 11, color: '#888', marginTop: 2 }}>
                          {req.customer_email}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        ...STATUS_COLORS[req.status],
                      }}>
                        {req.status === 'negotiating'
                          ? 'Negotiation Requested'
                          : STATUS_LABELS[req.status] ?? req.status}
                      </span>
                      {req.admin_notification === 'negotiation_requested' && (
                        <span style={{ display: 'block', fontSize: 11, color: '#b71c1c', marginTop: 3, fontWeight: 600 }}>
                          Action Required
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn--sm admin-btn--ghost"
                        onClick={() => toggleRow(req.id)}
                      >
                        {req.selection_snapshot?.length ?? 0} items{' '}
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </td>
                    <td>
                      {req.quoted_price != null
                        ? <span style={{ fontWeight: 600 }}>{fmtINR(req.quoted_price)}</span>
                        : <span style={{ color: '#aaa' }}>—</span>
                      }
                    </td>
                    <td>
                      {didSucceed ? (
                        <span style={{ color: '#1b5e20', fontWeight: 600, fontSize: 13 }}>
                          ✓ Sent successfully
                        </span>
                      ) : isLocked ? (
                        <button
                          className="admin-btn admin-btn--sm admin-btn--ghost"
                          onClick={() => handleReopen(req)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Please wait…' : 'Reopen'}
                        </button>
                      ) : (
                        <button
                          className="admin-btn admin-btn--sm admin-btn--primary"
                          onClick={() => setExpandedRows(prev => {
                            const next = new Set(prev)
                            next.add(req.id)
                            return next
                          })}
                        >
                          Respond
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${req.id}-expand`}>
                      <td colSpan={6} style={{ padding: '0', background: '#fafaf8' }}>
                        <div style={{ padding: '18px 24px', borderTop: '1px solid #ece9e4' }}>

                          {/* Selection snapshot */}
                          {req.selection_snapshot?.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#333' }}>
                                Selection Snapshot
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {req.selection_snapshot.map((item: any, idx: number) => (
                                  <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '8px 12px',
                                    background: '#fff',
                                    borderRadius: 8,
                                    border: '1px solid #ece9e4',
                                    fontSize: 13,
                                  }}>
                                    <span style={{ fontWeight: 500, flex: 1 }}>
                                      {item.option_name || item.option_id}
                                    </span>
                                    {item.room_label && (
                                      <span style={{ color: '#888', fontSize: 12 }}>{item.room_label}</span>
                                    )}
                                    {item.price_inr != null && (
                                      <span style={{ color: '#F05E3E', fontWeight: 600, fontSize: 12 }}>
                                        {fmtINR(item.price_inr)}
                                        {item.price_unit ? ` / ${item.price_unit}` : ''}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Customer notes */}
                          {req.customer_notes && (
                            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>Customer Notes</p>
                              <p style={{ fontSize: 13, color: '#78350f' }}>{req.customer_notes}</p>
                            </div>
                          )}

                          {/* Admin notes display (if already responded) */}
                          {req.admin_notes && (
                            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #ece9e4' }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4 }}>Admin Notes</p>
                              <p style={{ fontSize: 13 }}>{req.admin_notes}</p>
                            </div>
                          )}

                          {/* Error for this row */}
                          {rowErr && (
                            <p style={{ color: '#d94f4f', fontSize: 13, marginBottom: 12 }}>{rowErr}</p>
                          )}

                          {/* Response form — for pending / negotiating */}
                          {canRespond && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}>
                              <p style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>
                                {isDesignAdmin ? 'Upload Updated Floor Plan' : 'Send Response'}
                              </p>

                              {/* Price — admin only */}
                              {!isDesignAdmin && (
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>
                                      Quoted Price (INR) *
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1000"
                                      value={form.price}
                                      onChange={e => updateForm(req.id, 'price', e.target.value)}
                                      placeholder="e.g. 500000"
                                      style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: 8,
                                        fontSize: 14,
                                        fontFamily: 'var(--font-body)',
                                        outline: 'none',
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Notes — admin only */}
                              {!isDesignAdmin && (
                                <div>
                                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>
                                    Admin Notes (optional)
                                  </label>
                                  <textarea
                                    value={form.notes}
                                    onChange={e => updateForm(req.id, 'notes', e.target.value)}
                                    placeholder="Add any notes for the customer…"
                                    rows={3}
                                    style={{
                                      width: '100%',
                                      padding: '9px 12px',
                                      border: '1px solid #ddd',
                                      borderRadius: 8,
                                      fontSize: 13,
                                      fontFamily: 'var(--font-body)',
                                      resize: 'vertical',
                                      outline: 'none',
                                    }}
                                  />
                                </div>
                              )}

                              <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>
                                  Upload Updated Floor Plan (optional)
                                </label>
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                                  ref={el => { fileInputRefs.current[req.id] = el }}
                                  onChange={e => setFile(req.id, e.target.files?.[0] ?? null)}
                                  style={{ fontSize: 13 }}
                                />
                                {form.file && (
                                  <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                    Selected: {form.file.name}
                                  </p>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'flex-start' }}>
                                <button
                                  className="admin-btn admin-btn--primary"
                                  onClick={() => handleRespond(req)}
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? 'Uploading…' : isDesignAdmin ? 'Upload Floor Plan' : 'Send Response'}
                                </button>
                                {isSubmitting && (
                                  <span style={{ fontSize: 12, color: '#888' }}>
                                    Uploading floor plan — this may take up to 30 seconds…
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Reopen button for locked rows inside expanded */}
                          {isLocked && (
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                {req.quoted_price != null && (
                                  <p style={{ fontSize: 13, color: '#333' }}>
                                    Quoted: <strong>{fmtINR(req.quoted_price)}</strong>
                                  </p>
                                )}
                              </div>
                              <button
                                className="admin-btn admin-btn--sm admin-btn--danger"
                                onClick={() => handleReopen(req)}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? 'Please wait…' : 'Reopen Request'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

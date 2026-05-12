import { useEffect, useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, Save, Download } from 'lucide-react'
import { listQuotes, updateQuote, markQuoteRead, getAllLocations } from '../../services/api'
import { generateQuotation } from '../../utils/generateQuotation'

interface Quote {
  id: string
  customer_id: string
  customer_name: string
  villa_name?: string
  status: string
  notification_type?: string | null
  customer_notes?: string
  admin_notes?: string
  quoted_price?: number
  item_prices?: Array<{ option_id: string; location_id?: string; price: number }>
  requested_at: string
  updated_at?: string
  selection_snapshot?: any[]
}

/** Resolve a snapshot entry's display name. */
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
  item_prices: Record<number, string>   // flat snapshot index → price string
}

const STATUS_OPTIONS = ['pending', 'reviewed', 'quoted', 'accepted', 'rejected']

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

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

/** Build initial item_prices from saved item_prices or option price_inr values */
function buildInitialPrices(q: Quote): Record<number, string> {
  const prices: Record<number, string> = {}
  const snapshot = q.selection_snapshot || []
  if (q.item_prices && q.item_prices.length > 0) {
    // Use previously saved per-item prices
    q.item_prices.forEach((ip, i) => {
      prices[i] = ip.price != null ? String(ip.price) : ''
    })
  } else {
    // Pre-fill from option price_inr in snapshot
    snapshot.forEach((s: any, i: number) => {
      if (s.price_inr != null) prices[i] = String(s.price_inr)
    })
  }
  return prices
}

function computeTotal(snapshot: any[], item_prices: Record<number, string>): number | null {
  let total = 0
  let hasAny = false
  snapshot.forEach((_s, i) => {
    const v = item_prices[i]
    if (v !== undefined && v !== '') {
      const n = parseFloat(v)
      if (!isNaN(n)) { total += n; hasAny = true }
    }
  })
  return hasAny ? total : null
}

export default function AdminQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [locationMap, setLocationMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editStates, setEditStates] = useState<Record<string, EditState>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [qs, locs] = await Promise.all([listQuotes(), getAllLocations()])
      setQuotes(qs)
      const map: Record<string, string> = {}
      locs.forEach((l: any) => {
        const parts = [l.space, l.room_code].filter(Boolean)
        map[l.location_id] = parts.join(' — ')
      })
      setLocationMap(map)
    }
    catch { setError('Failed to load quotes.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const getEditState = (q: Quote): EditState =>
    editStates[q.id] ?? {
      status: q.status,
      admin_notes: q.admin_notes || '',
      item_prices: buildInitialPrices(q),
    }

  const setEditField = (id: string, field: 'status' | 'admin_notes', value: string) => {
    const q = quotes.find(q => q.id === id)!
    setEditStates(prev => ({ ...prev, [id]: { ...getEditState(q), [field]: value } }))
  }

  const setItemPrice = (id: string, idx: number, value: string) => {
    const q = quotes.find(q => q.id === id)!
    const cur = getEditState(q)
    setEditStates(prev => ({
      ...prev,
      [id]: { ...cur, item_prices: { ...cur.item_prices, [idx]: value } }
    }))
  }

  const handleToggle = async (id: string) => {
    const q = quotes.find(q => q.id === id)!
    if (expandedId !== id) {
      setEditStates(prev => ({
        ...prev,
        [id]: {
          status: q.status,
          admin_notes: q.admin_notes || '',
          item_prices: buildInitialPrices(q),
        }
      }))
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
    const q = quotes.find(q => q.id === id)!
    setSaving(id); setSaveError(prev => ({ ...prev, [id]: '' }))
    try {
      const snapshot = q.selection_snapshot || []
      const cleanItemPrices = snapshot
        .map((s: any, i: number) => ({
          option_id: s.option_id,
          location_id: s.location_id || null,
          price: parseFloat(es.item_prices[i] ?? ''),
          _i: i,
        }))
        .filter(ip => {
          const v = es.item_prices[ip._i]
          return v !== undefined && v !== '' && !isNaN(ip.price)
        })
        .map(({ option_id, location_id, price }) => ({ option_id, location_id, price }))

      const total = cleanItemPrices.reduce((sum, ip) => sum + ip.price, 0)
      const payload: any = { status: es.status }
      if (es.admin_notes.trim()) payload.admin_notes = es.admin_notes.trim()
      if (cleanItemPrices.length > 0) {
        payload.item_prices = cleanItemPrices
        payload.quoted_price = total
      }
      await updateQuote(id, payload)
      await load(); setExpandedId(null)
    } catch (err: any) {
      setSaveError(prev => ({ ...prev, [id]: err.response?.data?.detail || 'Failed to save.' }))
    } finally { setSaving(null) }
  }

  const handleDownload = (q: Quote, es: EditState) => {
    const snapshot = q.selection_snapshot || []
    let flatIdx = 0
    const items = snapshot.map((s: any) => {
      const i = flatIdx++
      const priceVal = es.item_prices[i] !== undefined ? es.item_prices[i] : (s.price_inr != null ? String(s.price_inr) : '')
      const price = priceVal !== '' ? parseFloat(priceVal) : null
      return {
        category:   s.category_name ?? s.category_id ?? 'Other',
        optionName: s.option_name ?? s.option_id ?? '',
        room:       s.room_label ?? (s.location_id ? locationMap[s.location_id] : '') ?? '',
        type:       s.selection_type ?? 'standard',
        price:      price !== null && !isNaN(price) ? price : null,
      }
    })
    const total = computeTotal(snapshot, es.item_prices)
    generateQuotation({
      customerName: q.customer_name,
      villaName:    q.villa_name || '',
      status:       q.status,
      requestedAt:  q.requested_at,
      items,
      total,
    })
  }

  const fmtDate = (d?: string) => {
    if (!d) return '—'
    const utc = d.endsWith('Z') || d.includes('+') ? d : d + 'Z'
    return new Date(utc).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
  }

  const fmtPrice = (p?: number) => p != null ? fmtINR(p) : '—'

  const newQuotes     = quotes.filter(q => q.notification_type === 'new')
  const updatedQuotes = quotes.filter(q => q.notification_type === 'updated')
  const seenQuotes    = quotes.filter(q => !q.notification_type)

  const renderRow = (q: Quote) => {
    const isOpen = expandedId === q.id
    const es = getEditState(q)
    const snapshotCount = Array.isArray(q.selection_snapshot) ? q.selection_snapshot.length : 0
    const snapshot = q.selection_snapshot || []

    // Build groups with flat indices
    const groups: Record<string, { item: any; idx: number }[]> = {}
    let flatIdx = 0
    snapshot.forEach((s: any) => {
      const key = s.category_name ?? s.category_id ?? 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push({ item: s, idx: flatIdx++ })
    })

    const total = computeTotal(snapshot, es.item_prices)

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
                <div className="quote-expand-inner quote-expand-inner--wide">

                  {/* Selections snapshot with per-item prices */}
                  {snapshot.length > 0 && (
                    <div className="quote-snapshot">
                      <div className="quote-snapshot-header-row">
                        <p className="quote-snapshot-title" style={{ margin: 0 }}>Customer Selections</p>
                        <div className="quote-snapshot-col-labels">
                          <span>Type</span>
                          <span>Price (INR)</span>
                        </div>
                      </div>

                      {Object.entries(groups).map(([cat, entries]) => (
                        <div key={cat} className="quote-snapshot-group">
                          <p className="quote-snapshot-cat">{cat}</p>
                          {entries.map(({ item: s, idx: i }) => {
                            const room = s.room_label || (s.location_id ? locationMap[s.location_id] : null)
                            const priceVal = es.item_prices[i] !== undefined
                              ? es.item_prices[i]
                              : (s.price_inr != null ? String(s.price_inr) : '')
                            return (
                              <div key={i} className="quote-snapshot-row">
                                <div className="quote-snapshot-name-block">
                                  <span className="quote-snapshot-name">{resolveSnapshotName(s)}</span>
                                  {room && <span className="quote-snapshot-room">{room}</span>}
                                </div>
                                <span className={`quote-snapshot-type ${s.selection_type}`}>
                                  {s.selection_type === 'upgrade' ? 'Upgrade' : 'Standard'}
                                </span>
                                <div className="quote-item-price-wrap">
                                  <span className="quote-item-price-sym">₹</span>
                                  <input
                                    type="number"
                                    className="quote-item-price-input"
                                    placeholder="Enter price"
                                    value={priceVal}
                                    onChange={e => setItemPrice(q.id, i, e.target.value)}
                                    min={0}
                                    step={1000}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))}

                      {/* Running total */}
                      <div className="quote-total-row">
                        <span className="quote-total-label">Total</span>
                        <span className="quote-total-value">
                          {total != null ? fmtINR(total) : <span style={{ color: '#bbb' }}>—</span>}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Customer notes */}
                  {q.customer_notes && (
                    <div className="quote-customer-notes">
                      <p className="quote-snapshot-title">Customer Notes</p>
                      <p className="quote-customer-notes-body">{q.customer_notes}</p>
                    </div>
                  )}

                  {/* Admin fields */}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                    <div className="admin-form-field" style={{ flex: '0 0 180px' }}>
                      <label>Status</label>
                      <select value={es.status} onChange={e => setEditField(q.id, 'status', e.target.value)}>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>



                  {saveError[q.id] && <div className="admin-error" style={{ margin: 0 }}>{saveError[q.id]}</div>}

                  <div className="quote-expand-actions">
                    <button className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => handleSave(q.id)} disabled={saving === q.id}>
                      <Save size={13} /> {saving === q.id ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button className="admin-btn admin-btn--download admin-btn--sm" onClick={() => handleDownload(q, es)} disabled={saving === q.id}>
                      <Download size={13} /> Download Quotation
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
          {newQuotes.length > 0 && (
            <div className="admin-table-wrap quote-section--new" style={{ marginBottom: 20 }}>
              <div className="admin-table-header">
                <span className="admin-table-title">🔴 New Requests</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{newQuotes.length} new</span>
              </div>
              <table className="admin-table">{tableHead}<tbody>{newQuotes.map(renderRow)}</tbody></table>
            </div>
          )}

          {updatedQuotes.length > 0 && (
            <div className="admin-table-wrap quote-section--updated" style={{ marginBottom: 20 }}>
              <div className="admin-table-header">
                <span className="admin-table-title">🟡 Updated Requests</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{updatedQuotes.length} updated</span>
              </div>
              <table className="admin-table">{tableHead}<tbody>{updatedQuotes.map(renderRow)}</tbody></table>
            </div>
          )}

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

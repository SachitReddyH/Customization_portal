import { useEffect, useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, Filter, Lock } from 'lucide-react'
import { listQuotes, getAllLocations } from '../../services/api'

interface Quote {
  id: string
  customer_id: string
  customer_name: string
  villa_name?: string
  status: string
  notification_type?: string | null
  customer_notes?: string
  quoted_price?: number
  item_prices?: Array<{ option_id: string; location_id?: string; price: number }>
  requested_at: string
  updated_at?: string
  selection_snapshot?: any[]
}

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

export default function CRMQuotes() {
  const [quotes, setQuotes]           = useState<Quote[]>([])
  const [locationMap, setLocationMap] = useState<Record<string, string>>({})
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy]           = useState<string>('date_desc')

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
    } catch { setError('Failed to load quotes.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const fmtDate = (d?: string) => {
    if (!d) return '—'
    const utc = d.endsWith('Z') || d.includes('+') ? d : d + 'Z'
    return new Date(utc).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    })
  }

  const fmtPrice = (p?: number) => p != null ? fmtINR(p) : '—'

  const filteredQuotes = (() => {
    let list = filterStatus === 'all' ? quotes : quotes.filter(q => q.status === filterStatus)
    list = [...list].sort((a, b) => {
      if (sortBy === 'price_asc')  return (a.quoted_price ?? -1) - (b.quoted_price ?? -1)
      if (sortBy === 'price_desc') return (b.quoted_price ?? -1) - (a.quoted_price ?? -1)
      if (sortBy === 'date_asc')   return new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime()
      return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    })
    return list
  })()

  const newQuotes     = filteredQuotes.filter(q => q.notification_type === 'new')
  const updatedQuotes = filteredQuotes.filter(q => q.notification_type === 'updated')
  const seenQuotes    = filteredQuotes.filter(q => !q.notification_type)

  const renderRow = (q: Quote) => {
    const isOpen = expandedId === q.id
    const snapshot = q.selection_snapshot || []
    const snapshotCount = snapshot.length
    const isFrozen = q.status === 'accepted'

    // Build category groups
    const groups: Record<string, { item: any; idx: number }[]> = {}
    let flatIdx = 0
    snapshot.forEach((s: any) => {
      const key = s.category_name ?? s.category_id ?? 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push({ item: s, idx: flatIdx++ })
    })

    // Build saved price map for displaying prices
    const savedPriceMap: Record<string, number> = {}
    if (q.item_prices) {
      q.item_prices.forEach(ip => {
        savedPriceMap[`${ip.option_id}__${ip.location_id ?? ''}`] = ip.price
      })
    }

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
              onClick={() => setExpandedId(prev => prev === q.id ? null : q.id)}
            >
              {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              View
            </button>
          </td>
        </tr>

        {isOpen && (
          <tr key={`${q.id}-expand`}>
            <td colSpan={7} style={{ padding: 0 }}>
              <div className="quote-expand-panel">
                <div className="quote-expand-inner quote-expand-inner--wide">

                  {/* Frozen banner */}
                  {isFrozen && (
                    <div className="quote-frozen-banner">
                      <Lock size={14} />
                      <span>This quote has been <strong>accepted and frozen</strong> by the customer.</span>
                    </div>
                  )}

                  {/* Selection snapshot — read-only */}
                  {snapshot.length > 0 && (
                    <div className="quote-snapshot">
                      <div className="quote-snapshot-header-row">
                        <p className="quote-snapshot-title" style={{ margin: 0 }}>Customer Selections</p>
                        <div className="quote-snapshot-col-labels">
                          <span>Price (INR)</span>
                        </div>
                      </div>

                      {Object.entries(groups).map(([cat, entries]) => (
                        <div key={cat} className="quote-snapshot-group">
                          <p className="quote-snapshot-cat">{cat}</p>
                          {entries.map(({ item: s, idx: i }) => {
                            const room = s.room_label || (s.location_id ? locationMap[s.location_id] : null)
                            const savedPrice = savedPriceMap[`${s.option_id}__${s.location_id ?? ''}`]
                            const displayPrice = savedPrice ?? (s.price_inr ?? null)
                            return (
                              <div key={i} className="quote-snapshot-row">
                                <div className="quote-snapshot-name-block">
                                  <span className="quote-snapshot-name">{resolveSnapshotName(s)}</span>
                                  {room && <span className="quote-snapshot-room">{room}</span>}
                                </div>
                                <div className="quote-item-price-wrap quote-item-price-wrap--frozen">
                                  <span className="quote-item-price-sym">₹</span>
                                  <span className="quote-item-price-frozen">
                                    {displayPrice != null
                                      ? displayPrice.toLocaleString('en-IN')
                                      : <span style={{ color: '#bbb' }}>—</span>
                                    }
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))}

                      {/* Total */}
                      <div className="quote-total-row">
                        <span className="quote-total-label">Total</span>
                        <span className="quote-total-value">
                          {q.quoted_price != null
                            ? fmtINR(q.quoted_price)
                            : <span style={{ color: '#bbb' }}>—</span>
                          }
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

                  <div className="quote-expand-actions">
                    <button
                      className="admin-btn admin-btn--ghost admin-btn--sm"
                      onClick={() => setExpandedId(null)}
                    >
                      Close
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
        <th>Selections</th><th>Quoted Price</th><th>Date</th><th></th>
      </tr>
    </thead>
  )

  return (
    <div>
      {/* Filter bar */}
      {!loading && !error && quotes.length > 0 && (
        <div className="quotes-filter-bar">
          <div className="quotes-filter-group">
            <Filter size={13} className="quotes-filter-icon" />
            <label className="quotes-filter-label">Status</label>
            <select className="quotes-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="quoted">Quoted</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="quotes-filter-group">
            <label className="quotes-filter-label">Sort by</label>
            <select className="quotes-filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date_desc">Date — Newest first</option>
              <option value="date_asc">Date — Oldest first</option>
              <option value="price_desc">Price — High to Low</option>
              <option value="price_asc">Price — Low to High</option>
            </select>
          </div>
          {(filterStatus !== 'all' || sortBy !== 'date_desc') && (
            <button className="quotes-filter-clear" onClick={() => { setFilterStatus('all'); setSortBy('date_desc') }}>
              Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="admin-loading">Loading quotes…</div>
      ) : error ? (
        <div className="admin-error" style={{ margin: 16 }}>{error}</div>
      ) : quotes.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-table-empty">No quote requests yet.</div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-table-empty">No quotes match the selected filter.</div>
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

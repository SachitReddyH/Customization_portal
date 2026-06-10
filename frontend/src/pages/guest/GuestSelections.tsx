import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { listCustomers, getCustomerSelections, listAllVillas, getCategories } from '../../services/api'

interface Customer {
  id: string
  full_name: string
  email: string
  villa_id?: string
}

interface Villa {
  id: string
  villa_number: string
  villa_type?: string
  facing?: string
  block?: string
}

interface Selection {
  option_id: string
  option_name?: string
  category_id: string
  location_id?: string
  room_label?: string
  selection_type: 'standard' | 'upgrade'
  [key: string]: unknown
}

interface Category {
  category_id: string
  name: string
}

function formatVilla(v: Villa): string {
  const parts = [v.villa_number]
  if (v.villa_type) parts.push(v.villa_type)
  if (v.facing)     parts.push(v.facing)
  if (v.block)      parts.push(`Blk ${v.block}`)
  return parts.join(' – ')
}

const ORANGE = '#F05E3E'

export default function GuestSelections() {
  const [customers, setCustomers]             = useState<Customer[]>([])
  const [villas, setVillas]                   = useState<Villa[]>([])
  const [categories, setCategories]           = useState<Category[]>([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState('')
  const [expandedId, setExpandedId]           = useState<string | null>(null)
  const [selectionsCache, setSelectionsCache] = useState<Record<string, any>>({})
  const [loadingId, setLoadingId]             = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('')
      try {
        const [c, v, cats] = await Promise.all([listCustomers(), listAllVillas(), getCategories()])
        setCustomers(c)
        setVillas(v)
        setCategories(cats)
      } catch {
        setError('Failed to load data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const catMap: Record<string, string> = {}
  for (const cat of categories) {
    catMap[cat.category_id] = cat.name
  }

  const getVilla = (id?: string) => id ? villas.find(v => v.id === id) : undefined

  const handleToggle = async (customer: Customer) => {
    if (expandedId === customer.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(customer.id)
    if (!selectionsCache[customer.id]) {
      setLoadingId(customer.id)
      try {
        const data = await getCustomerSelections(customer.id)
        setSelectionsCache(prev => ({ ...prev, [customer.id]: data }))
      } catch {
        setSelectionsCache(prev => ({ ...prev, [customer.id]: { error: true } }))
      } finally {
        setLoadingId(null)
      }
    }
  }

  const groupByCategory = (selections: Selection[]): Record<string, Selection[]> => {
    const groups: Record<string, Selection[]> = {}
    for (const sel of selections) {
      const key = sel.category_id || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(sel)
    }
    return groups
  }

  return (
    <div>
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <span className="admin-table-title">Customer Selections</span>
        </div>

        {loading ? (
          <div className="admin-loading">Loading…</div>
        ) : error ? (
          <div className="admin-error" style={{ margin: 16 }}>{error}</div>
        ) : customers.length === 0 ? (
          <div className="admin-table-empty">No customers found.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Name</th>
                <th style={{ width: '45%' }}>Villa</th>
                <th style={{ width: '25%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const villa     = getVilla(c.villa_id)
                const isOpen    = expandedId === c.id
                const isLoading = loadingId === c.id
                const cached    = selectionsCache[c.id]
                const selections: Selection[] = cached?.selections ?? []
                const grouped   = groupByCategory(selections)

                return [
                  <tr key={c.id} style={{ background: isOpen ? '#fef9f7' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {villa ? formatVilla(villa) : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => handleToggle(c)}
                        disabled={isLoading}
                      >
                        {isLoading
                          ? 'Loading…'
                          : isOpen
                            ? <><ChevronDown size={13} /> Hide</>
                            : <><ChevronRight size={13} /> View Selections</>
                        }
                      </button>
                    </td>
                  </tr>,

                  isOpen && (
                    <tr key={`${c.id}-detail`}>
                      <td colSpan={3} style={{
                        padding: '0 0 4px 0',
                        background: '#fafaf8',
                        borderBottom: '2px solid #e8e4df',
                      }}>
                        {cached?.error ? (
                          <div style={{ padding: '16px 20px', color: '#c0392b', fontSize: 13 }}>
                            Failed to load selections.
                          </div>
                        ) : selections.length === 0 ? (
                          <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                            No selections yet.
                          </div>
                        ) : (
                          /* Single unified table for all categories */
                          <div style={{ padding: '12px 20px 4px 20px' }}>
                            <div style={{
                              border: '1px solid #e0dbd4',
                              borderTop: `3px solid ${ORANGE}`,
                              borderRadius: '0 0 8px 8px',
                              overflow: 'hidden',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            }}>
                              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                <colgroup>
                                  <col style={{ width: '70%' }} />
                                  <col style={{ width: '30%' }} />
                                </colgroup>
                                {/* Column headers — shown once at top */}
                                <thead>
                                  <tr style={{ background: '#f7f4f0' }}>
                                    {(['OPTION', 'ROOM'] as const).map(label => (
                                      <th key={label} style={{
                                        padding: '8px 14px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#888',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        textAlign: 'left',
                                        borderBottom: '1px solid #e0dbd4',
                                        whiteSpace: 'nowrap',
                                      }}>
                                        {label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(grouped).map(([catId, items], gIdx) => (
                                    <>
                                      {/* Category section header */}
                                      <tr
                                        key={`cat-${catId}`}
                                        style={{
                                          background: gIdx % 2 === 0 ? '#f2efea' : '#ede9e3',
                                          borderTop: gIdx === 0 ? 'none' : '2px solid #e0dbd4',
                                        }}
                                      >
                                        <td
                                          colSpan={2}
                                          style={{
                                            padding: '7px 14px',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            color: '#444',
                                            letterSpacing: '0.02em',
                                          }}
                                        >
                                          {catMap[catId] ?? catId}
                                        </td>
                                      </tr>

                                      {/* Items under this category */}
                                      {items.map((sel, idx) => (
                                        <tr
                                          key={`${catId}-${idx}`}
                                          style={{
                                            background: idx % 2 === 0 ? '#fff' : '#faf8f6',
                                            borderBottom: '1px solid #ece9e4',
                                          }}
                                        >
                                          <td style={{
                                            padding: '9px 14px',
                                            fontSize: 13,
                                            fontWeight: 500,
                                            color: '#1a1a1a',
                                          }}>
                                            {sel.option_name || sel.option_id}
                                          </td>
                                          <td style={{
                                            padding: '9px 14px',
                                            fontSize: 13,
                                            color: sel.room_label ? '#555' : '#bbb',
                                          }}>
                                            {sel.room_label || '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ),
                ].filter(Boolean)
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

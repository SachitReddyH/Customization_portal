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
  category_id: string
  location_id?: string
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

export default function GuestSelections() {
  const [customers, setCustomers]         = useState<Customer[]>([])
  const [villas, setVillas]               = useState<Villa[]>([])
  const [categories, setCategories]       = useState<Category[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [selectionsCache, setSelectionsCache] = useState<Record<string, any>>({})
  const [loadingId, setLoadingId]         = useState<string | null>(null)

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
                <th>Name</th>
                <th>Villa</th>
                <th>Actions</th>
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
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
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
                      <td colSpan={3} style={{ padding: '12px 20px', background: '#fafaf9' }}>
                        {cached?.error ? (
                          <div style={{ color: '#c0392b', fontSize: 13 }}>Failed to load selections.</div>
                        ) : selections.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No selections yet.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {Object.entries(grouped).map(([catId, items]) => (
                              <div key={catId}>
                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#333' }}>
                                  {catMap[catId] ?? catId}
                                </div>
                                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #eee' }}>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Option ID</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Location</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((sel, idx) => (
                                      <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '4px 8px' }}>{sel.option_id}</td>
                                        <td style={{ padding: '4px 8px' }}>
                                          <span style={{
                                            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                                            background: sel.selection_type === 'upgrade' ? '#fff7ed' : '#f3f4f6',
                                            color:      sel.selection_type === 'upgrade' ? '#c2410c'  : '#374151',
                                            border:     sel.selection_type === 'upgrade' ? '1px solid #fed7aa' : '1px solid #e5e7eb',
                                          }}>
                                            {sel.selection_type}
                                          </span>
                                        </td>
                                        <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>
                                          {sel.location_id || '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))}
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

import { useEffect, useState } from 'react'
import { getCostBreakdown } from '../../services/api'

interface BreakdownItem {
  option_id: string
  option_name: string
  unit_price: number
  count: number
  total_cost: number
  villas_opted: number
}

interface CategoryBreakdown {
  category_id: string
  category_name: string
  total_cost: number
  percentage: number
  villas_opted: number
  items: BreakdownItem[]
}

interface BreakdownData {
  categories: CategoryBreakdown[]
  grand_total: number
  total_villas: number
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

const ORANGE = '#F05E3E'

const th: React.CSSProperties = {
  background: ORANGE,
  color: '#fff',
  padding: '10px 16px',
  fontWeight: 700,
  fontSize: 13,
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const thC: React.CSSProperties = { ...th, textAlign: 'center' }

export default function CostBreakdown() {
  const [data, setData]       = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    getCostBreakdown()
      .then((d: BreakdownData) => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load cost breakdown.'); setLoading(false) })
  }, [])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (loading) return <div className="admin-table-wrap"><div className="admin-loading">Loading cost breakdown…</div></div>
  if (error || !data) return <div className="admin-table-wrap"><div className="admin-error" style={{ margin: 16 }}>{error || 'No data.'}</div></div>

  return (
    <div className="admin-table-wrap">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>

          {/* Column widths */}
          <colgroup>
            <col style={{ width: '36%' }} />   {/* Name */}
            <col style={{ width: '16%' }} />   {/* Phase 1 Cost / Unit Price */}
            <col style={{ width: '12%' }} />   {/* % of Total / Count */}
            <col style={{ width: '18%' }} />   {/* — / Total Cost */}
            <col style={{ width: '12%' }} />   {/* Villas Opted */}
          </colgroup>

          <thead>
            {/* Title */}
            <tr>
              <th colSpan={5} style={{
                background: ORANGE, color: '#fff',
                fontWeight: 700, fontSize: 15,
                textAlign: 'center', padding: '12px 16px',
                letterSpacing: '0.05em',
              }}>
                CATEGORY-WISE COST BREAKDOWN
              </th>
            </tr>
            {/* Column headers */}
            <tr>
              <th style={th}>Category</th>
              <th style={thR}>Phase 1 Cost (₹)</th>
              <th style={thC}>% of Total</th>
              <th style={thR}>—</th>
              <th style={thC}>Villas Opted</th>
            </tr>
          </thead>

          <tbody>
            {data.categories.map((cat, idx) => {
              const isExpanded = expanded.has(cat.category_id)
              const rowBg      = idx % 2 === 0 ? '#fff' : '#fafaf8'
              const catTd: React.CSSProperties = {
                padding: '11px 16px',
                fontSize: 13,
                borderBottom: isExpanded ? 'none' : '1px solid #ece9e4',
                verticalAlign: 'middle',
                background: rowBg,
              }

              return (
                <>
                  {/* ── Category row ── */}
                  <tr
                    key={cat.category_id}
                    onClick={() => toggle(cat.category_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ ...catTd, fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 4,
                          background: isExpanded ? ORANGE : '#ece9e4',
                          color: isExpanded ? '#fff' : '#888',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, flexShrink: 0, transition: 'all 0.15s',
                        }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        {cat.category_name}
                      </span>
                    </td>
                    <td style={{ ...catTd, textAlign: 'right', fontWeight: 600 }}>{inr(cat.total_cost)}</td>
                    <td style={{ ...catTd, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        background: '#fff3ef', color: ORANGE,
                        borderRadius: 12, fontSize: 12, fontWeight: 600,
                        border: `1px solid #fdd0c4`,
                      }}>
                        {cat.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ ...catTd, textAlign: 'right', color: '#bbb' }}>—</td>
                    <td style={{ ...catTd, textAlign: 'center', fontWeight: 600 }}>{cat.villas_opted}</td>
                  </tr>

                  {/* ── Drill-down rows ── */}
                  {isExpanded && (
                    <>
                      {/* Sub-header */}
                      <tr key={`${cat.category_id}-subhead`}>
                        <td style={{
                          padding: '7px 16px 7px 44px',
                          background: '#f0ede9', fontWeight: 700,
                          fontSize: 11, color: '#666', textTransform: 'uppercase',
                          letterSpacing: '0.05em', borderBottom: '1px solid #e0dbd4',
                        }}>
                          Option / Package
                        </td>
                        <td style={{
                          padding: '7px 16px', background: '#f0ede9', fontWeight: 700,
                          fontSize: 11, color: '#666', textAlign: 'right',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          borderBottom: '1px solid #e0dbd4', whiteSpace: 'nowrap',
                        }}>
                          Unit Price (₹)
                        </td>
                        <td style={{
                          padding: '7px 16px', background: '#f0ede9', fontWeight: 700,
                          fontSize: 11, color: '#666', textAlign: 'center',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          borderBottom: '1px solid #e0dbd4',
                        }}>
                          Count
                        </td>
                        <td style={{
                          padding: '7px 16px', background: '#f0ede9', fontWeight: 700,
                          fontSize: 11, color: '#666', textAlign: 'right',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          borderBottom: '1px solid #e0dbd4', whiteSpace: 'nowrap',
                        }}>
                          Total Cost (₹)
                        </td>
                        <td style={{
                          padding: '7px 16px', background: '#f0ede9', fontWeight: 700,
                          fontSize: 11, color: '#666', textAlign: 'center',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          borderBottom: '1px solid #e0dbd4', whiteSpace: 'nowrap',
                        }}>
                          Villas Opted
                        </td>
                      </tr>

                      {/* Items */}
                      {cat.items.map((item, iIdx) => {
                        const itemBg = iIdx % 2 === 0 ? '#faf8f5' : '#fff'
                        const isLast = iIdx === cat.items.length - 1
                        const itemTd: React.CSSProperties = {
                          padding: '9px 16px',
                          fontSize: 13, color: '#2a2a2a',
                          borderBottom: isLast ? '2px solid #e0dbd4' : '1px solid #ece9e4',
                          background: itemBg, verticalAlign: 'middle',
                        }
                        return (
                          <tr key={item.option_id}>
                            <td style={{ ...itemTd, paddingLeft: 44, fontWeight: 500 }}>
                              {item.option_name}
                            </td>
                            <td style={{ ...itemTd, textAlign: 'right', color: '#555' }}>
                              {item.unit_price === 0
                                ? <span style={{ color: '#ccc' }}>—</span>
                                : inr(item.unit_price)}
                            </td>
                            <td style={{ ...itemTd, textAlign: 'center', fontWeight: 700, color: ORANGE }}>
                              {item.count}
                            </td>
                            <td style={{ ...itemTd, textAlign: 'right', fontWeight: 700, color: '#1a1a1a' }}>
                              {item.total_cost === 0
                                ? <span style={{ color: '#ccc' }}>—</span>
                                : inr(item.total_cost)}
                            </td>
                            <td style={{ ...itemTd, textAlign: 'center', color: '#555' }}>
                              {item.villas_opted}
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  )}
                </>
              )
            })}

            {/* Grand Total */}
            <tr>
              <td style={{
                padding: '13px 16px', background: ORANGE,
                color: '#fff', fontWeight: 700, fontSize: 14,
              }}>
                Grand Total
              </td>
              <td style={{
                padding: '13px 16px', background: ORANGE,
                color: '#fff', fontWeight: 700, fontSize: 14, textAlign: 'right',
              }}>
                {inr(data.grand_total)}
              </td>
              <td style={{
                padding: '13px 16px', background: ORANGE,
                color: '#fff', fontWeight: 700, fontSize: 14, textAlign: 'center',
              }}>
                100%
              </td>
              <td style={{ background: ORANGE }} />
              <td style={{
                padding: '13px 16px', background: ORANGE,
                color: '#fff', fontWeight: 700, fontSize: 14, textAlign: 'center',
              }}>
                {data.total_villas}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

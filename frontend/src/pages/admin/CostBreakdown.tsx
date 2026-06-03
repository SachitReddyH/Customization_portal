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

export default function CostBreakdown() {
  const [data, setData] = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    getCostBreakdown()
      .then((d: BreakdownData) => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load cost breakdown.'); setLoading(false) })
  }, [])

  const toggleRow = (catId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="admin-table-wrap">
        <div className="admin-table-header">Cost Breakdown</div>
        <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>Loading…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="admin-table-wrap">
        <div className="admin-table-header">Cost Breakdown</div>
        <div style={{ padding: 32, textAlign: 'center', color: '#c00' }}>{error || 'No data.'}</div>
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    background: ORANGE,
    color: '#fff',
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 13,
    textAlign: 'left',
    borderBottom: `1px solid rgba(255,255,255,0.2)`,
  }

  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: 13,
    borderBottom: '1px solid #e8e7e5',
    verticalAlign: 'middle',
  }

  const drillThStyle: React.CSSProperties = {
    background: '#f0ede9',
    color: '#666',
    padding: '7px 14px',
    fontWeight: 700,
    fontSize: 11,
    textAlign: 'left',
    borderBottom: '2px solid #e0ddd8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  const drillTdStyle: React.CSSProperties = {
    padding: '9px 14px',
    fontSize: 13,
    color: '#2a2a2a',
    borderBottom: '1px solid #e8e5e1',
    verticalAlign: 'middle',
    background: '#fff',
  }

  return (
    <div className="admin-table-wrap">
      <div className="admin-table-header">Cost Breakdown</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            {/* Big title row */}
            <tr>
              <th
                colSpan={4}
                style={{
                  background: ORANGE,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  textAlign: 'center',
                  padding: '10px 12px',
                  borderBottom: `1px solid rgba(255,255,255,0.3)`,
                }}
              >
                CATEGORY-WISE COST BREAKDOWN
              </th>
            </tr>
            {/* Column headers */}
            <tr>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Phase 1 Cost (₹)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>% of Total</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Villas Opted</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((cat, idx) => {
              const isExpanded = expanded.has(cat.category_id)
              const rowBg = idx % 2 === 0 ? '#fff' : '#fafaf9'
              return (
                <>
                  <tr
                    key={cat.category_id}
                    onClick={() => toggleRow(cat.category_id)}
                    style={{ cursor: 'pointer', background: rowBg }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      <span style={{ marginRight: 6, fontSize: 10, color: '#888' }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      {cat.category_name}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{inr(cat.total_cost)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{cat.percentage.toFixed(1)}%</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{cat.villas_opted}</td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${cat.category_id}-drill`}>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <div style={{
                          margin: '0 0 4px 0',
                          borderLeft: `4px solid ${ORANGE}`,
                          background: '#faf9f7',
                        }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                              <tr>
                                <th style={{ ...drillThStyle, paddingLeft: 28 }}>Option / Package</th>
                                <th style={{ ...drillThStyle, textAlign: 'right' }}>Unit Price (₹)</th>
                                <th style={{ ...drillThStyle, textAlign: 'center' }}>Count</th>
                                <th style={{ ...drillThStyle, textAlign: 'right' }}>Total Cost (₹)</th>
                                <th style={{ ...drillThStyle, textAlign: 'center' }}>Villas Opted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cat.items.map((item, iIdx) => (
                                <tr
                                  key={item.option_id}
                                  style={{ background: iIdx % 2 === 0 ? '#fff' : '#faf8f6' }}
                                >
                                  <td style={{ ...drillTdStyle, paddingLeft: 28, fontWeight: 500 }}>
                                    {item.option_name}
                                  </td>
                                  <td style={{ ...drillTdStyle, textAlign: 'right', color: '#444' }}>
                                    {item.unit_price === 0 ? <span style={{ color: '#bbb' }}>—</span> : inr(item.unit_price)}
                                  </td>
                                  <td style={{ ...drillTdStyle, textAlign: 'center', fontWeight: 600, color: '#F05E3E' }}>
                                    {item.count}
                                  </td>
                                  <td style={{ ...drillTdStyle, textAlign: 'right', fontWeight: 600, color: '#1a1a1a' }}>
                                    {item.total_cost === 0 ? <span style={{ color: '#bbb' }}>—</span> : inr(item.total_cost)}
                                  </td>
                                  <td style={{ ...drillTdStyle, textAlign: 'center', color: '#555' }}>
                                    {item.villas_opted}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {/* Grand Total row */}
            <tr style={{ background: ORANGE }}>
              <td style={{ ...tdStyle, fontWeight: 700, color: '#fff', borderBottom: 'none' }}>Grand Total</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff', borderBottom: 'none' }}>
                {inr(data.grand_total)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff', borderBottom: 'none' }}>
                100%
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff', borderBottom: 'none' }}>
                {data.total_villas}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

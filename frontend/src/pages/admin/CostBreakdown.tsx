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
    background: '#e8e7e5',
    color: '#555',
    padding: '5px 10px',
    fontWeight: 600,
    fontSize: 11,
    textAlign: 'left',
    borderBottom: '1px solid #d5d3d0',
  }

  const drillTdStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 12,
    borderBottom: '1px solid #ede',
    verticalAlign: 'middle',
    background: '#f5f4f2',
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
                      <td colSpan={4} style={{ padding: 0, background: '#f5f4f2' }}>
                        <div style={{ padding: '0 0 8px 32px' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                              <tr>
                                <th style={drillThStyle}>Option / Package</th>
                                <th style={{ ...drillThStyle, textAlign: 'right' }}>Unit Price (₹)</th>
                                <th style={{ ...drillThStyle, textAlign: 'right' }}>Count</th>
                                <th style={{ ...drillThStyle, textAlign: 'right' }}>Total Cost (₹)</th>
                                <th style={{ ...drillThStyle, textAlign: 'right' }}>Villas Opted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cat.items.map(item => (
                                <tr key={item.option_id}>
                                  <td style={drillTdStyle}>{item.option_name}</td>
                                  <td style={{ ...drillTdStyle, textAlign: 'right' }}>
                                    {item.unit_price === 0 ? '—' : inr(item.unit_price)}
                                  </td>
                                  <td style={{ ...drillTdStyle, textAlign: 'right' }}>{item.count}</td>
                                  <td style={{ ...drillTdStyle, textAlign: 'right' }}>
                                    {item.total_cost === 0 ? '—' : inr(item.total_cost)}
                                  </td>
                                  <td style={{ ...drillTdStyle, textAlign: 'right' }}>{item.villas_opted}</td>
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

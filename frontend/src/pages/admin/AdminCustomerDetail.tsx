import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  getCustomerSelections,
  getCategories,
  listAllVillas,
  getAllLocations,
} from '../../services/api'
import api from '../../services/api'

interface Customer {
  id: string
  email: string
  full_name: string
  phone?: string
  villa_id?: string
}

interface Selection {
  category_id: string
  option_id: string
  location_id?: string
  selection_type: string
  sub_section?: string
  selected_at: string
}

interface SelectionsResponse {
  customer: Customer
  selections: Selection[]
  status: string
}

interface Category {
  id: string
  category_id: string
  name: string
}

interface Option {
  id: string
  option_id: string
  option_name?: string
  space?: string
  category_id: string
}

interface Villa {
  id: string
  villa_number: string
  villa_name?: string
  villa_type?: string
  facing?: string
  block?: string
}

export default function AdminCustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<SelectionsResponse | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [optionsMap, setOptionsMap] = useState<Record<string, Option[]>>({})
  const [locationNames, setLocationNames] = useState<Record<string, string>>({})
  const [villas, setVillas] = useState<Villa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!customerId) return

    const fetchAll = async () => {
      setLoading(true)
      setError('')
      try {
        const [selResp, cats, vs, locs] = await Promise.all([
          getCustomerSelections(customerId),
          getCategories(),
          listAllVillas(),
          getAllLocations(),
        ])
        setData(selResp)
        setCategories(cats)
        setVillas(vs)
        // Build location_id → display name map
        const locMap: Record<string, string> = {}
        locs.forEach((l: { location_id: string; floor?: string; space?: string }) => {
          if (l.location_id) {
            // Show "Space — Floor" e.g. "Toilet — Bedroom 1 — Ground Floor"
            locMap[l.location_id] = l.space
              ? (l.floor ? `${l.space} — ${l.floor}` : l.space)
              : l.location_id
          }
        })
        setLocationNames(locMap)

        // Fetch options for every category that appears in selections
        const catIds: string[] = Array.from(
          new Set((selResp.selections as Selection[]).map(s => s.category_id))
        )
        const optionResults = await Promise.all(
          catIds.map((cid: string) =>
            api.get(`/options/${cid}`).then(r => ({ cid, options: r.data as Option[] }))
          )
        )
        const map: Record<string, Option[]> = {}
        optionResults.forEach(({ cid, options }) => { map[cid] = options })
        setOptionsMap(map)
      } catch {
        setError('Failed to load customer selections.')
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [customerId])

  // category_id is like "CAT002", match against category_id field (not MongoDB _id)
  const getCategoryName = (categoryId: string) =>
    categories.find(c => c.category_id === categoryId)?.name || categoryId

  // option_id is like "OPT-FL-001", match against option_id field.
  // Also handles synthetic addon IDs like OPT-BP-001-ADN-BAT.
  const getOptionName = (categoryId: string, optionId: string) => {
    const opts = optionsMap[categoryId] || []
    const opt = opts.find(o => o.option_id === optionId)
    if (opt) return opt.option_name || opt.space || optionId

    // Synthetic addon: e.g. OPT-BP-001-ADN-BAT → "Bathtub — Happy D2"
    const adnMatch = optionId.match(/^(.+)-ADN-([A-Z]+)$/)
    if (adnMatch) {
      const [, parentId, code] = adnMatch
      const label = code === 'BAT' ? 'Bathtub' : code === 'JAC' ? 'Jacuzzi' : code
      const parent = opts.find(o => o.option_id === parentId)
      const series = parent
        ? ` — ${(parent.option_name ?? '').replace(/ series$/i, '').trim()}`
        : ''
      return `${label}${series}`
    }
    return optionId
  }

  const getVilla = (villaId?: string): Villa | undefined =>
    villaId ? villas.find(v => v.id === villaId) : undefined

  const formatVilla = (v: Villa) => {
    const parts = [v.villa_number]
    if (v.villa_type) parts.push(v.villa_type)
    if (v.facing) parts.push(v.facing)
    if (v.block) parts.push(`Blk ${v.block}`)
    return parts.join(' – ')
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

  if (loading) return <div className="admin-loading">Loading customer data…</div>
  if (error) return <div className="admin-error">{error}</div>
  if (!data) return null

  const { customer, selections, status } = data
  const villa = getVilla(customer.villa_id)

  // Group selections by category_id
  const grouped: Record<string, Selection[]> = {}
  selections.forEach(s => {
    if (!grouped[s.category_id]) grouped[s.category_id] = []
    grouped[s.category_id].push(s)
  })

  return (
    <div className="admin-customer-detail">
      {/* ── Header ── */}
      <div className="admin-customer-header">
        <button
          className="admin-btn admin-btn--ghost admin-btn--sm"
          onClick={() => navigate('/admin/customers')}
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <div className="admin-customer-header-info">
          <h2 className="admin-customer-name">{customer.full_name}</h2>
          <div className="admin-customer-meta">
            <span>{customer.email}</span>
            {customer.phone && <span>{customer.phone}</span>}
            {villa && <span>Villa: {formatVilla(villa)}</span>}
          </div>
        </div>

        <div>
          <span className={`badge badge--${status === 'submitted' ? 'submitted' : 'in_progress'}`}>
            {status === 'submitted' ? 'Submitted' : 'In Progress'}
          </span>
        </div>
      </div>

      {/* ── Selections ── */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-title">
            Customisation Selections
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {selections.length} item{selections.length !== 1 ? 's' : ''} selected
          </span>
        </div>

        {selections.length === 0 ? (
          <div className="admin-table-empty">No selections made yet.</div>
        ) : (
          Object.entries(grouped).map(([catId, items]) => (
            <div key={catId} className="admin-category-group">
              <div className="admin-category-group-title">
                {getCategoryName(catId)}
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Sub-section</th>
                    <th>Selected At</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((sel, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>
                        {getOptionName(catId, sel.option_id)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {sel.location_id ? (locationNames[sel.location_id] ?? sel.location_id) : '—'}
                      </td>
                      <td>
                        <span
                          className={`badge ${sel.selection_type === 'upgrade' ? 'badge--quoted' : 'badge--active'}`}
                        >
                          {sel.selection_type === 'upgrade' ? 'Upgrade' : 'Standard'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {sel.sub_section || '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {formatDate(sel.selected_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

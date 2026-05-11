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
        const locMap: Record<string, string> = {}
        locs.forEach((l: { location_id: string; floor?: string; space?: string }) => {
          if (l.location_id) {
            locMap[l.location_id] = l.space
              ? (l.floor ? `${l.space} — ${l.floor}` : l.space)
              : l.location_id
          }
        })
        setLocationNames(locMap)
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

  const getCategoryName = (categoryId: string) =>
    categories.find(c => c.category_id === categoryId)?.name || categoryId

  const getOptionName = (categoryId: string, optionId: string) => {
    const opts = optionsMap[categoryId] || []
    const opt = opts.find(o => o.option_id === optionId)
    if (opt) return opt.option_name || opt.space || optionId
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
    return parts.join(' – ')
  }

  const formatDate = (d: string) => {
    // MongoDB datetimes are UTC but may arrive without 'Z'; force UTC before converting to IST
    const utc = d.endsWith('Z') || d.includes('+') ? d : d + 'Z'
    return new Date(utc).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    })
  }

  if (loading) return <div className="admin-loading">Loading customer data…</div>
  if (error)   return <div className="admin-error">{error}</div>
  if (!data)   return null

  const { customer, selections, status } = data
  const villa = getVilla(customer.villa_id)

  const grouped: Record<string, Selection[]> = {}
  selections.forEach(s => {
    if (!grouped[s.category_id]) grouped[s.category_id] = []
    grouped[s.category_id].push(s)
  })

  return (
    <div className="acd-page">

      {/* ── Customer header card ── */}
      <div className="acd-header">
        <button className="acd-back-btn" onClick={() => navigate('/admin/customers')}>
          <ArrowLeft size={14} /> Back
        </button>

        <div className="acd-header-info">
          <h2 className="acd-name">{customer.full_name}</h2>
          <div className="acd-meta">
            <span>{customer.email}</span>
            {customer.phone && <><span className="acd-meta-sep">·</span><span>{customer.phone}</span></>}
            {villa && <><span className="acd-meta-sep">·</span><span>Villa {formatVilla(villa)}</span></>}
          </div>
        </div>

        <span className={`acd-status-badge ${status === 'submitted' ? 'acd-status-badge--submitted' : 'acd-status-badge--progress'}`}>
          {status === 'submitted' ? 'Submitted' : 'In Progress'}
        </span>
      </div>

      {/* ── Selections card ── */}
      <div className="acd-card">
        <div className="acd-card-header">
          <span className="acd-card-title">Customisation Selections</span>
          <span className="acd-card-count">{selections.length} item{selections.length !== 1 ? 's' : ''}</span>
        </div>

        {selections.length === 0 ? (
          <div className="acd-empty">No selections made yet.</div>
        ) : (
          <table className="acd-table">
            <thead>
              <tr>
                <th>Option</th>
                <th>Room / Location</th>
                <th>Selected At</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([catId, items]) => (
                <>
                  {/* Category divider row */}
                  <tr key={`cat-${catId}`} className="acd-cat-row">
                    <td colSpan={3}>{getCategoryName(catId)}</td>
                  </tr>
                  {items.map((sel, idx) => (
                    <tr key={idx} className="acd-item-row">
                      <td className="acd-td-option">
                        {getOptionName(catId, sel.option_id)}
                      </td>
                      <td className="acd-td-location">
                        {sel.location_id
                          ? (locationNames[sel.location_id] ?? sel.location_id)
                          : <span className="acd-dash">—</span>
                        }
                      </td>
                      <td className="acd-td-date">
                        {formatDate(sel.selected_at)}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}

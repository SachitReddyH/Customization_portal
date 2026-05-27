import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Home, CheckCircle, Clock, ClipboardList, Bell, Send
} from 'lucide-react'
import { getDashboard, listInterests } from '../../services/api'

interface DashboardData {
  total_villas: number
  pending_quotes: number
  quoted_quotes: number
  accepted_quotes: number
}

interface InterestItem {
  id: string
  customer_name: string
  customer_email: string
  villa_name: string | null
  category_name: string
  created_at: string
}

interface StatCardProps {
  icon: React.ReactNode
  iconClass: string
  value: number | string
  label: string
}

function StatCard({ icon, iconClass, value, label }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-card-icon ${iconClass}`}>{icon}</div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  )
}

export default function CRMDashboard() {
  const navigate = useNavigate()
  const [data, setData]           = useState<DashboardData | null>(null)
  const [interests, setInterests] = useState<InterestItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    Promise.all([getDashboard(), listInterests()])
      .then(([dash, ints]) => { setData(dash); setInterests(ints) })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="admin-loading">Loading dashboard…</div>
  if (error)   return <div className="admin-error">{error}</div>
  if (!data)   return null

  return (
    <div>
      {/* ── Stat cards ── */}
      <div className="admin-stats-row">
        <StatCard
          icon={<Home size={20} />}
          iconClass="stat-card-icon--green"
          value={data.total_villas}
          label="Total Villas"
        />
        <StatCard
          icon={<Clock size={20} />}
          iconClass="stat-card-icon--orange"
          value={data.pending_quotes}
          label="Pending Quotes"
        />
        <StatCard
          icon={<Send size={20} />}
          iconClass="stat-card-icon--blue"
          value={data.quoted_quotes}
          label="Quotes Sent"
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          iconClass="stat-card-icon--green"
          value={data.accepted_quotes}
          label="Accepted Quotes"
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="admin-quick-actions">
        <div className="admin-quick-actions-title">Quick Actions</div>
        <div className="admin-quick-actions-row">
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => navigate('/crm/customers')}
          >
            <Users size={15} />
            Add Customer
          </button>
          <button
            className="admin-btn admin-btn--ghost"
            onClick={() => navigate('/crm/quotes')}
          >
            <ClipboardList size={15} />
            View Quotes
          </button>
        </div>
      </div>

      {/* ── Category Interests ── */}
      {interests.length > 0 && (
        <div className="admin-interests-section">
          <div className="admin-section-title">
            <Bell size={15} />
            Customer Interests — Coming Soon Categories
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Villa</th>
                <th>Category</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {interests.map(i => (
                <tr key={i.id}>
                  <td>{i.customer_name}</td>
                  <td>{i.customer_email}</td>
                  <td>{i.villa_name ?? '—'}</td>
                  <td>{i.category_name}</td>
                  <td>{i.created_at ? new Date(i.created_at.endsWith('Z') || i.created_at.includes('+') ? i.created_at : i.created_at + 'Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

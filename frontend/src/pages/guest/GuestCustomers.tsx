import { useEffect, useState } from 'react'
import { listCustomers, listAllVillas } from '../../services/api'

interface Customer {
  id: string
  email: string
  full_name: string
  phone?: string
  villa_id?: string
  is_active: boolean
}

interface Villa {
  id: string
  villa_number: string
  villa_name?: string
  villa_type?: string
  facing?: string
  block?: string
}

function formatVilla(v: Villa): string {
  const parts = [v.villa_number]
  if (v.villa_type) parts.push(v.villa_type)
  if (v.facing)     parts.push(v.facing)
  if (v.block)      parts.push(`Blk ${v.block}`)
  return parts.join(' – ')
}

export default function GuestCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [villas, setVillas]       = useState<Villa[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('')
      try {
        const [c, v] = await Promise.all([listCustomers(), listAllVillas()])
        setCustomers(c); setVillas(v)
      } catch {
        setError('Failed to load customers.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const getVilla = (id?: string) => id ? villas.find(v => v.id === id) : undefined

  return (
    <div>
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <span className="admin-table-title">Customers</span>
        </div>

        {loading ? (
          <div className="admin-loading">Loading customers…</div>
        ) : error ? (
          <div className="admin-error" style={{ margin: 16 }}>{error}</div>
        ) : customers.length === 0 ? (
          <div className="admin-table-empty">No customers found.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Villa</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const villa = getVilla(c.villa_id)
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.email}</td>
                    <td>{c.phone || '—'}</td>
                    <td>
                      {villa
                        ? <span style={{ fontSize: 12 }}>{formatVilla(villa)}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                      }
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 4,
                        background: c.is_active ? '#e6f9ef' : '#fde8e8',
                        color: c.is_active ? '#1a7a47' : '#c0392b',
                      }}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

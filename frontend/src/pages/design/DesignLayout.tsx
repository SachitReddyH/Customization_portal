import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { FolderOpen, LogOut, LayoutGrid } from 'lucide-react'
import { listSpaceCustRequests } from '../../services/api'

export default function DesignLayout() {
  const navigate  = useNavigate()
  const userName  = sessionStorage.getItem('user_name') || 'Design Admin'

  // Badge: count of pending + negotiating space cust requests
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetchCount = () => {
      listSpaceCustRequests()
        .then((data: any[]) => {
          const count = data.filter(r => r.status === 'pending' || r.status === 'negotiating').length
          setPendingCount(count)
        })
        .catch(() => {})
    }
    fetchCount()
    const timer = setInterval(fetchCount, 30000) // re-check every 30s
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    sessionStorage.clear()
    navigate('/')
  }

  return (
    <div className="admin-shell">

      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-logo-section">
          <img src="/capstonelife-logo.svg" alt="Capstone Life" className="admin-logo-img" />
          <span className="admin-role-badge" style={{ background: '#7c3aed' }}>Design</span>
        </div>

        <nav className="admin-nav">
          <NavLink to="/design/drawing" className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}>
            <FolderOpen size={16} />
            Drawing Register
          </NavLink>

          <NavLink to="/design/space-cust" className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            style={{ position: 'relative' }}>
            <LayoutGrid size={16} />
            Space Customisations
            {pendingCount > 0 && (
              <span style={{
                marginLeft: 'auto',
                background: '#F05E3E',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 20,
                padding: '1px 7px',
                minWidth: 20,
                textAlign: 'center',
              }}>
                {pendingCount}
              </span>
            )}
          </NavLink>
        </nav>

        <div className="admin-logout">
          <button className="admin-logout-btn" onClick={handleLogout}>
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-main">
        <header className="admin-topbar">
          <span className="admin-topbar-title">Design Portal</span>
          <div className="admin-topbar-user">
            <span className="admin-topbar-role" style={{ color: '#7c3aed' }}>Design Admin</span>
            <span className="admin-topbar-name">{userName}</span>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>

    </div>
  )
}

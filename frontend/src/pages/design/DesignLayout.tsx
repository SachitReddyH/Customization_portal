import { Outlet, useNavigate } from 'react-router-dom'
import { FolderOpen, LogOut } from 'lucide-react'

export default function DesignLayout() {
  const navigate  = useNavigate()
  const userName  = sessionStorage.getItem('user_name') || 'Design Admin'

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
          <a
            href="/design/drawing"
            className="admin-nav-link active"
          >
            <FolderOpen size={16} />
            Drawing Register
          </a>
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
          <span className="admin-topbar-title">Drawing Register</span>
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

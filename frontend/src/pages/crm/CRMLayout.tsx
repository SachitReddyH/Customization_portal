import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Users, FileText, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/crm/customers',  label: 'Customers',      icon: Users,    end: false },
  { to: '/crm/quotes',     label: 'Quote Requests', icon: FileText, end: false },
]

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/crm/customers')) return 'Customers'
  if (pathname.startsWith('/crm/quotes'))    return 'Quote Requests'
  return 'CRM'
}

export default function CRMLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const userName  = sessionStorage.getItem('user_name') || 'CRM Admin'

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
          <span className="admin-role-badge" style={{ background: '#2563eb' }}>CRM</span>
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
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
          <span className="admin-topbar-title">
            {getPageTitle(location.pathname)}
          </span>
          <div className="admin-topbar-user">
            <span className="admin-topbar-role" style={{ color: '#2563eb' }}>CRM Admin</span>
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

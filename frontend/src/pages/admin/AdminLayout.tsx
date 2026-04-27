import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, LogOut } from 'lucide-react'
import './admin.css'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/customers', label: 'Customers', icon: Users, end: false },
  { to: '/admin/quotes', label: 'Quote Requests', icon: FileText, end: false },
]

function getPageTitle(pathname: string): string {
  if (pathname === '/admin') return 'Dashboard'
  if (pathname.startsWith('/admin/customers/') && pathname.length > '/admin/customers/'.length) {
    return 'Customer Detail'
  }
  if (pathname.startsWith('/admin/customers')) return 'Customers'
  if (pathname.startsWith('/admin/quotes')) return 'Quote Requests'
  return 'Admin'
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const userName = sessionStorage.getItem('user_name') || 'Admin'

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
          <span className="admin-role-badge">Admin</span>
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? ' active' : ''}`
              }
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
            <span className="admin-topbar-role">Admin</span>
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

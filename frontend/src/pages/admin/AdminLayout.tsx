import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, LogOut, Settings2, FolderOpen, LayoutGrid, UserCog } from 'lucide-react'
import { listQuotes, listSpaceCustRequests } from '../../services/api'
import './admin.css'

function getPageTitle(pathname: string): string {
  if (pathname === '/admin') return 'Dashboard'
  if (pathname.startsWith('/admin/customers/') && pathname.length > '/admin/customers/'.length) {
    return 'Customer Detail'
  }
  if (pathname.startsWith('/admin/customers')) return 'Customers'
  if (pathname.startsWith('/admin/quotes')) return 'Quote Requests'
  if (pathname.startsWith('/admin/options')) return 'Options Manager'
  if (pathname.startsWith('/admin/drawing')) return 'Drawing Register'
  if (pathname.startsWith('/admin/space-cust')) return 'Space Customisations'
  if (pathname.startsWith('/admin/staff')) return 'Staff Users'
  return 'Admin'
}

const BADGE_STYLE: React.CSSProperties = {
  marginLeft: 'auto',
  background: '#F05E3E',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 20,
  padding: '1px 7px',
  minWidth: 20,
  textAlign: 'center',
}

export default function AdminLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const userName  = sessionStorage.getItem('user_name') || 'Admin'

  const [quotesCount,    setQuotesCount]    = useState(0)
  const [spaceCustCount, setSpaceCustCount] = useState(0)

  useEffect(() => {
    const fetchCounts = () => {
      listQuotes()
        .then((data: any[]) => {
          setQuotesCount(data.filter((q: any) => q.status === 'pending').length)
        })
        .catch(() => {})

      listSpaceCustRequests()
        .then((data: any[]) => {
          setSpaceCustCount(data.filter((r: any) => r.status === 'pending' || r.status === 'negotiating').length)
        })
        .catch(() => {})
    }

    fetchCounts()
    const timer = setInterval(fetchCounts, 30000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    sessionStorage.clear()
    navigate('/')
  }

  const badges: Record<string, number> = {
    '/admin/quotes':     quotesCount,
    '/admin/space-cust': spaceCustCount,
  }

  const NAV_ITEMS = [
    { to: '/admin',             label: 'Dashboard',           icon: LayoutDashboard, end: true  },
    { to: '/admin/customers',   label: 'Customers',           icon: Users,           end: false },
    { to: '/admin/quotes',      label: 'Quote Requests',      icon: FileText,        end: false },
    { to: '/admin/options',     label: 'Options Manager',     icon: Settings2,       end: false },
    { to: '/admin/drawing',     label: 'Drawing Register',    icon: FolderOpen,      end: false },
    { to: '/admin/space-cust',  label: 'Space Customisations',icon: LayoutGrid,      end: false },
    { to: '/admin/staff',       label: 'Staff Users',         icon: UserCog,         end: false },
  ]

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
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
              style={{ position: 'relative' }}
            >
              <Icon size={16} />
              {label}
              {(badges[to] ?? 0) > 0 && (
                <span style={BADGE_STYLE}>{badges[to]}</span>
              )}
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

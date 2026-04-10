import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid, Layers, Bath, ArrowUpSquare,
  Leaf, Wifi, Wind, Tv2, LogOut,
} from 'lucide-react'

const CATEGORIES = [
  { id: 'CAT001', name: 'Space Customisations',    tagline: 'Spaces that adapt to you',                             icon: LayoutGrid    },
  { id: 'CAT002', name: 'Flooring Upgrades',        tagline: 'The elegance of timeless stone',                      icon: Layers        },
  { id: 'CAT003', name: 'Bathroom Upgrades',        tagline: 'Every bath, a private sanctuary',                     icon: Bath          },
  { id: 'CAT004', name: 'Lift Interior Refinement', tagline: 'Sophisticated detailing that elevates every journey', icon: ArrowUpSquare },
  { id: 'CAT005', name: 'Landscape Packages',       tagline: 'Nature woven into your villa',                        icon: Leaf          },
  { id: 'CAT006', name: 'Smart Home',               tagline: 'Intelligence that Inspires',                          icon: Wifi          },
  { id: 'CAT007', name: 'VRF Cooling System',       tagline: 'Effortless Comfort, Elevated Efficiency',             icon: Wind          },
  { id: 'CAT008', name: 'Home Theatre',             tagline: 'Cinema, Curated for You',                             icon: Tv2           },
]

const ROWS = [
  CATEGORIES.slice(0, 3),
  CATEGORIES.slice(3, 6),
  CATEGORIES.slice(6, 8),
]

export default function CustomisationHub() {
  const navigate = useNavigate()
  const location = useLocation()
  // If coming back from a category page, jump straight to cards
  const returnedFromCategory = (location.state as any)?.showCards === true
  const [expanded, setExpanded] = useState(returnedFromCategory)
  const [settled, setSettled] = useState(returnedFromCategory)

  const handleCustomise = () => {
    if (!expanded) {
      setExpanded(true)
      // Last card finishes at: 7 cards × 60ms stagger + 550ms slide duration
      setTimeout(() => setSettled(true), 7 * 60 + 600)
    }
  }

  const userName = localStorage.getItem('user_name') ?? ''

  const handleLogout = () => {
    localStorage.clear()
    navigate('/')
  }

  return (
    <div className="hub-page">
      {/* ── Background video — served from backend static so it works on Vercel ── */}
      <video
        className="hub-video"
        src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/static/villa_banner.mp4`}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* White frosted overlay */}
      <div className={`hub-video-overlay ${expanded ? 'active' : ''}`} />

      {/* ── Top-right: user + logout ── */}
      <div className={`hub-topbar ${expanded ? 'hub-topbar--dark' : ''}`}>
        <span className="hub-topbar-name">{userName}</span>
        <button className="hub-topbar-logout" onClick={handleLogout} title="Log out">
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>

      {/* ── Hero text + CTA — slides out upward on expand ── */}
      <div className={`hub-hero ${expanded ? 'exit' : ''}`}>
        <h1 className="hub-hero-heading">
          Your Vision.<br />Your Villa.
        </h1>
        <button className="hub-cta-btn" onClick={handleCustomise}>
          Begin Customising
        </button>
      </div>

      {/* ── Category cards — slide in from bottom ── */}
      <div className="categories-overlay">
        <div className="categories-grid">
          {ROWS.map((row, rowIdx) => (
            <div className="cards-row" key={rowIdx}>
              {row.map((cat, colIdx) => {
                const globalIdx = rowIdx * 3 + colIdx
                const Icon = cat.icon
                return (
                  <div
                    key={cat.id}
                    className={`card ${expanded ? 'visible' : ''}`}
                    style={{
                      transitionDelay: settled ? '0ms' : expanded ? `${globalIdx * 60}ms` : '0ms',
                    }}
                    onClick={() => navigate(`/category/${cat.id}`)}
                  >
                    <span className="card-icon">
                      <Icon size={26} strokeWidth={1.5} color="#F05E3E" />
                    </span>
                    <p className="card-name">{cat.name}</p>
                    <p className="card-tagline">{cat.tagline}</p>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid, Layers, Bath, ArrowUpSquare,
  Leaf, Wifi, Wind, Tv2, LogOut, Images, X, ChevronLeft, ChevronRight,
  ShoppingCart, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { getMyVilla, getMySelections, getAllLocations } from '../services/api'

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

/* ── Mock villa image gallery ─────────────────────── */
interface MockImage { file: string; label: string }
interface MockGroup { group: string; images: MockImage[] }

const MOCK_GALLERY: MockGroup[] = [
  {
    group: 'Ground Floor',
    images: [
      { file: 'Ground Floor- Drawing Room.jpg',              label: 'Drawing Room'                    },
      { file: 'Ground Floor- DiningLiving Room.jpg',          label: 'Dining & Living Room'             },
      { file: 'Ground Floor- DiningLiving.jpg',               label: 'Dining & Living Room — View 2'   },
      { file: 'Ground Floor- Kitchen.jpg',                    label: 'Kitchen'                         },
      { file: 'Ground Floor- Kitchen-11.jpg',                 label: 'Kitchen — View 2'                },
      { file: 'Ground Floor- Bedroom-1.jpg',                  label: 'Bedroom 1'                       },
      { file: 'Ground Floor- Bedroom-1- Toilet.jpg.jpeg',     label: 'Bedroom 1 — Toilet'              },
      { file: 'Ground Floor- Bedroom-1- Toilet View 2.jpg.jpeg', label: 'Bedroom 1 — Toilet View 2'   },
      { file: 'Ground Floor- Bedroom-1-a.jpg',                label: 'Villa Rear Side - Set Back Area' },
      { file: 'Ground Floor- Deck.jpg',                       label: 'Deck'                            },
      { file: 'Ground Floor- Carpark Side Deck.jpg',          label: 'Carpark Side Deck'               },
    ],
  },
  {
    group: 'First Floor',
    images: [
      { file: 'First Floor_ MBR -1.jpg',                           label: 'Master Bedroom'                },
      { file: 'First Floor_ MBR -2.jpg',                           label: 'Master Bedroom — View 2'       },
      { file: 'First Floor- Master Bedroom-Toilet.jpg.jpeg',        label: 'Master Bedroom — Toilet'       },
      { file: 'First Floor- Master Bedroom-Toilet View 2.jpg.jpeg', label: 'Master Bedroom — Toilet View 2'},
      { file: 'First Floor- Bedroom-2.jpg',                         label: 'Bedroom 2'                    },
      { file: 'First Floor- Bedroom 2-Toilet.jpg.jpeg',             label: 'Bedroom 2 — Toilet'           },
      { file: 'First Floor- Bedroom 2-Toilet View 2.jpg.jpeg',      label: 'Bedroom 2 — Toilet View 2'   },
      { file: 'First Floor- Bedroom-2 Balcony.jpg',                 label: 'Bedroom 2 — Balcony'          },
      { file: 'First Floor- Family Lounge.jpg',                     label: 'Family Lounge'                },
    ],
  },
  {
    group: 'Second Floor',
    images: [
      { file: 'Second Floor- Bedroom-3.jpg',                      label: 'Bedroom 3'                  },
      { file: 'Second Floor- Bedroom 3-Toilet.jpg.jpeg',          label: 'Bedroom 3 — Toilet'         },
      { file: 'Second Floor- Bedroom 3-Toilet- View 2.jpg.jpeg',  label: 'Bedroom 3 — Toilet View 2' },
      { file: 'Second Floor- Bedroom-3- Dresser.jpg',             label: 'Bedroom 3 — Dresser'        },
      { file: 'Second Floor- Home Theatre.jpg',                   label: 'Home Theatre'               },
      { file: 'Second Floor- Home Theatre-1.jpg',                 label: 'Home Theatre — View 2'      },
      { file: 'Second Floor- Semi Covered Terrace.jpg',           label: 'Semi Covered Terrace'       },
    ],
  },
  {
    group: 'Additional',
    images: [
      { file: 'Villa- Front Elevation.jpg.jpeg', label: 'Front Elevation' },
      { file: 'Villa Front Porch.jpg',           label: 'Front Porch'     },
      { file: 'Additional- Lift Cladding.jpg',   label: 'Lift Cladding'   },
      { file: 'Staircase.jpg',                   label: 'Staircase'       },
    ],
  },
]

const ALL_MOCK_IMAGES: MockImage[] = MOCK_GALLERY.flatMap(g => g.images)

const imgSrc = (file: string) =>
  `/mockvillaimages/${encodeURIComponent(file)}`

/* ════════════════════════════════════════════════ */

export default function CustomisationHub() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnedFromCategory = (location.state as any)?.showCards === true
  const [expanded, setExpanded] = useState(returnedFromCategory)
  const [settled,  setSettled]  = useState(returnedFromCategory)

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [lightbox,    setLightbox]    = useState<MockImage | null>(null)

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!lightbox) return
    const idx = ALL_MOCK_IMAGES.findIndex(i => i.file === lightbox.file)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLightbox(ALL_MOCK_IMAGES[(idx + 1) % ALL_MOCK_IMAGES.length])
      else if (e.key === 'ArrowLeft') setLightbox(ALL_MOCK_IMAGES[(idx - 1 + ALL_MOCK_IMAGES.length) % ALL_MOCK_IMAGES.length])
      else if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox])

  const userName = localStorage.getItem('user_name') ?? ''


  const [villa, setVilla]           = useState<any>(null)
  const [selections, setSelections] = useState<any[]>([])
  const [locationMap, setLocationMap] = useState<Record<string, string>>({})
  const [cartOpen, setCartOpen]     = useState(false)

  useEffect(() => {
    getMyVilla().then((villas: any[]) => { if (villas?.length) setVilla(villas[0]) }).catch(() => {})
    getMySelections().then((data: any) => setSelections(data?.selections ?? [])).catch(() => {})
    getAllLocations().then((locs: any[]) => {
      const map: Record<string, string> = {}
      locs.forEach((l: any) => {
        const parts = [l.space, l.room_code].filter(Boolean)
        map[l.location_id] = parts.join(' — ')
      })
      setLocationMap(map)
    }).catch(() => {})
  }, [])

  // Group selections by category for the drawer
  const CAT_NAMES: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.name]))
  const grouped = selections.reduce<Record<string, any[]>>((acc, s) => {
    const key = CAT_NAMES[s.category_id] ?? s.category_id
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const handleCustomise = () => {
    if (!expanded) {
      setExpanded(true)
      setTimeout(() => setSettled(true), 7 * 60 + 600)
    }
  }

  const handleLogout = () => { localStorage.clear(); navigate('/') }

  return (
    <div className="hub-page">

      {/* White frosted overlay */}
      <div className={`hub-video-overlay ${expanded ? 'active' : ''}`} />

      {/* ── Top-right: mock villa button + logout ── */}
      <div className={`hub-topbar ${expanded ? 'hub-topbar--dark' : ''}`}>
        <button
          className="hub-topbar-gallery"
          onClick={() => setGalleryOpen(true)}
          title="Mock Villa Images"
        >
          <Images size={15} />
          <span>Mock Villa</span>
        </button>
        <button className="hub-topbar-logout" onClick={handleLogout} title="Log out">
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>

      {/* ── Villa info bar — slides in with cards ── */}
      <div className={`hub-infobar ${expanded ? 'hub-infobar--visible' : ''}`}>
        <div className="hub-infobar-chip">
          <span className="hub-infobar-label">Name</span>
          <span className="hub-infobar-value hub-infobar-name">{userName}</span>
        </div>
        {villa && (<>
          <span className="hub-infobar-sep">|</span>
          <div className="hub-infobar-chip">
            <span className="hub-infobar-label">Villa</span>
            <span className="hub-infobar-value">{villa.villa_number}</span>
          </div>
          <span className="hub-infobar-sep">|</span>
          <div className="hub-infobar-chip">
            <span className="hub-infobar-label">Facing</span>
            <span className="hub-infobar-value">{villa.facing}</span>
          </div>
        </>)}
      </div>

      {/* ── Hero ── */}
      <div className={`hub-hero ${expanded ? 'exit' : ''}`}>
        <h1 className="hub-hero-heading">Your Vision.<br />Your Villa.</h1>
        <button className="hub-cta-btn" onClick={handleCustomise}>Begin Customising</button>
      </div>

      {/* ── Category cards ── */}
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
                    style={{ transitionDelay: settled ? '0ms' : expanded ? `${globalIdx * 60}ms` : '0ms' }}
                    onClick={() => navigate(`/category/${cat.id}`)}
                  >
                    <span className="card-icon"><Icon size={26} strokeWidth={1.5} color="#F05E3E" /></span>
                    <p className="card-name">{cat.name}</p>
                    <p className="card-tagline">{cat.tagline}</p>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MOCK VILLA GALLERY MODAL
      ══════════════════════════════════════════ */}
      {galleryOpen && (
        <div className="mv-overlay" onClick={() => setGalleryOpen(false)}>
          <div className="mv-panel" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="mv-header">
              <div>
                <h2 className="mv-title">Mock Villa</h2>
                <p className="mv-subtitle">Reference images across all floors</p>
                <p className="mv-disclaimer"><strong>Disclaimer:</strong> These images are for reference purposes only and do not represent the actual final product, finishes, or dimensions.</p>
              </div>
              <button className="mv-close" onClick={() => setGalleryOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Grouped image grid */}
            <div className="mv-body">
              {MOCK_GALLERY.map(section => (
                <div key={section.group} className="mv-section">
                  <h3 className="mv-section-title">{section.group}</h3>
                  <div className="mv-grid">
                    {section.images.map(img => (
                      <div
                        key={img.file}
                        className="mv-item"
                        onClick={() => setLightbox(img)}
                      >
                        <div className="mv-img-wrap">
                          <img
                            src={imgSrc(img.file)}
                            alt={img.label}
                            loading="lazy"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                        <p className="mv-label">{img.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (() => {
        const idx = ALL_MOCK_IMAGES.findIndex(i => i.file === lightbox.file)
        const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setLightbox(ALL_MOCK_IMAGES[(idx - 1 + ALL_MOCK_IMAGES.length) % ALL_MOCK_IMAGES.length]) }
        const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setLightbox(ALL_MOCK_IMAGES[(idx + 1) % ALL_MOCK_IMAGES.length]) }
        return (
          <div className="mv-lightbox" onClick={() => setLightbox(null)}>
            <button className="mv-lightbox-close" onClick={() => setLightbox(null)}>
              <X size={24} />
            </button>
            <button className="mv-lightbox-nav mv-lightbox-nav--prev" onClick={goPrev}>
              <ChevronLeft size={32} />
            </button>
            <img
              src={imgSrc(lightbox.file)}
              alt={lightbox.label}
              className="mv-lightbox-img"
              onClick={e => e.stopPropagation()}
            />
            <button className="mv-lightbox-nav mv-lightbox-nav--next" onClick={goNext}>
              <ChevronRight size={32} />
            </button>
            <p className="mv-lightbox-label" onClick={e => e.stopPropagation()}>
              {lightbox.label} <span className="mv-lightbox-counter">({idx + 1} / {ALL_MOCK_IMAGES.length})</span>
            </p>
          </div>
        )
      })()}

      {/* ── Floating Cart Button ── */}
      {expanded && (
        <button className="hub-cart-fab" onClick={() => setCartOpen(true)}>
          <ShoppingCart size={22} />
          {selections.length > 0 && (
            <span className="hub-cart-fab-count">{selections.length}</span>
          )}
        </button>
      )}

      {/* ── Cart Drawer ── */}
      {cartOpen && (
        <div className="hub-cart-overlay" onClick={() => setCartOpen(false)}>
          <div className="hub-cart-drawer" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="hub-cart-header">
              <ShoppingCart size={18} />
              <span>Your Selections</span>
              {selections.length > 0 && <span className="hub-cart-count">{selections.length}</span>}
              <button className="hub-cart-close" onClick={() => setCartOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="hub-cart-body">
              {selections.length === 0 ? (
                <p className="hub-cart-empty">No selections yet. Browse the categories to get started.</p>
              ) : (
                Object.entries(grouped).map(([catName, items]) => (
                  <div key={catName} className="hub-cart-group">
                    <p className="hub-cart-group-label">{catName}</p>
                    {items.map((s: any, i: number) => (
                      <div key={i} className="hub-cart-item">
                        <div className="hub-cart-item-info">
                          <span className="hub-cart-item-name">{s.option_name ?? s.option_id}</span>
                          {s.location_id && locationMap[s.location_id] && (
                            <span className="hub-cart-item-room">{locationMap[s.location_id]}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="hub-cart-footer">
              <button
                className="hub-cart-quote-btn"
                onClick={() => { setCartOpen(false); navigate('/category/CAT001') }}
              >
                Continue Customising
                <ChevronRightIcon size={16} />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

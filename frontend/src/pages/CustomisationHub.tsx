import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid, Layers, Bath, ArrowUpSquare,
  Leaf, Wifi, Wind, Tv2, LogOut, Images, X, ChevronLeft, ChevronRight,
  ShoppingCart, Bell, CheckCircle, Lock,
} from 'lucide-react'
import {
  getMyVilla, getMySelections, getAllLocations, getDirectOptions,
  requestQuote, getMyQuotes, acceptQuote, requestQuoteChanges, getMe,
} from '../services/api'

const CATEGORIES = [
  { id: 'CAT001', name: 'Space Customisations',    tagline: 'Spaces that adapt to you',                             icon: LayoutGrid    },
  { id: 'CAT002', name: 'Flooring Upgrades',        tagline: 'The elegance of timeless stone',                      icon: Layers        },
  { id: 'CAT003', name: 'Bathroom Upgrades',        tagline: 'Every bath, a private sanctuary',                     icon: Bath          },
  { id: 'CAT007', name: 'VRF Cooling System',       tagline: 'Effortless Comfort, Elevated Efficiency',             icon: Wind          },
  { id: 'CAT006', name: 'Smart Home',               tagline: 'Intelligence that Inspires',                          icon: Wifi          },
  { id: 'CAT005', name: 'Landscape Packages',       tagline: 'Nature woven into your villa',                        icon: Leaf          },
  { id: 'CAT004', name: 'Lift Interior Refinement', tagline: 'Sophisticated detailing that elevates every journey', icon: ArrowUpSquare },
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
const imgSrc = (file: string) => `/mockvillaimages/${encodeURIComponent(file)}`

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

/** Strip trailing location codes like "— GF-KT" or "— FF-MBR-T" */
function stripCode(label: string): string {
  return label.replace(/\s*—\s*[A-Z0-9-]+$/, '').trim()
}

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

  const [villa,        setVilla]        = useState<any>(null)
  const [selections,   setSelections]   = useState<any[]>([])
  const [selectionsStatus, setSelectionsStatus] = useState<string>('in_progress')
  const [locationMap,  setLocationMap]  = useState<Record<string, string>>({})
  const [optionMap,    setOptionMap]    = useState<Record<string, string>>({})
  const [cartOpen,     setCartOpen]     = useState(false)

  // Quote notification state
  const [myQuote,          setMyQuote]          = useState<any>(null)
  const [quotePanelOpen,   setQuotePanelOpen]   = useState(false)
  const [acceptLoading,    setAcceptLoading]    = useState(false)
  const [acceptError,      setAcceptError]      = useState('')
  const [editLoading,      setEditLoading]      = useState(false)

  // Cart quote state
  const [quoteSubmitting, setQuoteSubmitting] = useState(false)
  const [quoteSuccess,    setQuoteSuccess]    = useState(false)
  const [quoteError,      setQuoteError]      = useState('')

  const handleRequestQuote = async () => {
    setQuoteSubmitting(true)
    setQuoteError('')
    try {
      await requestQuote({})
      setQuoteSuccess(true)
      // Refresh quote state so the bell reflects the new request immediately
      getMyQuotes().then((quotes: any[]) => {
        if (quotes?.length) setMyQuote(quotes[0])
      }).catch(() => {})
    } catch (e: any) {
      setQuoteError(e?.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setQuoteSubmitting(false)
    }
  }

  // Poll quote status — runs on mount and every 15 s so the bell updates live
  const fetchQuote = () => {
    getMyQuotes().then((quotes: any[]) => {
      if (quotes?.length) setMyQuote(quotes[0])
    }).catch(() => {})
  }

  useEffect(() => {
    // Guard: if an admin token is active redirect to home
    getMe().then((me: any) => {
      if (me?.role === 'admin') { sessionStorage.clear(); navigate('/') }
    }).catch(() => {})

    getMyVilla().then((villas: any[]) => { if (villas?.length) setVilla(villas[0]) }).catch(() => {})

    getMySelections().then((data: any) => {
      const sels: any[] = data?.selections ?? []
      setSelections(sels)
      setSelectionsStatus(data?.status ?? 'in_progress')

      const catIds = [...new Set(sels.map((s: any) => s.category_id))] as string[]
      if (catIds.length === 0) return
      Promise.all(catIds.map((catId) => getDirectOptions(catId).catch(() => [] as any[]))).then((results) => {
        const map: Record<string, string> = {}
        results.forEach((opts: any[]) => {
          opts.forEach((opt: any) => {
            map[opt.option_id] = opt.option_name || opt.upgrade_spec || opt.space || opt.option_id
          })
        })
        setOptionMap(map)
      })
    }).catch(() => {})

    getAllLocations().then((locs: any[]) => {
      const map: Record<string, string> = {}
      locs.forEach((l: any) => { map[l.location_id] = l.space || '' })
      setLocationMap(map)
    }).catch(() => {})

    // Fetch quote immediately, then poll every 15 s
    fetchQuote()
    const quoteTimer = setInterval(fetchQuote, 15000)
    return () => clearInterval(quoteTimer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isAccepted = selectionsStatus === 'accepted'
  const hasQuoteNotification = myQuote?.customer_notification === 'quoted'
  const isQuoteAccepted      = myQuote?.status === 'accepted'

  // Build quote items from snapshot + item_prices
  // Match prices by option_id + location_id (not array index, which breaks for partial price sets)
  const quoteItems = (() => {
    if (!myQuote?.selection_snapshot) return []
    const snapshot   = myQuote.selection_snapshot as any[]
    const itemPrices = (myQuote.item_prices ?? []) as any[]
    return snapshot.map((s: any) => {
      const saved = itemPrices.find((ip: any) =>
        ip.option_id === s.option_id &&
        (ip.location_id ?? null) === (s.location_id ?? null)
      )
      return { ...s, resolvedPrice: saved?.price ?? null }
    })
  })()

  const quoteTotal: number | null = myQuote?.quoted_price ?? null

  // Group quote items by category
  const quoteGroups: Record<string, any[]> = {}
  quoteItems.forEach((item: any) => {
    const key = item.category_name ?? item.category_id ?? 'Other'
    if (!quoteGroups[key]) quoteGroups[key] = []
    quoteGroups[key].push(item)
  })

  const handleAcceptQuote = async () => {
    if (!myQuote) return
    const confirmed = window.confirm(
      '⚠️ Once you accept this quotation, your villa customisations will be permanently frozen and no further changes can be made.\n\nAre you sure you want to accept?'
    )
    if (!confirmed) return
    setAcceptLoading(true)
    setAcceptError('')
    try {
      const updated = await acceptQuote(myQuote.id)
      setMyQuote(updated)
      setSelectionsStatus('accepted')
      setQuotePanelOpen(false)
    } catch (e: any) {
      setAcceptError(e?.response?.data?.detail || 'Something went wrong.')
    } finally {
      setAcceptLoading(false)
    }
  }

  const handleEditSelections = async () => {
    if (!myQuote) return
    setEditLoading(true)
    try {
      const updated = await requestQuoteChanges(myQuote.id)
      setMyQuote(updated)
      setSelectionsStatus('in_progress')
      setQuotePanelOpen(false)
    } catch { /* ignore */ }
    finally { setEditLoading(false) }
  }

  // Group cart selections by category
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

  const handleLogout = () => { localStorage.clear(); sessionStorage.clear(); navigate('/') }

  return (
    <div className="hub-page">

      {/* White frosted overlay */}
      <div className={`hub-video-overlay ${expanded ? 'active' : ''}`} />

      {/* ── Top-right: mock villa + bell + logout ── */}
      <div className={`hub-topbar ${expanded ? 'hub-topbar--dark' : ''}`}>
        <button className="hub-topbar-gallery" onClick={() => setGalleryOpen(true)} title="Mock Villa Images">
          <Images size={15} /><span>Mock Villa</span>
        </button>

        {/* ── Bell notification button ── */}
        <button
          className={`hub-topbar-bell ${hasQuoteNotification ? 'hub-topbar-bell--active' : ''} ${isQuoteAccepted ? 'hub-topbar-bell--accepted' : ''}`}
          onClick={() => {
            // Always re-fetch on bell click so the panel shows the latest data
            getMyQuotes().then((quotes: any[]) => {
              if (quotes?.length) setMyQuote(quotes[0])
            }).catch(() => {})
            setQuotePanelOpen(true)
          }}
          title={isQuoteAccepted ? 'Quotation Accepted' : hasQuoteNotification ? 'You have a new quotation' : 'Quotation'}
        >
          {isQuoteAccepted
            ? <CheckCircle size={15} />
            : <Bell size={15} />
          }
          {hasQuoteNotification && !isQuoteAccepted && (
            <span className="hub-bell-dot" />
          )}
        </button>

        <button className="hub-topbar-logout" onClick={handleLogout} title="Log out">
          <LogOut size={15} /><span>Logout</span>
        </button>
      </div>

      {/* ── Villa info bar ── */}
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

      {/* ── Accepted banner ── */}
      {isAccepted && expanded && (
        <div className="hub-accepted-banner">
          <Lock size={14} />
          Your customisation selections have been accepted and are now locked.
        </div>
      )}

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
                    className={`card ${expanded ? 'visible' : ''} ${isAccepted ? 'card--locked' : ''}`}
                    style={{ transitionDelay: settled ? '0ms' : expanded ? `${globalIdx * 60}ms` : '0ms' }}
                    onClick={() => !isAccepted && navigate(`/category/${cat.id}`)}
                  >
                    <span className="card-icon"><Icon size={26} strokeWidth={1.5} color={isAccepted ? '#bbb' : '#F05E3E'} /></span>
                    <p className="card-name">{cat.name}</p>
                    <p className="card-tagline">{cat.tagline}</p>
                    {isAccepted && <Lock size={14} className="card-lock-icon" color="#bbb" />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Mock Villa Gallery Modal ── */}
      {galleryOpen && (
        <div className="mv-overlay" onClick={() => setGalleryOpen(false)}>
          <div className="mv-panel" onClick={e => e.stopPropagation()}>
            <div className="mv-header">
              <div>
                <h2 className="mv-title">Mock Villa</h2>
                <p className="mv-subtitle">Reference images across all floors</p>
                <p className="mv-disclaimer"><strong>Disclaimer:</strong> These images are for reference purposes only and do not represent the actual final product, finishes, or dimensions.</p>
              </div>
              <button className="mv-close" onClick={() => setGalleryOpen(false)}><X size={20} /></button>
            </div>
            <div className="mv-body">
              {MOCK_GALLERY.map(section => (
                <div key={section.group} className="mv-section">
                  <h3 className="mv-section-title">{section.group}</h3>
                  <div className="mv-grid">
                    {section.images.map(img => (
                      <div key={img.file} className="mv-item" onClick={() => setLightbox(img)}>
                        <div className="mv-img-wrap">
                          <img src={imgSrc(img.file)} alt={img.label} loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
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
            <button className="mv-lightbox-close" onClick={() => setLightbox(null)}><X size={24} /></button>
            <button className="mv-lightbox-nav mv-lightbox-nav--prev" onClick={goPrev}><ChevronLeft size={32} /></button>
            <img src={imgSrc(lightbox.file)} alt={lightbox.label} className="mv-lightbox-img" onClick={e => e.stopPropagation()} />
            <button className="mv-lightbox-nav mv-lightbox-nav--next" onClick={goNext}><ChevronRight size={32} /></button>
            <p className="mv-lightbox-label" onClick={e => e.stopPropagation()}>
              {lightbox.label} <span className="mv-lightbox-counter">({idx + 1} / {ALL_MOCK_IMAGES.length})</span>
            </p>
          </div>
        )
      })()}

      {/* ── Floating Cart Button ── */}
      {expanded && !isAccepted && (
        <button className="hub-cart-fab" onClick={() => setCartOpen(true)}>
          <ShoppingCart size={22} />
          {selections.length > 0 && <span className="hub-cart-fab-count">{selections.length}</span>}
        </button>
      )}

      {/* ── Cart Drawer ── */}
      {cartOpen && (
        <div className="hub-cart-overlay" onClick={() => setCartOpen(false)}>
          <div className="hub-cart-drawer" onClick={e => e.stopPropagation()}>
            <div className="hub-cart-header">
              <ShoppingCart size={18} />
              <span>Your Selections</span>
              {selections.length > 0 && <span className="hub-cart-count">{selections.length}</span>}
              <button className="hub-cart-close" onClick={() => setCartOpen(false)}><X size={18} /></button>
            </div>
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
                          <span className="hub-cart-item-name">{optionMap[s.option_id] ?? s.option_name ?? s.option_id}</span>
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
            <div className="hub-cart-footer">
              {quoteSuccess ? (
                <div className="hub-cart-quote-success">
                  <span>✓</span>
                  <span>Quote request submitted!<br />Our team will be in touch soon.</span>
                </div>
              ) : (
                <>
                  {quoteError && <p className="hub-cart-quote-error">{quoteError}</p>}
                  <button
                    className="hub-cart-quote-btn"
                    disabled={selections.length === 0 || quoteSubmitting}
                    onClick={handleRequestQuote}
                  >
                    {quoteSubmitting ? 'Submitting…' : 'Request for Quote'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          QUOTE NOTIFICATION PANEL
      ══════════════════════════════════════════ */}
      {quotePanelOpen && (
        <div className="qn-overlay" onClick={() => setQuotePanelOpen(false)}>
          <div className="qn-panel" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="qn-header">
              <button className="qn-close" onClick={() => setQuotePanelOpen(false)}><X size={18} /></button>
              {isQuoteAccepted ? (
                <div className="qn-header-accepted">
                  <CheckCircle size={28} color="#1a7a47" />
                  <div>
                    <h2 className="qn-title">Quotation Accepted</h2>
                    <p className="qn-subtitle">Your customisations are confirmed and locked</p>
                  </div>
                </div>
              ) : hasQuoteNotification ? (
                <div className="qn-header-info">
                  <Bell size={22} color="#F05E3E" />
                  <div>
                    <h2 className="qn-title">Your Quotation is Ready</h2>
                    <p className="qn-subtitle">Capstone Life has reviewed your selections and prepared a price</p>
                  </div>
                </div>
              ) : (
                <div className="qn-header-info">
                  <Bell size={22} color="#aaa" />
                  <div>
                    <h2 className="qn-title">Your Quotation</h2>
                    <p className="qn-subtitle">Quote status: {myQuote?.status ?? 'No quote yet'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Items — only show when admin has actually sent a quotation */}
            {quoteItems.length > 0 && (myQuote?.status === 'quoted' || myQuote?.status === 'accepted') ? (
              <div className="qn-body">
                {Object.entries(quoteGroups).map(([cat, items]) => (
                  <div key={cat} className="qn-group">
                    <p className="qn-cat">{cat}</p>
                    {items.map((item: any, i: number) => (
                      <div key={i} className="qn-item">
                        <div className="qn-item-info">
                          <span className="qn-item-name">
                            {item.option_name || item.option_id}
                          </span>
                          {item.room_label && (
                            <span className="qn-item-room">{stripCode(item.room_label)}</span>
                          )}
                        </div>
                        <span className="qn-item-price">
                          {item.resolvedPrice != null
                            ? fmtINR(item.resolvedPrice)
                            : <span className="qn-on-request">On Request</span>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Total */}
                <div className="qn-total-row">
                  <span className="qn-total-label">Total</span>
                  <span className="qn-total-value">
                    {quoteTotal != null ? fmtINR(quoteTotal) : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="qn-empty">No quotation details yet.</div>
            )}

            {/* Footer actions */}
            {!isQuoteAccepted && (hasQuoteNotification || myQuote?.status === 'quoted') && (
              <div className="qn-footer">
                {acceptError && <p className="qn-error">{acceptError}</p>}
                <button
                  className="qn-btn qn-btn--accept"
                  onClick={handleAcceptQuote}
                  disabled={acceptLoading || editLoading}
                >
                  <CheckCircle size={15} />
                  {acceptLoading ? 'Accepting…' : 'Accept Quote'}
                </button>
                <button
                  className="qn-btn qn-btn--edit"
                  onClick={handleEditSelections}
                  disabled={acceptLoading || editLoading}
                >
                  {editLoading ? 'Please wait…' : 'Edit My Selections'}
                </button>
              </div>
            )}

            {isQuoteAccepted && (
              <div className="qn-footer qn-footer--accepted">
                <Lock size={14} color="#1a7a47" />
                <span>Your selections are final. No further changes can be made.</span>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}

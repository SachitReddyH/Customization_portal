import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, X, ChevronDown, ChevronRight, ShoppingCart, Images } from 'lucide-react'
import {
  getCategory, getCategories, getFloors, getRooms, getRoomOptions,
  getDirectOptions, getFlooringPackages,
  getMyVilla, getMySelections, upsertSelection, removeSelection,
  getMyQuotes, requestQuote,
  BASE,
} from '../services/api'

/* ── Types ──────────────────────────────────────── */
interface Option {
  id: string
  option_id: string
  category_id: string
  sub_section?: string
  location_id?: string
  floor?: string
  space?: string
  room_code?: string
  rooms_covered?: { location_id: string; standard_spec?: string; upgrade_spec?: string; has_upgrade?: boolean; space?: string; floor?: string; room_code?: string }[]
  option_name?: string
  standard_spec?: string
  upgrade_spec?: string
  has_upgrade: boolean
  price_inr?: number
  price_status: string
  price_unit?: string
  package_tier?: string
  description?: string
  detailed_spec?: string
  images: { standard?: string; standard_list?: { path: string; label: string }[]; upgrade?: string; upgrade_list?: { path: string; label: string }[] }
  floor_plan_image?: string
  option_type?: string
}

interface SelectionItem {
  option_id: string
  category_id: string
  sub_section?: string
  location_id?: string
  selection_type: 'standard' | 'upgrade'
}

interface Room { location_id: string; floor: string; space: string; room_code: string }

/* ── Constants ──────────────────────────────────── */
const ROOM_BASED = ['CAT002', 'CAT003']
const FLOOR_SUFFIX: Record<string, string> = {
  'Ground Floor': 'gf', 'First Floor': 'ff', 'Second Floor': 'sf',
}
const SUB_SECTIONS: Record<string, { id: string; label: string }[]> = {
  CAT002: [
    { id: 'package', label: 'Packages' },
  ],
  CAT003: [{ id: 'sanitaryware', label: 'Sanitaryware' }, { id: 'cp_fittings', label: 'CP Fittings' }],
}

// Display labels for sub_section groups within direct (non-room) categories
const SUB_GROUP_LABELS: Record<string, string> = {
  kitchen:      'Kitchen',
  home_theatre: 'Home Theatre / Private Office',
}

/* ── Price helper ───────────────────────────────── */
const formatPrice = (opt: Option) => {
  if (opt.price_status === 'fixed' && opt.price_inr)
    return `₹${opt.price_inr.toLocaleString('en-IN')}`
  if (opt.price_status === 'on_request') return 'Price on Request'
  return 'TBD'
}

/* ── Floor plan URL helper ──────────────────────── */
const floorPlanUrl = (villa: any, floor: string) => {
  if (!villa) return null
  const t = villa.villa_type?.toLowerCase().replace(' ', '') // 'type1'
  const f = villa.facing?.toLowerCase()                      // 'east'/'west'
  const suffix = FLOOR_SUFFIX[floor]
  if (!t || !f || !suffix) return null
  const key = `${t}_${f}`                                    // 'type1_east'
  const valid = ['type1_east', 'type2_west']
  if (!valid.includes(key)) return null
  return `${BASE}/static/floor_plans/${key}_${suffix}.png`
}

/* ── Mock villa gallery data ─────────────────────── */
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
      { file: 'First Floor_ MBR -1.jpg',                          label: 'Master Bedroom'               },
      { file: 'First Floor_ MBR -2.jpg',                          label: 'Master Bedroom — View 2'      },
      { file: 'First Floor- Master Bedroom-Toilet.jpg.jpeg',       label: 'Master Bedroom — Toilet'      },
      { file: 'First Floor- Master Bedroom-Toilet View 2.jpg.jpeg',label: 'Master Bedroom — Toilet View 2'},
      { file: 'First Floor- Bedroom-2.jpg',                        label: 'Bedroom 2'                    },
      { file: 'First Floor- Bedroom 2-Toilet.jpg.jpeg',            label: 'Bedroom 2 — Toilet'           },
      { file: 'First Floor- Bedroom 2-Toilet View 2.jpg.jpeg',     label: 'Bedroom 2 — Toilet View 2'   },
      { file: 'First Floor- Bedroom-2 Balcony.jpg',                label: 'Bedroom 2 — Balcony'          },
      { file: 'First Floor- Family Lounge.jpg',                    label: 'Family Lounge'                },
    ],
  },
  {
    group: 'Second Floor',
    images: [
      { file: 'Second Floor- Bedroom-3.jpg',                       label: 'Bedroom 3'                    },
      { file: 'Second Floor- Bedroom 3-Toilet.jpg.jpeg',           label: 'Bedroom 3 — Toilet'           },
      { file: 'Second Floor- Bedroom 3-Toilet- View 2.jpg.jpeg',   label: 'Bedroom 3 — Toilet View 2'   },
      { file: 'Second Floor- Bedroom-3- Dresser.jpg',              label: 'Bedroom 3 — Dresser'          },
      { file: 'Second Floor- Home Theatre.jpg',                    label: 'Home Theatre'                 },
      { file: 'Second Floor- Home Theatre-1.jpg',                  label: 'Home Theatre — View 2'        },
      { file: 'Second Floor- Semi Covered Terrace.jpg',            label: 'Semi Covered Terrace'         },
    ],
  },
  {
    group: 'Additional',
    images: [
      { file: 'Villa- Front Elevation.jpg.jpeg', label: 'Front Elevation'  },
      { file: 'Villa Front Porch.jpg',           label: 'Front Porch'      },
      { file: 'Additional- Lift Cladding.jpg',   label: 'Lift Cladding'    },
      { file: 'Staircase.jpg',                   label: 'Staircase'        },
    ],
  },
]

const mockImgSrc = (file: string) => `/mockvillaimages/${encodeURIComponent(file)}`

// Resolve image URLs — static assets live on the Render backend
const imgUrl = (path?: string | null) => {
  if (!path) return null
  if (path.startsWith('/static/')) return `${BASE}${path}`
  return path
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()

  const [category, setCategory] = useState<any>(null)
  const [villa, setVilla] = useState<any>(null)

  // Floor / room nav state
  const [floors, setFloors] = useState<string[]>([])
  const [floorsLoading, setFloorsLoading] = useState(false)
  const [floorsError, setFloorsError] = useState(false)
  const [roomsByFloor, setRoomsByFloor] = useState<Record<string, Room[]>>({})

  // Flat lookup: location_id → Room, built from all fetched rooms
  const locationMap = useMemo<Record<string, Room>>(() => {
    const map: Record<string, Room> = {}
    Object.values(roomsByFloor).forEach(rooms => rooms.forEach(r => { map[r.location_id] = r }))
    return map
  }, [roomsByFloor])

  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  const [selectedFloor, setSelectedFloor] = useState<string>('')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  // Sub-section tabs
  const tabs = SUB_SECTIONS[categoryId!] ?? []
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '')

  // Options
  const [options, setOptions] = useState<Option[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  // Selections (cart)
  const [selections, setSelections] = useState<SelectionItem[]>([])
  // Local map option_id → option (for cart display)
  const [optionMap, setOptionMap] = useState<Record<string, Option>>({})
  // Category id → display name (for cart grouping)
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({})

  // Floor plan lightbox
  const [lightboxUrl, setLightboxUrl] = useState('')
  // Floor plan tab for packages panel
  const [pkgFloor, setPkgFloor] = useState('First Floor')

  // Quote request
  const [pendingQuote, setPendingQuote] = useState<any>(null)   // the pending quote object
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [quoteModalMode, setQuoteModalMode] = useState<'new' | 'update'>('new')
  const [quoteNotes, setQuoteNotes] = useState('')
  const [quoteSubmitting, setQuoteSubmitting] = useState(false)
  const [quoteJustActed, setQuoteJustActed] = useState(false)   // show inline success flash
  const [quoteError, setQuoteError] = useState('')

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryLightbox, setGalleryLightbox] = useState<MockImage | null>(null)

  const isRoomBased  = ROOM_BASED.includes(categoryId!)
  const isPackageTab = activeTab === 'package'

  // Map of location_id → package name for rooms covered by a selected package
  const packageCoveredRooms = useMemo<Record<string, string>>(() => {
    const covered: Record<string, string> = {}
    const pkgSel = selections.find(s => s.category_id === 'CAT002' && s.sub_section === 'package')
    if (!pkgSel) return covered
    const pkgOpt = optionMap[pkgSel.option_id]
    if (!pkgOpt?.rooms_covered) return covered
    const pkgName = pkgOpt.option_name ?? pkgOpt.description ?? 'Selected Package'
    pkgOpt.rooms_covered.forEach(r => { covered[r.location_id] = pkgName })
    return covered
  }, [selections, optionMap])

  /* ── Load floors (also used for retry) ─────────── */
  const loadFloors = useCallback(async (catId: string) => {
    setFloorsLoading(true)
    setFloorsError(false)
    try {
      const d = await getFloors(catId)
      const floorList = d.floors ?? []
      setFloors(floorList)
      if (floorList.length) {
        setSelectedFloor(floorList[0])
        setExpandedFloors(new Set([floorList[0]]))
      }
    } catch (e) {
      console.error('Failed to load floors:', e)
      setFloorsError(true)
    } finally {
      setFloorsLoading(false)
    }
  }, [])

  /* ── Initial loads ─────────────────────────────── */
  useEffect(() => {
    if (!categoryId) return
    getCategory(categoryId).then(setCategory).catch(console.error)
    getMyVilla().then(villas => setVilla(villas[0] ?? null)).catch(console.error)
    getMyQuotes().then((qs: any[]) => {
      const pq = qs.find((q: any) => q.status === 'pending')
      setPendingQuote(pq ?? null)
    }).catch(console.error)

    // Fetch categories → build name map for cart grouping
    getCategories().then((cats: any[]) => {
      const map: Record<string, string> = {}
      cats.forEach(c => { map[c.category_id] = c.name })
      setCategoryNames(map)
    }).catch(console.error)

    // Fetch all selections; then pre-load options for every category in the cart
    getMySelections().then(async d => {
      const sels: SelectionItem[] = d.selections ?? []
      setSelections(sels)

      // Unique category_ids that appear in selections (to populate optionMap for cart names)
      const catIds = Array.from(new Set(sels.map((s: SelectionItem) => s.category_id)))
      catIds.forEach(async (cid: string) => {
        try {
          const opts: Option[] = await getDirectOptions(cid)
          setOptionMap(prev => {
            const next = { ...prev }
            opts.forEach(o => { next[o.option_id] = o })
            return next
          })
        } catch { /* silently ignore */ }
      })
    }).catch(console.error)

    if (ROOM_BASED.includes(categoryId)) {
      loadFloors(categoryId)
      // Pre-load packages so rooms_covered is in optionMap even if user never clicks Packages tab
      if (categoryId === 'CAT002') {
        getFlooringPackages().then(pkgs => {
          setOptionMap(prev => {
            const next = { ...prev }
            pkgs.forEach((p: Option) => { next[p.option_id] = p })
            return next
          })
        }).catch(console.error)

        // Pre-fetch all rooms so locationMap resolves package chip labels immediately
        getFloors(categoryId).then(async d => {
          const floorList: string[] = d.floors ?? []
          await Promise.all(floorList.map(async floor => {
            try {
              const rd = await getRooms(categoryId, floor)
              setRoomsByFloor(prev => ({ ...prev, [floor]: rd.rooms ?? [] }))
            } catch { /* ignore */ }
          }))
        }).catch(console.error)
      }
    } else {
      loadDirectOptions(categoryId)
    }
  }, [categoryId, loadFloors])

  /* ── Load rooms when floor expands ─────────────── */
  const loadRooms = useCallback(async (floor: string) => {
    if (roomsByFloor[floor]) return
    try {
      const d = await getRooms(categoryId!, floor)
      setRoomsByFloor(prev => ({ ...prev, [floor]: d.rooms ?? [] }))
      // Auto-select first room
      if (d.rooms?.length && !selectedRoom) {
        setSelectedRoom(d.rooms[0])
      }
    } catch (e) { console.error(e) }
  }, [categoryId, roomsByFloor, selectedRoom])

  useEffect(() => {
    if (selectedFloor) loadRooms(selectedFloor)
  }, [selectedFloor])

  /* ── Load options for room ──────────────────────── */
  useEffect(() => {
    if (!isRoomBased || !selectedRoom || isPackageTab) return
    setOptionsLoading(true)
    const sub = activeTab || undefined
    getRoomOptions(categoryId!, selectedRoom.location_id, sub)
      .then(opts => {
        setOptions(opts)
        setOptionMap(prev => {
          const next = { ...prev }
          opts.forEach((o: Option) => { next[o.option_id] = o })
          return next
        })
      })
      .catch(console.error)
      .finally(() => setOptionsLoading(false))
  }, [selectedRoom, activeTab, isRoomBased, isPackageTab])

  /* ── Load packages (flooring) ─────────────────── */
  useEffect(() => {
    if (!isPackageTab) return
    setOptionsLoading(true)
    getFlooringPackages()
      .then(opts => {
        setOptions(opts)
        setOptionMap(prev => {
          const next = { ...prev }
          opts.forEach((o: Option) => { next[o.option_id] = o })
          return next
        })
      })
      .catch(console.error)
      .finally(() => setOptionsLoading(false))
  }, [isPackageTab])

  const loadDirectOptions = async (catId: string) => {
    setOptionsLoading(true)
    try {
      const opts = await getDirectOptions(catId)
      setOptions(opts)
      setOptionMap(prev => {
        const next = { ...prev }
        opts.forEach((o: Option) => { next[o.option_id] = o })
        return next
      })
    } catch (e) { console.error(e) }
    finally { setOptionsLoading(false) }
  }

  /* ── Floor sidebar interactions ─────────────────── */
  const toggleFloor = (floor: string) => {
    setSelectedFloor(floor)
    setExpandedFloors(prev => {
      const next = new Set(prev)
      next.has(floor) ? next.delete(floor) : next.add(floor)
      return next
    })
    loadRooms(floor)
  }

  const selectRoom = (room: Room) => {
    setSelectedRoom(room)
    setSelectedFloor(room.floor)
  }

  /* ── Tab switch ──────────────────────────────────── */
  const switchTab = (tab: string) => {
    setActiveTab(tab)
    setOptions([])
    if (tab !== 'package' && selectedRoom) return // will re-fetch via useEffect
  }

  /* ── Selection helpers ───────────────────────────── */
  const isSelected = (optionId: string, locationId?: string, type?: string) =>
    selections.some(s =>
      s.option_id === optionId &&
      (locationId ? s.location_id === locationId : true) &&
      (type ? s.selection_type === type : true)
    )

  const getSelectionType = (optionId: string, locationId?: string) =>
    selections.find(s => s.option_id === optionId && s.location_id === locationId)?.selection_type

  const handleSelect = async (opt: Option, type: 'standard' | 'upgrade') => {
    const alreadySelected = isSelected(opt.option_id, opt.location_id, type)

    try {
      if (alreadySelected) {
        const updated = await removeSelection({ option_id: opt.option_id, location_id: opt.location_id })
        setSelections(updated.selections ?? [])
      } else {
        // Mutual exclusivity: selecting a kitchen space option removes the other kitchen option
        if (opt.sub_section === 'kitchen') {
          const rival = selections.find(s =>
            s.category_id === opt.category_id &&
            s.sub_section === 'kitchen' &&
            s.option_id !== opt.option_id
          )
          if (rival) {
            await removeSelection({ option_id: rival.option_id, location_id: rival.location_id })
          }
        }

        const updated = await upsertSelection({
          category_id: opt.category_id,
          sub_section: opt.sub_section,
          option_id: opt.option_id,
          location_id: opt.location_id,
          selection_type: type,
        })
        setSelections(updated.selections ?? [])
      }
    } catch (e) { console.error(e) }
  }

  const handleRemoveFromCart = async (sel: SelectionItem) => {
    try {
      const updated = await removeSelection({ option_id: sel.option_id, location_id: sel.location_id })
      setSelections(updated.selections ?? [])
    } catch (e) { console.error(e) }
  }

  const handleRequestQuote = async () => {
    setQuoteSubmitting(true)
    setQuoteError('')
    try {
      const result = await requestQuote({ customer_notes: quoteNotes.trim() || undefined })
      setPendingQuote(result)
      setQuoteJustActed(true)
      setQuoteModalOpen(false)
      setQuoteNotes('')
      setTimeout(() => setQuoteJustActed(false), 4000)
    } catch (e: any) {
      setQuoteError(e.response?.data?.detail ?? 'Failed to submit. Please try again.')
    } finally {
      setQuoteSubmitting(false)
    }
  }

  /* ── Render ──────────────────────────────────────── */
  return (
    <div className="cat-page">

      {/* ── Top nav ── */}
      <nav className="cat-nav">
        <button className="cat-back" onClick={() => navigate('/hub', { state: { showCards: true } })}>
          <ArrowLeft size={18} /> Back
        </button>
        <span className="cat-nav-title">{category?.name ?? ''}</span>
        <div className="cat-nav-right">
          <button
            className="cat-nav-gallery-btn"
            onClick={() => setGalleryOpen(true)}
            title="Mock Villa Images"
          >
            <Images size={14} />
            <span>Mock Villa</span>
          </button>
          <span className="cat-nav-username">{localStorage.getItem('user_name') ?? ''}</span>
        </div>
      </nav>

      {/* ── Content ── */}
      <div className="cat-content">

        {/* ══ LEFT — Floor sidebar (hidden on Packages tab) ══ */}
        {isRoomBased && !isPackageTab && (
          <aside className="floor-sidebar">
            <p className="sidebar-heading">Floors & Rooms</p>

            {floorsLoading && (
              <p className="sidebar-status">Loading…</p>
            )}

            {!floorsLoading && floorsError && (
              <div className="sidebar-error">
                <p>Could not load floors</p>
                <button onClick={() => loadFloors(categoryId!)}>Retry</button>
              </div>
            )}

            {!floorsLoading && !floorsError && floors.length === 0 && (
              <p className="sidebar-status">No floors found</p>
            )}

            {floors.map(floor => (
              <div key={floor} className="floor-group">
                <button
                  className={`floor-item ${selectedFloor === floor ? 'active' : ''}`}
                  onClick={() => toggleFloor(floor)}
                >
                  <span className="floor-label">{floor}</span>
                  {expandedFloors.has(floor)
                    ? <ChevronDown size={14} />
                    : <ChevronRight size={14} />}
                </button>

                {expandedFloors.has(floor) && (
                  <div className="room-list">
                    {(roomsByFloor[floor] ?? []).map(room => (
                      <button
                        key={room.location_id}
                        className={`room-item ${selectedRoom?.location_id === room.location_id ? 'active' : ''}`}
                        onClick={() => selectRoom(room)}
                      >
                        {room.space}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </aside>
        )}

        {/* ══ MIDDLE — Options panel ══ */}
        <main className={`options-panel ${(!isRoomBased || isPackageTab) ? 'options-panel--wide' : ''}`}>

          {/* Sub-section tabs */}
          {tabs.length > 0 && (
            <div className="subtabs">
              {tabs.map(t => (
                <button
                  key={t.id}
                  className={`subtab ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => switchTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Heading — shown for room-based tabs */}
          {isRoomBased && (
            <div className="options-heading">
              {isPackageTab
                ? <span className="options-room">Flooring Packages</span>
                : selectedRoom
                ? <><span className="options-room">{selectedRoom.space}</span><span className="options-floor">{selectedRoom.floor}</span></>
                : null
              }
            </div>
          )}

          {optionsLoading
            ? <div className="options-loading">Loading…</div>
            : (() => {
                // For packages show all; for regular options hide anything with no upgrade
                const visible = isPackageTab
                  ? options
                  : options.filter(opt => opt.has_upgrade)
                if (visible.length === 0)
                  return (
                    <div className="options-empty">
                      {isRoomBased && !isPackageTab && !selectedRoom
                        ? 'Select a room from the left'
                        : 'No options available'}
                    </div>
                  )
                // Group by sub_section if options carry sub_section values
                const hasSubGroups = !isRoomBased && !isPackageTab &&
                  visible.some(o => o.sub_section && SUB_GROUP_LABELS[o.sub_section])

                if (hasSubGroups) {
                  // Preserve MongoDB order; deduplicate group keys
                  const groupOrder: string[] = []
                  const grouped: Record<string, typeof visible> = {}
                  for (const opt of visible) {
                    const grp = (opt.sub_section && SUB_GROUP_LABELS[opt.sub_section])
                      ? opt.sub_section
                      : '__other'
                    if (!grouped[grp]) { grouped[grp] = []; groupOrder.push(grp) }
                    grouped[grp].push(opt)
                  }
                  return (
                    <div className={`options-grid options-grid--direct`}>
                      {groupOrder.map(grp => (
                        <div key={grp} className="opt-subgroup">
                          {grp !== '__other' && (
                            <h3 className="opt-subgroup-heading">{SUB_GROUP_LABELS[grp]}</h3>
                          )}
                          {grouped[grp].map(opt => (
                            <OptionCard
                              key={opt.option_id + (opt.location_id ?? '')}
                              opt={opt}
                              selectedType={getSelectionType(opt.option_id, opt.location_id)}
                              onSelect={handleSelect}
                              isPackage={false}
                              coveredByPackage={undefined}
                              locationMap={locationMap}
                              onImageClick={url => setLightboxUrl(url)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                }

                return (
                  <div className={`options-grid${!isRoomBased ? ' options-grid--direct' : ''}`}>
                    {visible.map(opt => (
                      <OptionCard
                        key={opt.option_id + (opt.location_id ?? '')}
                        opt={opt}
                        selectedType={getSelectionType(opt.option_id, opt.location_id)}
                        onSelect={handleSelect}
                        isPackage={isPackageTab}
                        coveredByPackage={opt.location_id ? packageCoveredRooms[opt.location_id] : undefined}
                        locationMap={locationMap}
                        onImageClick={url => setLightboxUrl(url)}
                      />
                    ))}
                  </div>
                )
              })()
          }
        </main>

        {/* ══ RIGHT — Floor plan + Cart ══ */}
        <aside className="right-panel">

          {/* Floor plan — packages tab: floor switcher tabs */}
          {isPackageTab && (
            <div className="floorplan-section">
              <p className="right-section-label">Floor Plan</p>
              <div className="pkg-floor-tabs">
                {['Ground Floor', 'First Floor', 'Second Floor'].map(f => (
                  <button
                    key={f}
                    className={`pkg-floor-tab ${pkgFloor === f ? 'active' : ''}`}
                    onClick={() => setPkgFloor(f)}
                  >
                    {f.replace(' Floor', '')}
                  </button>
                ))}
              </div>
              {(() => {
                const url = floorPlanUrl(villa, pkgFloor)
                return url
                  ? (
                    <div className="floorplan-img-wrap" title="Click to enlarge" onClick={() => setLightboxUrl(url)}>
                      <img src={url} alt={`${pkgFloor} plan`} className="floorplan-img" />
                      <span className="floorplan-zoom-hint">🔍 Click to enlarge</span>
                    </div>
                  )
                  : <div className="floorplan-placeholder">Floor plan not available</div>
              })()}
            </div>
          )}

          {/* Floor plan — room-based tabs (non-package) */}
          {isRoomBased && !isPackageTab && selectedFloor && (
            <div className="floorplan-section">
              <p className="right-section-label">Floor Plan — {selectedFloor}</p>
              {(() => {
                const url = floorPlanUrl(villa, selectedFloor)
                return url
                  ? (
                    <div className="floorplan-img-wrap" title="Click to enlarge" onClick={() => setLightboxUrl(url)}>
                      <img src={url} alt={`${selectedFloor} plan`} className="floorplan-img" />
                      <span className="floorplan-zoom-hint">🔍 Click to enlarge</span>
                    </div>
                  )
                  : <div className="floorplan-placeholder">Floor plan not available</div>
              })()}
            </div>
          )}

          {/* Cart */}
          <div className={`cart-section ${!isRoomBased ? 'cart-section--full' : ''}`}>
            <div className="cart-header">
              <ShoppingCart size={16} />
              <span>Your Selections</span>
              <span className="cart-count">{selections.length}</span>
            </div>

            {selections.length === 0
              ? <p className="cart-empty">No selections yet</p>
              : <div className="cart-list">
                  {(() => {
                    // Group selections by category_id
                    const groups: Record<string, SelectionItem[]> = {}
                    selections.forEach(s => {
                      if (!groups[s.category_id]) groups[s.category_id] = []
                      groups[s.category_id].push(s)
                    })
                    return Object.entries(groups).map(([catId, items]) => (
                      <div key={catId} className="cart-category-group">
                        <div className="cart-category-label">
                          {categoryNames[catId] ?? catId}
                        </div>
                        {items.map((sel, i) => {
                          const opt = optionMap[sel.option_id]
                          const name = opt?.option_name ?? opt?.space ?? opt?.description ?? sel.option_id
                          return (
                            <div key={i} className="cart-item">
                              <div className="cart-item-info">
                                <span className="cart-item-name">{name}</span>
                                {opt?.space && opt?.option_name && (
                                  <span className="cart-item-room">{opt.space}</span>
                                )}
                                <span className={`cart-item-type ${sel.selection_type}`}>
                                  {sel.selection_type === 'upgrade' ? 'Upgrade' : 'Standard'}
                                </span>
                                <span className="cart-item-price">
                                  {opt ? formatPrice(opt) : '–'}
                                </span>
                              </div>
                              <button
                                className="cart-item-remove"
                                onClick={() => handleRemoveFromCart(sel)}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  })()}
                </div>
            }

            {/* ── Request for Quote ── */}
            <div className="cart-quote-section">
              {pendingQuote ? (
                <>
                  {/* Persistent banner — always shows while a pending quote exists */}
                  <div className={`cart-quote-success ${quoteJustActed ? 'cart-quote-success--flash' : ''}`}>
                    <span className="cart-quote-success-icon">✓</span>
                    <span>
                      {quoteJustActed && pendingQuote.notification_type === 'updated'
                        ? <>Selections updated.<br />Admin has been notified.</>
                        : quoteJustActed
                        ? <>Quote request submitted.<br />Our team will be in touch soon.</>
                        : <>Quote request pending.<br />Our team will be in touch soon.</>
                      }
                    </span>
                  </div>
                  {/* Update button — lets customer re-submit after adding new items */}
                  {selections.length > 0 && (
                    <button
                      className="cart-quote-update-btn"
                      onClick={() => { setQuoteModalMode('update'); setQuoteModalOpen(true); setQuoteError('') }}
                    >
                      Update my request with current selections
                    </button>
                  )}
                </>
              ) : (
                <button
                  className="cart-quote-btn"
                  disabled={selections.length === 0}
                  onClick={() => { setQuoteModalMode('new'); setQuoteModalOpen(true); setQuoteError('') }}
                >
                  Request for Quote
                </button>
              )}
            </div>
          </div>

        </aside>
      </div>

      {/* ── Quote request modal ── */}
      {quoteModalOpen && (
        <div className="quote-modal-overlay" onClick={() => !quoteSubmitting && setQuoteModalOpen(false)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <h3 className="quote-modal-title">
              {quoteModalMode === 'update' ? 'Update Quote Request' : 'Request for Quote'}
            </h3>
            <p className="quote-modal-subtitle">
              {quoteModalMode === 'update'
                ? `Your existing request will be updated with your current selections (${selections.length} item${selections.length !== 1 ? 's' : ''}). The admin will be notified of the change.`
                : `Your current selections (${selections.length} item${selections.length !== 1 ? 's' : ''}) will be sent to our team. You can add an optional note below.`
              }
            </p>
            <textarea
              className="quote-modal-notes"
              placeholder="Any special requests or questions for our team… (optional)"
              value={quoteNotes}
              onChange={e => setQuoteNotes(e.target.value)}
              rows={4}
              disabled={quoteSubmitting}
            />
            {quoteError && <p className="quote-modal-error">{quoteError}</p>}
            <div className="quote-modal-actions">
              <button
                className="quote-modal-submit"
                onClick={handleRequestQuote}
                disabled={quoteSubmitting}
              >
                {quoteSubmitting ? 'Submitting…' : quoteModalMode === 'update' ? 'Update Request' : 'Submit Request'}
              </button>
              <button
                className="quote-modal-cancel"
                onClick={() => setQuoteModalOpen(false)}
                disabled={quoteSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floor plan lightbox ── */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl('')}>
          <button className="lightbox-close" onClick={() => setLightboxUrl('')}><X size={22} /></button>
          <img
            src={lightboxUrl}
            alt="Floor plan"
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Mock Villa gallery modal ── */}
      {galleryOpen && (
        <div className="mv-overlay" onClick={() => setGalleryOpen(false)}>
          <div className="mv-panel" onClick={e => e.stopPropagation()}>
            <div className="mv-header">
              <div>
                <h2 className="mv-title">Mock Villa</h2>
                <p className="mv-subtitle">Reference images across all floors</p>
              </div>
              <button className="mv-close" onClick={() => setGalleryOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="mv-body">
              {MOCK_GALLERY.map(section => (
                <div key={section.group} className="mv-section">
                  <h3 className="mv-section-title">{section.group}</h3>
                  <div className="mv-grid">
                    {section.images.map(img => (
                      <div key={img.file} className="mv-item" onClick={() => setGalleryLightbox(img)}>
                        <div className="mv-img-wrap">
                          <img
                            src={mockImgSrc(img.file)}
                            alt={img.label}
                            loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
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

      {/* ── Mock Villa lightbox ── */}
      {galleryLightbox && (
        <div className="mv-lightbox" onClick={() => setGalleryLightbox(null)}>
          <button className="mv-lightbox-close" onClick={() => setGalleryLightbox(null)}>
            <X size={24} />
          </button>
          <img
            src={mockImgSrc(galleryLightbox.file)}
            alt={galleryLightbox.label}
            className="mv-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          <p className="mv-lightbox-label" onClick={e => e.stopPropagation()}>
            {galleryLightbox.label}
          </p>
        </div>
      )}

    </div>
  )
}

/* ══════════════════════════════════════════════════
   OPTION CARD
══════════════════════════════════════════════════ */
function OptionCard({
  opt, selectedType, onSelect, isPackage, coveredByPackage, locationMap, onImageClick,
}: {
  opt: Option
  selectedType?: string
  onSelect: (opt: Option, type: 'standard' | 'upgrade') => void
  isPackage: boolean
  coveredByPackage?: string
  locationMap: Record<string, Room>
  onImageClick?: (url: string) => void
}) {
  if (isPackage) return <PackageCard opt={opt} selectedType={selectedType} onSelect={onSelect} locationMap={locationMap} onImageClick={onImageClick} />

  // has_upgrade=false → filtered out before reaching here, but guard anyway
  if (!opt.has_upgrade) return null

  const hasStandard = Boolean(opt.standard_spec)
  const upgradeOnly = !hasStandard

  // ── Room is covered by a selected package ──────────────────────────────
  if (coveredByPackage) {
    return (
      <div className="opt-card opt-card--pkg-covered">
        <div className="opt-card-header">
          <span className="opt-card-name">{opt.option_name ?? opt.space ?? opt.option_id}</span>
          {opt.room_code && <span className="opt-card-code">{opt.room_code}</span>}
        </div>
        <div className="pkg-covered-banner">
          <span className="pkg-covered-check">✓</span>
          <span className="pkg-covered-text">
            Included in <strong>{coveredByPackage}</strong>
          </span>
        </div>
        {opt.standard_spec && (
          <p className="pkg-covered-spec">
            <em>Standard:</em> {opt.standard_spec}
            {opt.upgrade_spec && <><br /><em>Upgrade:</em> {opt.upgrade_spec}</>}
          </p>
        )}
        <div className="opt-price-row">
          <span className="pkg-covered-price-note">Price included in package</span>
        </div>
      </div>
    )
  }

  // ── Horizontal card (upgradeOnly: single image, no standard alternative) ──
  if (upgradeOnly) {
    const imgSrcUrl = imgUrl(opt.images?.upgrade)

    return (
      <div
        className={`opt-card opt-card--horizontal ${selectedType ? 'opt-card--horizontal-selected' : ''}`}
        onClick={() => onSelect(opt, 'upgrade')}
      >
        {/* Left: image */}
        <div
          className="opt-horiz-img"
          onClick={e => { if (imgSrcUrl && onImageClick) { e.stopPropagation(); onImageClick(imgSrcUrl) } }}
        >
          <img
            src={imgSrcUrl ?? '/placeholder.png'}
            alt={opt.option_name ?? ''}
            onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="160"><rect width="200" height="160" fill="%23f5f4f2"/><text x="100" y="85" text-anchor="middle" fill="%23ccc" font-size="13">No image</text></svg>' }}
          />
          {imgSrcUrl && <span className="spec-img-zoom-hint">🔍 Enlarge</span>}
        </div>

        {/* Right: details */}
        <div className="opt-horiz-body">
          <div className="opt-horiz-top">
            <h3 className="opt-horiz-name">{opt.option_name ?? opt.space ?? opt.option_id}</h3>
            {opt.room_code && <span className="opt-card-code">{opt.room_code}</span>}
          </div>

          {(opt.detailed_spec ?? opt.description) && (
            <p className="opt-horiz-desc">{opt.detailed_spec ?? opt.description}</p>
          )}

          <div className="opt-horiz-footer">
            <span className="opt-price">{formatPrice(opt)}</span>
            <button
              className={`opt-horiz-btn ${selectedType ? 'opt-horiz-btn--selected' : ''}`}
              onClick={e => { e.stopPropagation(); onSelect(opt, 'upgrade') }}
            >
              {selectedType ? '✓ Selected' : 'Select'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Standard / Upgrade split card ─────────────────────────────────────
  const stdList = opt.images?.standard_list ?? []
  const upgList = opt.images?.upgrade_list ?? []

  // ── Multi-image comparison card (sanitaryware / rich-image options) ───
  if (stdList.length > 0 || upgList.length > 0) {
    const errStd = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="72"><rect width="80" height="72" fill="%23f0efed"/><text x="40" y="41" text-anchor="middle" fill="%23bbb" font-size="10">No image</text></svg>'
    const errUpg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="72"><rect width="80" height="72" fill="%23fff3f0"/><text x="40" y="41" text-anchor="middle" fill="%23F05E3E" font-size="10">No image</text></svg>'
    return (
      <div className={`opt-card opt-card--comparison ${selectedType ? 'opt-card--comparison-selected' : ''}`}>
        {/* ── Header bar ── */}
        <div className="cmp-header">
          <span className="cmp-title">{opt.option_name ?? opt.space ?? opt.option_id}</span>
          {opt.room_code && <span className="opt-card-code">{opt.room_code}</span>}
        </div>

        {/* ── Two-panel body ── */}
        <div className="cmp-body">

          {/* Standard panel */}
          <div
            className={`cmp-panel cmp-panel--std ${selectedType === 'standard' ? 'cmp-panel--active' : ''}`}
            onClick={() => onSelect(opt, 'standard')}
          >
            <div className="cmp-panel-badge cmp-panel-badge--std">Standard</div>
            <div className="cmp-img-grid cmp-img-grid--std">
              {stdList.map((img, i) => {
                const u = imgUrl(img.path)
                return (
                  <div key={i} className="cmp-img-tile" onClick={e => { if (u && onImageClick) { e.stopPropagation(); onImageClick(u) } }}>
                    <img src={u ?? ''} alt={img.label} onError={e => { (e.target as HTMLImageElement).src = errStd }} />
                    <span className="cmp-img-label">{img.label}</span>
                  </div>
                )
              })}
            </div>
            <p className="cmp-spec-text">{opt.standard_spec}</p>
            <button
              className={`cmp-btn cmp-btn--std ${selectedType === 'standard' ? 'cmp-btn--active' : ''}`}
              onClick={e => { e.stopPropagation(); onSelect(opt, 'standard') }}
            >
              {selectedType === 'standard' ? '✓ Keeping Standard' : 'Keep Standard'}
            </button>
          </div>

          {/* Divider */}
          <div className="cmp-divider">
            <span className="cmp-vs">vs</span>
          </div>

          {/* Upgrade panel */}
          <div
            className={`cmp-panel cmp-panel--upg ${selectedType === 'upgrade' ? 'cmp-panel--active' : ''}`}
            onClick={() => onSelect(opt, 'upgrade')}
          >
            <div className="cmp-panel-badge cmp-panel-badge--upg">Upgrade</div>
            <div className="cmp-img-grid cmp-img-grid--upg">
              {upgList.map((img, i) => {
                const u = imgUrl(img.path)
                return (
                  <div key={i} className="cmp-img-tile" onClick={e => { if (u && onImageClick) { e.stopPropagation(); onImageClick(u) } }}>
                    <img src={u ?? ''} alt={img.label} onError={e => { (e.target as HTMLImageElement).src = errUpg }} />
                    <span className="cmp-img-label">{img.label}</span>
                  </div>
                )
              })}
            </div>
            <p className="cmp-spec-text">{opt.upgrade_spec}</p>
            <button
              className={`cmp-btn cmp-btn--upg ${selectedType === 'upgrade' ? 'cmp-btn--active' : ''}`}
              onClick={e => { e.stopPropagation(); onSelect(opt, 'upgrade') }}
            >
              {selectedType === 'upgrade' ? '✓ Selected' : 'Select Upgrade'}
            </button>
          </div>
        </div>

        {/* ── Footer: price ── */}
        <div className="cmp-footer">
          <span className="opt-price">{formatPrice(opt)}</span>
          {opt.price_unit && <span className="opt-unit">/ {opt.price_unit}</span>}
        </div>
      </div>
    )
  }

  // ── Plain standard / upgrade split card (single image each) ──────────
  return (
    <div className="opt-card">
      <div className="opt-card-header">
        <span className="opt-card-name">{opt.option_name ?? opt.space ?? opt.option_id}</span>
        {opt.package_tier && opt.package_tier !== opt.option_name && (
          <span className="opt-card-tier">{opt.package_tier}</span>
        )}
        {opt.room_code && !opt.package_tier && <span className="opt-card-code">{opt.room_code}</span>}
      </div>

      <div className={`opt-specs ${upgradeOnly ? 'opt-specs--single' : ''}`}>
        {hasStandard && (
          <div
            className={`spec-card ${selectedType === 'standard' ? 'selected' : ''}`}
            onClick={() => onSelect(opt, 'standard')}
          >
            <div className="spec-img-wrap">
              <img src={imgUrl(opt.images?.standard) ?? '/placeholder.png'} alt="standard"
                style={{ cursor: onImageClick && opt.images?.standard ? 'zoom-in' : 'default' }}
                onClick={e => { const u = imgUrl(opt.images?.standard); if (u && onImageClick) { e.stopPropagation(); onImageClick(u) } }}
                onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="%23f5f5f5"/><text x="50" y="45" text-anchor="middle" fill="%23aaa" font-size="11">Standard</text></svg>' }}
              />
            </div>
            <p className="spec-label">Standard</p>
            <p className="spec-desc">{opt.standard_spec}</p>
            <div className={`spec-check ${selectedType === 'standard' ? 'active' : ''}`}>
              {selectedType === 'standard' ? '✓ Selected' : 'Keep Standard'}
            </div>
          </div>
        )}

        <div
          className={`spec-card spec-card--upgrade ${selectedType === 'upgrade' ? 'selected' : ''}`}
          onClick={() => onSelect(opt, 'upgrade')}
        >
          <div className="spec-img-wrap" onClick={e => { const u = imgUrl(opt.images?.upgrade); if (u && onImageClick) { e.stopPropagation(); onImageClick(u) } }}>
            <img src={imgUrl(opt.images?.upgrade) ?? '/placeholder.png'} alt="upgrade"
              onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="%23fff3f0"/><text x="50" y="45" text-anchor="middle" fill="%23F05E3E" font-size="11">Upgrade</text></svg>' }}
            />
            <span className="spec-img-zoom-hint">🔍 Click to enlarge</span>
          </div>
          <p className="spec-label upgrade-label">Upgrade</p>
          <p className="spec-desc">{opt.upgrade_spec ?? opt.description ?? '–'}</p>
          <div className={`spec-check upgrade ${selectedType === 'upgrade' ? 'active' : ''}`}>
            {selectedType === 'upgrade' ? '✓ Selected' : 'Select Upgrade'}
          </div>
        </div>
      </div>

      <div className="opt-price-row">
        <span className="opt-price">{formatPrice(opt)}</span>
        {opt.price_unit && <span className="opt-unit">/ {opt.price_unit}</span>}
      </div>
    </div>
  )
}

/* ── Package card (flooring packages) ─────────── */
function PackageCard({
  opt, selectedType, onSelect, locationMap, onImageClick,
}: {
  opt: Option
  selectedType?: string
  onSelect: (opt: Option, type: 'standard' | 'upgrade') => void
  locationMap: Record<string, Room>
  onImageClick?: (url: string) => void
}) {
  const [planExpanded, setPlanExpanded] = useState(false)
  const standardList  = opt.images?.standard_list ?? []
  const upgradeImg    = imgUrl(opt.images?.upgrade)
  const floorPlanImg  = imgUrl(opt.floor_plan_image)

  // Collect unique standard specs for display (may vary by room)
  const uniqueSpecs = Array.from(
    new Set((opt.rooms_covered ?? []).map(r => r.standard_spec).filter(Boolean))
  )

  return (
    <div className={`pkg-card ${selectedType ? 'selected' : ''}`}>

      {/* ── Top row: name + selected badge ── */}
      <div className="pkg-card-top">
        <span className="pkg-name">{opt.option_name ?? opt.description}</span>
        {selectedType && <span className="pkg-check">✓ Selected</span>}
      </div>

      {/* ── Rooms covered chips ── */}
      {(opt.rooms_covered ?? []).length > 0 && (
        <div className="pkg-rooms">
          {(opt.rooms_covered ?? []).map((r, i) => (
            <span key={i} className="pkg-room-chip">
              {locationMap[r.location_id]?.space ?? r.space ?? r.location_id}
            </span>
          ))}
        </div>
      )}

      {/* ── Images: standard finishes + upgrade ── */}
      <div className="pkg-images-row">
        {/* Standard: one thumb per distinct finish */}
        <div className="pkg-images-col">
          <span className="pkg-img-section-label">Standard</span>
          <div className="pkg-std-imgs">
            {standardList.length > 0
              ? standardList.map((img, i) => {
                  const url = imgUrl(img.path)
                  return (
                    <div key={i} className="pkg-img-wrap" onClick={() => url && onImageClick?.(url)}>
                      <img
                        src={url ?? ''}
                        alt={img.label}
                        onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="%23f5f4f2"/><text x="60" y="50" text-anchor="middle" fill="%23bbb" font-size="11">No image</text></svg>' }}
                      />
                      <span className="pkg-img-label">{img.label}</span>
                      <span className="pkg-img-zoom">🔍</span>
                    </div>
                  )
                })
              : uniqueSpecs.map((spec, i) => (
                  <div key={i} className="pkg-spec-pill">{spec}</div>
                ))
            }
          </div>
        </div>

        <div className="pkg-images-arrow">→</div>

        {/* Upgrade: single image */}
        <div className="pkg-images-col">
          <span className="pkg-img-section-label">Upgrade</span>
          <div className="pkg-upg-img">
            {upgradeImg
              ? (
                <div className="pkg-img-wrap" onClick={() => onImageClick?.(upgradeImg)}>
                  <img
                    src={upgradeImg}
                    alt="Upgrade"
                    onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="%23fff3f0"/><text x="60" y="50" text-anchor="middle" fill="%23F05E3E" font-size="11">No image</text></svg>' }}
                  />
                  <span className="pkg-img-label">{opt.rooms_covered?.[0]?.upgrade_spec ?? 'Upgrade'}</span>
                  <span className="pkg-img-zoom">🔍</span>
                </div>
              )
              : <div className="pkg-spec-pill">{opt.rooms_covered?.[0]?.upgrade_spec ?? '–'}</div>
            }
          </div>
        </div>
      </div>

      {/* ── Expandable floor plan ── */}
      {floorPlanImg && planExpanded && (
        <div className="pkg-floorplan-expand">
          <img
            src={floorPlanImg}
            alt={`${opt.option_name} floor plan`}
            className="pkg-floorplan-img"
            onClick={() => onImageClick?.(floorPlanImg)}
            title="Click to enlarge"
          />
        </div>
      )}

      {/* ── Action row: price + view plan + select ── */}
      <div className="pkg-actions">
        <span className="opt-price">{formatPrice(opt)}</span>
        <div className="pkg-action-btns">
          {floorPlanImg && (
            <button
              className="pkg-details-btn"
              onClick={() => setPlanExpanded(prev => !prev)}
            >
              {planExpanded ? 'Hide Floor Plan ↑' : 'View Floor Plan ↓'}
            </button>
          )}
          <button
            className={`pkg-select-btn ${selectedType ? 'pkg-select-btn--selected' : ''}`}
            onClick={() => onSelect(opt, 'upgrade')}
          >
            {selectedType ? '✓ Selected' : 'Select Package'}
          </button>
        </div>
      </div>
    </div>
  )
}

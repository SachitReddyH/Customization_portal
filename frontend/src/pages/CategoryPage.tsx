import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, X, ChevronDown, ChevronRight, ChevronLeft, ShoppingCart, Images } from 'lucide-react'
import {
  getCategory, getCategories, getFloors, getRooms, getRoomOptions,
  getDirectOptions, getFlooringPackages,
  getMyVilla, getMySelections, upsertSelection, removeSelection, clearAllSelections,
  getMyQuotes, requestQuote,
  submitInterest,
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
  images: { standard?: string; standard_list?: { path: string; label: string; code?: string; product_name?: string }[]; upgrade?: string; upgrade_list?: { path: string; label: string; code?: string; product_name?: string }[]; addon_list?: { path: string; label: string; option_id?: string }[] }
  floor_plan_image?: string
  option_type?: string
  vrf_benefits?: string[]
  vrf_tech_specs?: string[]
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
    { id: 'addon',   label: 'Add-Ons'  },
  ],
  CAT003: [{ id: 'sanitaryware', label: 'Sanitaryware' }, { id: 'cp_fittings', label: 'CP Fittings' }],
}

// Display labels for sub_section groups within direct (non-room) categories
const SUB_GROUP_LABELS: Record<string, string> = {
  kitchen:      'Kitchen',
  home_theatre: 'Home Theatre / Private Office',
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

/* ── Bathroom highlighted floor plan URL helper ─── */
const BATHROOM_ROOM_KEY: Record<string, string> = {
  'master': 'masterbedroom',
  'bedroom 1': 'bedroom1',
  'bedroom 2': 'bedroom2',
  'bedroom 3': 'bedroom3',
}

const bathroomFloorPlanUrl = (villa: any, roomSpace: string) => {
  if (!villa || !roomSpace) return null
  const t = villa.villa_type?.toLowerCase().replace(/\s+/g, '') // 'type1'
  const f = villa.facing?.toLowerCase()                          // 'east'/'west'
  const valid = ['type1_east', 'type2_west']
  const key = `${t}_${f}`
  if (!valid.includes(key)) return null
  const lower = roomSpace.toLowerCase()
  let imgKey: string | null = null
  for (const [match, file] of Object.entries(BATHROOM_ROOM_KEY)) {
    if (lower.includes(match)) { imgKey = file; break }
  }
  if (!imgKey) return null
  return `${BASE}/static/floor_plans/bathroom/${key}/${imgKey}.png`
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

const ALL_MOCK_IMAGES: MockImage[] = MOCK_GALLERY.flatMap(g => g.images)

const mockImgSrc = (file: string) => `/mockvillaimages/${encodeURIComponent(file)}`

// Resolve image URLs — static assets live on the Render backend
const imgUrl = (path?: string | null) => {
  if (!path) return null
  if (path.startsWith('/static/')) return `${BASE}${path}`
  return path
}

// Items in upgrade_list that should be treated as add-ons, not upgrade alternatives
const ADDON_LABELS = new Set(['Bathtub', 'Jacuzzi'])

// Static addon definitions per sanitaryware series (keyed by lowercase upgrade_spec prefix)
// These are shown as collapsible add-ons under each series card
const BASE_CAT003 = '/static/options/CAT003'
const SERIES_ADDONS: Record<string, { label: string; path: string }[]> = {
  'happy d2': [
    { label: 'Bathtub', path: `${BASE_CAT003}/happyd2_bathtub.png`  },
    { label: 'Jacuzzi', path: `${BASE_CAT003}/happyd2_jacuzzi.jpeg` },
  ],
  'qatego': [
    { label: 'Bathtub', path: `${BASE_CAT003}/qatego_bathtub.png` },
  ],
  'zencha': [
    { label: 'Bathtub', path: `${BASE_CAT003}/zencha_bathtub.png`  },
    { label: 'Jacuzzi', path: `${BASE_CAT003}/zencha_jacuzzi.png`  },
  ],
}

/** Decode a synthetic addon option_id (e.g. OPT-BP-001-ADN-BAT) into a readable name.
 *  Optionally looks up the parent in optionMap to append the series name. */
function resolveOptionName(
  optionId: string,
  optionMap: Record<string, Option>
): string {
  const opt = optionMap[optionId]
  if (opt) return opt.option_name ?? opt.space ?? opt.description ?? optionId

  const adnMatch = optionId.match(/^(.+)-ADN-([A-Z]+)$/)
  if (adnMatch) {
    const [, parentId, code] = adnMatch
    const label = code === 'BAT' ? 'Bathtub' : code === 'JAC' ? 'Jacuzzi' : code
    const parent = optionMap[parentId]
    const series = parent
      ? ` — ${(parent.upgrade_spec ?? parent.option_name ?? '').replace(/ series$/i, '').trim()}`
      : ''
    return `${label}${series}`
  }
  return optionId
}

/** Return addon definitions for a sanitaryware series card, or [] if not applicable. */
function getSeriesAddons(opt: Option): { label: string; path: string }[] {
  if (opt.category_id !== 'CAT003' || opt.sub_section !== 'sanitaryware') return []
  const spec = (opt.upgrade_spec ?? opt.option_name ?? '').toLowerCase()
  for (const [key, addons] of Object.entries(SERIES_ADDONS)) {
    if (spec.includes(key)) return addons
  }
  return []
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

  // Coming-soon interest
  const [interestSent, setInterestSent]       = useState(false)
  const [interestLoading, setInterestLoading] = useState(false)

  // Floor plan lightbox
  const [lightboxUrl, setLightboxUrl] = useState('')
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

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!galleryLightbox) return
    const idx = ALL_MOCK_IMAGES.findIndex(i => i.file === galleryLightbox.file)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setGalleryLightbox(ALL_MOCK_IMAGES[(idx + 1) % ALL_MOCK_IMAGES.length])
      else if (e.key === 'ArrowLeft') setGalleryLightbox(ALL_MOCK_IMAGES[(idx - 1 + ALL_MOCK_IMAGES.length) % ALL_MOCK_IMAGES.length])
      else if (e.key === 'Escape') setGalleryLightbox(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [galleryLightbox])

  const isRoomBased  = ROOM_BASED.includes(categoryId!)
  const isPackageTab = activeTab === 'package'
  const isAddonTab   = activeTab === 'addon'

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
    if (!isRoomBased || !selectedRoom || isPackageTab || isAddonTab) return
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

  /* ── Load add-ons (flooring add-ons tab) ──────── */
  useEffect(() => {
    if (!isAddonTab) return
    setOptionsLoading(true)
    getDirectOptions(categoryId!, 'addon')
      .then((opts: Option[]) => {
        setOptions(opts)
        setOptionMap(prev => {
          const next = { ...prev }
          opts.forEach(o => { next[o.option_id] = o })
          return next
        })
      })
      .catch(console.error)
      .finally(() => setOptionsLoading(false))
  }, [isAddonTab])

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

    // Helper: is this a sanitaryware series (not an add-on)?
    const isSanitarySeries = (optionId: string) =>
      opt.category_id === 'CAT003' && opt.sub_section === 'sanitaryware' && !optionId.includes('-ADN-')

    try {
      // ── REMOVING a selection ─────────────────────────────────────────────
      if (alreadySelected) {
        // Step 1: remove the item itself
        let live = (await removeSelection({ option_id: opt.option_id, location_id: opt.location_id })).selections ?? []

        // Step 2: if it was a series upgrade, also remove its add-ons
        if (isSanitarySeries(opt.option_id)) {
          const addonsToRemove = live.filter(
            (s: SelectionItem) => s.option_id.startsWith(`${opt.option_id}-ADN-`) && s.location_id === opt.location_id
          )
          for (const addon of addonsToRemove) {
            const r = await removeSelection({ option_id: addon.option_id, location_id: addon.location_id })
            live = r.selections ?? []
          }
        }

        setSelections(live)
        return
      }

      // ── ADDING a selection ───────────────────────────────────────────────
      // Track live selections through each sequential API call
      let live: SelectionItem[] = [...selections]

      // Kitchen mutual exclusivity
      if (opt.sub_section === 'kitchen') {
        const rival = live.find(s =>
          s.category_id === opt.category_id &&
          s.sub_section === 'kitchen' &&
          s.option_id !== opt.option_id
        )
        if (rival) {
          const r = await removeSelection({ option_id: rival.option_id, location_id: rival.location_id })
          live = r.selections ?? []
        }
      }

      // Sanitaryware: only one series per bathroom — remove old series + its add-ons
      if (isSanitarySeries(opt.option_id)) {
        // Find any other series already selected for this same room
        const oldSeries = live.find(s =>
          s.category_id === 'CAT003' &&
          s.sub_section === 'sanitaryware' &&
          s.location_id === opt.location_id &&
          !s.option_id.includes('-ADN-') &&
          s.option_id !== opt.option_id
        )
        if (oldSeries) {
          // Remove old series upgrade
          const r1 = await removeSelection({ option_id: oldSeries.option_id, location_id: oldSeries.location_id })
          live = r1.selections ?? []

          // Remove all add-ons that belong to the old series
          const oldAddons = live.filter(
            (s: SelectionItem) => s.option_id.startsWith(`${oldSeries.option_id}-ADN-`) && s.location_id === opt.location_id
          )
          for (const addon of oldAddons) {
            const r = await removeSelection({ option_id: addon.option_id, location_id: addon.location_id })
            live = r.selections ?? []
          }
        }
      }

      // CP Fittings: only one package per bathroom room
      if (opt.category_id === 'CAT003' && opt.sub_section === 'cp_fittings') {
        const oldCp = live.find(s =>
          s.category_id === 'CAT003' &&
          s.sub_section === 'cp_fittings' &&
          s.location_id === opt.location_id &&
          s.option_id !== opt.option_id
        )
        if (oldCp) {
          const r = await removeSelection({ option_id: oldCp.option_id, location_id: oldCp.location_id })
          live = r.selections ?? []
        }
      }

      // Smart Home: only one package (Gold or Platinum) — remove any other CAT006 selection
      if (opt.category_id === 'CAT006') {
        const oldSh = live.find(s =>
          s.category_id === 'CAT006' &&
          s.option_id !== opt.option_id
        )
        if (oldSh) {
          const r = await removeSelection({ option_id: oldSh.option_id, location_id: oldSh.location_id })
          live = r.selections ?? []
        }
      }

      // Lift Interior: only one package — remove any other CAT004 selection
      if (opt.category_id === 'CAT004') {
        const oldLift = live.find(s =>
          s.category_id === 'CAT004' &&
          s.option_id !== opt.option_id
        )
        if (oldLift) {
          const r = await removeSelection({ option_id: oldLift.option_id, location_id: oldLift.location_id })
          live = r.selections ?? []
        }
      }

      // Flooring: only one package at a time — remove any other CAT002 package selection
      if (opt.category_id === 'CAT002' && opt.sub_section === 'package') {
        const oldPkg = live.find(s =>
          s.category_id === 'CAT002' &&
          s.sub_section === 'package' &&
          s.option_id !== opt.option_id
        )
        if (oldPkg) {
          const r = await removeSelection({ option_id: oldPkg.option_id, location_id: oldPkg.location_id })
          live = r.selections ?? []
        }
      }

      // Finally, add the new selection
      const updated = await upsertSelection({
        category_id: opt.category_id,
        sub_section: opt.sub_section,
        option_id: opt.option_id,
        location_id: opt.location_id,
        selection_type: type,
      })
      setSelections(updated.selections ?? [])

    } catch (e) { console.error(e) }
  }

  const handleRemoveFromCart = async (sel: SelectionItem) => {
    try {
      const updated = await removeSelection({ option_id: sel.option_id, location_id: sel.location_id })
      setSelections(updated.selections ?? [])
    } catch (e) { console.error(e) }
  }

  const handleClearCart = async () => {
    try {
      const updated = await clearAllSelections()
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
          <ArrowLeft size={18} /> Home
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

        {/* ══ LEFT — Floor sidebar (hidden on Packages + Add-Ons tabs) ══ */}
        {isRoomBased && !isPackageTab && !isAddonTab && (
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

                {/* Bathroom floor plan — shown below this floor's rooms when a room on this floor is selected */}
                {categoryId === 'CAT003' && expandedFloors.has(floor) && selectedRoom?.floor === floor && (() => {
                  const url = bathroomFloorPlanUrl(villa, selectedRoom.space)
                  return url ? (
                    <div className="sidebar-floorplan">
                      <p className="sidebar-floorplan-label">Floor Plan</p>
                      <div className="sidebar-floorplan-wrap" onClick={() => setLightboxUrl(url)} title="Click to enlarge">
                        <img src={url} alt={`${selectedRoom.space} floor plan`} className="sidebar-floorplan-img" />
                        <span className="sidebar-floorplan-hint">🔍 Enlarge</span>
                      </div>
                    </div>
                  ) : null
                })()}
              </div>
            ))}
          </aside>
        )}

        {/* ══ MIDDLE — Options panel ══ */}
        <main className={`options-panel ${(!isRoomBased || isPackageTab || isAddonTab) ? 'options-panel--wide' : ''}`}>

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
                : isAddonTab
                ? <span className="options-room">Add-Ons</span>
                : selectedRoom
                ? <><span className="options-room">{selectedRoom.space}</span><span className="options-floor">{selectedRoom.floor}</span></>
                : null
              }
            </div>
          )}

          {optionsLoading
            ? <div className="options-loading">Loading…</div>
            : (() => {
                // Separate intro card(s) — rendered above the selectable options
                const introOpts = options.filter(o => o.sub_section === 'intro')
                // For packages/addons show all; for regular options hide anything with no upgrade or intro
                const visible = (isPackageTab || isAddonTab)
                  ? options.filter(o => o.sub_section !== 'intro')
                  : options.filter(opt => opt.has_upgrade && opt.sub_section !== 'intro')
                if (visible.length === 0 && introOpts.length === 0)
                  return categoryId === 'CAT008' ? (
                    <div className="options-coming-soon">
                      <span className="coming-soon-heading">Coming Soon<span className="coming-soon-dots">...</span></span>
                      <span className="coming-soon-sub">
                        We're putting the finishing touches on this.
                      </span>
                      {interestSent ? (
                        <span className="coming-soon-sent">✓ We've noted your interest — we'll be in touch!</span>
                      ) : (
                        <button
                          className="coming-soon-btn"
                          disabled={interestLoading}
                          onClick={async () => {
                            setInterestLoading(true)
                            try {
                              await submitInterest(categoryId!, category?.category_name ?? 'Home Theatre')
                              setInterestSent(true)
                            } finally {
                              setInterestLoading(false)
                            }
                          }}
                        >
                          {interestLoading ? 'Sending…' : 'Let us know you\'re interested'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="options-empty">
                      {isRoomBased && !isPackageTab && !isAddonTab && !selectedRoom
                        ? 'Select a room from the left'
                        : 'No options available'}
                    </div>
                  )
                // Group by sub_section if options carry sub_section values
                const hasSubGroups = !isRoomBased && !isPackageTab &&
                  visible.some(o => o.sub_section && SUB_GROUP_LABELS[o.sub_section])

                // ── Intro card renderer ──────────────────────────────────
                const parseFeatures = (text: string) =>
                  text.split('\n').map(s => s.trim()).filter(Boolean)

                const introSection = introOpts.length > 0 ? (
                  <>
                    <div className="sh-intro-section">
                      {introOpts.map(opt => {
                        const features = opt.detailed_spec ? parseFeatures(opt.detailed_spec) : []
                        return (
                          <div key={opt.option_id} className="sh-intro-card">
                            {opt.images?.standard && (
                              <div className="sh-intro-img-wrap">
                                <img
                                  src={imgUrl(opt.images.standard) ?? ''}
                                  alt={opt.option_name ?? 'Smart Home'}
                                  className="sh-intro-img"
                                />
                              </div>
                            )}
                            <div className="sh-intro-content">
                              {opt.description && (
                                <p className="sh-intro-tagline">{opt.description}</p>
                              )}
                              {features.length > 0 && (
                                <ul className="sh-intro-features">
                                  {features.map((f, i) => {
                                    const dash = f.indexOf(' — ')
                                    return (
                                      <li key={i} className="sh-intro-feature">
                                        {dash > 0
                                          ? <><strong>{f.slice(0, dash)}</strong>{f.slice(dash)}</>
                                          : f
                                        }
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                              <p className="sh-intro-note">
                                * Based on the package chosen (Gold or Platinum), circuits and keypads change accordingly. Core features remain the same: Remote Access, Voice Control, OCPP Integration, CCTV &amp; Sonos Integration.
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {visible.length > 0 && (
                      <h3 className="sh-packages-heading">Choose Your Package</h3>
                    )}
                  </>
                ) : null

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
                    <>{introSection}<div className={`options-grid options-grid--direct`}>
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
                              selections={selections}
                              upgradeLabel={categoryId === 'CAT001' ? 'Option' : 'Upgrade'}
                              onRegisterOpts={opts => setOptionMap(prev => {
                                const next = { ...prev }
                                opts.forEach(o => { next[o.option_id] = o })
                                return next
                              })}
                            />
                          ))}
                        </div>
                      ))}
                    </div></>
                  )
                }

                return (
                  <div className={`options-grid${!isRoomBased ? ' options-grid--direct' : ''}${categoryId === 'CAT006' ? ' options-grid--sh' : ''}`}>
                    {introSection}
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
                        selections={selections}
                        upgradeLabel={categoryId === 'CAT001' ? 'Option' : 'Upgrade'}
                        onRegisterOpts={opts => setOptionMap(prev => {
                          const next = { ...prev }
                          opts.forEach(o => { next[o.option_id] = o })
                          return next
                        })}
                      />
                    ))}
                  </div>
                )
              })()
          }
        </main>

        {/* ══ RIGHT — Floor plan + Cart ══ */}
        <aside className="right-panel">

          {/* Floor plan removed from packages tab — shown inline in each card */}

          {/* Floor plan — room-based tabs (non-package, non-bathroom) */}
          {isRoomBased && !isPackageTab && selectedFloor && categoryId !== 'CAT003' && (
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
          <div className={`cart-section ${(!isRoomBased || isPackageTab || isAddonTab) ? 'cart-section--full' : ''}`}>
            <div className="cart-header">
              <ShoppingCart size={16} />
              <span>Your Selections</span>
              <span className="cart-count">{selections.length}</span>
              {selections.length > 0 && (
                <button className="cart-clear-btn" onClick={handleClearCart}>
                  Clear all
                </button>
              )}
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
                          const name = resolveOptionName(sel.option_id, optionMap)
                          return (
                            <div key={i} className="cart-item">
                              <div className="cart-item-info">
                                <span className="cart-item-name">{name}</span>
                                {opt?.space && opt?.option_name && (
                                  <span className="cart-item-room">{opt.space}</span>
                                )}
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
                <p className="mv-disclaimer"><strong>Disclaimer:</strong> These images are for reference purposes only and do not represent the actual final product, finishes, or dimensions.</p>
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
      {galleryLightbox && (() => {
        const idx = ALL_MOCK_IMAGES.findIndex(i => i.file === galleryLightbox.file)
        const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setGalleryLightbox(ALL_MOCK_IMAGES[(idx - 1 + ALL_MOCK_IMAGES.length) % ALL_MOCK_IMAGES.length]) }
        const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setGalleryLightbox(ALL_MOCK_IMAGES[(idx + 1) % ALL_MOCK_IMAGES.length]) }
        return (
          <div className="mv-lightbox" onClick={() => setGalleryLightbox(null)}>
            <button className="mv-lightbox-close" onClick={() => setGalleryLightbox(null)}>
              <X size={24} />
            </button>
            <button className="mv-lightbox-nav mv-lightbox-nav--prev" onClick={goPrev}>
              <ChevronLeft size={32} />
            </button>
            <img
              src={mockImgSrc(galleryLightbox.file)}
              alt={galleryLightbox.label}
              className="mv-lightbox-img"
              onClick={e => e.stopPropagation()}
            />
            <button className="mv-lightbox-nav mv-lightbox-nav--next" onClick={goNext}>
              <ChevronRight size={32} />
            </button>
            <p className="mv-lightbox-label" onClick={e => e.stopPropagation()}>
              {galleryLightbox.label} <span className="mv-lightbox-counter">({idx + 1} / {ALL_MOCK_IMAGES.length})</span>
            </p>
          </div>
        )
      })()}

    </div>
  )
}

/* ══════════════════════════════════════════════════
   OPTION CARD
══════════════════════════════════════════════════ */
function OptionCard({
  opt, selectedType, onSelect, isPackage, coveredByPackage, locationMap, onImageClick,
  selections, onRegisterOpts, upgradeLabel = 'Upgrade',
}: {
  opt: Option
  selectedType?: string
  onSelect: (opt: Option, type: 'standard' | 'upgrade') => void
  isPackage: boolean
  coveredByPackage?: string
  locationMap: Record<string, Room>
  onImageClick?: (url: string) => void
  selections?: SelectionItem[]
  onRegisterOpts?: (opts: Option[]) => void
  upgradeLabel?: string
}) {
  if (isPackage) return <PackageCard opt={opt} selectedType={selectedType} onSelect={onSelect} locationMap={locationMap} onImageClick={onImageClick} />

  // has_upgrade=false → filtered out before reaching here, but guard anyway
  if (!opt.has_upgrade) return null

  const hasStandard = Boolean(opt.standard_spec)
  const upgradeOnly = !hasStandard

  // Pre-compute image lists early so we can gate the horizontal card branch
  const stdListEarly = opt.images?.standard_list ?? []
  const upgListEarly = opt.images?.upgrade_list ?? []
  const hasImageLists = stdListEarly.length > 0 || upgListEarly.length > 0

  // ── Room is covered by a selected package ──────────────────────────────
  if (coveredByPackage) {
    return (
      <div className="opt-card opt-card--pkg-covered">
        <div className="opt-card-header">
          <span className="opt-card-name">{opt.option_name ?? opt.space ?? opt.option_id}</span>
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
      </div>
    )
  }

  // ── VRF card (CAT007 rich layout) ────────────────────────────────────────
  if (upgradeOnly && opt.category_id === 'CAT007') {
    return (
      <VrfCard
        opt={opt}
        selectedType={selectedType}
        onSelect={onSelect}
        onImageClick={onImageClick}
      />
    )
  }

  // ── Smart Home card (CAT006 packages) ────────────────────────────────────
  if (upgradeOnly && opt.category_id === 'CAT006') {
    return (
      <SmartHomeCard
        opt={opt}
        selectedType={selectedType}
        onSelect={onSelect}
        onImageClick={onImageClick}
      />
    )
  }

  // ── Horizontal card (upgradeOnly: single image, no standard alternative) ──
  if (upgradeOnly && !hasImageLists) {
    const imgSrcUrl = imgUrl(opt.images?.upgrade)

    // Categories that render description as bullet points
    const POINT_CATS    = new Set(['CAT004', 'CAT005'])
    const FULL_PT_CATS  = new Set(['CAT004'])          // Lift: show ALL bullets
    // CAT005: show first 3 + ellipsis + "View details" popup

    const isPointCat   = POINT_CATS.has(opt.category_id)
    const showAllPts   = FULL_PT_CATS.has(opt.category_id)
    const [detailsOpen, setDetailsOpen] = useState(false)

    // Parse detailed_spec into an array of strings
    const parsePoints = (text: string): string[] => {
      const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
      // Numbered list  "1. foo"
      if (lines.filter(l => /^\d+\./.test(l)).length >= 2) {
        return lines.map(l => l.replace(/^\d+\.\s*/, ''))
      }
      return lines
    }
    // Strip "Title – detail" down to just "Title" for in-card preview
    const pointTitle = (pt: string) => {
      const cut = pt.indexOf(' \u2013 ')   // en-dash
      if (cut > 0) return pt.slice(0, cut)
      const cut2 = pt.indexOf(' \u2014 ')  // em-dash
      if (cut2 > 0) return pt.slice(0, cut2)
      return pt
    }

    const allPoints     = isPointCat && opt.detailed_spec ? parsePoints(opt.detailed_spec) : []
    const previewPoints = showAllPts ? allPoints : allPoints.slice(0, 4)
    const hasMore       = !showAllPts && allPoints.length > 4

    return (
      <>
        <div
          className={`opt-card opt-card--horizontal ${showAllPts ? 'opt-card--horizontal--autoht' : ''} ${selectedType ? 'opt-card--horizontal-selected' : ''}`}
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
            </div>

            {isPointCat && allPoints.length > 0 ? (
              <ul className="opt-point-list">
                {previewPoints.map((pt, i) => (
                  <li key={i} className="opt-point-item">{pointTitle(pt)}</li>
                ))}
                {hasMore && (
                  <li className="opt-point-more">
                    <button
                      className="opt-point-viewmore"
                      onClick={e => { e.stopPropagation(); setDetailsOpen(true) }}
                    >
                      View details
                    </button>
                  </li>
                )}
              </ul>
            ) : (
              (opt.detailed_spec ?? opt.description) && (
                <p className="opt-horiz-desc">{opt.detailed_spec ?? opt.description}</p>
              )
            )}

            <div className="opt-horiz-footer">
              <button
                className={`opt-horiz-btn ${selectedType ? 'opt-horiz-btn--selected' : ''}`}
                onClick={e => { e.stopPropagation(); onSelect(opt, 'upgrade') }}
              >
                {selectedType ? '✓ Selected' : 'Select'}
              </button>
            </div>
          </div>
        </div>

        {/* Full details popup (CAT005 / CAT006) */}
        {detailsOpen && (
          <div className="desc-modal-overlay" onClick={() => setDetailsOpen(false)}>
            <div className="desc-modal" onClick={e => e.stopPropagation()}>
              <div className="desc-modal-header">
                <h3 className="desc-modal-title">{opt.option_name ?? opt.space}</h3>
                <button className="desc-modal-close" onClick={() => setDetailsOpen(false)}><X size={20} /></button>
              </div>
              <div className="desc-modal-body">
                <ul className="opt-point-list opt-point-list--full">
                  {allPoints.map((pt, i) => (
                    <li key={i} className="opt-point-item">
                      <span className="opt-point-title">{pointTitle(pt)}</span>
                      {pt !== pointTitle(pt) && (
                        <span className="opt-point-detail"> — {pt.slice(pointTitle(pt).length + 3)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Multi-image comparison card (sanitaryware / rich-image options) ───
  if (hasImageLists) {
    return (
      <ComparisonCard
        opt={opt}
        selectedType={selectedType}
        onSelect={onSelect}
        onImageClick={onImageClick}
        selections={selections}
        onRegisterOpts={onRegisterOpts}
        upgradeLabel={upgradeLabel}
      />
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

    </div>
  )
}

/* ── Comparison card (sanitaryware / multi-image) ──────────────────── */
function ComparisonCard({
  opt, selectedType, onSelect, onImageClick, selections, onRegisterOpts, upgradeLabel = 'Upgrade',
}: {
  opt: Option
  selectedType?: string
  onSelect: (opt: Option, type: 'standard' | 'upgrade') => void
  onImageClick?: (url: string) => void
  selections?: SelectionItem[]
  onRegisterOpts?: (opts: Option[]) => void
  upgradeLabel?: string
}) {
  const stdList = opt.images?.standard_list ?? []
  // Filter out addon items from upgrade list (safety — in case they end up there)
  const upgList = (opt.images?.upgrade_list ?? []).filter(img => !ADDON_LABELS.has(img.label))

  // Addon definitions: 1) addon_list from API (stored in DB), 2) fallback to static series map
  const addonImgs: { path: string; label: string; option_id?: string }[] =
    (opt.images?.addon_list?.length ?? 0) > 0
      ? (opt.images!.addon_list!)
      : getSeriesAddons(opt)

  const [addonsOpen, setAddonsOpen] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; code: string; product_name: string } | null>(null)

  const showTooltip = (e: React.MouseEvent<HTMLSpanElement>, code: string, product_name: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, code, product_name })
  }
  const hideTooltip = () => setTooltip(null)

  // Series short name for display (e.g. "Happy D2 Series" → "Happy D2")
  const seriesShort = (opt.upgrade_spec ?? opt.option_name ?? '').replace(/ series$/i, '').trim()

  // Build synthetic Option objects for each addon so they can be cart-tracked
  // Use the option_id stored in DB addon_list if available, otherwise generate one
  const addonOpts = useMemo<Option[]>(() =>
    addonImgs.map(img => {
      const syntheticId = (img as any).option_id ?? `${opt.option_id}-ADN-${img.label.toUpperCase()}`
      return {
        id: syntheticId,
        option_id: syntheticId,
        category_id: opt.category_id,
        sub_section: opt.sub_section,
        location_id: opt.location_id,
        // Include series name so cart can differentiate across series
        option_name: `${img.label} — ${seriesShort}`,
        has_upgrade: true,
        price_status: opt.price_status,
        images: { upgrade: img.path },
      }
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [opt.option_id])

  // Register synthetic addon opts in parent's optionMap (for cart display)
  useEffect(() => {
    if (addonOpts.length > 0) onRegisterOpts?.(addonOpts)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opt.option_id])

  const errStd = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="72"><rect width="80" height="72" fill="%23f0efed"/><text x="40" y="41" text-anchor="middle" fill="%23bbb" font-size="10">No image</text></svg>'
  const errUpg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="72"><rect width="80" height="72" fill="%23fff3f0"/><text x="40" y="41" text-anchor="middle" fill="%23F05E3E" font-size="10">No image</text></svg>'
  const stdViewOnly = opt.sub_section === 'kitchen' || opt.sub_section === 'home_theatre'

  return (
    <div className={`opt-card opt-card--comparison ${selectedType ? 'opt-card--comparison-selected' : ''}`}>
      {/* ── Header bar ── */}
      <div className="cmp-header">
        <span className="cmp-title">{opt.option_name ?? opt.space ?? opt.option_id}</span>
      </div>

      {/* ── Labels row (above panels) ── */}
      <div className="cmp-labels-row">
        <div className="cmp-labels-std">Standard</div>
        <div className="cmp-labels-gap" />
        <div className="cmp-labels-upg">{upgradeLabel}</div>
      </div>

      {/* ── Two-panel body ── */}
      <div className={`cmp-body ${stdViewOnly ? 'cmp-body--kitchen' : ''}`}>

        {/* Standard panel */}
        <div
          className={`cmp-panel cmp-panel--std ${!stdViewOnly && selectedType === 'standard' ? 'cmp-panel--active' : ''} ${stdViewOnly ? 'cmp-panel--view-only' : ''}`}
          onClick={stdViewOnly ? undefined : () => onSelect(opt, 'standard')}
        >
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
          {stdViewOnly && <span className="cmp-view-only-label">Current layout</span>}
        </div>

        {/* Divider */}
        <div className="cmp-divider">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="4,8 16,22 4,36" fill="none" stroke="#F05E40" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
            <polyline points="20,8 32,22 20,36" fill="none" stroke="#F05E40" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Upgrade panel */}
        <div
          className={`cmp-panel cmp-panel--upg ${selectedType === 'upgrade' ? 'cmp-panel--active' : ''}`}
          onClick={() => onSelect(opt, 'upgrade')}
        >
          <div className={`cmp-img-grid cmp-img-grid--upg ${upgList.length === 1 ? 'cmp-img-grid--single' : ''}`}>
            {upgList.map((img, i) => {
              const u = imgUrl(img.path)
              return (
                <div key={i} className="cmp-img-tile" onClick={e => { if (u && onImageClick) { e.stopPropagation(); onImageClick(u) } }}>
                  <img src={u ?? ''} alt={img.label} onError={e => { (e.target as HTMLImageElement).src = errUpg }} />
                  <span
                    className={`cmp-img-label ${img.code ? 'cmp-img-label--has-tooltip' : ''}`}
                    onMouseEnter={img.code ? e => showTooltip(e, img.code!, img.product_name ?? '') : undefined}
                    onMouseLeave={img.code ? hideTooltip : undefined}
                  >
                    {img.label}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="cmp-spec-text">{opt.upgrade_spec}</p>
          <button
            className={`cmp-btn cmp-btn--upg ${selectedType === 'upgrade' ? 'cmp-btn--active' : ''}`}
            onClick={e => { e.stopPropagation(); onSelect(opt, 'upgrade') }}
          >
            {selectedType === 'upgrade' ? '✓ Selected' : `Select ${upgradeLabel}`}
          </button>
        </div>
      </div>

      {/* ── Add-Ons dropdown (Bathtub / Jacuzzi) ── */}
      {addonImgs.length > 0 && (
        <div className="cmp-addons">
          <button
            className={`cmp-addons-toggle ${addonsOpen ? 'cmp-addons-toggle--open' : ''}`}
            onClick={() => setAddonsOpen(prev => !prev)}
          >
            <span className="cmp-addons-toggle-label">
              Add-Ons Available
              <span className="cmp-addons-badge">{addonImgs.length}</span>
            </span>
            <ChevronDown size={15} className="cmp-addons-chevron" />
          </button>

          {addonsOpen && (
            <div className="cmp-addons-body">
              {/* Gate: series upgrade must be selected first */}
              {selectedType !== 'upgrade' && (
                <div className="cmp-addons-gate">
                  Select the <strong>{seriesShort}</strong> upgrade above to unlock add-ons
                </div>
              )}
              {addonOpts.map((addonOpt, i) => {
                const img = addonImgs[i]
                const u = imgUrl(img.path)
                const isAddonSel = (selections ?? []).some(
                  s => s.option_id === addonOpt.option_id && s.location_id === addonOpt.location_id
                )
                const locked = selectedType !== 'upgrade'
                return (
                  <div
                    key={addonOpt.option_id}
                    className={`cmp-addon-item ${isAddonSel ? 'cmp-addon-item--selected' : ''} ${locked ? 'cmp-addon-item--locked' : ''}`}
                  >
                    {u && (
                      <div className="cmp-addon-img" onClick={() => !locked && onImageClick?.(u)}>
                        <img src={u} alt={img.label}
                          onError={e => { (e.target as HTMLImageElement).src = errUpg }}
                        />
                        {!locked && <span className="spec-img-zoom-hint">🔍</span>}
                      </div>
                    )}
                    <div className="cmp-addon-info">
                      <span className="cmp-addon-name">{img.label}</span>
                      <span className="cmp-addon-note">{locked ? `Requires ${seriesShort} upgrade` : 'Optional add-on'}</span>
                    </div>
                    <button
                      className={`cmp-addon-btn ${isAddonSel ? 'cmp-addon-btn--selected' : ''} ${locked ? 'cmp-addon-btn--locked' : ''}`}
                      disabled={locked}
                      onClick={() => !locked && onSelect(addonOpt, 'upgrade')}
                    >
                      {isAddonSel ? '✓ Added' : '+ Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Portal tooltip — rendered on document.body, immune to overflow:hidden and transform ancestors */}
      {tooltip && createPortal(
        <div
          className="cmp-img-tooltip-fixed"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="cmp-img-tooltip-row">
            <span className="cmp-img-tooltip-key">Code</span>
            <span className="cmp-img-tooltip-val">{tooltip.code}</span>
          </div>
          <div className="cmp-img-tooltip-row">
            <span className="cmp-img-tooltip-key">Product</span>
            <span className="cmp-img-tooltip-val">{tooltip.product_name}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/* ── Smart Home card (CAT006 packages) ────────── */
function SmartHomeCard({
  opt, selectedType, onSelect, onImageClick,
}: {
  opt: Option
  selectedType?: string
  onSelect: (opt: Option, type: 'standard' | 'upgrade') => void
  onImageClick?: (url: string) => void
}) {
  const imgSrc = imgUrl(opt.images?.upgrade)
  const tier   = opt.package_tier ?? ''
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Parse numbered feature lines: "1. Title – detail" or "1. Title — detail"
  const parseFeatures = (text: string): { title: string; detail: string }[] =>
    text.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
      const stripped = line.replace(/^\d+\.\s*/, '')
      const cut  = stripped.indexOf(' \u2013 ')
      const cut2 = stripped.indexOf(' \u2014 ')
      const idx  = cut > 0 ? cut : cut2 > 0 ? cut2 : -1
      if (idx > 0) return { title: stripped.slice(0, idx), detail: stripped.slice(idx + 3) }
      return { title: stripped, detail: '' }
    })

  const features = opt.detailed_spec ? parseFeatures(opt.detailed_spec) : []

  const formatPrice = (p: number) => {
    if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`
    if (p >= 100000)   return `₹${(p / 100000).toFixed(p % 100000 === 0 ? 0 : 1)} L`
    return `₹${p.toLocaleString('en-IN')}`
  }

  return (
    <>
      <div className={`sm-card ${selectedType ? 'sm-card--selected' : ''}`}>

        {/* ── Package image — full, no crop ── */}
        {imgSrc && (
          <div className="sm-img-wrap" onClick={e => { e.stopPropagation(); onImageClick?.(imgSrc) }}>
            <img src={imgSrc} alt={opt.option_name ?? tier} className="sm-img" />
            <span className="spec-img-zoom-hint">🔍 Enlarge</span>
          </div>
        )}

        {/* ── Content ── */}
        <div className="sm-content">

          {/* Tier badge + name */}
          <div className="sm-header">
            {tier && (
              <span className={`sm-tier-badge sm-tier-badge--${tier.toLowerCase()}`}>
                {tier}
              </span>
            )}
            <h2 className="sm-name">{opt.option_name}</h2>
          </div>

          {/* Price */}
          {opt.price_status === 'fixed' && opt.price_inr != null && (
            <div className="sm-price-row">
              <span className="sm-price-val">{formatPrice(opt.price_inr)}</span>
              {opt.price_unit && <span className="sm-price-unit"> / {opt.price_unit}</span>}
            </div>
          )}

          {/* Footer: View Details + Select */}
          <div className="sm-footer">
            {features.length > 0 && (
              <button
                className="sm-details-btn"
                onClick={e => { e.stopPropagation(); setDetailsOpen(true) }}
              >
                View Details
              </button>
            )}
            <button
              className={`sm-select-btn ${selectedType ? 'sm-select-btn--selected' : ''}`}
              onClick={() => onSelect(opt, 'upgrade')}
            >
              {selectedType ? '✓ Selected' : 'Select Package'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Details modal ── */}
      {detailsOpen && (
        <div className="desc-modal-overlay" onClick={() => setDetailsOpen(false)}>
          <div className="desc-modal" onClick={e => e.stopPropagation()}>
            <div className="desc-modal-header">
              <div className="sm-modal-title-row">
                {tier && <span className={`sm-tier-badge sm-tier-badge--${tier.toLowerCase()}`}>{tier}</span>}
                <h3 className="desc-modal-title">{opt.option_name}</h3>
              </div>
              <button className="desc-modal-close" onClick={() => setDetailsOpen(false)}><X size={20} /></button>
            </div>
            <div className="desc-modal-body">
              <ul className="opt-point-list opt-point-list--full">
                {features.map((f, i) => (
                  <li key={i} className="opt-point-item">
                    <span className="opt-point-title">{f.title}</span>
                    {f.detail && <span className="opt-point-detail"> — {f.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── VRF card (CAT007 rich layout) ────────────── */
function VrfCard({
  opt, selectedType, onSelect, onImageClick,
}: {
  opt: Option
  selectedType?: string
  onSelect: (opt: Option, type: 'standard' | 'upgrade') => void
  onImageClick?: (url: string) => void
}) {
  const imgList = opt.images?.upgrade_list ?? []
  const img0 = imgList[0] ? imgUrl(imgList[0].path) : null
  const img1 = imgList[1] ? imgUrl(imgList[1].path) : null
  const img2 = imgList[2] ? imgUrl(imgList[2].path) : null

  const splitPoint = (pt: string) => {
    const cut = pt.indexOf(' \u2013 ')
    if (cut > 0) return { title: pt.slice(0, cut), detail: pt.slice(cut + 3) }
    const cut2 = pt.indexOf(' \u2014 ')
    if (cut2 > 0) return { title: pt.slice(0, cut2), detail: pt.slice(cut2 + 3) }
    return { title: pt, detail: '' }
  }

  const splitSpec = (s: string) => {
    const cut = s.indexOf(': ')
    if (cut > 0) return { key: s.slice(0, cut), val: s.slice(cut + 2) }
    return { key: s, val: '' }
  }

  return (
    <div className={`vrf-card ${selectedType ? 'vrf-card--selected' : ''}`}>

      {/* ── Top: images 0 and 2 side by side ── */}
      <div className="vrf-img-pair">
        {img0 && (
          <div className="vrf-img-pair-item" onClick={() => onImageClick?.(img0)}>
            <img src={img0} alt={imgList[0]?.label ?? ''} />
            <span className="spec-img-zoom-hint">🔍 Enlarge</span>
          </div>
        )}
        {img2 && (
          <div className="vrf-img-pair-item" onClick={() => onImageClick?.(img2)}>
            <img src={img2} alt={imgList[2]?.label ?? ''} />
            <span className="spec-img-zoom-hint">🔍 Enlarge</span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="vrf-content">

        {/* Headline */}
        <h2 className="vrf-name">{opt.option_name}</h2>
        {opt.description && <p className="vrf-headline">{opt.description}</p>}
        {opt.detailed_spec && <p className="vrf-intro">{opt.detailed_spec}</p>}

        {/* What Makes It Different */}
        {(opt.vrf_benefits ?? []).length > 0 && (
          <div className="vrf-section">
            <h4 className="vrf-section-title">What Makes It Different</h4>
            <ul className="vrf-benefits">
              {(opt.vrf_benefits ?? []).map((pt, i) => {
                const { title, detail } = splitPoint(pt)
                return (
                  <li key={i} className="vrf-benefit-item">
                    <span className="vrf-benefit-title">{title}</span>
                    {detail && <span className="vrf-benefit-detail"> — {detail}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* VRF vs VRV differences diagram */}
        {img1 && (
          <div className="vrf-info-img" onClick={() => onImageClick?.(img1)}>
            <img src={img1} alt={imgList[1]?.label ?? 'VRF Diagram'} />
          </div>
        )}

        {/* Technical Specifications */}
        {(opt.vrf_tech_specs ?? []).length > 0 && (
          <div className="vrf-section">
            <h4 className="vrf-section-title">Technical Specifications</h4>
            <div className="vrf-specs-grid">
              {(opt.vrf_tech_specs ?? []).map((s, i) => {
                const { key, val } = splitSpec(s)
                return (
                  <div key={i} className="vrf-spec-row">
                    <span className="vrf-spec-key">{key}</span>
                    <span className="vrf-spec-val">{val}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Select button */}
        <div className="vrf-footer">
          <button
            className={`vrf-select-btn ${selectedType ? 'vrf-select-btn--selected' : ''}`}
            onClick={() => onSelect(opt, 'upgrade')}
          >
            {selectedType ? '✓ Selected' : 'Select Upgrade'}
          </button>
        </div>
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
          <span className="pkg-rooms-label">Areas covered:</span>
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

        <div className="pkg-images-arrow">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="4,8 16,22 4,36" fill="none" stroke="#F05E40" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
            <polyline points="20,8 32,22 20,36" fill="none" stroke="#F05E40" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </div>

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

      {floorPlanImg && planExpanded && (
        <>
          <div className="pkg-floorplan-note">
            <span className="pkg-floorplan-note-dot" />
            Areas highlighted in red on the floor plan indicate the rooms included in this package.
          </div>
          <div className="pkg-floorplan-expand">
            <img
              src={floorPlanImg}
              alt={`${opt.option_name} floor plan`}
              className="pkg-floorplan-img"
              onClick={() => onImageClick?.(floorPlanImg)}
              title="Click to enlarge"
            />
          </div>
        </>
      )}

      {/* ── Action row: view plan + select ── */}
      <div className="pkg-actions">
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

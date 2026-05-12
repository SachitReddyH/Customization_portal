// @ts-ignore – xlsx-js-style ships its own types
import XLSXStyle from 'xlsx-js-style'

export interface QuotationItem {
  category:   string
  optionName: string
  room:       string
  type:       string
  price:      number | null
}

export interface QuotationData {
  customerName: string
  villaName:    string
  status:       string
  requestedAt:  string
  items:        QuotationItem[]
  total:        number | null
}

// ── Helpers ───────────────────────────────────────────────────────
function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(d: string): string {
  const utc = d.endsWith('Z') || d.includes('+') ? d : d + 'Z'
  return new Date(utc).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
}

// Cell factory
function c(
  v: string | number,
  opts: {
    bold?: boolean; italic?: boolean; sz?: number
    color?: string; bg?: string; align?: string; border?: boolean
    numFmt?: string
  } = {}
) {
  const font: any = { name: 'Calibri', sz: opts.sz ?? 10 }
  if (opts.bold)   font.bold   = true
  if (opts.italic) font.italic = true
  if (opts.color)  font.color  = { rgb: opts.color }

  const cell: any = { v, t: typeof v === 'number' ? 'n' : 's', s: { font } }
  if (opts.numFmt) cell.z = opts.numFmt

  if (opts.bg) cell.s.fill = { fgColor: { rgb: opts.bg }, patternType: 'solid' }

  cell.s.alignment = {
    horizontal: opts.align ?? 'left',
    vertical: 'center',
    wrapText: false,
  }

  if (opts.border) {
    const b = { style: 'thin', color: { rgb: 'E8E4DF' } }
    cell.s.border = { top: b, bottom: b, left: b, right: b }
  }

  return cell
}

const EMPTY = () => c('')

// ── Main export ───────────────────────────────────────────────────
export function generateQuotation(data: QuotationData): void {
  const rows: any[][] = []

  const push = (...cells: any[]) => rows.push(cells)

  // ── Row 1: title banner ──────────────────────────────────────
  push(
    c('CAPSTONE LIFE — Villa Customisation Quotation', {
      bold: true, sz: 16, color: 'FFFFFF', bg: 'F05E3E', align: 'center',
    }),
    EMPTY(), EMPTY(), EMPTY(), EMPTY(),
  )

  // ── Row 2: spacer ────────────────────────────────────────────
  push(EMPTY(), EMPTY(), EMPTY(), EMPTY(), EMPTY())

  // ── Rows 3-5: customer info ───────────────────────────────────
  const ref = `QT-${data.requestedAt.slice(0,10).replace(/-/g,'')}-${data.customerName.replace(/\s/g,'').toUpperCase().slice(0,4)}`
  const status = data.status.charAt(0).toUpperCase() + data.status.slice(1)

  const infoRows: [string,string,string,string][] = [
    ['Customer',  data.customerName,    'Villa',   data.villaName || '—'],
    ['Date',      fmtDate(data.requestedAt), 'Status', status],
    ['Reference', ref,                  'Items',   String(data.items.length)],
  ]
  for (const [l1, v1, l2, v2] of infoRows) {
    push(
      c(l1,  { bold: true, sz: 9, color: '888888', bg: 'FAF9F7' }),
      c(v1,  { bold: true, sz: 10, bg: 'FAF9F7' }),
      EMPTY(),
      c(l2,  { bold: true, sz: 9, color: '888888', bg: 'FAF9F7' }),
      c(v2,  { bold: true, sz: 10, bg: 'FAF9F7' }),
    )
  }

  // ── Row: spacer ──────────────────────────────────────────────
  push(EMPTY(), EMPTY(), EMPTY(), EMPTY(), EMPTY())

  // ── Table header ─────────────────────────────────────────────
  push(
    c('',              { bold: true, sz: 9.5, color: 'FFFFFF', bg: '1A1A1A', border: true }),
    c('Option / Selection', { bold: true, sz: 9.5, color: 'FFFFFF', bg: '1A1A1A', border: true }),
    c('Room / Location',    { bold: true, sz: 9.5, color: 'FFFFFF', bg: '1A1A1A', border: true }),
    c('Type',               { bold: true, sz: 9.5, color: 'FFFFFF', bg: '1A1A1A', border: true }),
    c('Price (INR)',         { bold: true, sz: 9.5, color: 'FFFFFF', bg: '1A1A1A', align: 'right', border: true }),
  )

  // ── Group by category ─────────────────────────────────────────
  const groups: Record<string, QuotationItem[]> = {}
  data.items.forEach(item => {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  })

  let rowIdx = 0
  for (const [cat, items] of Object.entries(groups)) {
    // Category header
    push(
      c(cat.toUpperCase(), { bold: true, sz: 8.5, color: 'C85A3A', bg: 'FFF8F5' }),
      EMPTY(), EMPTY(), EMPTY(), EMPTY(),
    )

    for (const item of items) {
      rowIdx++
      const bg = rowIdx % 2 === 0 ? 'FFFFFF' : 'FCFBFA'
      const priceDisplay = item.price !== null ? fmtINR(item.price) : 'On Request'
      const priceIsNum   = item.price !== null

      push(
        c('', { bg }),
        c(item.optionName,  { sz: 10, bg }),
        c(item.room || '—', { sz: 9.5, color: '6B6B6B', bg }),
        c(item.type === 'upgrade' ? 'Upgrade' : 'Standard', {
          sz: 9, bold: item.type === 'upgrade',
          color: item.type === 'upgrade' ? 'C85A3A' : '888888', bg,
        }),
        priceIsNum
          ? c(item.price!, { sz: 10, bold: true, bg, align: 'right', numFmt: '₹#,##0' })
          : c(priceDisplay, { sz: 9.5, italic: true, color: '999999', bg, align: 'right' }),
      )
    }
  }

  // ── Spacer ────────────────────────────────────────────────────
  push(EMPTY(), EMPTY(), EMPTY(), EMPTY(), EMPTY())

  // ── Total row ─────────────────────────────────────────────────
  push(
    c('', { bg: 'F05E3E' }),
    c('', { bg: 'F05E3E' }),
    c('', { bg: 'F05E3E' }),
    c('TOTAL QUOTED PRICE', { bold: true, sz: 11, color: 'FFFFFF', bg: 'F05E3E', align: 'right' }),
    data.total !== null
      ? c(data.total, { bold: true, sz: 12, color: 'FFFFFF', bg: 'F05E3E', align: 'right', numFmt: '₹#,##0' })
      : c('On Request',     { bold: true, sz: 11, color: 'FFFFFF', bg: 'F05E3E', align: 'right' }),
  )

  // ── Spacer ────────────────────────────────────────────────────
  push(EMPTY(), EMPTY(), EMPTY(), EMPTY(), EMPTY())

  // ── Notes ─────────────────────────────────────────────────────
  const notes = [
    '* This is a preliminary price quotation for villa customisation upgrades.',
    '* Prices are indicative and subject to final confirmation.',
    '* This quotation is valid for 30 days from the date of issue.',
    '* For queries, contact: admin@capstonelife.com',
  ]
  for (const note of notes) {
    push(c(note, { italic: true, sz: 8.5, color: 'AAAAAA' }), EMPTY(), EMPTY(), EMPTY(), EMPTY())
  }

  push(EMPTY(), EMPTY(), EMPTY(), EMPTY(), EMPTY())

  push(
    c(
      `Generated by Capstone Life Admin Portal  ·  ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}`,
      { italic: true, sz: 8, color: 'CCCCCC', align: 'center', bg: 'FAF9F7' }
    ),
    EMPTY(), EMPTY(), EMPTY(), EMPTY(),
  )

  // ── Build worksheet ───────────────────────────────────────────
  const ws: any = {}
  const cols = ['A','B','C','D','E']

  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      ws[`${cols[ci]}${ri + 1}`] = cell
    })
  })

  ws['!ref'] = `A1:E${rows.length}`

  // Merge title row across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },   // title banner
  ]

  // Column widths
  ws['!cols'] = [
    { wch: 4  },   // A gutter
    { wch: 34 },   // B Option
    { wch: 28 },   // C Room
    { wch: 14 },   // D Type
    { wch: 18 },   // E Price
  ]

  // Row heights
  const heights: Record<number, number> = { 0: 32, 1: 6 }
  ws['!rows'] = rows.map((_, i) => ({ hpt: heights[i] ?? 18 }))

  // ── Build workbook & download ─────────────────────────────────
  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Quotation')

  const safeName = data.customerName.replace(/\s+/g, '_')
  const dateStr  = data.requestedAt.slice(0, 10)
  XLSXStyle.writeFile(wb, `Quotation_${safeName}_${dateStr}.xlsx`)
}

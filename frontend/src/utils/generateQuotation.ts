import ExcelJS from 'exceljs'

interface QuotationItem {
  category: string
  optionName: string
  room: string
  type: string
  price: number | null
}

interface QuotationData {
  customerName: string
  villaName: string
  status: string
  requestedAt: string
  items: QuotationItem[]
  total: number | null
}

// ── Colour palette ────────────────────────────────────────────────
const ORANGE      = 'FFF05E3E'
const ORANGE_LIGHT= 'FFFDF1EE'
const DARK        = 'FF1A1A1A'
const MUTED       = 'FF6B6B6B'
const GREY_BG     = 'FFFAF9F7'
const WHITE       = 'FFFFFFFF'
const CAT_BG      = 'FFFFF8F5'
const BORDER_CLR  = 'FFE8E4DF'

function cell(ws: ExcelJS.Worksheet, row: number, col: number): ExcelJS.Cell {
  return ws.getCell(row, col)
}

function setFont(c: ExcelJS.Cell, opts: Partial<ExcelJS.Font>) {
  c.font = { name: 'Calibri', ...opts }
}

function setBg(c: ExcelJS.Cell, argb: string) {
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function setBorder(c: ExcelJS.Cell, style: ExcelJS.BorderStyle = 'thin', color = BORDER_CLR) {
  const b = { style, color: { argb: color } }
  c.border = { top: b, bottom: b, left: b, right: b }
}

function setBottomBorder(c: ExcelJS.Cell, style: ExcelJS.BorderStyle = 'thin', color = BORDER_CLR) {
  c.border = { bottom: { style, color: { argb: color } } }
}

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(n)
}

function fmtDate(d: string): string {
  const utc = d.endsWith('Z') || d.includes('+') ? d : d + 'Z'
  return new Date(utc).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'
  })
}

export async function generateQuotation(data: QuotationData): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Capstone Life Admin Portal'
  wb.created  = new Date()
  wb.modified = new Date()

  const ws = wb.addWorksheet('Quotation', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 }
  })

  // ── Column widths ──────────────────────────────────────────────
  ws.columns = [
    { width: 3  },   // A  gutter
    { width: 26 },   // B  Option
    { width: 28 },   // C  Room / Location
    { width: 14 },   // D  Type
    { width: 18 },   // E  Price
    { width: 3  },   // F  gutter
  ]

  let r = 1

  // ── Row 1: orange header banner ────────────────────────────────
  ws.mergeCells(r, 1, r, 6)
  const hdr = ws.getCell(r, 1)
  hdr.value = 'CAPSTONE LIFE'
  setFont(hdr, { size: 20, bold: true, color: { argb: WHITE }, name: 'Calibri' })
  setBg(hdr, ORANGE)
  hdr.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 40
  r++

  // ── Row 2: subtitle ───────────────────────────────────────────
  ws.mergeCells(r, 1, r, 6)
  const sub = ws.getCell(r, 1)
  sub.value = 'Villa Customisation — Price Quotation'
  setFont(sub, { size: 11, color: { argb: WHITE }, italic: true })
  setBg(sub, ORANGE)
  sub.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 22
  r++

  // ── Row 3: spacer ─────────────────────────────────────────────
  ws.mergeCells(r, 1, r, 6)
  setBg(ws.getCell(r, 1), GREY_BG)
  ws.getRow(r).height = 8
  r++

  // ── Rows 4-6: customer info block ─────────────────────────────
  const infoRows: [string, string, string, string][] = [
    ['Customer',  data.customerName,
     'Villa',     data.villaName || '—'],
    ['Date',      fmtDate(data.requestedAt),
     'Status',    data.status.charAt(0).toUpperCase() + data.status.slice(1)],
    ['Reference', `QT-${data.requestedAt.slice(0,10).replace(/-/g,'')}-${data.customerName.replace(/\s/g,'').toUpperCase().slice(0,4)}`,
     'Items',     String(data.items.filter(i => i.price !== null).length) + ' priced'],
  ]

  for (const [lbl1, val1, lbl2, val2] of infoRows) {
    ws.getRow(r).height = 20

    // left label
    const lc = cell(ws, r, 2)
    lc.value = lbl1
    setFont(lc, { size: 9.5, bold: true, color: { argb: MUTED } })
    setBg(lc, GREY_BG)
    lc.alignment = { vertical: 'middle' }

    // left value
    const lv = cell(ws, r, 3)
    lv.value = val1
    setFont(lv, { size: 10, bold: true, color: { argb: DARK } })
    setBg(lv, GREY_BG)
    lv.alignment = { vertical: 'middle' }

    // right label
    const rl = cell(ws, r, 4)
    rl.value = lbl2
    setFont(rl, { size: 9.5, bold: true, color: { argb: MUTED } })
    setBg(rl, GREY_BG)
    rl.alignment = { vertical: 'middle' }

    // right value
    const rv = cell(ws, r, 5)
    rv.value = val2
    setFont(rv, { size: 10, bold: true, color: { argb: DARK } })
    setBg(rv, GREY_BG)
    rv.alignment = { vertical: 'middle' }

    // side gutters
    setBg(cell(ws, r, 1), GREY_BG)
    setBg(cell(ws, r, 6), GREY_BG)
    r++
  }

  // ── Row: spacer ───────────────────────────────────────────────
  ws.mergeCells(r, 1, r, 6)
  ws.getRow(r).height = 10
  r++

  // ── Table header row ──────────────────────────────────────────
  ws.getRow(r).height = 26
  const headers = ['', 'Option / Selection', 'Room / Location', 'Type', 'Price (INR)', '']
  headers.forEach((h, ci) => {
    const c = cell(ws, r, ci + 1)
    c.value = h
    setBg(c, DARK)
    setFont(c, { size: 9, bold: true, color: { argb: WHITE }, name: 'Calibri' })
    c.alignment = { horizontal: ci === 4 ? 'right' : 'left', vertical: 'middle' }
  })
  r++

  // ── Group items by category ───────────────────────────────────
  const groups: Record<string, QuotationItem[]> = {}
  data.items.forEach(item => {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  })

  let rowNum = 0
  for (const [cat, items] of Object.entries(groups)) {

    // Category divider row
    ws.mergeCells(r, 1, r, 6)
    const catCell = ws.getCell(r, 1)
    catCell.value = cat.toUpperCase()
    setFont(catCell, { size: 8.5, bold: true, color: { argb: 'FFC85A3A' } })
    setBg(catCell, CAT_BG)
    catCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    setBottomBorder(catCell, 'thin', 'FFEED9D3')
    ws.getRow(r).height = 18
    r++

    // Item rows
    for (const item of items) {
      rowNum++
      ws.getRow(r).height = 22
      const rowBg = rowNum % 2 === 0 ? WHITE : 'FFFCFBFA'

      const gutter1 = cell(ws, r, 1)
      setBg(gutter1, rowBg)

      const optCell = cell(ws, r, 2)
      optCell.value = item.optionName
      setFont(optCell, { size: 10, color: { argb: DARK } })
      setBg(optCell, rowBg)
      optCell.alignment = { vertical: 'middle', wrapText: true }
      setBottomBorder(optCell, 'hair', BORDER_CLR)

      const roomCell = cell(ws, r, 3)
      roomCell.value = item.room || '—'
      setFont(roomCell, { size: 9.5, color: { argb: MUTED } })
      setBg(roomCell, rowBg)
      roomCell.alignment = { vertical: 'middle' }
      setBottomBorder(roomCell, 'hair', BORDER_CLR)

      const typeCell = cell(ws, r, 4)
      typeCell.value = item.type === 'upgrade' ? 'Upgrade' : 'Standard'
      setFont(typeCell, {
        size: 9,
        bold: item.type === 'upgrade',
        color: { argb: item.type === 'upgrade' ? 'FFC85A3A' : 'FF888888' }
      })
      setBg(typeCell, rowBg)
      typeCell.alignment = { vertical: 'middle' }
      setBottomBorder(typeCell, 'hair', BORDER_CLR)

      const priceCell = cell(ws, r, 5)
      if (item.price !== null) {
        priceCell.value = item.price
        priceCell.numFmt = '₹#,##0'
        setFont(priceCell, { size: 10, bold: true, color: { argb: DARK } })
      } else {
        priceCell.value = 'On Request'
        setFont(priceCell, { size: 9.5, italic: true, color: { argb: MUTED } })
      }
      setBg(priceCell, rowBg)
      priceCell.alignment = { horizontal: 'right', vertical: 'middle' }
      setBottomBorder(priceCell, 'hair', BORDER_CLR)

      const gutter2 = cell(ws, r, 6)
      setBg(gutter2, rowBg)

      r++
    }
  }

  // ── Spacer before total ───────────────────────────────────────
  ws.getRow(r).height = 6
  r++

  // ── Total row ─────────────────────────────────────────────────
  ws.getRow(r).height = 30

  ws.mergeCells(r, 1, r, 4)
  const totalLbl = ws.getCell(r, 1)
  totalLbl.value = 'TOTAL QUOTED PRICE'
  setFont(totalLbl, { size: 11, bold: true, color: { argb: WHITE } })
  setBg(totalLbl, ORANGE)
  totalLbl.alignment = { horizontal: 'right', vertical: 'middle' }

  const totalVal = cell(ws, r, 5)
  if (data.total !== null) {
    totalVal.value = data.total
    totalVal.numFmt = '₹#,##0'
  } else {
    totalVal.value = 'On Request'
  }
  setFont(totalVal, { size: 12, bold: true, color: { argb: WHITE } })
  setBg(totalVal, ORANGE)
  totalVal.alignment = { horizontal: 'right', vertical: 'middle' }

  setBg(cell(ws, r, 6), ORANGE)
  r++

  // ── Spacer ────────────────────────────────────────────────────
  ws.getRow(r).height = 14
  r++

  // ── Notes / disclaimer ────────────────────────────────────────
  const notes = [
    '* This is a preliminary price quotation for villa customisation upgrades.',
    '* Prices are indicative and subject to final confirmation.',
    '* This quotation is valid for 30 days from the date of issue.',
    '* For queries, contact: admin@capstonelife.com',
  ]
  for (const note of notes) {
    ws.mergeCells(r, 1, r, 6)
    const nc = ws.getCell(r, 1)
    nc.value = note
    setFont(nc, { size: 8.5, italic: true, color: { argb: 'FFAAAAAA' } })
    nc.alignment = { horizontal: 'left', indent: 1 }
    ws.getRow(r).height = 14
    r++
  }

  // ── Footer ────────────────────────────────────────────────────
  ws.getRow(r).height = 8
  r++
  ws.mergeCells(r, 1, r, 6)
  const footer = ws.getCell(r, 1)
  footer.value = `Generated by Capstone Life Admin Portal  ·  ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}`
  setFont(footer, { size: 8, italic: true, color: { argb: 'FFCCCCCC' } })
  footer.alignment = { horizontal: 'center' }
  setBg(footer, GREY_BG)
  ws.getRow(r).height = 16

  // ── Download ──────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  const safeName = data.customerName.replace(/\s+/g, '_')
  const dateStr  = data.requestedAt.slice(0, 10)
  a.href     = url
  a.download = `Quotation_${safeName}_${dateStr}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

import type { PDFDocumentProxy } from 'pdfjs-dist'

/** ตำแหน่งผลค้นหาหนึ่งจุด (พิกัด normalized 0..1, origin บนซ้าย) */
export interface SearchHit {
  /** index อ้างอิงหน้าต้นฉบับ */
  pageIndex: number
  x: number
  y: number
  w: number
  h: number
}

/**
 * ค้นหาข้อความทั้งเอกสารด้วย text layer ของ PDF.js
 * แล้วคืนพิกัด bounding box แบบ normalized เพื่อให้ overlay ไฮไลต์ได้
 *
 * หมายเหตุ: จับคู่ระดับ "text item" (คำ/ช่วงข้อความ) แบบ case-insensitive
 * ครอบเคสส่วนใหญ่ ยกเว้นคำที่ถูกตัดข้าม item (ข้อจำกัดของ text layer)
 */
export async function searchDocument(
  doc: PDFDocumentProxy,
  query: string
): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const hits: SearchHit[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const viewport = page.getViewport({ scale: 1 })
    const pw = viewport.width
    const ph = viewport.height
    const content = await page.getTextContent()

    for (const item of content.items) {
      if (!('str' in item)) continue
      const str = item.str
      const lower = str.toLowerCase()
      if (!lower.includes(q)) continue

      // transform = [a, b, c, d, e, f] → (e,f) คือตำแหน่ง baseline ซ้ายล่าง
      const [a, , , d, e, f] = item.transform as number[]
      const fontHeight = Math.hypot(item.transform[2] as number, d) || Math.abs(d)
      const itemWidth = item.width || Math.abs(a) * str.length

      // หา offset ของ match ในสตริงเพื่อประมาณตำแหน่ง x
      let from = 0
      let idx = lower.indexOf(q, from)
      while (idx !== -1) {
        const charW = itemWidth / Math.max(1, str.length)
        const matchX = e + charW * idx
        const matchW = charW * q.length
        // f คือ baseline; ยกขึ้นเป็นกล่องสูง fontHeight
        const topY = ph - (f + fontHeight)
        hits.push({
          pageIndex: p - 1,
          x: matchX / pw,
          y: topY / ph,
          w: matchW / pw,
          h: fontHeight / ph
        })
        from = idx + q.length
        idx = lower.indexOf(q, from)
      }
    }
    page.cleanup()
  }

  return hits
}

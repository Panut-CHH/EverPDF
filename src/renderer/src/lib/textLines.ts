import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * ข้อความหนึ่ง "run" ในเอกสาร (จาก text layer ของ PDF.js)
 * ใช้สำหรับฟีเจอร์ Edit Text — คลิกเพื่อแก้ข้อความตรงจุดนั้น
 */
export interface TextRun {
  id: string
  /** index หน้าต้นฉบับ */
  pageIndex: number
  /** พิกัด normalized (origin บนซ้าย, อิงหน้า rotation 0) */
  x: number
  y: number
  w: number
  h: number
  text: string
  /** ขนาดฟอนต์โดยประมาณ (pt) */
  fontSize: number
}

/**
 * ดึงข้อความทั้งเอกสารเป็น run ๆ พร้อมพิกัด
 * ข้าม run ที่เป็นช่องว่างล้วน
 */
export async function extractTextRuns(doc: PDFDocumentProxy): Promise<TextRun[]> {
  const runs: TextRun[] = []
  let counter = 0

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const W = vp.width
    const H = vp.height
    const content = await page.getTextContent()

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const tr = item.transform as number[]
      const e = tr[4]
      const f = tr[5]
      // ความสูงฟอนต์จาก scale ของแกน y
      const fontHeight = item.height || Math.hypot(tr[2], tr[3]) || Math.abs(tr[3])
      const width = item.width || 0
      if (width <= 0 || fontHeight <= 0) continue

      counter += 1
      runs.push({
        id: `run_${p}_${counter}`,
        pageIndex: p - 1,
        x: e / W,
        y: (H - (f + fontHeight)) / H,
        w: width / W,
        h: fontHeight / H,
        text: item.str,
        fontSize: fontHeight
      })
    }
    page.cleanup()
  }

  return runs
}

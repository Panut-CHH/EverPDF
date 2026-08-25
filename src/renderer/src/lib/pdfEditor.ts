import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type {
  Annotation,
  TextAnnotation,
  ImageAnnotation,
  HighlightAnnotation,
  RectAnnotation,
  LineAnnotation,
  InkAnnotation
} from '@/lib/annotations'
import type { PageInfo } from '@/store/documentStore'

/** แปลงสี hex (#rrggbb) → RGB ของ pdf-lib (0..1) */
function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** โหลดฟอนต์จาก public/ (คืน null ถ้าไม่พบ) */
async function fetchFont(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export interface BakeOptions {
  original: Uint8Array
  pageOrder: number[]
  pages: PageInfo[]
  annotations: Annotation[]
}

/** คู่ฟอนต์ปกติ/หนา ที่ใช้ตอน bake */
interface FontPair {
  regular: PDFFont
  bold: PDFFont
}

/**
 * "อบ" (bake) การแก้ไขทั้งหมดกลับเข้า PDF จริง แล้วคืน bytes ใหม่
 *   1) จัดหน้าใหม่ตาม pageOrder (ลบ/สลับหน้า)
 *   2) ใส่องศาหมุน
 *   3) วาด annotation ทุกชนิดลงหน้า (แปลงพิกัด DOM → PDF)
 */
export async function bakePdf(opts: BakeOptions): Promise<Uint8Array> {
  const { original, pageOrder, pages, annotations } = opts

  const srcDoc = await PDFDocument.load(original)
  const outDoc = await PDFDocument.create()
  outDoc.registerFontkit(fontkit)

  // ฟอนต์: Sarabun (ไทย) ถ้ามี ไม่งั้น Helvetica
  const regBytes = await fetchFont('/fonts/Sarabun-Regular.ttf')
  const boldBytes = await fetchFont('/fonts/Sarabun-Bold.ttf')
  const font: FontPair = {
    regular: regBytes
      ? await outDoc.embedFont(regBytes, { subset: true })
      : await outDoc.embedFont(StandardFonts.Helvetica),
    bold: boldBytes
      ? await outDoc.embedFont(boldBytes, { subset: true })
      : await outDoc.embedFont(StandardFonts.HelveticaBold)
  }

  const copied = await outDoc.copyPages(srcDoc, pageOrder)
  copied.forEach((p) => outDoc.addPage(p))

  const imageCache = new Map<string, PDFImage>()

  for (let displayIndex = 0; displayIndex < pageOrder.length; displayIndex++) {
    const originalIndex = pageOrder[displayIndex]
    const page = outDoc.getPage(displayIndex)

    const userRot = pages[originalIndex]?.rotation ?? 0
    if (userRot) {
      page.setRotation(degrees((page.getRotation().angle + userRot) % 360))
    }

    for (const ann of annotations.filter((a) => a.pageIndex === originalIndex)) {
      await drawAnnotation(outDoc, page, ann, font, imageCache)
    }
  }

  return outDoc.save()
}

async function drawAnnotation(
  doc: PDFDocument,
  page: PDFPage,
  ann: Annotation,
  font: FontPair,
  cache: Map<string, PDFImage>
): Promise<void> {
  switch (ann.type) {
    case 'text':
      return drawText(page, ann, font)
    case 'image':
      return drawImage(doc, page, ann, cache)
    case 'highlight':
      return drawHighlight(page, ann)
    case 'rect':
      return drawRect(page, ann)
    case 'line':
      return drawLine(page, ann)
    case 'ink':
      return drawInk(page, ann)
  }
}

function drawText(page: PDFPage, ann: TextAnnotation, font: FontPair): void {
  const { width, height } = page.getSize()
  const f = ann.bold ? font.bold : font.regular
  const x = ann.x * width
  const yTop = ann.y * height
  // ข้อความหลายบรรทัด: วาดทีละบรรทัด
  const lines = ann.text.split('\n')
  lines.forEach((line, i) => {
    const y = height - yTop - ann.fontSize * (i + 1)
    page.drawText(line, { x, y, size: ann.fontSize, font: f, color: hexToRgb(ann.color) })
  })
}

async function drawImage(
  doc: PDFDocument,
  page: PDFPage,
  ann: ImageAnnotation,
  cache: Map<string, PDFImage>
): Promise<void> {
  const { width, height } = page.getSize()
  let img = cache.get(ann.dataUrl)
  if (!img) {
    const base64 = ann.dataUrl.split(',')[1] ?? ''
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const isJpeg = /^data:image\/jpe?g/i.test(ann.dataUrl)
    img = isJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
    cache.set(ann.dataUrl, img)
  }
  page.drawImage(img, {
    x: ann.x * width,
    y: height - ann.y * height - ann.h * height,
    width: ann.w * width,
    height: ann.h * height
  })
}

function drawHighlight(page: PDFPage, ann: HighlightAnnotation): void {
  const { width, height } = page.getSize()
  page.drawRectangle({
    x: ann.x * width,
    y: height - ann.y * height - ann.h * height,
    width: ann.w * width,
    height: ann.h * height,
    color: hexToRgb(ann.color),
    opacity: ann.opacity
  })
}

function drawRect(page: PDFPage, ann: RectAnnotation): void {
  const { width, height } = page.getSize()
  page.drawRectangle({
    x: ann.x * width,
    y: height - ann.y * height - ann.h * height,
    width: ann.w * width,
    height: ann.h * height,
    borderColor: hexToRgb(ann.color),
    borderWidth: ann.strokeWidth,
    color: ann.fill ? hexToRgb(ann.fill) : undefined
  })
}

function drawLine(page: PDFPage, ann: LineAnnotation): void {
  const { width, height } = page.getSize()
  const start = { x: ann.x1 * width, y: height - ann.y1 * height }
  const end = { x: ann.x2 * width, y: height - ann.y2 * height }
  const color = hexToRgb(ann.color)
  page.drawLine({ start, end, thickness: ann.strokeWidth, color })

  if (ann.arrow) {
    // หัวลูกศรที่ปลาย (end): สองเส้นสั้นทำมุม ~28°
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const len = 10 + ann.strokeWidth * 2
    const spread = 0.5
    for (const s of [spread, -spread]) {
      page.drawLine({
        start: end,
        end: {
          x: end.x - len * Math.cos(angle - s),
          y: end.y - len * Math.sin(angle - s)
        },
        thickness: ann.strokeWidth,
        color
      })
    }
  }
}

function drawInk(page: PDFPage, ann: InkAnnotation): void {
  const { width, height } = page.getSize()
  const color = hexToRgb(ann.color)
  for (let i = 1; i < ann.points.length; i++) {
    const a = ann.points[i - 1]
    const b = ann.points[i]
    page.drawLine({
      start: { x: a.x * width, y: height - a.y * height },
      end: { x: b.x * width, y: height - b.y * height },
      thickness: ann.strokeWidth,
      color
    })
  }
}

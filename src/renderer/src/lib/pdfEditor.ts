import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Annotation, TextAnnotation, ImageAnnotation } from '@/lib/annotations'
import type { PageInfo } from '@/store/documentStore'

/**
 * แปลงสี hex (#rrggbb) → rgb() ของ pdf-lib (ค่า 0..1)
 */
function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/**
 * พยายามโหลดฟอนต์ไทยที่ผู้ใช้วางไว้ที่ public/fonts
 * ถ้าไม่มี → คืน null แล้วไปใช้ Helvetica (อังกฤษ/ตัวเลขเท่านั้น)
 *
 * วิธีเพิ่มฟอนต์ไทย: วางไฟล์ NotoSansThai-Regular.ttf ไว้ที่
 *   src/renderer/public/fonts/NotoSansThai-Regular.ttf
 */
async function loadThaiFontBytes(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch('/fonts/NotoSansThai-Regular.ttf')
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export interface BakeOptions {
  /** bytes ต้นฉบับ */
  original: Uint8Array
  /** ลำดับหน้าที่ต้องการ (index อ้างอิงหน้าต้นฉบับ) */
  pageOrder: number[]
  /** ข้อมูลหน้า (สำหรับองศาหมุนที่ผู้ใช้สั่ง) */
  pages: PageInfo[]
  /** annotation ทั้งหมด (pageIndex อ้างอิงหน้าต้นฉบับ) */
  annotations: Annotation[]
}

/**
 * "อบ" (bake) การแก้ไขทั้งหมดกลับเข้า PDF จริง แล้วคืน bytes ใหม่
 *
 * ทำ 3 อย่างตามลำดับ:
 *   1) จัดหน้าใหม่ตาม pageOrder (รองรับลบ/สลับหน้า) โดย copy หน้าจากต้นฉบับ
 *   2) ใส่องศาหมุนที่ผู้ใช้สั่ง
 *   3) วาด annotation (ข้อความ/รูป/ลายเซ็น) ลงบนหน้า โดยแปลงพิกัด DOM → PDF
 */
export async function bakePdf(opts: BakeOptions): Promise<Uint8Array> {
  const { original, pageOrder, pages, annotations } = opts

  const srcDoc = await PDFDocument.load(original)
  const outDoc = await PDFDocument.create()
  outDoc.registerFontkit(fontkit)

  // เตรียมฟอนต์: ไทยถ้ามี, ไม่งั้น Helvetica
  const thaiBytes = await loadThaiFontBytes()
  let font: PDFFont
  if (thaiBytes) {
    font = await outDoc.embedFont(thaiBytes, { subset: true })
  } else {
    font = await outDoc.embedFont(StandardFonts.Helvetica)
  }

  // 1) copy หน้าตามลำดับใหม่
  const copied = await outDoc.copyPages(srcDoc, pageOrder)
  copied.forEach((p) => outDoc.addPage(p))

  // cache รูปที่ embed แล้ว (กัน embed ซ้ำถ้ารูปเดียวกันหลายที่)
  const imageCache = new Map<string, Awaited<ReturnType<typeof outDoc.embedPng>>>()

  // วนแต่ละหน้าในเอกสารใหม่
  for (let displayIndex = 0; displayIndex < pageOrder.length; displayIndex++) {
    const originalIndex = pageOrder[displayIndex]
    const page = outDoc.getPage(displayIndex)

    // 2) องศาหมุน (บวกจากที่ผู้ใช้สั่ง)
    const userRot = pages[originalIndex]?.rotation ?? 0
    if (userRot) {
      const base = page.getRotation().angle
      page.setRotation(degrees((base + userRot) % 360))
    }

    // 3) annotation บนหน้านี้
    const pageAnns = annotations.filter((a) => a.pageIndex === originalIndex)
    for (const ann of pageAnns) {
      if (ann.type === 'text') {
        drawText(page, ann, font)
      } else {
        await drawImage(outDoc, page, ann, imageCache)
      }
    }
  }

  return outDoc.save()
}

/** วาดข้อความ: แปลงพิกัด normalized (บนซ้าย) → พิกัด PDF (ล่างซ้าย) */
function drawText(page: PDFPage, ann: TextAnnotation, font: PDFFont): void {
  const { width, height } = page.getSize()
  const x = ann.x * width
  // y ใน DOM นับจากบน, PDF นับจากล่าง; ann.fontSize คือ baseline offset โดยประมาณ
  const yTop = ann.y * height
  const y = height - yTop - ann.fontSize

  page.drawText(ann.text, {
    x,
    y,
    size: ann.fontSize,
    font,
    color: hexToRgb(ann.color)
  })
}

/** วาดรูป/ลายเซ็น (รองรับ PNG data URL) */
async function drawImage(
  doc: PDFDocument,
  page: PDFPage,
  ann: ImageAnnotation,
  cache: Map<string, Awaited<ReturnType<typeof doc.embedPng>>>
): Promise<void> {
  const { width, height } = page.getSize()

  let img = cache.get(ann.dataUrl)
  if (!img) {
    const base64 = ann.dataUrl.split(',')[1] ?? ''
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    // เลือก embedder ตามชนิดไฟล์ (ลายเซ็นที่วาด = PNG, รูปแทรกอาจเป็น JPEG)
    const isJpeg = /^data:image\/jpe?g/i.test(ann.dataUrl)
    img = isJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
    cache.set(ann.dataUrl, img)
  }

  const w = ann.w * width
  const h = ann.h * height
  const x = ann.x * width
  const y = height - ann.y * height - h // มุมล่างซ้ายของรูป

  page.drawImage(img, { x, y, width: w, height: h })
}

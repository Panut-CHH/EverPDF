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
import sarabunRegularUrl from '@/assets/fonts/Sarabun-Regular.ttf?url'
import sarabunBoldUrl from '@/assets/fonts/Sarabun-Bold.ttf?url'
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
import type { FormField } from '@/lib/forms'

/** แปลงสี hex (#rrggbb) → RGB ของ pdf-lib (0..1) */
function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/**
 * โหลดฟอนต์จาก URL ที่ Vite แปลงให้ (คืน null ถ้าไม่พบ)
 *
 * ใช้ XMLHttpRequest แทน fetch() เพราะ fetch ของ Chromium ไม่รองรับ file://
 * (แอปที่แพ็กแล้วโหลดผ่าน file://) — XHR ทำงานได้ทั้ง dev (http) และ production
 */
function fetchFont(url: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url, true)
      xhr.responseType = 'arraybuffer'
      xhr.onload = () => {
        // file:// สำเร็จจะได้ status 0, http สำเร็จได้ 200-299
        const ok = xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)
        resolve(ok && xhr.response ? (xhr.response as ArrayBuffer) : null)
      }
      xhr.onerror = () => resolve(null)
      xhr.send()
    } catch {
      resolve(null)
    }
  })
}

/**
 * เขียนค่าฟอร์มลง AcroForm ของเอกสาร แล้ว flatten
 *
 * ต้องส่งฟอนต์ (Sarabun) เข้ามาด้วย เพราะ appearance เริ่มต้นของ pdf-lib
 * เป็น Helvetica ที่ encode ภาษาไทยไม่ได้ (จะ throw) — เราจึงตั้ง appearance
 * ด้วยฟอนต์ไทยเอง แล้ว flatten แบบไม่ให้ pdf-lib regenerate ทับ
 */
function applyFormValues(doc: PDFDocument, fields: FormField[], font?: PDFFont): void {
  let form
  try {
    form = doc.getForm()
  } catch {
    return
  }

  for (const f of fields) {
    try {
      if (f.type === 'text') {
        const tf = form.getTextField(f.name)
        tf.setText(String(f.value ?? ''))
        if (font) tf.updateAppearances(font)
      } else if (f.type === 'checkbox') {
        const cb = form.getCheckBox(f.name)
        f.value ? cb.check() : cb.uncheck()
      } else if (f.type === 'dropdown') {
        if (f.value) {
          const dd = form.getDropdown(f.name)
          dd.select(String(f.value))
          if (font) dd.updateAppearances(font)
        }
      } else if (f.type === 'radio') {
        if (f.value) form.getRadioGroup(f.name).select(String(f.value))
      }
    } catch {
      /* ข้าม field ที่เขียนไม่ได้ */
    }
  }

  try {
    // ถ้ามีฟอนต์: อย่าให้ flatten regenerate appearance (จะกลับไปใช้ Helvetica)
    form.flatten(font ? { updateFieldAppearances: false } : undefined)
  } catch {
    /* บางเอกสาร flatten ไม่ได้ — ปล่อยค่าที่ set ไว้ */
  }
}

export interface BakeOptions {
  original: Uint8Array
  pageOrder: number[]
  pages: PageInfo[]
  annotations: Annotation[]
  /** ค่าฟอร์มที่กรอก — ถ้ามี จะถูกเขียนแล้ว flatten ก่อนจัดหน้า */
  formFields?: FormField[]
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
  const { original, pageOrder, pages, annotations, formFields } = opts

  const srcDoc = await PDFDocument.load(original)

  // โหลดฟอนต์ Sarabun ล่วงหน้า (ใช้ทั้งฝั่งฟอร์มและ annotation)
  // ใช้ URL ที่ Vite แปลงให้ → ถูกต้องทั้ง dev และ production (file://)
  const regBytes = await fetchFont(sarabunRegularUrl)
  const boldBytes = await fetchFont(sarabunBoldUrl)

  // กรอกค่าฟอร์มลง AcroForm แล้ว flatten ให้กลายเป็นเนื้อหาถาวร
  // (ต้องทำก่อน copyPages เพราะ copyPages ไม่พา AcroForm ไปด้วย)
  if (formFields && formFields.length) {
    let formFont: PDFFont | undefined
    if (regBytes) {
      srcDoc.registerFontkit(fontkit)
      formFont = await srcDoc.embedFont(regBytes, { subset: false })
    }
    applyFormValues(srcDoc, formFields, formFont)
  }

  const outDoc = await PDFDocument.create()
  outDoc.registerFontkit(fontkit)

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

    // สร้างตัวแปลงพิกัดที่รู้เรื่องการหมุน (จาก /Rotate เดิม + ที่ผู้ใช้สั่ง)
    const geom = makeGeom(page)

    for (const ann of annotations.filter((a) => a.pageIndex === originalIndex)) {
      await drawAnnotation(outDoc, page, ann, geom, font, imageCache)
    }
  }

  return outDoc.save()
}

/**
 * ตัวช่วยแปลงพิกัด "display" (normalized 0..1, origin บนซ้าย ตาม viewport ที่หมุนแล้ว)
 * → พิกัด mediabox ของ pdf-lib (origin ล่างซ้าย, ไม่หมุน)
 *
 * นี่คือหัวใจที่ทำให้ annotation วางตรงแม้หน้าจะมี /Rotate หรือถูกสั่งหมุน
 */
interface PageGeom {
  /** ขนาด mediabox (ไม่หมุน) */
  W: number
  H: number
  /** การหมุนรวม (0/90/180/270) */
  R: number
  /** มุมที่ต้องหมุนข้อความให้อ่านตรง (ชดเชยการหมุนหน้า) */
  textAngle: number
  /** แปลงจุด normalized → mediabox */
  point: (nx: number, ny: number) => { x: number; y: number }
  /** แปลงกล่อง normalized → mediabox (x,y = มุมล่างซ้าย) */
  box: (nx: number, ny: number, nw: number, nh: number) => {
    x: number
    y: number
    w: number
    h: number
  }
}

function makeGeom(page: PDFPage): PageGeom {
  const { width: W, height: H } = page.getSize()
  const R = ((page.getRotation().angle % 360) + 360) % 360
  const rotated = R === 90 || R === 270
  const Wd = rotated ? H : W
  const Hd = rotated ? W : H

  const point = (nx: number, ny: number): { x: number; y: number } => {
    const dx = nx * Wd // จากซ้าย
    const dy = ny * Hd // จากบน
    switch (R) {
      case 90:
        return { x: dy, y: dx }
      case 180:
        return { x: W - dx, y: dy }
      case 270:
        return { x: W - dy, y: H - dx }
      default:
        return { x: dx, y: H - dy }
    }
  }

  const box = (
    nx: number,
    ny: number,
    nw: number,
    nh: number
  ): { x: number; y: number; w: number; h: number } => {
    const c1 = point(nx, ny)
    const c2 = point(nx + nw, ny + nh)
    return {
      x: Math.min(c1.x, c2.x),
      y: Math.min(c1.y, c2.y),
      w: Math.abs(c1.x - c2.x),
      h: Math.abs(c1.y - c2.y)
    }
  }

  return { W, H, R, textAngle: (360 - R) % 360, point, box }
}

async function drawAnnotation(
  doc: PDFDocument,
  page: PDFPage,
  ann: Annotation,
  geom: PageGeom,
  font: FontPair,
  cache: Map<string, PDFImage>
): Promise<void> {
  switch (ann.type) {
    case 'text':
      return drawText(page, ann, geom, font)
    case 'image':
      return drawImage(doc, page, ann, geom, cache)
    case 'highlight':
      return drawHighlight(page, ann, geom)
    case 'rect':
      return drawRect(page, ann, geom)
    case 'line':
      return drawLine(page, ann, geom)
    case 'ink':
      return drawInk(page, ann, geom)
  }
}

function drawText(page: PDFPage, ann: TextAnnotation, geom: PageGeom, font: FontPair): void {
  const f = ann.bold ? font.bold : font.regular
  const Hd = geom.R === 90 || geom.R === 270 ? geom.W : geom.H
  const lineStepNorm = ann.fontSize / Hd // ระยะ 1 บรรทัดในหน่วย normalized
  const lines = ann.text.split('\n')
  lines.forEach((line, i) => {
    // จุด baseline ของบรรทัด (display: ต่ำลงจากขอบบนกล่องตามจำนวนบรรทัด)
    const p = geom.point(ann.x, ann.y + lineStepNorm * (i + 1))
    page.drawText(line, {
      x: p.x,
      y: p.y,
      size: ann.fontSize,
      font: f,
      color: hexToRgb(ann.color),
      rotate: degrees(geom.textAngle)
    })
  })
}

async function drawImage(
  doc: PDFDocument,
  page: PDFPage,
  ann: ImageAnnotation,
  geom: PageGeom,
  cache: Map<string, PDFImage>
): Promise<void> {
  let img = cache.get(ann.dataUrl)
  if (!img) {
    const base64 = ann.dataUrl.split(',')[1] ?? ''
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const isJpeg = /^data:image\/jpe?g/i.test(ann.dataUrl)
    img = isJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
    cache.set(ann.dataUrl, img)
  }
  const b = geom.box(ann.x, ann.y, ann.w, ann.h)
  page.drawImage(img, { x: b.x, y: b.y, width: b.w, height: b.h })
}

function drawHighlight(page: PDFPage, ann: HighlightAnnotation, geom: PageGeom): void {
  const b = geom.box(ann.x, ann.y, ann.w, ann.h)
  page.drawRectangle({
    x: b.x,
    y: b.y,
    width: b.w,
    height: b.h,
    color: hexToRgb(ann.color),
    opacity: ann.opacity
  })
}

function drawRect(page: PDFPage, ann: RectAnnotation, geom: PageGeom): void {
  const b = geom.box(ann.x, ann.y, ann.w, ann.h)
  page.drawRectangle({
    x: b.x,
    y: b.y,
    width: b.w,
    height: b.h,
    borderColor: hexToRgb(ann.color),
    borderWidth: ann.strokeWidth,
    color: ann.fill ? hexToRgb(ann.fill) : undefined
  })
}

function drawLine(page: PDFPage, ann: LineAnnotation, geom: PageGeom): void {
  const start = geom.point(ann.x1, ann.y1)
  const end = geom.point(ann.x2, ann.y2)
  const color = hexToRgb(ann.color)
  page.drawLine({ start, end, thickness: ann.strokeWidth, color })

  if (ann.arrow) {
    // หัวลูกศรที่ปลาย (end): สองเส้นสั้นทำมุม
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

function drawInk(page: PDFPage, ann: InkAnnotation, geom: PageGeom): void {
  const color = hexToRgb(ann.color)
  for (let i = 1; i < ann.points.length; i++) {
    page.drawLine({
      start: geom.point(ann.points[i - 1].x, ann.points[i - 1].y),
      end: geom.point(ann.points[i].x, ann.points[i].y),
      thickness: ann.strokeWidth,
      color
    })
  }
}

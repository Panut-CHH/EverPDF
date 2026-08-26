import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
// Vite จะแปลง URL นี้เป็น path ของ worker ที่ bundle แล้ว
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import type { PageInfo } from '@/store/documentStore'

/**
 * โหลดเอกสารจาก bytes — clone ก่อนเพราะ pdf.js อาจ transfer/detach buffer
 *
 * สำคัญ: สร้าง Web Worker "ของตัวเอง" ต่อหนึ่งเอกสาร (ไม่ใช้ workerPort ร่วมกัน)
 * เพราะถ้าแชร์ worker เดียว การ destroy() เอกสารหนึ่งจะทำลาย worker ที่ตัวอื่นใช้อยู่
 * → error "PDFWorker.fromPort - the worker is being destroyed"
 * (ใช้ ?worker ของ Vite เพื่อให้ทำงานได้ทั้ง dev และ production file://)
 */
export async function loadPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const copy = bytes.slice()
  // @types ของ pdfjs กำหนด port เป็น null — cast เพราะ runtime รับ Worker ได้
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const worker = new pdfjs.PDFWorker({ port: new PdfWorker() } as any)
  const doc = await pdfjs.getDocument({ data: copy, worker }).promise
  // ผูก worker ไว้กับ doc เพื่อ destroy ทีหลัง
  ;(doc as unknown as { _ownWorker?: pdfjs.PDFWorker })._ownWorker = worker
  return doc
}

/** ทำลายเอกสาร + worker ของมันให้หมด (ใช้แทน doc.destroy() ตรงๆ) */
export async function destroyPdf(doc: PDFDocumentProxy | null | undefined): Promise<void> {
  if (!doc) return
  const worker = (doc as unknown as { _ownWorker?: pdfjs.PDFWorker })._ownWorker
  try {
    await doc.destroy()
  } catch {
    /* ignore */
  }
  try {
    worker?.destroy()
  } catch {
    /* ignore */
  }
}

/** ดึงข้อมูลขนาด/หมุนของทุกหน้า (ใช้ scale=1 = point จริง) */
export async function readPagesInfo(doc: PDFDocumentProxy): Promise<PageInfo[]> {
  const pages: PageInfo[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp = page.getViewport({ scale: 1 })
    pages.push({ width: vp.width, height: vp.height, rotation: 0 })
    page.cleanup()
  }
  return pages
}

/**
 * สร้างชั้นข้อความโปร่งใสสำหรับ "เลือก + คัดลอก" ทับบน canvas
 * คำนวณตำแหน่ง/ขนาด span เองจาก text content (ไม่พึ่ง TextLayer ของ pdf.js
 * ที่ต้อง setup CSS var — เปราะและเปลี่ยนตามเวอร์ชัน)
 */
export async function renderTextSelectLayer(
  page: PDFPageProxy,
  container: HTMLElement,
  scale: number,
  extraRotation = 0
): Promise<void> {
  const viewport = page.getViewport({ scale, rotation: (page.rotate + extraRotation) % 360 })
  const content = await page.getTextContent()
  container.replaceChildren()

  const frag = document.createDocumentFragment()
  const spans: { el: HTMLSpanElement; targetW: number; angle: number }[] = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue
    // แปลง transform ของ item → พิกัดอุปกรณ์ (device) ผ่าน viewport
    const tx = pdfjs.Util.transform(viewport.transform, item.transform)
    const fontHeight = Math.hypot(tx[2], tx[3])
    if (fontHeight <= 0) continue
    const angle = Math.atan2(tx[1], tx[0])

    const el = document.createElement('span')
    el.textContent = item.str
    el.style.left = `${tx[4]}px`
    el.style.top = `${tx[5] - fontHeight}px`
    el.style.fontSize = `${fontHeight}px`
    frag.appendChild(el)
    spans.push({ el, targetW: item.width * scale, angle })
  }
  container.appendChild(frag)

  // วัดความกว้างจริงแล้ว scaleX ให้พอดีกับความกว้างของข้อความต้นฉบับ
  const naturals = spans.map((s) => s.el.getBoundingClientRect().width)
  spans.forEach((s, i) => {
    const nat = naturals[i]
    const parts: string[] = []
    if (s.angle) parts.push(`rotate(${s.angle}rad)`)
    if (nat > 0 && s.targetW > 0) parts.push(`scaleX(${s.targetW / nat})`)
    if (parts.length) s.el.style.transform = parts.join(' ')
  })
}

// เก็บ render task ที่กำลังทำงานของแต่ละ canvas เพื่อยกเลิกก่อนเริ่มใหม่
// (กัน error "Cannot use the same canvas during multiple render()")
const activeRenders = new WeakMap<HTMLCanvasElement, RenderTask>()

/**
 * เรนเดอร์หนึ่งหน้าลง canvas ที่ให้มา
 * @param extraRotation องศาที่ผู้ใช้สั่งหมุนเพิ่ม (บวกกับ /Rotate เดิมของหน้า)
 * คืนค่าขนาด canvas จริงเป็น px เพื่อให้ overlay layer จัด layout ตรงกัน
 */
export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
  extraRotation = 0
): Promise<{ width: number; height: number }> {
  // ยกเลิก render เดิมของ canvas นี้ (ถ้ายังทำงานอยู่)
  const prev = activeRenders.get(canvas)
  if (prev) {
    try {
      prev.cancel()
    } catch {
      /* ignore */
    }
  }

  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale, rotation: (page.rotate + extraRotation) % 360 })

  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const task = page.render({ canvasContext: ctx, viewport })
  activeRenders.set(canvas, task)
  try {
    await task.promise
  } catch (err) {
    // การยกเลิกเป็นเรื่องปกติ — โยน error เฉพาะกรณีอื่น
    if ((err as { name?: string })?.name !== 'RenderingCancelledException') throw err
  } finally {
    if (activeRenders.get(canvas) === task) activeRenders.delete(canvas)
  }

  return { width: viewport.width, height: viewport.height }
}

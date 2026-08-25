import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
// Vite จะแปลง URL นี้เป็น path ของ worker ที่ bundle แล้ว
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import type { PageInfo } from '@/store/documentStore'

// ตั้ง worker แบบ Vite-friendly (ไม่ใช้ CDN → ทำงาน offline ได้)
pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()

/** โหลดเอกสารจาก bytes — clone ก่อนเพราะ pdf.js อาจ transfer/detach buffer */
export async function loadPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const copy = bytes.slice()
  return pdfjs.getDocument({ data: copy }).promise
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

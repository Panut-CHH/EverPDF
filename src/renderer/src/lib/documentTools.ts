import { PDFDocument, StandardFonts, degrees, rgb, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadSarabun } from '@/lib/fontLoader'
import type { OpenedImage } from '@shared/types'

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/* ---------- Export → ข้อความ ---------- */

/** ดึงข้อความทั้งเอกสารเป็น .txt (คั่นหน้าด้วยหัวข้อ) */
export async function pagesToText(doc: PDFDocumentProxy): Promise<string> {
  const out: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    let lastY: number | null = null
    let line = ''
    const parts: string[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform[5] as number
      // ขึ้นบรรทัดใหม่เมื่อ y เปลี่ยนชัดเจน
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        parts.push(line)
        line = ''
      }
      line += item.str
      lastY = y
    }
    if (line) parts.push(line)
    out.push(`--- หน้า ${p} ---\n${parts.join('\n')}`)
    page.cleanup()
  }
  return out.join('\n\n')
}

/* ---------- สร้าง PDF จากรูปภาพ ---------- */

const A4 = { w: 595.28, h: 841.89 }

/** รวมรูปภาพหลายไฟล์เป็น PDF (หน้า A4 ต่อรูป, จัดกึ่งกลาง คงสัดส่วน) */
export async function imagesToPdf(images: OpenedImage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const img of images) {
    const embedded =
      img.mime === 'image/png' ? await doc.embedPng(img.data) : await doc.embedJpg(img.data)
    const page = doc.addPage([A4.w, A4.h])
    const margin = 28
    const maxW = A4.w - margin * 2
    const maxH = A4.h - margin * 2
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1)
    const w = embedded.width * scale
    const h = embedded.height * scale
    page.drawImage(embedded, {
      x: (A4.w - w) / 2,
      y: (A4.h - h) / 2,
      width: w,
      height: h
    })
  }
  return doc.save()
}

/* ---------- ลายน้ำ / เลขหน้า ---------- */

export interface StampOptions {
  /** ข้อความลายน้ำทแยงกลางหน้า (เว้นว่าง = ไม่ใส่) */
  watermark?: string
  watermarkOpacity: number
  watermarkColor: string
  /** ใส่เลขหน้าด้านล่างไหม */
  pageNumbers: boolean
  /** รูปแบบเลขหน้า เช่น "หน้า {n}/{total}" */
  pageNumberFormat: string
}

/**
 * ใส่ลายน้ำ + เลขหน้า ลงทุกหน้า แล้วคืน bytes ใหม่
 * (ทำบนเอกสารต้นฉบับโดยตรง เพื่อคงเนื้อหาเดิมทั้งหมด)
 */
export async function stampDocument(
  original: Uint8Array,
  opts: StampOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original)
  doc.registerFontkit(fontkit)

  const { regular } = await loadSarabun()
  const font = regular
    ? await doc.embedFont(regular, { subset: true })
    : await doc.embedFont(StandardFonts.Helvetica)

  const pages = doc.getPages()
  const total = pages.length

  pages.forEach((page, i) => {
    const { width, height } = page.getSize()

    // ลายน้ำทแยง 45° กลางหน้า
    if (opts.watermark && opts.watermark.trim()) {
      const size = Math.min(width, height) / Math.max(6, opts.watermark.length) + 24
      const textW = font.widthOfTextAtSize(opts.watermark, size)
      page.drawText(opts.watermark, {
        x: width / 2 - (textW / 2) * Math.cos(Math.PI / 4),
        y: height / 2 - (textW / 2) * Math.sin(Math.PI / 4),
        size,
        font,
        color: hexToRgb(opts.watermarkColor),
        opacity: opts.watermarkOpacity,
        rotate: degrees(45)
      })
    }

    // เลขหน้าด้านล่างกึ่งกลาง
    if (opts.pageNumbers) {
      const label = opts.pageNumberFormat
        .replace('{n}', String(i + 1))
        .replace('{total}', String(total))
      const size = 10
      const w = font.widthOfTextAtSize(label, size)
      page.drawText(label, {
        x: width / 2 - w / 2,
        y: 20,
        size,
        font,
        color: rgb(0.3, 0.3, 0.3)
      })
    }
  })

  return doc.save()
}

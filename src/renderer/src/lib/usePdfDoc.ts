import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdf, destroyPdf } from '@/lib/pdfjs'
import { useDocStore } from '@/store/documentStore'

/**
 * โหลด PDFDocumentProxy จาก bytes ปัจจุบันครั้งเดียว แล้วแชร์ให้ทั้ง Sidebar และ Viewer
 * ผูกกับ pdfBytes ใน store — เปลี่ยนไฟล์เมื่อไหร่ก็โหลดใหม่ + ทำลายตัวเก่า
 */
export function usePdfDoc(): PDFDocumentProxy | null {
  const pdfBytes = useDocStore((s) => s.pdfBytes)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)

  useEffect(() => {
    if (!pdfBytes) {
      setDoc(null)
      return
    }
    let cancelled = false
    let created: PDFDocumentProxy | null = null
    loadPdf(pdfBytes).then((d) => {
      if (cancelled) {
        void destroyPdf(d)
        return
      }
      created = d
      setDoc(d)
    })
    return () => {
      cancelled = true
      void destroyPdf(created)
    }
  }, [pdfBytes])

  return doc
}

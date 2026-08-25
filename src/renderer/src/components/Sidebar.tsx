import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useDocStore } from '@/store/documentStore'
import { usePdfDoc } from '@/lib/usePdfDoc'
import { renderPage } from '@/lib/pdfjs'

/** ภาพย่อของหนึ่งหน้า + ปุ่มจัดการ (ลบ/หมุน/เลื่อน) */
function Thumb({
  doc,
  originalIndex,
  displayIndex
}: {
  doc: PDFDocumentProxy
  originalIndex: number
  displayIndex: number
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentPage = useDocStore((s) => s.currentPage)
  const rotation = useDocStore((s) => s.pages[originalIndex]?.rotation ?? 0)
  const setCurrentPage = useDocStore((s) => s.setCurrentPage)

  useEffect(() => {
    let cancelled = false
    doc.getPage(originalIndex + 1).then(async (page) => {
      if (cancelled || !canvasRef.current) return
      await renderPage(page, canvasRef.current, 0.2, rotation)
      page.cleanup()
    })
    return () => {
      cancelled = true
    }
  }, [doc, originalIndex, rotation])

  return (
    <div
      className={`thumb ${currentPage === displayIndex ? 'active' : ''}`}
      onClick={() => setCurrentPage(displayIndex)}
    >
      <div className="thumb-canvas">
        <canvas ref={canvasRef} />
      </div>
      <div className="thumb-index">{displayIndex + 1}</div>
    </div>
  )
}

export default function Sidebar(): JSX.Element {
  const doc = usePdfDoc()
  const pageOrder = useDocStore((s) => s.pageOrder)
  const currentPage = useDocStore((s) => s.currentPage)
  const removePage = useDocStore((s) => s.removePage)
  const movePage = useDocStore((s) => s.movePage)
  const rotatePage = useDocStore((s) => s.rotatePage)
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="collapse-btn" onClick={() => setCollapsed(false)}>
          »
        </button>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <span>หน้า ({pageOrder.length})</span>
        <button className="collapse-btn" onClick={() => setCollapsed(true)}>
          «
        </button>
      </div>

      <div className="page-ops">
        <button title="หมุนซ้าย" onClick={() => rotatePage(currentPage, -90)}>↺</button>
        <button title="หมุนขวา" onClick={() => rotatePage(currentPage, 90)}>↻</button>
        <button title="เลื่อนขึ้น" onClick={() => currentPage > 0 && movePage(currentPage, currentPage - 1)}>
          ↑
        </button>
        <button
          title="เลื่อนลง"
          onClick={() => currentPage < pageOrder.length - 1 && movePage(currentPage, currentPage + 1)}
        >
          ↓
        </button>
        <button className="danger" title="ลบหน้า" onClick={() => removePage(currentPage)}>
          🗑
        </button>
      </div>

      <div className="thumbs">
        {doc &&
          pageOrder.map((originalIndex, displayIndex) => (
            <Thumb
              key={`${originalIndex}-${displayIndex}`}
              doc={doc}
              originalIndex={originalIndex}
              displayIndex={displayIndex}
            />
          ))}
      </div>
    </div>
  )
}

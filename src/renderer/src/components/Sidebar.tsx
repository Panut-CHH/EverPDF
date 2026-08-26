import { useEffect, useRef, useState } from 'react'
import {
  RotateCcw,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Trash2,
  FilePlus2,
  Scissors,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
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

export default function Sidebar({
  onInsert,
  onExtract
}: {
  onInsert: () => void
  onExtract: () => void
}): JSX.Element {
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
        <button className="collapse-btn" title="ขยายแถบหน้า" onClick={() => setCollapsed(false)}>
          <PanelLeftOpen size={18} strokeWidth={2} />
        </button>
      </div>
    )
  }

  const canUp = currentPage > 0
  const canDown = currentPage < pageOrder.length - 1

  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <span>หน้า · {pageOrder.length}</span>
        <button className="collapse-btn" title="ย่อแถบหน้า" onClick={() => setCollapsed(true)}>
          <PanelLeftClose size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="page-ops">
        <button title="หมุนซ้าย" onClick={() => rotatePage(currentPage, -90)}>
          <RotateCcw size={16} strokeWidth={2} />
        </button>
        <button title="หมุนขวา" onClick={() => rotatePage(currentPage, 90)}>
          <RotateCw size={16} strokeWidth={2} />
        </button>
        <button title="เลื่อนหน้าขึ้น" disabled={!canUp} onClick={() => movePage(currentPage, currentPage - 1)}>
          <ChevronUp size={16} strokeWidth={2} />
        </button>
        <button title="เลื่อนหน้าลง" disabled={!canDown} onClick={() => movePage(currentPage, currentPage + 1)}>
          <ChevronDown size={16} strokeWidth={2} />
        </button>
        <button className="danger" title="ลบหน้านี้" onClick={() => removePage(currentPage)}>
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="page-ops">
        <button className="wide" title="แทรกไฟล์ PDF อื่นต่อจากหน้านี้" onClick={onInsert}>
          <FilePlus2 size={15} strokeWidth={2} /> แทรก
        </button>
        <button className="wide" title="แยกหน้านี้เป็นไฟล์ใหม่" onClick={onExtract}>
          <Scissors size={15} strokeWidth={2} /> แยก
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

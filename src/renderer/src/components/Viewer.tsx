import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useDocStore } from '@/store/documentStore'
import { usePdfDoc } from '@/lib/usePdfDoc'
import { renderPage } from '@/lib/pdfjs'
import { newId, type Annotation } from '@/lib/annotations'
import AnnotationLayer from '@/components/AnnotationLayer'

/** ขนาด px จริงของหน้าที่เรนเดอร์ (ใช้จัด overlay ให้ตรง) */
interface RenderedSize {
  width: number
  height: number
}

export default function Viewer(): JSX.Element {
  const doc = usePdfDoc()
  const currentPage = useDocStore((s) => s.currentPage)
  const pageOrder = useDocStore((s) => s.pageOrder)
  const pages = useDocStore((s) => s.pages)
  const zoom = useDocStore((s) => s.zoom)

  const originalIndex = pageOrder[currentPage] ?? 0
  const rotation = pages[originalIndex]?.rotation ?? 0

  return (
    <div className="viewer">
      {doc && (
        <PageView
          key={`${originalIndex}-${zoom}-${rotation}`}
          doc={doc}
          originalIndex={originalIndex}
          rotation={rotation}
          zoom={zoom}
        />
      )}
    </div>
  )
}

function PageView({
  doc,
  originalIndex,
  rotation,
  zoom
}: {
  doc: PDFDocumentProxy
  originalIndex: number
  rotation: number
  zoom: number
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<RenderedSize | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingClickRef = useRef<{ x: number; y: number } | null>(null)

  const tool = useDocStore((s) => s.tool)
  const setTool = useDocStore((s) => s.setTool)
  const addAnnotation = useDocStore((s) => s.addAnnotation)
  const select = useDocStore((s) => s.select)
  const stagedImage = useDocStore((s) => s.stagedImage)
  const clearStaged = useDocStore((s) => s.clearStaged)

  // เรนเดอร์หน้าเมื่อ zoom/rotation/หน้า เปลี่ยน
  useEffect(() => {
    let cancelled = false
    doc.getPage(originalIndex + 1).then(async (page) => {
      if (cancelled || !canvasRef.current) return
      const s = await renderPage(page, canvasRef.current, zoom, rotation)
      if (!cancelled) setSize(s)
      page.cleanup()
    })
    return () => {
      cancelled = true
    }
  }, [doc, originalIndex, zoom, rotation])

  /** แปลงตำแหน่งคลิก → พิกัด normalized (0..1) เทียบขนาดหน้า */
  const toNormalized = (e: React.PointerEvent): { x: number; y: number } | null => {
    if (!size) return null
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / size.width,
      y: (e.clientY - rect.top) / size.height
    }
  }

  /** คลิกพื้นที่ว่างของหน้า → ทำงานตาม tool ที่เลือก */
  const handlePageClick = (e: React.PointerEvent): void => {
    // ถ้าคลิกโดน annotation ปล่อยให้ตัวมันจัดการเอง
    if ((e.target as HTMLElement).closest('.annotation')) return

    const pos = toNormalized(e)
    if (!pos) return

    // มีรูป/ลายเซ็นรอวาง → วางเลย (ไม่สนใจ tool อื่น)
    if (stagedImage) {
      placeImage(stagedImage.dataUrl, pos, stagedImage.isSignature)
      clearStaged()
      setTool('select')
      return
    }

    if (tool === 'text') {
      const ann: Annotation = {
        id: newId('txt'),
        type: 'text',
        pageIndex: originalIndex,
        x: pos.x,
        y: pos.y,
        w: 0.3,
        h: 0.05,
        text: 'พิมพ์ข้อความ',
        fontSize: 16,
        color: '#111111'
      }
      addAnnotation(ann)
      setTool('select')
    } else if (tool === 'image') {
      pendingClickRef.current = pos
      fileInputRef.current?.click()
    } else {
      select(null)
    }
  }

  /** วางรูป/ลายเซ็นโดยคง aspect ratio ให้กว้าง ~25% ของหน้า */
  const placeImage = (dataUrl: string, pos: { x: number; y: number }, isSignature: boolean): void => {
    const img = new Image()
    img.onload = () => {
      const aspect = img.height / img.width
      const w = isSignature ? 0.22 : 0.3
      const h = w * aspect * ((size!.width) / (size!.height))
      addAnnotation({
        id: newId(isSignature ? 'sig' : 'img'),
        type: 'image',
        pageIndex: originalIndex,
        x: pos.x,
        y: pos.y,
        w,
        h,
        dataUrl,
        isSignature
      })
    }
    img.src = dataUrl
  }

  /** ผู้ใช้เลือกไฟล์รูปจาก tool 'image' */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset เพื่อเลือกไฟล์เดิมซ้ำได้
    if (!file || !pendingClickRef.current) return
    const reader = new FileReader()
    const pos = pendingClickRef.current
    reader.onload = () => {
      placeImage(reader.result as string, pos, false)
      setTool('select')
    }
    reader.readAsDataURL(file)
  }

  const cursor =
    stagedImage || tool === 'text' || tool === 'image' ? 'crosshair' : 'default'

  return (
    <div className="page-scroll">
      <div className="page-wrap" style={{ cursor }} onPointerDown={handlePageClick}>
        <canvas ref={canvasRef} className="page-canvas" />
        {size && <AnnotationLayer originalIndex={originalIndex} size={size} />}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  )
}

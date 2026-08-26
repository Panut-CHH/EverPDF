import { memo, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useDocStore } from '@/store/documentStore'
import { renderPage, renderTextSelectLayer } from '@/lib/pdfjs'
import type { SearchHit } from '@/lib/search'
import AnnotationLayer from '@/components/AnnotationLayer'
import DrawSurface from '@/components/DrawSurface'
import FormLayer from '@/components/FormLayer'
import EditTextLayer from '@/components/EditTextLayer'

interface Size {
  width: number
  height: number
}

/**
 * เรนเดอร์หนึ่งหน้า + ชั้นซ้อนทั้งหมด
 * ใช้ IntersectionObserver เพื่อ render เฉพาะหน้าที่ใกล้ viewport (ประหยัดหน่วยความจำ)
 */
function PageViewImpl({
  doc,
  displayIndex,
  originalIndex,
  rotation,
  zoom,
  pageHeightPt,
  hits,
  activeHit,
  registerEl
}: {
  doc: PDFDocumentProxy
  displayIndex: number
  originalIndex: number
  rotation: number
  zoom: number
  pageHeightPt: number
  hits: SearchHit[]
  activeHit: SearchHit | null
  registerEl: (i: number, el: HTMLDivElement | null) => void
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [visible, setVisible] = useState(displayIndex < 3)

  const tool = useDocStore((s) => s.tool)
  const select = useDocStore((s) => s.select)

  // เฝ้าดูว่าหน้านี้ใกล้ viewport ไหม
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { rootMargin: '600px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // เรนเดอร์หน้าเมื่อมองเห็น + เมื่อ zoom/rotation เปลี่ยน
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    doc.getPage(originalIndex + 1).then(async (page) => {
      if (cancelled || !canvasRef.current) return
      const s = await renderPage(page, canvasRef.current, zoom, rotation)
      if (cancelled) {
        page.cleanup()
        return
      }
      setSize(s)
      // ชั้นข้อความสำหรับเลือก/คัดลอก
      if (textLayerRef.current) {
        try {
          await renderTextSelectLayer(page, textLayerRef.current, zoom, rotation)
        } catch {
          /* ข้าม ถ้าเรนเดอร์ text layer ไม่สำเร็จ */
        }
      }
      page.cleanup()
    })
    return () => {
      cancelled = true
    }
  }, [doc, originalIndex, zoom, rotation, visible])

  return (
    <div
      className="page-container"
      ref={(el) => {
        wrapRef.current = el
        registerEl(displayIndex, el)
      }}
      style={size ? { width: size.width, height: size.height } : { width: 600, height: 800 }}
      onPointerDown={(e) => {
        // คลิกที่ใดก็ได้ที่ "ไม่ใช่ตัว annotation" ในโหมด select → ยกเลิกการเลือก
        // (คลิกโดน annotation จะไม่ bubble มาถึงนี่ หรือ target อยู่ใน .annotation)
        if (tool !== 'select') return
        const target = e.target as HTMLElement
        if (!target.closest('.annotation')) select(null)
      }}
    >
      <canvas ref={canvasRef} className="page-canvas" />

      {/* ชั้นข้อความโปร่งใส (เลือก/คัดลอก) — เปิด pointer-events เฉพาะโหมดเลือก */}
      <div
        ref={textLayerRef}
        className={`text-layer ${tool === 'select' ? 'active' : ''}`}
      />

      {size && (
        <>
          {/* ผลค้นหา */}
          {hits.length > 0 && (
            <div className="search-layer">
              {hits.map((h, i) => (
                <div
                  key={i}
                  className={`search-hit ${activeHit === h ? 'active' : ''}`}
                  style={{
                    left: `${h.x * 100}%`,
                    top: `${h.y * 100}%`,
                    width: `${h.w * 100}%`,
                    height: `${h.h * 100}%`
                  }}
                />
              ))}
            </div>
          )}

          <FormLayer originalIndex={originalIndex} size={size} />

          <AnnotationLayer originalIndex={originalIndex} size={size} pageHeightPt={pageHeightPt} />

          {/* ชั้นแก้ข้อความเดิม */}
          {tool === 'edittext' && (
            <EditTextLayer
              originalIndex={originalIndex}
              size={size}
              getCanvas={() => canvasRef.current}
            />
          )}

          {/* ชั้นวาด: เปิดเฉพาะเครื่องมือวาด (ไม่ใช่ select/edittext) */}
          {tool !== 'select' && tool !== 'edittext' && (
            <DrawSurface originalIndex={originalIndex} size={size} pageHeightPt={pageHeightPt} />
          )}
        </>
      )}

      <div className="page-badge">{displayIndex + 1}</div>
    </div>
  )
}

export default memo(PageViewImpl)

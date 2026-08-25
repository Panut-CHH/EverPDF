import { useRef } from 'react'
import { useDocStore } from '@/store/documentStore'
import type { Annotation, TextAnnotation, ImageAnnotation } from '@/lib/annotations'

interface Size {
  width: number
  height: number
}

/** ชั้น annotation ลอยเหนือ canvas — เฉพาะของหน้าปัจจุบัน */
export default function AnnotationLayer({
  originalIndex,
  size
}: {
  originalIndex: number
  size: Size
}): JSX.Element {
  const annotations = useDocStore((s) => s.annotations.filter((a) => a.pageIndex === originalIndex))

  return (
    <div className="annotation-layer" style={{ width: size.width, height: size.height }}>
      {annotations.map((a) => (
        <AnnotationItem key={a.id} ann={a} size={size} />
      ))}
    </div>
  )
}

type DragMode = 'move' | 'resize' | null

function AnnotationItem({ ann, size }: { ann: Annotation; size: Size }): JSX.Element {
  const selectedId = useDocStore((s) => s.selectedId)
  const select = useDocStore((s) => s.select)
  const update = useDocStore((s) => s.updateAnnotation)
  const remove = useDocStore((s) => s.removeAnnotation)

  const selected = selectedId === ann.id
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
  } | null>(null)

  const startDrag = (e: React.PointerEvent, mode: DragMode): void => {
    e.stopPropagation()
    select(ann.id)
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: ann.x,
      origY: ann.y,
      origW: ann.w,
      origH: ann.h
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent): void => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.startX) / size.width
    const dy = (e.clientY - d.startY) / size.height

    if (d.mode === 'move') {
      update(ann.id, {
        x: Math.max(0, Math.min(1 - ann.w, d.origX + dx)),
        y: Math.max(0, Math.min(1 - ann.h, d.origY + dy))
      })
    } else if (d.mode === 'resize') {
      update(ann.id, {
        w: Math.max(0.03, d.origW + dx),
        h: Math.max(0.02, d.origH + dy)
      })
    }
  }

  const endDrag = (e: React.PointerEvent): void => {
    dragRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  const style: React.CSSProperties = {
    left: `${ann.x * 100}%`,
    top: `${ann.y * 100}%`,
    width: `${ann.w * 100}%`,
    height: `${ann.h * 100}%`
  }

  return (
    <div
      className={`annotation ${selected ? 'selected' : ''}`}
      style={style}
      onPointerDown={(e) => startDrag(e, 'move')}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onClick={(e) => {
        e.stopPropagation()
        select(ann.id)
      }}
    >
      {ann.type === 'text' ? (
        <TextBody ann={ann} size={size} />
      ) : (
        <img className="annotation-img" src={(ann as ImageAnnotation).dataUrl} draggable={false} alt="" />
      )}

      {selected && (
        <>
          <button
            className="ann-delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              remove(ann.id)
            }}
          >
            ×
          </button>
          <div
            className="ann-resize"
            onPointerDown={(e) => startDrag(e, 'resize')}
            onPointerMove={onMove}
            onPointerUp={endDrag}
          />
        </>
      )}
    </div>
  )
}

/** เนื้อข้อความ: ดับเบิลคลิกเพื่อแก้ไข inline, มีแถบปรับขนาด/สีตอนถูกเลือก */
function TextBody({ ann, size }: { ann: TextAnnotation; size: Size }): JSX.Element {
  const update = useDocStore((s) => s.updateAnnotation)
  const selected = useDocStore((s) => s.selectedId === ann.id)
  const editRef = useRef<HTMLDivElement>(null)

  // fontSize เป็น pt ของ PDF → บนจอคูณด้วย (size.height / หน้าจริง)?
  // ประมาณด้วย scale = ขนาดpx ปัจจุบัน / ขนาด point (เดาจาก zoom ผ่าน size)
  // ใช้ px = fontSize * (size.height / pageHeightPt) แต่เราไม่มี pt ตรงนี้ → ใช้ ratio จาก store แทน
  const pxPerPt = size.height / (useDocStore.getState().pages[ann.pageIndex]?.height ?? size.height)
  const fontPx = ann.fontSize * pxPerPt

  return (
    <>
      <div
        ref={editRef}
        className="annotation-text"
        style={{ fontSize: `${fontPx}px`, color: ann.color }}
        contentEditable={selected}
        suppressContentEditableWarning
        onDoubleClick={() => editRef.current?.focus()}
        onBlur={(e) => update(ann.id, { text: e.currentTarget.textContent ?? '' })}
      >
        {ann.text}
      </div>

      {selected && (
        <div className="text-tools" onPointerDown={(e) => e.stopPropagation()}>
          <input
            type="number"
            min={6}
            max={200}
            value={ann.fontSize}
            onChange={(e) => update(ann.id, { fontSize: Number(e.target.value) })}
          />
          <input
            type="color"
            value={ann.color}
            onChange={(e) => update(ann.id, { color: e.target.value })}
          />
        </div>
      )}
    </>
  )
}

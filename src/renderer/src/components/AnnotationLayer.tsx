import { useRef } from 'react'
import { useDocStore } from '@/store/documentStore'
import {
  isBoxLike,
  type Annotation,
  type TextAnnotation,
  type ImageAnnotation,
  type HighlightAnnotation,
  type RectAnnotation,
  type LineAnnotation,
  type InkAnnotation,
  type BoxLike
} from '@/lib/annotations'

interface Size {
  width: number
  height: number
}

/** ชั้น annotation ลอยเหนือ canvas — เฉพาะของหน้าปัจจุบัน */
export default function AnnotationLayer({
  originalIndex,
  size,
  pageHeightPt
}: {
  originalIndex: number
  size: Size
  pageHeightPt: number
}): JSX.Element {
  const annotations = useDocStore((s) =>
    s.annotations.filter((a) => a.pageIndex === originalIndex)
  )

  const shapes = annotations.filter((a) => a.type === 'line' || a.type === 'ink')
  const boxes = annotations.filter(isBoxLike)

  return (
    <div className="annotation-layer" style={{ width: size.width, height: size.height }}>
      {/* รูปทรงเส้น/ปากกา วาดใน SVG ชั้นล่าง */}
      <svg className="shape-svg" viewBox={`0 0 ${size.width} ${size.height}`}>
        {shapes.map((a) =>
          a.type === 'line' ? (
            <LineShape key={a.id} ann={a} size={size} />
          ) : (
            <InkShape key={a.id} ann={a as InkAnnotation} size={size} />
          )
        )}
      </svg>

      {/* กล่อง (ข้อความ/รูป/ไฮไลต์/สี่เหลี่ยม) เป็น div ชั้นบน */}
      {boxes.map((a) => (
        <BoxItem key={a.id} ann={a} size={size} pageHeightPt={pageHeightPt} />
      ))}
    </div>
  )
}

/* ============ กล่อง (box-like) ============ */

type DragMode = 'move' | 'resize' | null

function BoxItem({
  ann,
  size,
  pageHeightPt
}: {
  ann: BoxLike
  size: Size
  pageHeightPt: number
}): JSX.Element {
  const selectedId = useDocStore((s) => s.selectedId)
  const select = useDocStore((s) => s.select)
  const update = useDocStore((s) => s.updateAnnotation)
  const commit = useDocStore((s) => s.commitTransient)
  const remove = useDocStore((s) => s.removeAnnotation)
  const tool = useDocStore((s) => s.tool)

  const selected = selectedId === ann.id
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    o: { x: number; y: number; w: number; h: number }
    moved: boolean
  } | null>(null)

  const startDrag = (e: React.PointerEvent, mode: DragMode): void => {
    if (tool !== 'select') return
    e.stopPropagation()
    select(ann.id)
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      o: { x: ann.x, y: ann.y, w: ann.w, h: ann.h },
      moved: false
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent): void => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.startX) / size.width
    const dy = (e.clientY - d.startY) / size.height
    if (!d.moved && (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001)) {
      commit() // บันทึกสถานะก่อนเริ่มลาก ลง history (ครั้งเดียว)
      d.moved = true
    }
    if (d.mode === 'move') {
      update(
        ann.id,
        {
          x: Math.max(0, Math.min(1 - ann.w, d.o.x + dx)),
          y: Math.max(0, Math.min(1 - ann.h, d.o.y + dy))
        },
        true
      )
    } else if (d.mode === 'resize') {
      update(ann.id, { w: Math.max(0.02, d.o.w + dx), h: Math.max(0.01, d.o.h + dy) }, true)
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
      <BoxBody ann={ann} size={size} pageHeightPt={pageHeightPt} />

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

function BoxBody({
  ann,
  size,
  pageHeightPt
}: {
  ann: BoxLike
  size: Size
  pageHeightPt: number
}): JSX.Element | null {
  if (ann.type === 'text') return <TextBody ann={ann} size={size} pageHeightPt={pageHeightPt} />
  if (ann.type === 'image')
    return (
      <img className="annotation-img" src={(ann as ImageAnnotation).dataUrl} draggable={false} alt="" />
    )
  if (ann.type === 'highlight') {
    const a = ann as HighlightAnnotation
    return <div style={{ width: '100%', height: '100%', background: a.color, opacity: a.opacity }} />
  }
  // rect
  const a = ann as RectAnnotation
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        border: `${a.strokeWidth}px solid ${a.color}`,
        background: a.fill ?? 'transparent',
        boxSizing: 'border-box'
      }}
    />
  )
}

/** ข้อความ: ดับเบิลคลิกแก้ไข inline, มีแถบปรับ ขนาด/สี/ตัวหนา ตอนถูกเลือก */
function TextBody({
  ann,
  size,
  pageHeightPt
}: {
  ann: TextAnnotation
  size: Size
  pageHeightPt: number
}): JSX.Element {
  const update = useDocStore((s) => s.updateAnnotation)
  const selected = useDocStore((s) => s.selectedId === ann.id)
  const editRef = useRef<HTMLDivElement>(null)

  // fontSize เป็น pt → px บนจอ = fontSize * (px หน้าจริง / pt หน้าจริง)
  const fontPx = ann.fontSize * (size.height / pageHeightPt)

  return (
    <>
      <div
        ref={editRef}
        className="annotation-text"
        style={{ fontSize: `${fontPx}px`, color: ann.color, fontWeight: ann.bold ? 700 : 400 }}
        contentEditable={selected}
        suppressContentEditableWarning
        onDoubleClick={() => editRef.current?.focus()}
        onBlur={(e) => update(ann.id, { text: e.currentTarget.innerText })}
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
          <button
            className={ann.bold ? 'active' : ''}
            style={{ fontWeight: 700 }}
            onClick={() => update(ann.id, { bold: !ann.bold })}
          >
            B
          </button>
        </div>
      )}
    </>
  )
}

/* ============ รูปทรงเส้น/ปากกา (SVG) ============ */

function LineShape({ ann, size }: { ann: LineAnnotation; size: Size }): JSX.Element {
  const selected = useDocStore((s) => s.selectedId === ann.id)
  const select = useDocStore((s) => s.select)
  const remove = useDocStore((s) => s.removeAnnotation)
  const tool = useDocStore((s) => s.tool)

  const x1 = ann.x1 * size.width
  const y1 = ann.y1 * size.height
  const x2 = ann.x2 * size.width
  const y2 = ann.y2 * size.height

  const arrow = ann.arrow ? arrowHead(x1, y1, x2, y2, ann.strokeWidth) : null

  return (
    <g
      style={{ pointerEvents: tool === 'select' ? 'stroke' : 'none', cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        select(ann.id)
      }}
      onDoubleClick={() => remove(ann.id)}
    >
      {/* เส้นจับ (โปร่งใส หนา) ให้คลิกง่าย */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={ann.color}
        strokeWidth={ann.strokeWidth}
        strokeLinecap="round"
      />
      {arrow && <polyline points={arrow} fill="none" stroke={ann.color} strokeWidth={ann.strokeWidth} strokeLinecap="round" />}
      {selected && (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" />
      )}
    </g>
  )
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, sw: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const len = 10 + sw * 2
  const s = 0.5
  const p1 = [x2 - len * Math.cos(angle - s), y2 - len * Math.sin(angle - s)]
  const p2 = [x2 - len * Math.cos(angle + s), y2 - len * Math.sin(angle + s)]
  return `${p1[0]},${p1[1]} ${x2},${y2} ${p2[0]},${p2[1]}`
}

function InkShape({ ann, size }: { ann: InkAnnotation; size: Size }): JSX.Element {
  const selected = useDocStore((s) => s.selectedId === ann.id)
  const select = useDocStore((s) => s.select)
  const remove = useDocStore((s) => s.removeAnnotation)
  const tool = useDocStore((s) => s.tool)

  const pts = ann.points.map((p) => `${p.x * size.width},${p.y * size.height}`).join(' ')

  return (
    <g
      style={{ pointerEvents: tool === 'select' ? 'stroke' : 'none', cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        select(ann.id)
      }}
      onDoubleClick={() => remove(ann.id)}
    >
      <polyline points={pts} fill="none" stroke="transparent" strokeWidth={14} />
      <polyline
        points={pts}
        fill="none"
        stroke={ann.color}
        strokeWidth={ann.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {selected && (
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" />
      )}
    </g>
  )
}

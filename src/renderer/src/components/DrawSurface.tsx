import { useRef, useState } from 'react'
import { useDocStore } from '@/store/documentStore'
import { newId, type Annotation } from '@/lib/annotations'

interface Size {
  width: number
  height: number
}

type Pt = { x: number; y: number }

/**
 * ชั้นรับการวาดของเครื่องมือสร้าง annotation
 * เปิดใช้เฉพาะเมื่อเลือกเครื่องมือที่ไม่ใช่ 'select'
 * - text/image/signature : คลิกครั้งเดียว
 * - highlight/rect        : ลากเป็นกล่อง
 * - line/arrow            : ลากเป็นเส้น
 * - ink                   : ลากอิสระ (freehand)
 */
export default function DrawSurface({
  originalIndex,
  size,
  pageHeightPt
}: {
  originalIndex: number
  size: Size
  pageHeightPt: number
}): JSX.Element {
  const tool = useDocStore((s) => s.tool)
  const setTool = useDocStore((s) => s.setTool)
  const addAnnotation = useDocStore((s) => s.addAnnotation)
  const drawColor = useDocStore((s) => s.drawColor)
  const highlightColor = useDocStore((s) => s.highlightColor)
  const strokeWidth = useDocStore((s) => s.strokeWidth)
  const stagedImage = useDocStore((s) => s.stagedImage)
  const clearStaged = useDocStore((s) => s.clearStaged)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<Pt | null>(null)
  const inkRef = useRef<Pt[]>([])
  const [preview, setPreview] = useState<JSX.Element | null>(null)

  const toNorm = (e: React.PointerEvent): Pt => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / size.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / size.height))
    }
  }

  const placeImage = (dataUrl: string, pos: Pt, isSignature: boolean): void => {
    const img = new Image()
    img.onload = () => {
      const aspectPx = img.height / img.width
      const w = isSignature ? 0.22 : 0.3
      const h = (w * size.width * aspectPx) / size.height
      addAnnotation({
        id: newId(isSignature ? 'sig' : 'img'),
        type: 'image',
        pageIndex: originalIndex,
        x: Math.min(pos.x, 1 - w),
        y: Math.min(pos.y, 1 - h),
        w,
        h,
        dataUrl,
        isSignature
      })
    }
    img.src = dataUrl
  }

  const onDown = (e: React.PointerEvent): void => {
    const pos = toNorm(e)

    // มีรูป/ลายเซ็นรอวาง
    if (stagedImage) {
      placeImage(stagedImage.dataUrl, pos, stagedImage.isSignature)
      clearStaged()
      setTool('select')
      return
    }

    if (tool === 'text') {
      const fontSize = 16
      addAnnotation({
        id: newId('txt'),
        type: 'text',
        pageIndex: originalIndex,
        x: pos.x,
        y: pos.y,
        w: 0.3,
        h: (fontSize * 1.4) / pageHeightPt,
        text: 'พิมพ์ข้อความ',
        fontSize,
        color: drawColor,
        bold: false
      })
      setTool('select')
      return
    }

    if (tool === 'image') {
      startRef.current = pos
      fileInputRef.current?.click()
      return
    }

    // เครื่องมือลาก
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* บาง environment/synthetic event ตั้ง capture ไม่ได้ — ไม่เป็นไร */
    }
    startRef.current = pos
    if (tool === 'ink') inkRef.current = [pos]
  }

  const onMove = (e: React.PointerEvent): void => {
    const start = startRef.current
    if (!start) return
    const cur = toNorm(e)

    if (tool === 'highlight' || tool === 'rect') {
      const x = Math.min(start.x, cur.x) * size.width
      const y = Math.min(start.y, cur.y) * size.height
      const w = Math.abs(cur.x - start.x) * size.width
      const h = Math.abs(cur.y - start.y) * size.height
      const isHl = tool === 'highlight'
      setPreview(
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={isHl ? highlightColor : 'none'}
          fillOpacity={isHl ? 0.4 : 0}
          stroke={isHl ? 'none' : drawColor}
          strokeWidth={strokeWidth}
        />
      )
    } else if (tool === 'line' || tool === 'arrow') {
      setPreview(
        <line
          x1={start.x * size.width}
          y1={start.y * size.height}
          x2={cur.x * size.width}
          y2={cur.y * size.height}
          stroke={drawColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )
    } else if (tool === 'ink') {
      inkRef.current.push(cur)
      const pts = inkRef.current.map((p) => `${p.x * size.width},${p.y * size.height}`).join(' ')
      setPreview(
        <polyline
          points={pts}
          fill="none"
          stroke={drawColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    }
  }

  const onUp = (e: React.PointerEvent): void => {
    const start = startRef.current
    startRef.current = null
    setPreview(null)
    if (!start) return
    const cur = toNorm(e)
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)

    let ann: Annotation | null = null
    if (tool === 'highlight' || tool === 'rect') {
      const x = Math.min(start.x, cur.x)
      const y = Math.min(start.y, cur.y)
      const w = Math.abs(cur.x - start.x)
      const h = Math.abs(cur.y - start.y)
      if (w < 0.005 || h < 0.005) return
      ann =
        tool === 'highlight'
          ? {
              id: newId('hl'),
              type: 'highlight',
              pageIndex: originalIndex,
              x,
              y,
              w,
              h,
              color: highlightColor,
              opacity: 0.4
            }
          : {
              id: newId('rect'),
              type: 'rect',
              pageIndex: originalIndex,
              x,
              y,
              w,
              h,
              color: drawColor,
              strokeWidth
            }
    } else if (tool === 'line' || tool === 'arrow') {
      const dist = Math.hypot(cur.x - start.x, cur.y - start.y)
      if (dist < 0.005) return
      ann = {
        id: newId('line'),
        type: 'line',
        pageIndex: originalIndex,
        x1: start.x,
        y1: start.y,
        x2: cur.x,
        y2: cur.y,
        color: drawColor,
        strokeWidth,
        arrow: tool === 'arrow'
      }
    } else if (tool === 'ink') {
      if (inkRef.current.length < 2) return
      ann = {
        id: newId('ink'),
        type: 'ink',
        pageIndex: originalIndex,
        points: inkRef.current.slice(),
        color: drawColor,
        strokeWidth
      }
      inkRef.current = []
    }

    if (ann) {
      addAnnotation(ann) // จะเลือก annotation ที่เพิ่งวาดให้อัตโนมัติ
      // สลับกลับโหมดเลือก เพื่อให้เคอร์เซอร์กลับปกติ + กดปุ่มลบ/ปรับขนาดได้ทันที
      // (ยกเว้นปากกา ที่ตั้งใจให้วาดต่อเนื่องหลายเส้น)
      if (tool !== 'ink') setTool('select')
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const pos = startRef.current
    startRef.current = null
    if (!file || !pos) return
    const reader = new FileReader()
    reader.onload = () => {
      placeImage(reader.result as string, pos, false)
      setTool('select')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      className="draw-surface"
      style={{ cursor: tool === 'text' ? 'text' : 'crosshair' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      {preview && (
        <svg className="shape-svg" viewBox={`0 0 ${size.width} ${size.height}`}>
          {preview}
        </svg>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={onFile}
      />
    </div>
  )
}

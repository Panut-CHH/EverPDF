import { useEffect, useRef, useState } from 'react'
import { useDocStore } from '@/store/documentStore'

/**
 * แผงวาดลายเซ็น: วาดด้วยเมาส์/ปากกา → ตัดขอบขาว → ได้ PNG โปร่งใส
 * เมื่อกด "ใช้ลายเซ็น" จะ stage รูปไว้ให้ผู้ใช้คลิกวางบนหน้า PDF
 */
export default function SignaturePad({ onClose }: { onClose: () => void }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const stageImage = useDocStore((s) => s.stageImage)
  const [color, setColor] = useState('#0a2a6b')
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = 600 * dpr
    canvas.height = 220 * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const pos = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent): void => {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.strokeStyle = color
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }
  const move = (e: React.PointerEvent): void => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setEmpty(false)
  }
  const end = (): void => {
    drawing.current = false
  }

  const clear = (): void => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setEmpty(true)
  }

  /** ตัดพื้นที่ว่างรอบลายเซ็นออก เหลือเฉพาะรอยหมึก แล้วคืน data URL */
  const trimmed = (): string | null => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let minX = width, minY = height, maxX = 0, maxY = 0, found = false
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 10) {
          found = true
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (!found) return null
    const pad = 8
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(width, maxX + pad)
    maxY = Math.min(height, maxY + pad)
    const out = document.createElement('canvas')
    out.width = maxX - minX
    out.height = maxY - minY
    out.getContext('2d')!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
    return out.toDataURL('image/png')
  }

  const apply = (): void => {
    const url = trimmed()
    if (!url) return
    stageImage(url, true)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>วาดลายเซ็น</h3>
        <div className="sig-controls">
          <label>
            สี <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <button onClick={clear}>ล้าง</button>
        </div>
        <canvas
          ref={canvasRef}
          className="sig-canvas"
          style={{ width: 600, height: 220 }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        <p className="hint">วาดในกรอบด้านบน แล้วกด "ใช้ลายเซ็น" จากนั้นคลิกตำแหน่งบนหน้า PDF</p>
        <div className="modal-actions">
          <button onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary" disabled={empty} onClick={apply}>
            ใช้ลายเซ็น
          </button>
        </div>
      </div>
    </div>
  )
}

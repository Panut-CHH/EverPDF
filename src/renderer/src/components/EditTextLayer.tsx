import { useMemo } from 'react'
import { useDocStore } from '@/store/documentStore'
import { newId, type HighlightAnnotation, type TextAnnotation } from '@/lib/annotations'
import { sampleColors } from '@/lib/sampleColor'
import type { TextRun } from '@/lib/textLines'

interface Size {
  width: number
  height: number
}

/**
 * ชั้น Edit Text — แสดงกรอบคลิกได้ทับข้อความเดิม (เมื่อเลือกเครื่องมือ "แก้ข้อความ")
 * คลิก run ไหน → ทับสีพื้นตรงนั้น + วางกล่องข้อความแก้ไขได้พร้อมข้อความเดิม
 */
export default function EditTextLayer({
  originalIndex,
  size,
  getCanvas
}: {
  originalIndex: number
  size: Size
  getCanvas: () => HTMLCanvasElement | null
}): JSX.Element | null {
  const tool = useDocStore((s) => s.tool)
  const allRuns = useDocStore((s) => s.textRuns)
  const addAnnotation = useDocStore((s) => s.addAnnotation)
  const select = useDocStore((s) => s.select)
  const setTool = useDocStore((s) => s.setTool)

  const runs = useMemo(
    () => allRuns.filter((r) => r.pageIndex === originalIndex),
    [allRuns, originalIndex]
  )

  if (tool !== 'edittext' || runs.length === 0) return null

  const editRun = (run: TextRun): void => {
    const canvas = getCanvas()
    const colors = canvas
      ? sampleColors(canvas, { x: run.x, y: run.y, w: run.w, h: run.h })
      : { bg: '#ffffff', fg: '#000000' }

    // 1) ตัวทับสีพื้น (ขยายเล็กน้อยให้ปิดข้อความเดิมสนิท)
    const padY = run.h * 0.25
    const padX = run.h * 0.12
    const cover: HighlightAnnotation = {
      id: newId('cover'),
      type: 'highlight',
      pageIndex: originalIndex,
      x: Math.max(0, run.x - padX),
      y: Math.max(0, run.y - padY),
      w: run.w + padX * 2,
      h: run.h + padY * 2,
      color: colors.bg,
      opacity: 1
    }

    // 2) กล่องข้อความใหม่ (พร้อมข้อความเดิม) ตรงตำแหน่ง/ขนาดเดิม
    const text: TextAnnotation = {
      id: newId('etxt'),
      type: 'text',
      pageIndex: originalIndex,
      x: run.x,
      y: run.y,
      w: Math.max(run.w * 1.1, 0.08),
      h: run.h * 1.4,
      text: run.text,
      fontSize: run.fontSize,
      color: colors.fg,
      bold: false
    }

    addAnnotation(cover)
    addAnnotation(text)
    select(text.id)
    setTool('select') // สลับเป็นโหมดเลือกเพื่อพิมพ์แก้ได้ทันที
  }

  return (
    <div className="edittext-layer" style={{ width: size.width, height: size.height }}>
      {runs.map((run) => (
        <div
          key={run.id}
          className="edittext-run"
          style={{
            left: `${run.x * 100}%`,
            top: `${run.y * 100}%`,
            width: `${run.w * 100}%`,
            height: `${run.h * 100}%`
          }}
          title="คลิกเพื่อแก้ข้อความนี้"
          onPointerDown={(e) => {
            e.stopPropagation()
            editRun(run)
          }}
        />
      ))}
    </div>
  )
}

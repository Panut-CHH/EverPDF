import { useState } from 'react'
import { useDocStore, type Tool } from '@/store/documentStore'
import SignaturePad from '@/components/SignaturePad'
import SignDialog from '@/components/SignDialog'

interface Props {
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
}

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'เลือก', icon: '⬚', hint: 'เลือก/ย้าย/ปรับขนาด' },
  { id: 'text', label: 'ข้อความ', icon: 'T', hint: 'คลิกบนหน้าเพื่อเพิ่มข้อความ' },
  { id: 'image', label: 'รูปภาพ', icon: '🖼', hint: 'แทรกรูปภาพ' },
  { id: 'signature', label: 'ลายเซ็น', icon: '✒', hint: 'วาดลายเซ็นแล้ววางบนหน้า' }
]

export default function Toolbar({ onOpen, onSave, onSaveAs }: Props): JSX.Element {
  const tool = useDocStore((s) => s.tool)
  const setTool = useDocStore((s) => s.setTool)
  const zoom = useDocStore((s) => s.zoom)
  const setZoom = useDocStore((s) => s.setZoom)
  const dirty = useDocStore((s) => s.dirty)
  const fileName = useDocStore((s) => s.fileName)
  const hasDoc = useDocStore((s) => !!s.pdfBytes)

  const [showPad, setShowPad] = useState(false)
  const [showSign, setShowSign] = useState(false)

  const handleTool = (t: Tool): void => {
    if (t === 'signature') {
      setShowPad(true)
    } else {
      setTool(t)
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button onClick={onOpen} title="เปิด (Ctrl+O)">📂 เปิด</button>
        <button onClick={onSave} disabled={!hasDoc} title="บันทึก (Ctrl+S)">
          💾 บันทึก
        </button>
        <button onClick={onSaveAs} disabled={!hasDoc}>บันทึกเป็น…</button>
      </div>

      <div className="divider" />

      <div className="toolbar-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? 'active' : ''}
            disabled={!hasDoc}
            title={t.hint}
            onClick={() => handleTool(t.id)}
          >
            <span className="tool-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="divider" />

      <div className="toolbar-group">
        <button disabled={!hasDoc} onClick={() => setZoom(zoom - 0.1)}>−</button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button disabled={!hasDoc} onClick={() => setZoom(zoom + 0.1)}>+</button>
        <button disabled={!hasDoc} onClick={() => setZoom(1)}>พอดี</button>
      </div>

      <div className="divider" />

      <div className="toolbar-group">
        <button className="btn-sign" disabled={!hasDoc} onClick={() => setShowSign(true)}>
          🔏 ลงลายเซ็นดิจิทัล
        </button>
      </div>

      <div className="toolbar-spacer" />
      <div className="file-name">
        {fileName || 'ยังไม่มีไฟล์'} {dirty && <span className="dirty">●</span>}
      </div>

      {showPad && <SignaturePad onClose={() => setShowPad(false)} />}
      {showSign && <SignDialog onClose={() => setShowSign(false)} />}
    </div>
  )
}

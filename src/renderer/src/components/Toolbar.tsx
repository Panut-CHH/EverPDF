import { useState } from 'react'
import { useDocStore, type Tool } from '@/store/documentStore'
import SignaturePad from '@/components/SignaturePad'
import SignDialog from '@/components/SignDialog'
import VerifyDialog from '@/components/VerifyDialog'

interface Props {
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
}

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'เลือก', icon: '⬚', hint: 'เลือก/ย้าย/ปรับขนาด' },
  { id: 'text', label: 'ข้อความ', icon: 'T', hint: 'คลิกบนหน้าเพื่อเพิ่มข้อความ' },
  { id: 'highlight', label: 'ไฮไลต์', icon: '▨', hint: 'ลากคลุมข้อความเพื่อไฮไลต์' },
  { id: 'ink', label: 'ปากกา', icon: '✎', hint: 'วาดอิสระ' },
  { id: 'rect', label: 'สี่เหลี่ยม', icon: '▭', hint: 'ลากเป็นกรอบ' },
  { id: 'line', label: 'เส้น', icon: '／', hint: 'ลากเป็นเส้น' },
  { id: 'arrow', label: 'ลูกศร', icon: '➟', hint: 'ลากเป็นลูกศร' },
  { id: 'image', label: 'รูป', icon: '🖼', hint: 'แทรกรูปภาพ' }
]

const DRAW_TOOLS: Tool[] = ['ink', 'rect', 'line', 'arrow']

export default function Toolbar({ onOpen, onSave, onSaveAs }: Props): JSX.Element {
  const tool = useDocStore((s) => s.tool)
  const setTool = useDocStore((s) => s.setTool)
  const zoom = useDocStore((s) => s.zoom)
  const setZoom = useDocStore((s) => s.setZoom)
  const fitMode = useDocStore((s) => s.fitMode)
  const setFitMode = useDocStore((s) => s.setFitMode)
  const dirty = useDocStore((s) => s.dirty)
  const fileName = useDocStore((s) => s.fileName)
  const hasDoc = useDocStore((s) => !!s.pdfBytes)

  const currentPage = useDocStore((s) => s.currentPage)
  const numPages = useDocStore((s) => s.pageOrder.length)
  const setCurrentPage = useDocStore((s) => s.setCurrentPage)

  const undo = useDocStore((s) => s.undo)
  const redo = useDocStore((s) => s.redo)
  const canUndo = useDocStore((s) => s.past.length > 0)
  const canRedo = useDocStore((s) => s.future.length > 0)

  const drawColor = useDocStore((s) => s.drawColor)
  const setDrawColor = useDocStore((s) => s.setDrawColor)
  const highlightColor = useDocStore((s) => s.highlightColor)
  const setHighlightColor = useDocStore((s) => s.setHighlightColor)
  const strokeWidth = useDocStore((s) => s.strokeWidth)
  const setStrokeWidth = useDocStore((s) => s.setStrokeWidth)

  const [showPad, setShowPad] = useState(false)
  const [showSign, setShowSign] = useState(false)
  const [showVerify, setShowVerify] = useState(false)

  const handleTool = (t: Tool): void => {
    if (t === 'signature') setShowPad(true)
    else setTool(t)
  }

  const showDrawOpts = DRAW_TOOLS.includes(tool)
  const showHlOpts = tool === 'highlight'

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button onClick={onOpen} title="เปิด (Ctrl+O)">📂</button>
        <button onClick={onSave} disabled={!hasDoc} title="บันทึก (Ctrl+S)">💾</button>
        <button onClick={onSaveAs} disabled={!hasDoc} title="บันทึกเป็น">💾+</button>
      </div>

      <div className="divider" />

      <div className="toolbar-group">
        <button onClick={undo} disabled={!canUndo} title="เลิกทำ (Ctrl+Z)">↶</button>
        <button onClick={redo} disabled={!canRedo} title="ทำซ้ำ (Ctrl+Y)">↷</button>
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
            <span className="tool-icon">{t.icon}</span>
          </button>
        ))}
        <button
          className="btn-sign"
          disabled={!hasDoc}
          title="วาดลายเซ็น"
          onClick={() => handleTool('signature')}
        >
          ✒ ลายเซ็น
        </button>
      </div>

      {(showDrawOpts || showHlOpts) && (
        <>
          <div className="divider" />
          <div className="draw-opts">
            {showHlOpts ? (
              <label>
                สี
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label>
                  สี
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => setDrawColor(e.target.value)}
                  />
                </label>
                <label>
                  หนา
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  />
                </label>
              </>
            )}
          </div>
        </>
      )}

      <div className="divider" />

      <div className="toolbar-group">
        <button disabled={!hasDoc} onClick={() => setZoom(zoom - 0.15)}>−</button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button disabled={!hasDoc} onClick={() => setZoom(zoom + 0.15)}>+</button>
        <button
          className={fitMode === 'width' ? 'active' : ''}
          disabled={!hasDoc}
          onClick={() => setFitMode('width')}
          title="พอดีความกว้าง"
        >
          ↔
        </button>
        <button
          className={fitMode === 'page' ? 'active' : ''}
          disabled={!hasDoc}
          onClick={() => setFitMode('page')}
          title="พอดีทั้งหน้า"
        >
          ⤢
        </button>
      </div>

      {hasDoc && (
        <>
          <div className="divider" />
          <div className="toolbar-group">
            <input
              className="page-input"
              type="number"
              min={1}
              max={numPages}
              value={currentPage + 1}
              onChange={(e) => {
                const p = Math.max(1, Math.min(numPages, Number(e.target.value))) - 1
                setCurrentPage(p)
              }}
            />
            <span className="zoom-label">/ {numPages}</span>
          </div>
        </>
      )}

      <div className="toolbar-spacer" />
      <div className="toolbar-group">
        <button className="btn-sign" disabled={!hasDoc} onClick={() => setShowSign(true)}>
          🔏 เซ็นดิจิทัล
        </button>
        <button disabled={!hasDoc} onClick={() => setShowVerify(true)} title="ตรวจสอบลายเซ็น">
          🔎 ตรวจ
        </button>
      </div>
      <div className="file-name">
        {fileName || 'ยังไม่มีไฟล์'} {dirty && <span className="dirty">●</span>}
      </div>

      {showPad && <SignaturePad onClose={() => setShowPad(false)} />}
      {showSign && <SignDialog onClose={() => setShowSign(false)} />}
      {showVerify && <VerifyDialog onClose={() => setShowVerify(false)} />}
    </div>
  )
}

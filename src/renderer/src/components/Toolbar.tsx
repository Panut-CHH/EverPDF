import { useState } from 'react'
import {
  FolderOpen,
  Save,
  FileDown,
  Undo2,
  Redo2,
  MousePointer2,
  TextCursorInput,
  Type,
  Highlighter,
  Pencil,
  Square,
  Minus,
  MoveUpRight,
  Image as ImageIcon,
  PenTool,
  Plus,
  StretchHorizontal,
  Maximize,
  ShieldCheck,
  SearchCheck,
  type LucideIcon
} from 'lucide-react'
import { useDocStore, type Tool } from '@/store/documentStore'
import SignaturePad from '@/components/SignaturePad'
import SignDialog from '@/components/SignDialog'
import VerifyDialog from '@/components/VerifyDialog'

interface Props {
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
}

const TOOLS: { id: Tool; label: string; Icon: LucideIcon }[] = [
  { id: 'select', label: 'เลือก / ย้าย / ปรับขนาด', Icon: MousePointer2 },
  { id: 'edittext', label: 'แก้ข้อความเดิม — คลิกข้อความในเอกสาร', Icon: TextCursorInput },
  { id: 'text', label: 'เพิ่มข้อความใหม่', Icon: Type },
  { id: 'highlight', label: 'ไฮไลต์', Icon: Highlighter },
  { id: 'ink', label: 'ปากกา (วาดอิสระ)', Icon: Pencil },
  { id: 'rect', label: 'สี่เหลี่ยม', Icon: Square },
  { id: 'line', label: 'เส้น', Icon: Minus },
  { id: 'arrow', label: 'ลูกศร', Icon: MoveUpRight },
  { id: 'image', label: 'แทรกรูปภาพ', Icon: ImageIcon }
]

const DRAW_TOOLS: Tool[] = ['ink', 'rect', 'line', 'arrow']

/** ปุ่มไอคอนมาตรฐานของ toolbar */
function IconBtn({
  Icon,
  label,
  active,
  disabled,
  variant,
  onClick
}: {
  Icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  variant?: 'ghost' | 'accent' | 'sign' | 'verify'
  onClick?: () => void
}): JSX.Element {
  return (
    <button
      className={`icon-btn ${variant ?? 'ghost'} ${active ? 'active' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  )
}

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

  const showDrawOpts = DRAW_TOOLS.includes(tool)
  const showHlOpts = tool === 'highlight'

  return (
    <div className="toolbar">
      <div className="tb-group">
        <IconBtn Icon={FolderOpen} label="เปิด (Ctrl+O)" onClick={onOpen} />
        <IconBtn Icon={Save} label="บันทึก (Ctrl+S)" disabled={!hasDoc} onClick={onSave} />
        <IconBtn Icon={FileDown} label="บันทึกเป็น…" disabled={!hasDoc} onClick={onSaveAs} />
      </div>

      <div className="tb-sep" />

      <div className="tb-group">
        <IconBtn Icon={Undo2} label="เลิกทำ (Ctrl+Z)" disabled={!canUndo} onClick={undo} />
        <IconBtn Icon={Redo2} label="ทำซ้ำ (Ctrl+Y)" disabled={!canRedo} onClick={redo} />
      </div>

      <div className="tb-sep" />

      <div className="tb-group">
        {TOOLS.map((t) => (
          <IconBtn
            key={t.id}
            Icon={t.Icon}
            label={t.label}
            active={tool === t.id}
            disabled={!hasDoc}
            onClick={() => setTool(t.id)}
          />
        ))}
        <IconBtn
          Icon={PenTool}
          label="วาดลายเซ็น"
          variant="sign"
          disabled={!hasDoc}
          onClick={() => setShowPad(true)}
        />
      </div>

      {(showDrawOpts || showHlOpts) && (
        <>
          <div className="tb-sep" />
          <div className="draw-opts">
            {showHlOpts ? (
              <label className="opt">
                <span>สี</span>
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="opt">
                  <span>สี</span>
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => setDrawColor(e.target.value)}
                  />
                </label>
                <label className="opt">
                  <span>หนา</span>
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

      <div className="tb-sep" />

      <div className="tb-group">
        <IconBtn Icon={Minus} label="ซูมออก" disabled={!hasDoc} onClick={() => setZoom(zoom - 0.15)} />
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <IconBtn Icon={Plus} label="ซูมเข้า" disabled={!hasDoc} onClick={() => setZoom(zoom + 0.15)} />
        <IconBtn
          Icon={StretchHorizontal}
          label="พอดีความกว้าง"
          active={fitMode === 'width'}
          disabled={!hasDoc}
          onClick={() => setFitMode('width')}
        />
        <IconBtn
          Icon={Maximize}
          label="พอดีทั้งหน้า"
          active={fitMode === 'page'}
          disabled={!hasDoc}
          onClick={() => setFitMode('page')}
        />
      </div>

      {hasDoc && (
        <>
          <div className="tb-sep" />
          <div className="tb-group page-nav">
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

      <div className="tb-spacer" />

      <div className="tb-group">
        <button
          className="pill-btn sign"
          disabled={!hasDoc}
          onClick={() => setShowSign(true)}
          title="ลงลายเซ็นดิจิทัล (PKI)"
        >
          <ShieldCheck size={16} strokeWidth={2} />
          <span>เซ็นดิจิทัล</span>
        </button>
        <IconBtn
          Icon={SearchCheck}
          label="ตรวจสอบลายเซ็น"
          variant="verify"
          disabled={!hasDoc}
          onClick={() => setShowVerify(true)}
        />
      </div>

      <div className="file-name" title={fileName}>
        {fileName || 'ยังไม่มีไฟล์'}
        {dirty && <span className="dot" title="ยังไม่ได้บันทึก" />}
      </div>

      {showPad && <SignaturePad onClose={() => setShowPad(false)} />}
      {showSign && <SignDialog onClose={() => setShowSign(false)} />}
      {showVerify && <VerifyDialog onClose={() => setShowVerify(false)} />}
    </div>
  )
}

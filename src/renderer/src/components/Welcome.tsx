import { FolderOpen, PenTool, Highlighter, FileText, ShieldCheck } from 'lucide-react'
import logoUrl from '@/assets/logo.png'

interface Props {
  onOpen: () => void
}

const FEATURES = [
  { Icon: FileText, label: 'แก้ข้อความในเอกสาร' },
  { Icon: Highlighter, label: 'ไฮไลต์ · วาด · ใส่รูป' },
  { Icon: PenTool, label: 'ลงลายเซ็น' },
  { Icon: ShieldCheck, label: 'เซ็นดิจิทัล & ตรวจสอบ' }
]

/** หน้าจอเริ่มต้นเมื่อยังไม่ได้เปิดไฟล์ */
export default function Welcome({ onOpen }: Props): JSX.Element {
  return (
    <div className="welcome">
      <div className="welcome-glow" />
      <div className="welcome-card">
        <img className="welcome-logo" src={logoUrl} alt="EverPDF" width={132} height={132} />
        <h1 className="welcome-title">EverPDF</h1>
        <p className="welcome-sub">เปิด · แก้ไข · ลงลายเซ็น PDF ครบในที่เดียว</p>

        <button className="btn-primary btn-lg" onClick={onOpen}>
          <FolderOpen size={18} strokeWidth={2} />
          เปิดไฟล์ PDF
        </button>
        <p className="hint">หรือกด Ctrl+O</p>

        <div className="feature-row">
          {FEATURES.map((f) => (
            <div className="feature-chip" key={f.label}>
              <f.Icon size={16} strokeWidth={2} />
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

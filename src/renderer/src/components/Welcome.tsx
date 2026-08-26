import { useEffect, useState } from 'react'
import { FolderOpen, PenTool, Highlighter, FileText, ShieldCheck, Clock, File } from 'lucide-react'
import logoUrl from '@/assets/logo.png'
import type { RecentFile } from '@shared/types'

interface Props {
  onOpen: () => void
  onOpenRecent: (path: string) => void
}

const FEATURES = [
  { Icon: FileText, label: 'แก้ข้อความในเอกสาร' },
  { Icon: Highlighter, label: 'ไฮไลต์ · วาด · ใส่รูป' },
  { Icon: PenTool, label: 'ลงลายเซ็น' },
  { Icon: ShieldCheck, label: 'เซ็นดิจิทัล & ตรวจสอบ' }
]

/** หน้าจอเริ่มต้นเมื่อยังไม่ได้เปิดไฟล์ */
export default function Welcome({ onOpen, onOpenRecent }: Props): JSX.Element {
  const [recent, setRecent] = useState<RecentFile[]>([])

  useEffect(() => {
    window.api.getRecent().then(setRecent).catch(() => setRecent([]))
  }, [])

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

        {recent.length > 0 && (
          <div className="recent-box">
            <div className="recent-head">
              <Clock size={14} strokeWidth={2} /> เปิดล่าสุด
            </div>
            <div className="recent-list">
              {recent.map((r) => (
                <button
                  key={r.path}
                  className="recent-item"
                  title={r.path}
                  onClick={() => onOpenRecent(r.path)}
                >
                  <File size={15} strokeWidth={2} />
                  <span>{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

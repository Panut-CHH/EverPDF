import { useState } from 'react'
import { useDocStore } from '@/store/documentStore'
import { bakePdf } from '@/lib/pdfEditor'
import { stampDocument, type StampOptions } from '@/lib/documentTools'

const PRESETS = ['ตัวอย่าง', 'DRAFT', 'ลับ', 'CONFIDENTIAL', 'สำเนา', 'ต้นฉบับ']

/** ใส่ลายน้ำ + เลขหน้า แล้วบันทึกเป็นไฟล์ใหม่ */
export default function StampDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [watermark, setWatermark] = useState('ตัวอย่าง')
  const [opacity, setOpacity] = useState(0.15)
  const [color, setColor] = useState('#d21c1c')
  const [pageNumbers, setPageNumbers] = useState(true)
  const [format, setFormat] = useState('หน้า {n} / {total}')
  const [busy, setBusy] = useState(false)

  const apply = async (): Promise<void> => {
    setBusy(true)
    try {
      const s = useDocStore.getState()
      if (!s.pdfBytes) return
      // อบสถานะปัจจุบันก่อน แล้วค่อยประทับ
      const baked = await bakePdf({
        original: s.pdfBytes,
        pageOrder: s.pageOrder,
        pages: s.pages,
        annotations: s.annotations,
        formFields: s.formFields
      })
      const opts: StampOptions = {
        watermark,
        watermarkOpacity: opacity,
        watermarkColor: color,
        pageNumbers,
        pageNumberFormat: format
      }
      const out = await stampDocument(baked, opts)
      const res = await window.api.saveFile({
        data: out,
        defaultName: s.fileName.replace(/\.pdf$/i, '') + '-stamped.pdf'
      })
      if (!res.canceled) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>💧 ลายน้ำ & เลขหน้า</h3>

        <label className="field">
          ข้อความลายน้ำ (เว้นว่าง = ไม่ใส่)
          <input value={watermark} onChange={(e) => setWatermark(e.target.value)} />
        </label>
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button key={p} className="chip-btn" onClick={() => setWatermark(p)}>
              {p}
            </button>
          ))}
        </div>

        <div className="field-2col">
          <label className="field">
            สีลายน้ำ
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label className="field">
            ความจาง {Math.round(opacity * 100)}%
            <input
              type="range"
              min={5}
              max={60}
              value={opacity * 100}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            />
          </label>
        </div>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={pageNumbers}
            onChange={(e) => setPageNumbers(e.target.checked)}
          />
          ใส่เลขหน้า
        </label>
        {pageNumbers && (
          <label className="field">
            รูปแบบ (ใช้ {'{n}'} = เลขหน้า, {'{total}'} = จำนวนหน้า)
            <input value={format} onChange={(e) => setFormat(e.target.value)} />
          </label>
        )}

        <div className="modal-actions">
          <button onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          <button className="btn-primary" onClick={apply} disabled={busy}>
            {busy ? 'กำลังทำ…' : 'ใส่แล้วบันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useDocStore } from '@/store/documentStore'
import { bakePdf } from '@/lib/pdfEditor'
import { encryptPdf } from '@/lib/encryptPdf'

/** ใส่รหัสผ่าน + เข้ารหัส (AES-256) แล้วบันทึกเป็นไฟล์ใหม่ */
export default function PasswordDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [allowPrinting, setAllowPrinting] = useState(true)
  const [allowCopying, setAllowCopying] = useState(false)
  const [allowModifying, setAllowModifying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const apply = async (): Promise<void> => {
    setError('')
    if (pw.length < 4) return setError('รหัสผ่านควรยาวอย่างน้อย 4 ตัวอักษร')
    if (pw !== pw2) return setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')

    setBusy(true)
    try {
      const s = useDocStore.getState()
      if (!s.pdfBytes) return
      const baked = await bakePdf({
        original: s.pdfBytes,
        pageOrder: s.pageOrder,
        pages: s.pages,
        annotations: s.annotations,
        formFields: s.formFields
      })
      const out = await encryptPdf(baked, {
        userPassword: pw,
        allowPrinting,
        allowCopying,
        allowModifying
      })
      const res = await window.api.saveFile({
        data: out,
        defaultName: s.fileName.replace(/\.pdf$/i, '') + '-protected.pdf'
      })
      if (!res.canceled) onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>🔒 ใส่รหัสผ่าน & เข้ารหัส</h3>

        <label className="field">
          รหัสสำหรับเปิดเอกสาร
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        <label className="field">
          ยืนยันรหัสผ่าน
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>

        <div className="perm-title">สิทธิ์ของผู้เปิดเอกสาร</div>
        <label className="field checkbox-field">
          <input type="checkbox" checked={allowPrinting} onChange={(e) => setAllowPrinting(e.target.checked)} />
          อนุญาตให้พิมพ์
        </label>
        <label className="field checkbox-field">
          <input type="checkbox" checked={allowCopying} onChange={(e) => setAllowCopying(e.target.checked)} />
          อนุญาตให้คัดลอกข้อความ
        </label>
        <label className="field checkbox-field">
          <input type="checkbox" checked={allowModifying} onChange={(e) => setAllowModifying(e.target.checked)} />
          อนุญาตให้แก้ไข
        </label>

        <div className="note-box">
          <ShieldAlert size={15} />
          เข้ารหัสแบบ AES-256 — เก็บรหัสผ่านไว้ให้ดี หากลืมจะเปิดไฟล์ไม่ได้
        </div>

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn-primary" onClick={apply} disabled={busy}>
            {busy ? 'กำลังเข้ารหัส…' : 'เข้ารหัส & บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

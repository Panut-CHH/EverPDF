import { useState } from 'react'
import { useDocStore } from '@/store/documentStore'
import { bakePdf } from '@/lib/pdfEditor'

/**
 * ลงลายเซ็นดิจิทัลแบบ PKI:
 *   1) อบ annotation ปัจจุบันเข้าไฟล์ก่อน (เพื่อให้ลายเซ็นภาพติดไปด้วย)
 *   2) ส่ง bytes + ไฟล์ .p12/.pfx + รหัสผ่าน ไปเซ็นที่ main process
 *   3) ได้ PDF ที่เซ็นแล้ว → บันทึกเป็นไฟล์ใหม่
 *
 * หมายเหตุด้านความปลอดภัย: การเซ็นจริงทำที่ Node (main) ไม่ใช่ใน renderer
 * รหัสผ่านถูกส่งผ่าน IPC ครั้งเดียวเพื่อปลดล็อกใบรับรอง ไม่ถูกเก็บไว้
 */
export default function SignDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [p12Path, setP12Path] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [reason, setReason] = useState('รับรองเอกสาร')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (): Promise<void> => {
    const p = await window.api.pickP12()
    if (p) setP12Path(p)
  }

  const sign = async (): Promise<void> => {
    setError('')
    if (!p12Path) return setError('กรุณาเลือกไฟล์ใบรับรอง (.pfx / .p12)')
    if (!passphrase) return setError('กรุณากรอกรหัสผ่านใบรับรอง')

    setBusy(true)
    try {
      const s = useDocStore.getState()
      if (!s.pdfBytes) throw new Error('ยังไม่ได้เปิดไฟล์')

      // 1) อบ annotation เข้าไฟล์ก่อนเซ็น
      const baked = await bakePdf({
        original: s.pdfBytes,
        pageOrder: s.pageOrder,
        pages: s.pages,
        annotations: s.annotations
      })

      // 2) เซ็นที่ main process
      const res = await window.api.digitalSign({
        pdf: baked,
        p12Path,
        passphrase,
        reason,
        location
      })
      if (!res.ok || !res.signed) throw new Error(res.error || 'เซ็นไม่สำเร็จ')

      // 3) บันทึกเป็นไฟล์ใหม่
      const saveRes = await window.api.saveFile({
        data: res.signed,
        defaultName: s.fileName.replace(/\.pdf$/i, '') + '-signed.pdf'
      })
      if (!saveRes.canceled) onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>🔏 ลงลายเซ็นดิจิทัล (PKI)</h3>

        <label className="field">
          ไฟล์ใบรับรอง (.pfx / .p12)
          <div className="field-row">
            <input value={p12Path} readOnly placeholder="ยังไม่ได้เลือก" />
            <button onClick={pick}>เลือก…</button>
          </div>
        </label>

        <label className="field">
          รหัสผ่านใบรับรอง
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="field">
          เหตุผล
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        <label className="field">
          สถานที่
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          <button className="btn-primary" onClick={sign} disabled={busy}>
            {busy ? 'กำลังเซ็น…' : 'เซ็นและบันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

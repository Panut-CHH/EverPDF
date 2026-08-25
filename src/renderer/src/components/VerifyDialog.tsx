import { useEffect, useState } from 'react'
import { useDocStore } from '@/store/documentStore'
import type { VerifyResult } from '@shared/types'

/** แสดงผลการตรวจสอบลายเซ็นดิจิทัลในไฟล์ที่เปิดอยู่ */
export default function VerifyDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const pdfBytes = useDocStore((s) => s.pdfBytes)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!pdfBytes) return
    window.api
      .verifySign(pdfBytes)
      .then(setResult)
      .finally(() => setLoading(false))
  }, [pdfBytes])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 480 }}>
        <h3>🔎 ตรวจสอบลายเซ็นดิจิทัล</h3>

        {loading && <p>กำลังตรวจสอบ…</p>}

        {!loading && result && !result.hasSignature && (
          <p className="hint">ไฟล์นี้ไม่มีลายเซ็นดิจิทัล</p>
        )}

        {!loading &&
          result?.signatures.map((sig, i) => (
            <div key={i} className={`sig-card ${sig.integrity ? 'ok' : 'bad'}`}>
              <div className="sig-status">
                {sig.integrity ? '✅ ลายเซ็นถูกต้อง — เนื้อหาไม่ถูกแก้ไข' : '⛔ ลายเซ็นใช้ไม่ได้ / เนื้อหาถูกแก้ไข'}
              </div>
              {sig.error ? (
                <div className="error">{sig.error}</div>
              ) : (
                <dl className="sig-details">
                  <dt>ผู้เซ็น</dt>
                  <dd>{sig.signer}</dd>
                  <dt>ออกโดย</dt>
                  <dd>{sig.issuer || '(self-signed)'}</dd>
                  {sig.signingTime && (
                    <>
                      <dt>เวลาเซ็น</dt>
                      <dd>{sig.signingTime}</dd>
                    </>
                  )}
                  <dt>ใบรับรองใช้ได้</dt>
                  <dd>
                    {fmt(sig.validFrom)} → {fmt(sig.validTo)}
                  </dd>
                  <dt>ครอบคลุมทั้งไฟล์</dt>
                  <dd>{sig.coversWholeDoc ? 'ใช่' : 'ไม่ (มีการต่อท้ายหลังเซ็น)'}</dd>
                </dl>
              )}
            </div>
          ))}

        <p className="hint" style={{ marginTop: 12 }}>
          หมายเหตุ: ตรวจความสมบูรณ์ของลายเซ็นและใบรับรอง แต่ยังไม่ตรวจสอบสายความเชื่อถือ (trust chain)
        </p>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

function fmt(iso: string): string {
  if (!iso) return '-'
  return iso.slice(0, 10)
}

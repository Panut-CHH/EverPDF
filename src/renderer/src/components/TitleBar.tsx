import { useDocStore } from '@/store/documentStore'
import logoUrl from '@/assets/logo.png'

/**
 * แถบชื่อหน้าต่างแบบกำหนดเอง (custom title bar)
 * - ลากย้ายหน้าต่างได้ (-webkit-app-region: drag)
 * - เว้นพื้นที่ขวาให้ปุ่มหน้าต่าง native (– □ ×) ที่วางแบบ overlay
 */
export default function TitleBar(): JSX.Element {
  const fileName = useDocStore((s) => s.fileName)
  const dirty = useDocStore((s) => s.dirty)
  const hasDoc = useDocStore((s) => !!s.pdfBytes)

  return (
    <div className="titlebar">
      <div className="titlebar-brand">
        <img src={logoUrl} alt="" width={18} height={18} />
        <span className="titlebar-app">EverPDF</span>
      </div>

      <div className="titlebar-file">
        {hasDoc && (
          <>
            {fileName}
            {dirty && <span className="titlebar-dot" title="ยังไม่ได้บันทึก" />}
          </>
        )}
      </div>

      {/* พื้นที่ว่างด้านขวาสำหรับปุ่มหน้าต่าง native */}
      <div className="titlebar-controls-space" />
    </div>
  )
}

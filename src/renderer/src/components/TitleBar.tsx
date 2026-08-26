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

  // macOS: ปุ่มหน้าต่าง (traffic lights) อยู่ซ้าย → เว้นที่ด้านซ้าย
  // Windows/Linux: ปุ่มอยู่ขวา → เว้นที่ด้านขวา
  const isMac = window.api.platform === 'darwin'

  return (
    <div className="titlebar">
      {isMac && <div className="titlebar-traffic-space" />}

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

      {!isMac && <div className="titlebar-controls-space" />}
    </div>
  )
}

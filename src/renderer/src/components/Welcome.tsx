interface Props {
  onOpen: () => void
}

/** หน้าจอเริ่มต้นเมื่อยังไม่ได้เปิดไฟล์ */
export default function Welcome({ onOpen }: Props): JSX.Element {
  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>EverPDF</h1>
        <p>เปิด แก้ไข และลงลายเซ็น PDF</p>
        <button className="btn-primary" onClick={onOpen}>
          เปิดไฟล์ PDF…
        </button>
        <p className="hint">หรือกด Ctrl+O</p>
      </div>
    </div>
  )
}

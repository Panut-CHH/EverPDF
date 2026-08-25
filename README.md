# EverPDF

โปรแกรมเดสก์ท็อปสำหรับ **เปิด / แก้ไข / ลงลายเซ็น PDF** สไตล์ Acrobat
สร้างด้วย **Electron + React + TypeScript** — ทำงาน offline ได้ 100%

---

## ✨ ฟีเจอร์ (v0.2)

| กลุ่ม | รายละเอียด |
|-------|------------|
| **เปิด/ดู** | เลื่อนดูต่อเนื่องหลายหน้า (continuous scroll), ซูม, **พอดีความกว้าง/ทั้งหน้า**, แถบภาพย่อ, ช่องไปหน้า |
| **ค้นหา** | 🔍 Ctrl+F ค้นหาข้อความทั้งเอกสาร + ไฮไลต์ + ไป-มา (Enter / Shift+Enter) |
| **จัดการหน้า** | ลบ / หมุน / สลับลำดับหน้า |
| **ข้อความ** | เพิ่มข้อความ **ภาษาไทย** ได้ (ฟอนต์ Sarabun ฝังใน PDF), ปรับ ขนาด / สี / **ตัวหนา** |
| **เครื่องมือวาด** | ไฮไลต์, ปากกา (freehand), สี่เหลี่ยม, เส้น, ลูกศร — เลือกสี/ความหนาได้ |
| **รูปภาพ** | แทรก PNG / JPEG, ลากวาง + ปรับขนาด |
| **ลายเซ็น (Visual)** | วาดด้วยเมาส์/ปากกา → ตัดขอบอัตโนมัติ → วางบนหน้า |
| **ลายเซ็น (Digital/PKI)** | เซ็นด้วยใบรับรอง `.pfx`/`.p12` แบบ PKCS#7 (ทดสอบผ่าน ✅) |
| **Undo/Redo** | ↩️ Ctrl+Z / Ctrl+Y (ประวัติ 100 ขั้น) + ลบด้วยปุ่ม Delete |
| **บันทึก** | อบ (bake) การแก้ไขทั้งหมดกลับเข้าไฟล์ PDF จริง |

> **ไฟล์ทดสอบ:** เปิด `samples/sample.pdf` (เอกสารไทย 3 หน้า) เพื่อลองทุกฟีเจอร์ได้ทันที

---

## 🏗 สถาปัตยกรรม

```
src/
├── shared/         ← type กลาง ใช้ร่วม main/preload/renderer
├── main/           ← Electron main (Node) : เปิด/บันทึกไฟล์ + เซ็น PKI
│   ├── index.ts
│   └── pdfSigner.ts   (@signpdf + node-forge)
├── preload/        ← contextBridge : เปิด API ปลอดภัยให้ renderer
└── renderer/       ← React UI
    ├── lib/
    │   ├── pdfjs.ts       (PDF.js — เรนเดอร์)
    │   ├── pdfEditor.ts   (pdf-lib — อบการแก้ไข)
    │   └── annotations.ts (โมเดล annotation)
    ├── store/documentStore.ts  (zustand)
    └── components/  (Toolbar, Sidebar, Viewer, AnnotationLayer, SignaturePad, SignDialog)
```

**หลักคิด:** แยก engine "เรนเดอร์" (PDF.js, อ่านอย่างเดียว) ออกจาก engine "แก้ไข" (pdf-lib, เขียนไฟล์) — เหมือนที่ Acrobat แยกกัน ทำให้ขยายฟีเจอร์ได้โดยไม่พันกัน

---

## 🚀 วิธีใช้งาน

```bash
npm install          # ติดตั้ง dependencies
npm run dev          # รันโหมดพัฒนา (hot reload)
npm run build        # build production
npm run dist:win     # แพ็กเป็น .exe (Windows)
npm run dist:mac     # แพ็กเป็น .dmg (macOS)
```

### ⚠️ ฟอนต์ไทย
ถ้าต้องการพิมพ์ **ข้อความภาษาไทย** ลง PDF ให้วางไฟล์
`NotoSansThai-Regular.ttf` ไว้ที่ `src/renderer/public/fonts/`
(ดูรายละเอียดใน `src/renderer/public/fonts/README.md`)
ถ้าไม่มี ระบบจะใช้ Helvetica (อังกฤษ/ตัวเลขเท่านั้น) โดยอัตโนมัติ

---

## 🗺 Roadmap (สิ่งที่จะทำต่อ)

- [x] มุมมองเลื่อนต่อเนื่องหลายหน้า (continuous scroll)
- [x] ค้นหาข้อความ + ไฮไลต์
- [x] เครื่องมือวาด (freehand, สี่เหลี่ยม, เส้น, ลูกศร)
- [x] ข้อความภาษาไทย (ฝังฟอนต์ Sarabun)
- [x] Undo/Redo
- [ ] รวม/แยกไฟล์ PDF, แทรกหน้าจากไฟล์อื่น
- [ ] Form fields (กรอกฟอร์ม AcroForm)
- [ ] ตรวจสอบสถานะลายเซ็นดิจิทัลในเอกสาร (verify)
- [ ] annotation แม่นยำบนหน้าที่หมุน/มี `/Rotate` (ดูข้อจำกัดด้านล่าง)

## ⚠️ ข้อจำกัดที่รู้อยู่

- **หน้าที่หมุน:** annotation วางแม่นยำบนหน้าที่ไม่หมุน (rotation 0) — เอกสารสแกนที่ตั้งค่า `/Rotate`
  หรือหน้าที่ผู้ใช้สั่งหมุน อาจวางตำแหน่งคลาดเคลื่อน (อยู่ใน roadmap)
- **ค้นหา:** จับคู่ระดับ text-item ครอบเคสส่วนใหญ่ แต่คำที่ถูกตัดข้ามช่วงข้อความอาจไม่เจอ
```

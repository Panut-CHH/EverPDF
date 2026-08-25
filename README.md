# EverPDF

โปรแกรมเดสก์ท็อปสำหรับ **เปิด / แก้ไข / ลงลายเซ็น PDF** สไตล์ Acrobat
สร้างด้วย **Electron + React + TypeScript** — ทำงาน offline ได้ 100%

---

## ✨ ฟีเจอร์ (v0.1)

| กลุ่ม | รายละเอียด |
|-------|------------|
| **เปิด/ดู** | เปิดไฟล์ PDF, เลื่อนหน้า, ซูมเข้า/ออก, แถบภาพย่อ (thumbnail sidebar) |
| **จัดการหน้า** | ลบหน้า, หมุนหน้า (ซ้าย/ขวา), สลับลำดับหน้า |
| **แก้ไข** | เพิ่มข้อความ (ปรับขนาด/สีได้), แทรกรูปภาพ (PNG/JPEG), ลากวาง + ปรับขนาด |
| **ลายเซ็น (Visual)** | วาดลายเซ็นด้วยเมาส์/ปากกา → ตัดขอบอัตโนมัติ → วางบนหน้า |
| **ลายเซ็น (Digital/PKI)** | เซ็นด้วยใบรับรอง `.pfx`/`.p12` แบบ PKCS#7 — ตรวจสอบได้ตามมาตรฐาน |
| **บันทึก** | อบ (bake) การแก้ไขทั้งหมดกลับเข้าไฟล์ PDF จริง |

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

- [ ] มุมมองเลื่อนต่อเนื่องหลายหน้า (continuous scroll)
- [ ] ค้นหาข้อความ + ไฮไลต์
- [ ] เครื่องมือวาด (freehand, สี่เหลี่ยม, ลูกศร)
- [ ] Form fields (กรอกฟอร์ม)
- [ ] รวม/แยกไฟล์ PDF
- [ ] ตรวจสอบสถานะลายเซ็นดิจิทัลในเอกสาร
- [ ] Undo/Redo
```

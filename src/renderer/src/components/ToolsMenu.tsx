import { useEffect, useRef, useState } from 'react'
import {
  Wrench,
  FileImage,
  FileText,
  FilePlus2,
  Droplets,
  EyeOff,
  Printer,
  Lock,
  ScanText,
  Loader2
} from 'lucide-react'
import { useDocStore } from '@/store/documentStore'
import { usePdfDoc } from '@/lib/usePdfDoc'
import { loadPdf, destroyPdf } from '@/lib/pdfjs'
import { bakePdf } from '@/lib/pdfEditor'
import { pagesToText, imagesToPdf, applyRedaction } from '@/lib/documentTools'
import StampDialog from '@/components/StampDialog'
import PasswordDialog from '@/components/PasswordDialog'

/** อบสถานะปัจจุบันเป็น bytes (annotation + ฟอร์ม + จัดหน้า) */
async function bakedBytes(): Promise<Uint8Array | null> {
  const s = useDocStore.getState()
  if (!s.pdfBytes) return null
  return bakePdf({
    original: s.pdfBytes,
    pageOrder: s.pageOrder,
    pages: s.pages,
    annotations: s.annotations,
    formFields: s.formFields
  })
}

/** เมนูเครื่องมือเอกสาร (export / สร้าง / ลายน้ำ) */
export default function ToolsMenu(): JSX.Element {
  const hasDoc = useDocStore((s) => !!s.pdfBytes)
  const fileName = useDocStore((s) => s.fileName)
  const doc = usePdfDoc()

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [showStamp, setShowStamp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [ocrMsg, setOcrMsg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // ปิดเมนูเมื่อคลิกข้างนอก
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const base = fileName.replace(/\.pdf$/i, '')

  /** Export ทุกหน้าเป็น PNG (WYSIWYG: อบก่อนแล้วเรนเดอร์) */
  const exportImages = async (): Promise<void> => {
    setOpen(false)
    setBusy('images')
    try {
      const bytes = await bakedBytes()
      if (!bytes) return
      const rdoc = await loadPdf(bytes)
      const files: { name: string; data: Uint8Array }[] = []
      for (let i = 1; i <= rdoc.numPages; i++) {
        const page = await rdoc.getPage(i)
        const vp = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = vp.width
        canvas.height = vp.height
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
        const b64 = canvas.toDataURL('image/png').split(',')[1]
        files.push({
          name: `${base}-หน้า${String(i).padStart(3, '0')}.png`,
          data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        })
        page.cleanup()
      }
      await destroyPdf(rdoc)
      await window.api.writeFilesToDir(files)
    } finally {
      setBusy(null)
    }
  }

  /** Export ข้อความทั้งเอกสารเป็น .txt */
  const exportText = async (): Promise<void> => {
    setOpen(false)
    if (!doc) return
    setBusy('text')
    try {
      const text = await pagesToText(doc)
      await window.api.saveBinary({
        data: new TextEncoder().encode(text),
        defaultName: `${base}.txt`,
        filterName: 'ข้อความ',
        ext: 'txt'
      })
    } finally {
      setBusy(null)
    }
  }

  /** ลบช่องว่างที่ tesseract แทรกระหว่างตัวอักษรไทย (ไทยไม่เว้นวรรคในคำ) */
  const cleanThaiSpaces = (t: string): string =>
    t.replace(/([฀-๿])[ \t]+(?=[฀-๿])/g, '$1')

  /** OCR ทุกหน้า → รวมเป็นข้อความ → บันทึก .txt */
  const runOcr = async (): Promise<void> => {
    setOpen(false)
    if (!doc) return
    setBusy('ocr')
    try {
      const parts: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        setOcrMsg(`กำลัง OCR หน้า ${i}/${doc.numPages}…`)
        const page = await doc.getPage(i)
        const vp = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = vp.width
        canvas.height = vp.height
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
        const b64 = canvas.toDataURL('image/png').split(',')[1]
        page.cleanup()
        const text = await window.api.ocr(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
        parts.push(`--- หน้า ${i} ---\n${cleanThaiSpaces(text).trim()}`)
      }
      await window.api.saveBinary({
        data: new TextEncoder().encode(parts.join('\n\n')),
        defaultName: `${base}-ocr.txt`,
        filterName: 'ข้อความ',
        ext: 'txt'
      })
    } catch (err) {
      window.alert('OCR ผิดพลาด: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(null)
      setOcrMsg(null)
    }
  }

  /** พิมพ์: อบสถานะปัจจุบันแล้วส่งไปพิมพ์ */
  const print = async (): Promise<void> => {
    setOpen(false)
    setBusy('print')
    try {
      const bytes = await bakedBytes()
      if (bytes) await window.api.printPdf(bytes)
    } finally {
      setBusy(null)
    }
  }

  /** ใช้ Redaction: rasterize หน้าที่มีกล่องปิดข้อมูล แล้วบันทึกเป็นไฟล์ใหม่ */
  const doRedaction = async (): Promise<void> => {
    setOpen(false)
    const s = useDocStore.getState()
    const redactedOrig = new Set(
      s.annotations.filter((a) => a.type === 'redact').map((a) => a.pageIndex)
    )
    if (redactedOrig.size === 0) {
      window.alert('ยังไม่มีพื้นที่ปิดข้อมูล — เลือกเครื่องมือ "ปิดข้อมูล" แล้วลากคลุมส่วนที่ต้องการลบก่อน')
      return
    }
    setBusy('redact')
    try {
      const bytes = await bakedBytes()
      if (!bytes) return
      const redactedDisplay = new Set<number>()
      s.pageOrder.forEach((orig, disp) => {
        if (redactedOrig.has(orig)) redactedDisplay.add(disp)
      })
      const out = await applyRedaction(bytes, redactedDisplay)
      await window.api.saveFile({ data: out, defaultName: `${base}-redacted.pdf` })
    } finally {
      setBusy(null)
    }
  }

  /** สร้าง PDF จากรูปภาพที่เลือก */
  const createFromImages = async (): Promise<void> => {
    setOpen(false)
    setBusy('create')
    try {
      const images = await window.api.openImages()
      if (images.length === 0) return
      const out = await imagesToPdf(images)
      await window.api.saveFile({ data: out, defaultName: 'จากรูปภาพ.pdf' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="tools-menu" ref={ref}>
      <button
        className="icon-btn"
        title="เครื่องมือเอกสาร"
        disabled={!hasDoc && !busy}
        onClick={() => setOpen((o) => !o)}
      >
        {busy ? <Loader2 size={18} className="spin" /> : <Wrench size={18} strokeWidth={2} />}
      </button>

      {open && (
        <div className="tools-dropdown">
          <button onClick={exportImages}>
            <FileImage size={16} /> Export เป็นรูปภาพ (PNG)
          </button>
          <button onClick={exportText}>
            <FileText size={16} /> Export เป็นข้อความ (TXT)
          </button>
          <button onClick={createFromImages}>
            <FilePlus2 size={16} /> สร้าง PDF จากรูปภาพ
          </button>
          <button onClick={runOcr}>
            <ScanText size={16} /> OCR → ข้อความ (ไทย/อังกฤษ)
          </button>
          <div className="tools-sep" />
          <button
            onClick={() => {
              setOpen(false)
              setShowStamp(true)
            }}
          >
            <Droplets size={16} /> ลายน้ำ & เลขหน้า…
          </button>
          <button onClick={doRedaction}>
            <EyeOff size={16} /> ใช้ Redaction & บันทึก
          </button>
          <button
            onClick={() => {
              setOpen(false)
              setShowPassword(true)
            }}
          >
            <Lock size={16} /> ใส่รหัสผ่าน & เข้ารหัส…
          </button>
          <div className="tools-sep" />
          <button onClick={print}>
            <Printer size={16} /> พิมพ์ (Ctrl+P)
          </button>
        </div>
      )}

      {ocrMsg && (
        <div className="ocr-toast">
          <Loader2 size={16} className="spin" /> {ocrMsg}
        </div>
      )}

      {showStamp && <StampDialog onClose={() => setShowStamp(false)} />}
      {showPassword && <PasswordDialog onClose={() => setShowPassword(false)} />}
    </div>
  )
}

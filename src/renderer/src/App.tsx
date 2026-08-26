import { useCallback, useEffect } from 'react'
import { useDocStore } from '@/store/documentStore'
import { loadPdf, readPagesInfo, destroyPdf } from '@/lib/pdfjs'
import { bakePdf } from '@/lib/pdfEditor'
import { extractFields } from '@/lib/forms'
import { extractTextRuns } from '@/lib/textLines'
import { mergeAfter, extractPages } from '@/lib/docOps'
import TitleBar from '@/components/TitleBar'
import Toolbar from '@/components/Toolbar'
import Sidebar from '@/components/Sidebar'
import Viewer from '@/components/Viewer'
import Welcome from '@/components/Welcome'

export default function App(): JSX.Element {
  const pdfBytes = useDocStore((s) => s.pdfBytes)
  const loadDocument = useDocStore((s) => s.loadDocument)
  const setFormFields = useDocStore((s) => s.setFormFields)
  const setTextRuns = useDocStore((s) => s.setTextRuns)
  const markClean = useDocStore((s) => s.markClean)

  /** เปิดไฟล์ผ่าน native dialog แล้วอ่านข้อมูลหน้า + ฟอร์มเข้าสู่ store */
  const openFile = useCallback(async () => {
    const res = await window.api.openFile()
    if (res.canceled || !res.data) return
    const doc = await loadPdf(res.data)
    const pages = await readPagesInfo(doc)
    const fileName = res.filePath?.split(/[\\/]/).pop() ?? 'document.pdf'
    loadDocument({ bytes: res.data, filePath: res.filePath ?? null, fileName, pages })
    // ดึง form fields + text runs (สำหรับ Edit Text) แล้วทำลาย doc ชั่วคราว
    Promise.allSettled([
      extractFields(doc).then(setFormFields, () => setFormFields([])),
      extractTextRuns(doc).then(setTextRuns, () => setTextRuns([]))
    ]).finally(() => void destroyPdf(doc))
  }, [loadDocument, setFormFields, setTextRuns])

  /** บันทึก: อบ annotation + ฟอร์ม + จัดหน้า แล้วเขียนไฟล์ (Save As ถ้ายังไม่มี path) */
  const saveFile = useCallback(
    async (forceDialog = false) => {
      const s = useDocStore.getState()
      if (!s.pdfBytes) return
      const baked = await bakePdf({
        original: s.pdfBytes,
        pageOrder: s.pageOrder,
        pages: s.pages,
        annotations: s.annotations,
        formFields: s.formFields
      })
      const res = await window.api.saveFile({
        filePath: forceDialog ? undefined : s.filePath ?? undefined,
        data: baked,
        defaultName: s.fileName
      })
      if (!res.canceled && res.filePath) {
        markClean(res.filePath)
      }
    },
    [markClean]
  )

  /** อบสถานะปัจจุบันทั้งหมด (annotation+ฟอร์ม+จัดหน้า) เป็น bytes */
  const bakeCurrent = useCallback(async (): Promise<Uint8Array | null> => {
    const s = useDocStore.getState()
    if (!s.pdfBytes) return null
    return bakePdf({
      original: s.pdfBytes,
      pageOrder: s.pageOrder,
      pages: s.pages,
      annotations: s.annotations,
      formFields: s.formFields
    })
  }, [])

  /** โหลด bytes ชุดใหม่เข้าเป็นเอกสารปัจจุบัน (ใช้หลัง merge/extract) */
  const reloadFrom = useCallback(
    async (bytes: Uint8Array, fileName: string, filePath: string | null) => {
      const doc = await loadPdf(bytes)
      const pages = await readPagesInfo(doc)
      loadDocument({ bytes, filePath, fileName, pages })
      Promise.allSettled([
        extractFields(doc).then(setFormFields, () => setFormFields([])),
        extractTextRuns(doc).then(setTextRuns, () => setTextRuns([]))
      ]).finally(() => void destroyPdf(doc))
    },
    [loadDocument, setFormFields, setTextRuns]
  )

  /** เปิดไฟล์จาก path โดยตรง (ไฟล์ล่าสุด) */
  const openRecent = useCallback(
    async (path: string) => {
      const res = await window.api.openByPath(path)
      if (res.canceled || !res.data) return
      const name = path.split(/[\\/]/).pop() ?? 'document.pdf'
      await reloadFrom(res.data, name, res.filePath ?? path)
    },
    [reloadFrom]
  )

  /** แทรกไฟล์ PDF อื่นต่อจากหน้าปัจจุบัน */
  const insertPdf = useCallback(async () => {
    const s = useDocStore.getState()
    const baked = await bakeCurrent()
    if (!baked) return
    const picked = await window.api.openFile()
    if (picked.canceled || !picked.data) return
    const merged = await mergeAfter(baked, picked.data, s.currentPage)
    await reloadFrom(merged, s.fileName, s.filePath)
  }, [bakeCurrent, reloadFrom])

  /** แยกหน้าปัจจุบันออกเป็นไฟล์ใหม่ */
  const extractCurrent = useCallback(async () => {
    const s = useDocStore.getState()
    const baked = await bakeCurrent()
    if (!baked) return
    const out = await extractPages(baked, [s.currentPage])
    await window.api.saveFile({
      data: out,
      defaultName: s.fileName.replace(/\.pdf$/i, '') + `-หน้า${s.currentPage + 1}.pdf`
    })
  }, [bakeCurrent])

  // hook โหลดจาก bytes โดยตรง (ใช้ได้ทั้ง drag-drop ในอนาคต และการทดสอบ)
  useEffect(() => {
    ;(window as unknown as { __everLoad?: (b64: string, name: string) => void }).__everLoad = (
      b64,
      name
    ) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      void reloadFrom(bytes, name, null)
    }
  }, [reloadFrom])

  // คีย์ลัดเปิด/บันทึก (เดิมอยู่ในเมนู native ที่ตอนนี้เอาออกแล้ว)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        void openFile()
      } else if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveFile(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openFile, saveFile])

  // คีย์ลัด: Undo/Redo + ลบ annotation ที่เลือก
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = useDocStore.getState()
      const editing =
        document.activeElement?.tagName === 'INPUT' ||
        (document.activeElement as HTMLElement | null)?.isContentEditable
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? s.redo() : s.undo()
      } else if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
      } else if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        if (s.pdfBytes) {
          bakePdf({
            original: s.pdfBytes,
            pageOrder: s.pageOrder,
            pages: s.pages,
            annotations: s.annotations,
            formFields: s.formFields
          }).then((b) => window.api.printPdf(b))
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId && !editing) {
        e.preventDefault()
        s.removeAnnotation(s.selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <TitleBar />
      <Toolbar onOpen={openFile} onSave={() => saveFile(false)} onSaveAs={() => saveFile(true)} />
      <div className="body">
        {pdfBytes ? (
          <>
            <Sidebar onInsert={insertPdf} onExtract={extractCurrent} />
            <Viewer />
          </>
        ) : (
          <Welcome onOpen={openFile} onOpenRecent={openRecent} />
        )}
      </div>
    </div>
  )
}

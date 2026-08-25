import { useCallback, useEffect } from 'react'
import { useDocStore } from '@/store/documentStore'
import { loadPdf, readPagesInfo } from '@/lib/pdfjs'
import { bakePdf } from '@/lib/pdfEditor'
import Toolbar from '@/components/Toolbar'
import Sidebar from '@/components/Sidebar'
import Viewer from '@/components/Viewer'
import Welcome from '@/components/Welcome'

export default function App(): JSX.Element {
  const pdfBytes = useDocStore((s) => s.pdfBytes)
  const loadDocument = useDocStore((s) => s.loadDocument)
  const markClean = useDocStore((s) => s.markClean)

  /** เปิดไฟล์ผ่าน native dialog แล้วอ่านข้อมูลหน้าเข้าสู่ store */
  const openFile = useCallback(async () => {
    const res = await window.api.openFile()
    if (res.canceled || !res.data) return
    const doc = await loadPdf(res.data)
    const pages = await readPagesInfo(doc)
    const fileName = res.filePath?.split(/[\\/]/).pop() ?? 'document.pdf'
    loadDocument({ bytes: res.data, filePath: res.filePath ?? null, fileName, pages })
  }, [loadDocument])

  /** บันทึก: อบ annotation + จัดหน้า แล้วเขียนไฟล์ (Save As ถ้ายังไม่มี path) */
  const saveFile = useCallback(
    async (forceDialog = false) => {
      const s = useDocStore.getState()
      if (!s.pdfBytes) return
      const baked = await bakePdf({
        original: s.pdfBytes,
        pageOrder: s.pageOrder,
        pages: s.pages,
        annotations: s.annotations
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

  // ผูกกับเมนู (Ctrl+O / Ctrl+S)
  useEffect(() => {
    const offOpen = window.api.onMenuOpen(() => void openFile())
    const offSave = window.api.onMenuSave(() => void saveFile(false))
    return () => {
      offOpen()
      offSave()
    }
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
      <Toolbar onOpen={openFile} onSave={() => saveFile(false)} onSaveAs={() => saveFile(true)} />
      <div className="body">
        {pdfBytes ? (
          <>
            <Sidebar />
            <Viewer />
          </>
        ) : (
          <Welcome onOpen={openFile} />
        )}
      </div>
    </div>
  )
}

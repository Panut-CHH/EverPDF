import { create } from 'zustand'
import type { Annotation } from '@/lib/annotations'
import type { FormField } from '@/lib/forms'
import type { TextRun } from '@/lib/textLines'

export type Tool =
  | 'select'
  | 'text'
  | 'image'
  | 'signature'
  | 'highlight'
  | 'rect'
  | 'line'
  | 'arrow'
  | 'ink'
  | 'edittext'
  | 'redact'

export type FitMode = 'custom' | 'width' | 'page'

/** ข้อมูลขนาดของแต่ละหน้า (point จริงจาก PDF) */
export interface PageInfo {
  width: number
  height: number
  /** องศาหมุนที่ผู้ใช้สั่ง (0/90/180/270) */
  rotation: number
}

/** ส่วนของ state ที่ต้องเก็บลง history เพื่อ undo/redo */
interface Snapshot {
  annotations: Annotation[]
  pageOrder: number[]
  pages: PageInfo[]
}

interface DocumentState extends Snapshot {
  pdfBytes: Uint8Array | null
  filePath: string | null
  fileName: string
  numPages: number

  currentPage: number
  zoom: number
  fitMode: FitMode
  tool: Tool

  selectedId: string | null
  stagedImage: { dataUrl: string; isSignature: boolean } | null

  /** form fields ที่พบในเอกสาร (แยกจาก history) */
  formFields: FormField[]

  /** text runs สำหรับฟีเจอร์ Edit Text (แยกจาก history) */
  textRuns: TextRun[]

  /** ค่าเริ่มต้นของเครื่องมือวาด */
  drawColor: string
  highlightColor: string
  strokeWidth: number

  dirty: boolean

  /* history */
  past: Snapshot[]
  future: Snapshot[]

  /* ---- actions ---- */
  loadDocument: (p: {
    bytes: Uint8Array
    filePath: string | null
    fileName: string
    pages: PageInfo[]
  }) => void
  setTool: (t: Tool) => void
  setZoom: (z: number, fit?: FitMode) => void
  setFitMode: (f: FitMode) => void
  setCurrentPage: (p: number) => void
  setDrawColor: (c: string) => void
  setHighlightColor: (c: string) => void
  setStrokeWidth: (w: number) => void

  addAnnotation: (a: Annotation) => void
  updateAnnotation: (id: string, patch: Partial<Annotation>, transient?: boolean) => void
  /** เรียกตอนปล่อยเมาส์หลังลาก/ปรับขนาด เพื่อปิด transaction ลง history */
  commitTransient: () => void
  removeAnnotation: (id: string) => void
  select: (id: string | null) => void

  stageImage: (dataUrl: string, isSignature: boolean) => void
  clearStaged: () => void

  setFormFields: (fields: FormField[]) => void
  setFormValue: (name: string, value: string | boolean) => void
  setTextRuns: (runs: TextRun[]) => void

  removePage: (displayIndex: number) => void
  movePage: (from: number, to: number) => void
  rotatePage: (displayIndex: number, delta: number) => void

  undo: () => void
  redo: () => void

  markClean: (filePath?: string) => void
}

const HISTORY_LIMIT = 100

function snapshot(s: DocumentState): Snapshot {
  return { annotations: s.annotations, pageOrder: s.pageOrder, pages: s.pages }
}

export const useDocStore = create<DocumentState>((set, get) => {
  /** ผูก mutation เข้ากับ history: บันทึก snapshot ปัจจุบันก่อนเปลี่ยน */
  const commit = (updater: (s: DocumentState) => Partial<DocumentState>): void =>
    set((s) => {
      const past = [...s.past, snapshot(s)].slice(-HISTORY_LIMIT)
      return { ...updater(s), past, future: [], dirty: true }
    })

  return {
    pdfBytes: null,
    filePath: null,
    fileName: '',
    numPages: 0,
    pages: [],
    pageOrder: [],
    annotations: [],

    currentPage: 0,
    zoom: 1,
    fitMode: 'width',
    tool: 'select',

    selectedId: null,
    stagedImage: null,
    formFields: [],
    textRuns: [],

    drawColor: '#d21c1c',
    highlightColor: '#ffeb3b',
    strokeWidth: 3,

    dirty: false,
    past: [],
    future: [],

    loadDocument: ({ bytes, filePath, fileName, pages }) =>
      set({
        pdfBytes: bytes,
        filePath,
        fileName,
        pages,
        numPages: pages.length,
        pageOrder: pages.map((_, i) => i),
        annotations: [],
        currentPage: 0,
        selectedId: null,
        stagedImage: null,
        formFields: [],
        textRuns: [],
        dirty: false,
        past: [],
        future: []
      }),

    setTool: (tool) => set({ tool, selectedId: tool === 'select' ? get().selectedId : null }),
    setZoom: (zoom, fit = 'custom') =>
      set({ zoom: Math.min(6, Math.max(0.1, zoom)), fitMode: fit }),
    setFitMode: (fitMode) => set({ fitMode }),
    setCurrentPage: (currentPage) => set({ currentPage }),
    setDrawColor: (drawColor) => set({ drawColor }),
    setHighlightColor: (highlightColor) => set({ highlightColor }),
    setStrokeWidth: (strokeWidth) => set({ strokeWidth }),

    addAnnotation: (a) =>
      commit((s) => ({ annotations: [...s.annotations, a], selectedId: a.id })),

    updateAnnotation: (id, patch, transient = false) => {
      if (transient) {
        // ระหว่างลาก: อัปเดตแบบไม่ลง history (กัน history ท่วม)
        set((s) => ({
          annotations: s.annotations.map((a) =>
            a.id === id ? ({ ...a, ...patch } as Annotation) : a
          ),
          dirty: true
        }))
      } else {
        commit((s) => ({
          annotations: s.annotations.map((a) =>
            a.id === id ? ({ ...a, ...patch } as Annotation) : a
          )
        }))
      }
    },

    // ปิด transaction: ดัน snapshot "ก่อนเริ่มลาก" ลง history
    commitTransient: () =>
      set((s) => {
        const past = [...s.past, snapshot(s)].slice(-HISTORY_LIMIT)
        return { past, future: [] }
      }),

    removeAnnotation: (id) =>
      commit((s) => ({
        annotations: s.annotations.filter((a) => a.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId
      })),

    select: (selectedId) => set({ selectedId }),

    stageImage: (dataUrl, isSignature) =>
      set({ stagedImage: { dataUrl, isSignature }, tool: isSignature ? 'signature' : 'image' }),
    clearStaged: () => set({ stagedImage: null }),

    setFormFields: (formFields) => set({ formFields }),
    setFormValue: (name, value) =>
      set((s) => ({
        formFields: s.formFields.map((f) => (f.name === name ? { ...f, value } : f)),
        dirty: true
      })),

    setTextRuns: (textRuns) => set({ textRuns }),

    removePage: (displayIndex) =>
      commit((s) => {
        if (s.pageOrder.length <= 1) return {}
        const removedOriginal = s.pageOrder[displayIndex]
        const pageOrder = s.pageOrder.filter((_, i) => i !== displayIndex)
        return {
          pageOrder,
          annotations: s.annotations.filter((a) => a.pageIndex !== removedOriginal),
          currentPage: Math.min(s.currentPage, pageOrder.length - 1)
        }
      }),

    movePage: (from, to) =>
      commit((s) => {
        const pageOrder = [...s.pageOrder]
        const [moved] = pageOrder.splice(from, 1)
        pageOrder.splice(to, 0, moved)
        return { pageOrder, currentPage: to }
      }),

    rotatePage: (displayIndex, delta) =>
      commit((s) => {
        const original = s.pageOrder[displayIndex]
        const pages = s.pages.map((p, i) =>
          i === original ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 } : p
        )
        return { pages }
      }),

    undo: () =>
      set((s) => {
        const prev = s.past[s.past.length - 1]
        if (!prev) return s
        return {
          ...prev,
          past: s.past.slice(0, -1),
          future: [snapshot(s), ...s.future].slice(0, HISTORY_LIMIT),
          dirty: true,
          selectedId: null
        }
      }),

    redo: () =>
      set((s) => {
        const next = s.future[0]
        if (!next) return s
        return {
          ...next,
          past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
          future: s.future.slice(1),
          dirty: true,
          selectedId: null
        }
      }),

    markClean: (filePath) => set((s) => ({ dirty: false, filePath: filePath ?? s.filePath }))
  }
})

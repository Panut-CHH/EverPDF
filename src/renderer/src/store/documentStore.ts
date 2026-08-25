import { create } from 'zustand'
import type { Annotation } from '@/lib/annotations'

export type Tool = 'select' | 'text' | 'image' | 'signature'

/** ข้อมูลขนาดของแต่ละหน้า (point จริงจาก PDF) */
export interface PageInfo {
  width: number
  height: number
  /** องศาหมุนสะสมที่ผู้ใช้สั่ง (0/90/180/270) — ยังไม่นับ /Rotate เดิม */
  rotation: number
}

interface DocumentState {
  /** bytes ต้นฉบับของ PDF ที่เปิดอยู่ (ไว้ส่งให้ pdf.js/pdf-lib) */
  pdfBytes: Uint8Array | null
  filePath: string | null
  fileName: string
  numPages: number
  pages: PageInfo[]
  /** ลำดับหน้าปัจจุบัน (index อ้างอิงหน้าต้นฉบับ) — รองรับลบ/สลับหน้า */
  pageOrder: number[]

  currentPage: number
  zoom: number
  tool: Tool

  annotations: Annotation[]
  selectedId: string | null

  /** รูป/ลายเซ็นที่ "รอวาง" — คลิกบนหน้าถัดไปจะวางตรงนั้น */
  stagedImage: { dataUrl: string; isSignature: boolean } | null

  dirty: boolean

  /* actions */
  loadDocument: (payload: {
    bytes: Uint8Array
    filePath: string | null
    fileName: string
    pages: PageInfo[]
  }) => void
  setTool: (t: Tool) => void
  setZoom: (z: number) => void
  setCurrentPage: (p: number) => void

  addAnnotation: (a: Annotation) => void
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void
  removeAnnotation: (id: string) => void
  select: (id: string | null) => void

  stageImage: (dataUrl: string, isSignature: boolean) => void
  clearStaged: () => void

  removePage: (displayIndex: number) => void
  movePage: (from: number, to: number) => void
  rotatePage: (displayIndex: number, delta: number) => void

  markClean: (filePath?: string) => void
}

export const useDocStore = create<DocumentState>((set) => ({
  pdfBytes: null,
  filePath: null,
  fileName: '',
  numPages: 0,
  pages: [],
  pageOrder: [],
  currentPage: 0,
  zoom: 1,
  tool: 'select',
  annotations: [],
  selectedId: null,
  stagedImage: null,
  dirty: false,

  loadDocument: ({ bytes, filePath, fileName, pages }) =>
    set({
      pdfBytes: bytes,
      filePath,
      fileName,
      pages,
      numPages: pages.length,
      pageOrder: pages.map((_, i) => i),
      currentPage: 0,
      annotations: [],
      selectedId: null,
      stagedImage: null,
      dirty: false
    }),

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.min(5, Math.max(0.2, zoom)) }),
  setCurrentPage: (currentPage) => set({ currentPage }),

  addAnnotation: (a) =>
    set((s) => ({ annotations: [...s.annotations, a], selectedId: a.id, dirty: true })),

  updateAnnotation: (id, patch) =>
    set((s) => ({
      annotations: s.annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
      dirty: true
    })),

  removeAnnotation: (id) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      dirty: true
    })),

  select: (selectedId) => set({ selectedId }),

  stageImage: (dataUrl, isSignature) =>
    set({ stagedImage: { dataUrl, isSignature }, tool: isSignature ? 'signature' : 'image' }),
  clearStaged: () => set({ stagedImage: null }),

  removePage: (displayIndex) =>
    set((s) => {
      if (s.pageOrder.length <= 1) return s // กันลบจนไม่เหลือหน้า
      const removedOriginal = s.pageOrder[displayIndex]
      const pageOrder = s.pageOrder.filter((_, i) => i !== displayIndex)
      return {
        pageOrder,
        // ลบ annotation ที่อยู่บนหน้าที่ถูกลบ
        annotations: s.annotations.filter((a) => a.pageIndex !== removedOriginal),
        currentPage: Math.min(s.currentPage, pageOrder.length - 1),
        dirty: true
      }
    }),

  movePage: (from, to) =>
    set((s) => {
      const pageOrder = [...s.pageOrder]
      const [moved] = pageOrder.splice(from, 1)
      pageOrder.splice(to, 0, moved)
      return { pageOrder, dirty: true }
    }),

  rotatePage: (displayIndex, delta) =>
    set((s) => {
      const original = s.pageOrder[displayIndex]
      const pages = s.pages.map((p, i) =>
        i === original ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 } : p
      )
      return { pages, dirty: true }
    }),

  markClean: (filePath) =>
    set((s) => ({ dirty: false, filePath: filePath ?? s.filePath }))
}))

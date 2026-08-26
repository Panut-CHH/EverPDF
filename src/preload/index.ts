import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type OpenFileResult,
  type SaveFileRequest,
  type SaveFileResult,
  type DigitalSignRequest,
  type DigitalSignResult,
  type VerifyResult,
  type NamedFile,
  type OpenedImage,
  type RecentFile
} from '@shared/types'

/**
 * เปิด API ที่ "จำกัดเฉพาะที่จำเป็น" ให้ฝั่ง renderer เรียก
 * renderer จะเข้าถึง Node/Electron ได้เฉพาะผ่าน window.api นี้เท่านั้น
 * (contextIsolation = true → ปลอดภัยจาก XSS ที่พยายามเรียก fs โดยตรง)
 */
const api = {
  openFile: (): Promise<OpenFileResult> => ipcRenderer.invoke(IPC.openFile),

  saveFile: (req: SaveFileRequest): Promise<SaveFileResult> =>
    ipcRenderer.invoke(IPC.saveFile, req),

  pickP12: (): Promise<string | null> => ipcRenderer.invoke(IPC.pickP12),

  digitalSign: (req: DigitalSignRequest): Promise<DigitalSignResult> =>
    ipcRenderer.invoke(IPC.digitalSign, req),

  verifySign: (bytes: Uint8Array): Promise<VerifyResult> =>
    ipcRenderer.invoke(IPC.verifySign, bytes),

  openByPath: (filePath: string): Promise<OpenFileResult> =>
    ipcRenderer.invoke(IPC.openByPath, filePath),
  getRecent: (): Promise<RecentFile[]> => ipcRenderer.invoke(IPC.getRecent),
  writeFilesToDir: (files: NamedFile[]): Promise<number> =>
    ipcRenderer.invoke(IPC.writeFilesToDir, files),
  openImages: (): Promise<OpenedImage[]> => ipcRenderer.invoke(IPC.openImages),
  saveBinary: (req: {
    data: Uint8Array
    defaultName: string
    filterName: string
    ext: string
  }): Promise<SaveFileResult> => ipcRenderer.invoke(IPC.saveBinary, req),

  /** รับสัญญาณจากเมนู (Ctrl+O / Ctrl+S) → คืน unsubscribe */
  onMenuOpen: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.onMenuOpen, listener)
    return () => ipcRenderer.removeListener(IPC.onMenuOpen, listener)
  },
  onMenuSave: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.onMenuSave, listener)
    return () => ipcRenderer.removeListener(IPC.onMenuSave, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type EverPdfApi = typeof api

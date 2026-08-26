import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import {
  IPC,
  type OpenFileResult,
  type SaveFileRequest,
  type SaveFileResult,
  type DigitalSignRequest,
  type NamedFile,
  type OpenedImage,
  type RecentFile
} from '@shared/types'
import { digitalSign } from './pdfSigner'
import { verifyPdf } from './pdfVerify'
import { getRecent, addRecent } from './recentFiles'
import { ocrRecognize, shutdownOcr } from './ocrService'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !!process.env['ELECTRON_RENDERER_URL']

let mainWindow: BrowserWindow | null = null

/* ---------- File association (เปิด .pdf ด้วย EverPDF) ---------- */

/** ไฟล์ PDF ที่รอเปิด (จากดับเบิลคลิกไฟล์ตอนแอปยังไม่พร้อม) */
let pendingFile: string | null = null

/** หา path ไฟล์ .pdf จาก argv (ตอนถูกเปิดผ่าน file association บน Windows) */
function pdfPathFromArgv(argv: string[]): string | null {
  for (const a of argv) {
    if (/\.pdf$/i.test(a) && existsSync(a)) return a
  }
  return null
}

/** อ่านไฟล์แล้วส่งให้ renderer เปิด (ผ่าน IPC) */
async function openExternalFile(filePath: string): Promise<void> {
  try {
    const data = await readFile(filePath)
    addRecent(filePath)
    mainWindow?.webContents.send(IPC.externalOpen, {
      filePath,
      fileName: basename(filePath),
      data: new Uint8Array(data)
    })
  } catch {
    /* เปิดไม่ได้ก็ข้าม */
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f1117',
    title: 'EverPDF',
    // ซ่อน title bar ระบบ แต่คงปุ่มหน้าต่าง native (– □ ×) แบบ overlay ในธีมมืด
    titleBarStyle: 'hidden',
    // Windows/Linux: ปุ่มหน้าต่างแบบ overlay สีธีมมืด (mac จะไม่ใช้ค่านี้)
    titleBarOverlay: { color: '#14161d', symbolColor: '#c8cdd8', height: 40 },
    // macOS: จัดตำแหน่งปุ่ม traffic lights ให้อยู่กลางแถบสูง 40px (mac เท่านั้น)
    trafficLightPosition: { x: 14, y: 13 },
    // ไอคอนหน้าต่าง (ตอน dev; production ใช้ไอคอนของ exe)
    ...(isDev ? { icon: join(process.cwd(), 'resources/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // ต้องปิดเพื่อให้ preload ใช้ require ได้ (contextBridge ยังปลอดภัย)
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // เมื่อหน้าเว็บโหลดเสร็จ ถ้ามีไฟล์รอเปิด (ดับเบิลคลิก .pdf) → เปิดให้
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFile) {
      const f = pendingFile
      pendingFile = null
      setTimeout(() => void openExternalFile(f), 300)
    }
  })

  // log ข้อผิดพลาดระดับ process ของ renderer (เงียบตอนปกติ)
  mainWindow.webContents.on('preload-error', (_e, p, err) => {
    console.error(`[preload-error] ${p}`, err)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[render-gone]`, details)
  })

  // เปิดลิงก์ภายนอกด้วย browser จริง ไม่เปิดในแอป
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] as string)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  buildMenu()
}

/**
 * เมนูแยกตามแพลตฟอร์ม:
 * - macOS: ต้องมีเมนูมาตรฐาน (แสดงบนแถบบนสุดของจอ ไม่ใช่ในหน้าต่าง) เพื่อให้
 *   Cmd+C/V/A/Q ใช้ได้ (ข้อจำกัดของ macOS) — ใช้ role สำเร็จรูปของ Electron
 * - Windows/Linux: ไม่ใช้เมนู (เมนูจะอยู่ในหน้าต่าง ทำให้รก) — ทุกคำสั่งอยู่ใน toolbar
 */
function buildMenu(): void {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' }, // EverPDF: about / quit (Cmd+Q)
        { role: 'editMenu' }, // undo/redo/cut/copy/paste/selectAll
        { role: 'viewMenu' },
        { role: 'windowMenu' }
      ])
    )
  } else {
    Menu.setApplicationMenu(null)
  }
}

/* ---------- IPC handlers ---------- */

ipcMain.handle(IPC.openFile, async (): Promise<OpenFileResult> => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'เปิดไฟล์ PDF',
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (res.canceled || res.filePaths.length === 0) return { canceled: true }
  const filePath = res.filePaths[0]
  const data = await readFile(filePath)
  addRecent(filePath)
  return { canceled: false, filePath, data: new Uint8Array(data) }
})

/** เปิดไฟล์จาก path โดยตรง (ใช้กับ "ไฟล์ล่าสุด") */
ipcMain.handle(IPC.openByPath, async (_e, filePath: string): Promise<OpenFileResult> => {
  try {
    const data = await readFile(filePath)
    addRecent(filePath)
    return { canceled: false, filePath, data: new Uint8Array(data) }
  } catch {
    return { canceled: true }
  }
})

ipcMain.handle(IPC.getRecent, (): RecentFile[] => getRecent())

/** เขียนหลายไฟล์ลงโฟลเดอร์ที่ผู้ใช้เลือก (export รูปภาพ) */
ipcMain.handle(IPC.writeFilesToDir, async (_e, files: NamedFile[]): Promise<number> => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'เลือกโฟลเดอร์ปลายทาง',
    properties: ['openDirectory', 'createDirectory']
  })
  if (res.canceled || res.filePaths.length === 0) return -1
  const dir = res.filePaths[0]
  await Promise.all(files.map((f) => writeFile(join(dir, f.name), Buffer.from(f.data))))
  return files.length
})

/** เปิดรูปภาพหลายไฟล์ (สร้าง PDF จากรูป) */
ipcMain.handle(IPC.openImages, async (): Promise<OpenedImage[]> => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'เลือกรูปภาพ',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'รูปภาพ', extensions: ['png', 'jpg', 'jpeg'] }]
  })
  if (res.canceled) return []
  return Promise.all(
    res.filePaths.map(async (p) => {
      const data = await readFile(p)
      const mime = /\.png$/i.test(p) ? 'image/png' : 'image/jpeg'
      return { name: basename(p), data: new Uint8Array(data), mime }
    })
  )
})

/** บันทึกไฟล์ binary ทั่วไป (เช่น .txt) พร้อมเลือกนามสกุล */
ipcMain.handle(
  IPC.saveBinary,
  async (
    _e,
    req: { data: Uint8Array; defaultName: string; filterName: string; ext: string }
  ): Promise<SaveFileResult> => {
    const res = await dialog.showSaveDialog(mainWindow!, {
      title: 'บันทึกไฟล์',
      defaultPath: req.defaultName,
      filters: [{ name: req.filterName, extensions: [req.ext] }]
    })
    if (res.canceled || !res.filePath) return { canceled: true }
    await writeFile(res.filePath, Buffer.from(req.data))
    return { canceled: false, filePath: res.filePath }
  }
)

ipcMain.handle(IPC.saveFile, async (_e, req: SaveFileRequest): Promise<SaveFileResult> => {
  let target = req.filePath
  if (!target) {
    const res = await dialog.showSaveDialog(mainWindow!, {
      title: 'บันทึก PDF',
      defaultPath: req.defaultName ?? 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (res.canceled || !res.filePath) return { canceled: true }
    target = res.filePath
  }
  await writeFile(target, Buffer.from(req.data))
  addRecent(target)
  return { canceled: false, filePath: target }
})

ipcMain.handle(IPC.pickP12, async (): Promise<string | null> => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'เลือกไฟล์ใบรับรอง (.pfx / .p12)',
    properties: ['openFile'],
    filters: [{ name: 'ใบรับรองดิจิทัล', extensions: ['pfx', 'p12'] }]
  })
  if (res.canceled || res.filePaths.length === 0) return null
  return res.filePaths[0]
})

ipcMain.handle(IPC.digitalSign, (_e, req: DigitalSignRequest) => digitalSign(req))

ipcMain.handle(IPC.verifySign, (_e, bytes: Uint8Array) => verifyPdf(bytes))

ipcMain.handle(IPC.ocr, (_e, png: Uint8Array, langs?: string) => ocrRecognize(png, langs))

/** พิมพ์ PDF: เขียนไฟล์ชั่วคราว → โหลดในหน้าต่างซ่อน (ตัวอ่าน PDF ของ Chromium) → print */
let printCounter = 0
ipcMain.handle(IPC.printPdf, async (_e, data: Uint8Array): Promise<boolean> => {
  const tmp = join(app.getPath('temp'), `everpdf-print-${process.pid}-${++printCounter}.pdf`)
  await writeFile(tmp, Buffer.from(data))
  const pw = new BrowserWindow({ show: false, webPreferences: { plugins: true } })
  try {
    await pw.loadFile(tmp)
    await new Promise((r) => setTimeout(r, 400))
    await new Promise<void>((resolve) => {
      pw.webContents.print({ silent: false }, () => resolve())
    })
    return true
  } catch {
    return false
  } finally {
    if (!pw.isDestroyed()) pw.close()
  }
})

/* ---------- lifecycle ---------- */

// ให้มีอินสแตนซ์เดียว: ดับเบิลคลิก .pdf ไฟล์ที่ 2 → เปิดในหน้าต่างเดิม
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  // Windows: จับ path จาก argv ตอนเปิดครั้งแรก
  pendingFile = pdfPathFromArgv(process.argv.slice(1))

  // ดับเบิลคลิกไฟล์อื่นขณะแอปเปิดอยู่ (Windows/Linux)
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const f = pdfPathFromArgv(argv.slice(1))
    if (f) void openExternalFile(f)
  })

  // macOS: เปิดไฟล์ผ่าน Finder / ดับเบิลคลิก
  app.on('open-file', (e, filePath) => {
    e.preventDefault()
    if (mainWindow) void openExternalFile(filePath)
    else pendingFile = filePath
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    shutdownOcr()
    if (process.platform !== 'darwin') app.quit()
  })
}

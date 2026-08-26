import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import {
  IPC,
  type OpenFileResult,
  type SaveFileRequest,
  type SaveFileResult,
  type DigitalSignRequest
} from '@shared/types'
import { digitalSign } from './pdfSigner'
import { verifyPdf } from './pdfVerify'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !!process.env['ELECTRON_RENDERER_URL']

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f1117',
    title: 'EverPDF',
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

/** เมนูบนสุด + คีย์ลัด (Ctrl+O เปิด, Ctrl+S บันทึก) แบบ Acrobat */
function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'ไฟล์',
      submenu: [
        {
          label: 'เปิด...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send(IPC.onMenuOpen)
        },
        {
          label: 'บันทึก',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send(IPC.onMenuSave)
        },
        { type: 'separator' },
        { role: 'quit', label: 'ออก' }
      ]
    },
    {
      label: 'มุมมอง',
      submenu: [
        { role: 'reload', label: 'โหลดใหม่' },
        { role: 'toggleDevTools', label: 'เครื่องมือนักพัฒนา' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'ซูมปกติ' },
        { role: 'zoomIn', label: 'ซูมเข้า' },
        { role: 'zoomOut', label: 'ซูมออก' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'เต็มจอ' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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
  return { canceled: false, filePath, data: new Uint8Array(data) }
})

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

/* ---------- lifecycle ---------- */

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

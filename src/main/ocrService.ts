import { fork, type ChildProcess } from 'node:child_process'
import { app } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** โฟลเดอร์ traineddata: dev = resources/, packaged = resourcesPath */
function tessdataDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tessdata')
    : join(process.cwd(), 'resources', 'tessdata')
}

let child: ChildProcess | null = null
let reqId = 0
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>()

/** สร้าง/คืน child process (fork แบบ pure Node ผ่าน ELECTRON_RUN_AS_NODE) */
function ensureChild(): ChildProcess {
  if (child && child.connected) return child
  child = fork(join(__dirname, 'ocrWorker.js'), [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  })
  child.stderr?.on('data', (d) => console.error('[ocr-child]', d.toString().trim()))
  child.on('message', (msg: { id: number; ok: boolean; text?: string; error?: string }) => {
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.ok) p.resolve(msg.text ?? '')
    else p.reject(new Error(msg.error ?? 'OCR failed'))
  })
  child.on('exit', () => {
    child = null
    pending.forEach((p) => p.reject(new Error('OCR worker หยุดทำงาน')))
    pending.clear()
  })
  return child
}

/** OCR รูปหนึ่งหน้า → คืนข้อความ */
export function ocrRecognize(pngBytes: Uint8Array, langs = 'tha+eng'): Promise<string> {
  const c = ensureChild()
  const id = ++reqId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    c.send({
      id,
      pngBase64: Buffer.from(pngBytes).toString('base64'),
      langs,
      langPath: tessdataDir(),
      // cachePath = โฟลเดอร์ traineddata → tesseract อ่านไฟล์ด้วย fs ตรงๆ
      cachePath: tessdataDir()
    })
  })
}

/** ปิด child ตอนออกจากแอป */
export function shutdownOcr(): void {
  child?.kill()
  child = null
}

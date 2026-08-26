/**
 * OCR worker — รันเป็น child process แบบ "pure Node" (ELECTRON_RUN_AS_NODE=1)
 *
 * ทำไมต้องแยกออกมา: tesseract.js โหลดไฟล์ภาษา (traineddata) ผ่าน fs ของ Node
 * แต่ถ้ารันใน Electron main, fetch ของ Chromium จะบังจนโหลดค้าง
 * → fork เป็น Node ล้วนเพื่อให้ tesseract อ่านไฟล์ได้ปกติ
 *
 * โปรโตคอล (ผ่าน process IPC):
 *   รับ: { id, pngBase64, langs, langPath, cachePath }
 *   ส่ง: { id, ok, text } หรือ { id, ok:false, error }
 */
import { createWorker, type Worker } from 'tesseract.js'

interface OcrRequest {
  id: number
  pngBase64: string
  langs: string
  langPath: string
  cachePath: string
}

let workerPromise: Promise<Worker> | null = null
let currentLangs = ''

/** เก็บ tesseract worker ไว้ใช้ซ้ำ (โหลดภาษาครั้งเดียว) */
function getWorker(langs: string, langPath: string, cachePath: string): Promise<Worker> {
  if (workerPromise && currentLangs === langs) return workerPromise
  currentLangs = langs
  // เคล็ดลับ: ชี้ cachePath ไปที่โฟลเดอร์ traineddata + cacheMethod 'readOnly'
  // → tesseract อ่านไฟล์ด้วย fs (adapter.readCache) ตรงๆ ไม่ fetch
  //   เลี่ยงบั๊ก "Only absolute URLs" ของ Electron-as-Node (env ตรวจเป็น non-node)
  workerPromise = createWorker(langs, 1, {
    langPath,
    cachePath,
    cacheMethod: 'readOnly',
    gzip: false
  })
  return workerPromise
}

process.on('message', async (msg: OcrRequest) => {
  try {
    const worker = await getWorker(msg.langs, msg.langPath, msg.cachePath)
    const png = Buffer.from(msg.pngBase64, 'base64')
    const {
      data: { text }
    } = await worker.recognize(png)
    process.send?.({ id: msg.id, ok: true, text })
  } catch (err) {
    process.send?.({
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    })
  }
})

import sarabunRegularUrl from '@/assets/fonts/Sarabun-Regular.ttf?url'
import sarabunBoldUrl from '@/assets/fonts/Sarabun-Bold.ttf?url'

/**
 * โหลดไฟล์ผ่าน XHR (รองรับ file:// ของแอปที่แพ็กแล้ว — fetch ไม่รองรับ)
 */
export function loadArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url, true)
      xhr.responseType = 'arraybuffer'
      xhr.onload = () => {
        const ok = xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)
        resolve(ok && xhr.response ? (xhr.response as ArrayBuffer) : null)
      }
      xhr.onerror = () => resolve(null)
      xhr.send()
    } catch {
      resolve(null)
    }
  })
}

export interface SarabunBytes {
  regular: ArrayBuffer | null
  bold: ArrayBuffer | null
}

/** โหลดฟอนต์ไทย Sarabun (regular + bold) */
export async function loadSarabun(): Promise<SarabunBytes> {
  const [regular, bold] = await Promise.all([
    loadArrayBuffer(sarabunRegularUrl),
    loadArrayBuffer(sarabunBoldUrl)
  ])
  return { regular, bold }
}

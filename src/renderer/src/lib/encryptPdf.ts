import { PDFDocument } from '@cantoo/pdf-lib'

/**
 * เข้ารหัส PDF ด้วยรหัสผ่าน (AES-256)
 *
 * ใช้ @cantoo/pdf-lib (fork ของ pdf-lib ที่รองรับ encryption ซึ่ง pdf-lib ปกติทำไม่ได้)
 * แยกไลบรารีนี้ไว้ใช้เฉพาะฟีเจอร์เข้ารหัส เพื่อไม่กระทบ pdf-lib หลัก
 */
export interface EncryptOptions {
  /** รหัสสำหรับเปิดเอกสาร (จำเป็น) */
  userPassword: string
  /** อนุญาตให้พิมพ์ */
  allowPrinting: boolean
  /** อนุญาตให้คัดลอกข้อความ */
  allowCopying: boolean
  /** อนุญาตให้แก้ไข */
  allowModifying: boolean
}

/** สุ่มรหัสเจ้าของ เพื่อบังคับสิทธิ์ (ผู้เปิดด้วย user password จะถูกจำกัดตามที่ตั้ง) */
function randomOwnerPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function encryptPdf(bytes: Uint8Array, opts: EncryptOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes)
  doc.encrypt({
    userPassword: opts.userPassword,
    // owner password ต่างจาก user เพื่อให้สิทธิ์ถูกบังคับจริง
    ownerPassword: randomOwnerPassword(),
    permissions: {
      printing: opts.allowPrinting ? 'highResolution' : undefined,
      copying: opts.allowCopying,
      modifying: opts.allowModifying,
      // ค่าอื่นปล่อยตาม default (ไม่อนุญาต) เพื่อความปลอดภัย
      annotating: opts.allowModifying,
      fillingForms: opts.allowModifying
    }
  })
  return doc.save()
}

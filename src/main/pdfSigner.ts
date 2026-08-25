import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib'
import { P12Signer } from '@signpdf/signer-p12'
import signpdf from '@signpdf/signpdf'
import type { DigitalSignRequest, DigitalSignResult } from '@shared/types'

/**
 * ลงลายเซ็นดิจิทัลแบบ PKI ลงใน PDF
 *
 * ขั้นตอนมาตรฐาน (เหมือนที่ Acrobat ทำเบื้องหลัง):
 *   1) เติม "signature placeholder" ลงใน PDF (ByteRange + ช่องว่างสำหรับ /Contents)
 *   2) ใช้ private key จากไฟล์ .p12/.pfx สร้าง PKCS#7/CMS detached signature
 *   3) ยัด signature กลับเข้า placeholder → ได้ PDF ที่ verify ได้ตามมาตรฐาน PAdES/CMS
 *
 * งานนี้ต้องอยู่ฝั่ง main process (Node) เพราะ:
 *   - ต้องอ่านไฟล์ใบรับรองจากดิสก์
 *   - ใช้ crypto ระดับ Node ที่ browser sandbox เข้าไม่ถึง
 */
export async function digitalSign(req: DigitalSignRequest): Promise<DigitalSignResult> {
  try {
    const { pdf, p12Path, passphrase, reason, location, contactInfo, signerName } = req

    // 1) โหลด PDF แล้วเติม placeholder ผ่าน pdf-lib
    const pdfDoc = await PDFDocument.load(pdf)

    pdflibAddPlaceholder({
      pdfDoc,
      reason: reason ?? 'ลงลายเซ็นอิเล็กทรอนิกส์',
      location: location ?? '',
      contactInfo: contactInfo ?? '',
      name: signerName ?? '',
      // ByteRange จริงจะถูกคำนวณตอน sign — signatureLength เผื่อขนาด CMS
      signatureLength: 8192
    })

    // ต้อง save โดย "ไม่" ให้ pdf-lib ไปแตะ object streams ที่มี placeholder
    const withPlaceholder = await pdfDoc.save({ useObjectStreams: false })

    // 2) เตรียม signer จากไฟล์ .p12/.pfx
    const p12Buffer = readFileSync(p12Path)
    const signer = new P12Signer(p12Buffer, { passphrase })

    // 3) เซ็นจริง — signpdf จะแทนที่ /Contents ใน placeholder ด้วย CMS
    const signed = await signpdf.sign(Buffer.from(withPlaceholder), signer)

    return { ok: true, signed: new Uint8Array(signed) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

import { PDFDocument } from 'pdf-lib'

/**
 * ปฏิบัติการระดับเอกสาร (รวม/แทรก/แยกหน้า)
 *
 * แนวคิด: ทำงานบน "baked bytes" ที่ page index = ลำดับที่แสดง (display order) แล้ว
 * เพื่อให้ index ตรงกับที่ผู้ใช้เห็น จากนั้นผลลัพธ์จะถูก reload เป็นเอกสารใหม่
 */

/** แทรกทุกหน้าของ insertBytes ต่อจากหน้า afterIndex (null = ต่อท้ายสุด) */
export async function mergeAfter(
  baseBytes: Uint8Array,
  insertBytes: Uint8Array,
  afterIndex: number | null
): Promise<Uint8Array> {
  const base = await PDFDocument.load(baseBytes)
  const insert = await PDFDocument.load(insertBytes)
  const out = await PDFDocument.create()

  const insertPages = await out.copyPages(insert, insert.getPageIndices())
  const basePages = await out.copyPages(base, base.getPageIndices())

  const pos = afterIndex === null ? basePages.length - 1 : afterIndex
  basePages.forEach((p, i) => {
    out.addPage(p)
    if (i === pos) insertPages.forEach((ip) => out.addPage(ip))
  })
  // เผื่อ base ว่าง
  if (basePages.length === 0) insertPages.forEach((ip) => out.addPage(ip))

  return out.save()
}

/** ดึงเฉพาะหน้าที่เลือก (index อิง display order) ออกเป็นเอกสารใหม่ */
export async function extractPages(
  baseBytes: Uint8Array,
  indices: number[]
): Promise<Uint8Array> {
  const base = await PDFDocument.load(baseBytes)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(base, indices)
  pages.forEach((p) => out.addPage(p))
  return out.save()
}

/**
 * โมเดล annotation ของ EverPDF
 *
 * หลักการสำคัญ: เก็บพิกัดแบบ "normalized" (0..1) เทียบกับขนาดหน้า
 * โดยใช้จุดกำเนิดมุมบนซ้าย (เหมือน DOM)
 *   → ทำให้ตำแหน่ง annotation ไม่เพี้ยนเวลาซูมเข้า/ออก
 *   → ตอน bake ค่อยแปลงกลับเป็นพิกัด PDF (จุดกำเนิดมุมล่างซ้าย)
 */

export type AnnotationType = 'text' | 'image'

interface BaseAnnotation {
  id: string
  type: AnnotationType
  pageIndex: number
  /** ตำแหน่งมุมบนซ้าย (0..1) */
  x: number
  y: number
  /** ขนาด (0..1 เทียบความกว้าง/สูงหน้า) */
  w: number
  h: number
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  text: string
  /** ขนาดฟอนต์เป็น pt (อิงหน้า PDF จริง) */
  fontSize: number
  /** สี hex เช่น #d21c1c */
  color: string
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image'
  /** data URL (PNG) — ใช้ได้ทั้งรูปแทรกและลายเซ็นที่วาด */
  dataUrl: string
  /** true = ลายเซ็น (ไว้แยกไอคอน/พฤติกรรมในอนาคต) */
  isSignature?: boolean
}

export type Annotation = TextAnnotation | ImageAnnotation

let counter = 0
/** สร้าง id ที่ไม่ชนกัน (เลี่ยง Math.random เพื่อให้ deterministic) */
export function newId(prefix = 'ann'): string {
  counter += 1
  return `${prefix}_${counter}_${performance.now().toString(36)}`
}

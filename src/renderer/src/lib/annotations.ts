/**
 * โมเดล annotation ของ EverPDF
 *
 * หลักการสำคัญ: เก็บพิกัดแบบ "normalized" (0..1) เทียบกับขนาดหน้า
 * โดยใช้จุดกำเนิดมุมบนซ้าย (เหมือน DOM)
 *   → ตำแหน่งไม่เพี้ยนเวลาซูมเข้า/ออก
 *   → ตอน bake ค่อยแปลงกลับเป็นพิกัด PDF (จุดกำเนิดมุมล่างซ้าย)
 */

export type AnnotationType =
  | 'text'
  | 'image'
  | 'highlight'
  | 'rect'
  | 'ink'
  | 'line'

interface BaseAnnotation {
  id: string
  pageIndex: number
}

/** annotation ที่อ้างอิงด้วยกล่อง (box): text, image, highlight, rect */
interface BoxAnnotation extends BaseAnnotation {
  /** มุมบนซ้าย (0..1) */
  x: number
  y: number
  /** ขนาด (0..1) */
  w: number
  h: number
}

export interface TextAnnotation extends BoxAnnotation {
  type: 'text'
  text: string
  /** ขนาดฟอนต์เป็น pt (อิงหน้า PDF จริง) */
  fontSize: number
  color: string
  bold: boolean
}

export interface ImageAnnotation extends BoxAnnotation {
  type: 'image'
  dataUrl: string
  isSignature?: boolean
}

/** ไฮไลต์ = กล่องสีโปร่งแสงทับข้อความ */
export interface HighlightAnnotation extends BoxAnnotation {
  type: 'highlight'
  color: string
  opacity: number
}

/** กรอบสี่เหลี่ยม (เส้นขอบ, เติมสีได้) */
export interface RectAnnotation extends BoxAnnotation {
  type: 'rect'
  color: string
  strokeWidth: number
  /** สีเติม (undefined = โปร่งใส) */
  fill?: string
}

/** เส้นตรง / ลูกศร */
export interface LineAnnotation extends BaseAnnotation {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  strokeWidth: number
  arrow: boolean
}

/** ลายเส้นอิสระ (ปากกา) — เก็บชุดจุด normalized */
export interface InkAnnotation extends BaseAnnotation {
  type: 'ink'
  points: { x: number; y: number }[]
  color: string
  strokeWidth: number
}

export type Annotation =
  | TextAnnotation
  | ImageAnnotation
  | HighlightAnnotation
  | RectAnnotation
  | LineAnnotation
  | InkAnnotation

/** annotation ที่มีกล่อง (ย้าย/ปรับขนาดด้วย handle ได้) */
export type BoxLike = TextAnnotation | ImageAnnotation | HighlightAnnotation | RectAnnotation

export function isBoxLike(a: Annotation): a is BoxLike {
  return a.type === 'text' || a.type === 'image' || a.type === 'highlight' || a.type === 'rect'
}

let counter = 0
/** สร้าง id ที่ไม่ชนกัน (เลี่ยง Math.random เพื่อให้ deterministic) */
export function newId(prefix = 'ann'): string {
  counter += 1
  return `${prefix}_${counter}_${performance.now().toString(36)}`
}

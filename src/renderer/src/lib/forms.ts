import type { PDFDocumentProxy } from 'pdfjs-dist'

/** ชนิด form field ที่รองรับ */
export type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown'

export interface FormField {
  /** ชื่อ field (ตรงกับ AcroForm — ใช้เขียนค่ากลับด้วย pdf-lib) */
  name: string
  type: FieldType
  /** index หน้าต้นฉบับ */
  pageIndex: number
  /** พิกัด normalized (origin บนซ้าย, อิงหน้า rotation 0) */
  x: number
  y: number
  w: number
  h: number
  /** ค่าปัจจุบัน: string (text/dropdown/radio) หรือ boolean (checkbox) */
  value: string | boolean
  /** ตัวเลือก (dropdown) */
  options?: string[]
  /** ค่าที่ต้องส่งเมื่อติ๊ก (checkbox/radio) */
  exportValue?: string
  readOnly?: boolean
  multiline?: boolean
}

/**
 * ดึง form fields ทั้งเอกสารด้วย annotation layer ของ PDF.js
 * (ได้ตำแหน่ง/ชนิด/ค่า/ตัวเลือกครบในที่เดียว)
 */
export async function extractFields(doc: PDFDocumentProxy): Promise<FormField[]> {
  const fields: FormField[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const W = vp.width
    const H = vp.height
    const anns = await page.getAnnotations({ intent: 'display' })

    for (const a of anns as any[]) {
      if (a.subtype !== 'Widget' || !a.fieldName) continue

      const [x1, y1, x2, y2] = a.rect as number[]
      const nx = Math.min(x1, x2) / W
      const nw = Math.abs(x2 - x1) / W
      const nh = Math.abs(y2 - y1) / H
      // PDF y จากล่าง → normalized จากบน
      const ny = (H - Math.max(y1, y2)) / H

      const base = {
        name: a.fieldName as string,
        pageIndex: p - 1,
        x: nx,
        y: ny,
        w: nw,
        h: nh,
        readOnly: !!a.readOnly
      }

      if (a.fieldType === 'Tx') {
        fields.push({
          ...base,
          type: 'text',
          value: (a.fieldValue as string) ?? '',
          multiline: !!a.multiLine
        })
      } else if (a.fieldType === 'Btn') {
        if (a.radioButton) {
          fields.push({
            ...base,
            type: 'radio',
            value: (a.fieldValue as string) ?? '',
            exportValue: a.buttonValue as string
          })
        } else if (a.checkBox) {
          const on = a.exportValue ?? 'Yes'
          fields.push({
            ...base,
            type: 'checkbox',
            value: a.fieldValue && a.fieldValue !== 'Off',
            exportValue: on
          })
        }
      } else if (a.fieldType === 'Ch') {
        const opts: string[] = (a.options ?? []).map(
          (o: { displayValue?: string; exportValue?: string }) =>
            o.displayValue ?? o.exportValue ?? ''
        )
        fields.push({
          ...base,
          type: 'dropdown',
          value: (a.fieldValue as string) ?? '',
          options: opts
        })
      }
    }
    page.cleanup()
  }

  return fields
}

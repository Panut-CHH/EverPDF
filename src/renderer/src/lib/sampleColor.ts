/**
 * สุ่มสีจาก canvas ที่เรนเดอร์หน้า PDF เพื่อใช้ตอนแก้ข้อความ:
 *  - bg: สีพื้นหลัง (ไว้ทับข้อความเดิมให้เนียน)
 *  - fg: สีข้อความเดิม (ไว้ใช้กับข้อความใหม่)
 *
 * bbox เป็น normalized (0..1, origin บนซ้าย) เทียบกับหน้า
 */
export interface SampledColors {
  bg: string
  fg: string
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function sampleColors(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number }
): SampledColors {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { bg: '#ffffff', fg: '#000000' }

  // canvas ถูก scale ด้วย dpr → ใช้ขนาด pixel จริงของ canvas
  const cw = canvas.width
  const ch = canvas.height
  const px = Math.max(0, Math.floor(box.x * cw))
  const py = Math.max(0, Math.floor(box.y * ch))
  const pw = Math.max(1, Math.floor(box.w * cw))
  const ph = Math.max(1, Math.floor(box.h * ch))

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(px, py, pw, ph).data
  } catch {
    return { bg: '#ffffff', fg: '#000000' }
  }

  // นับความถี่ของสี (quantize ทีละ 8 เพื่อรวมสีใกล้กัน)
  const freq = new Map<string, { c: [number, number, number]; n: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] & 0xf8
    const g = data[i + 1] & 0xf8
    const b = data[i + 2] & 0xf8
    const key = `${r},${g},${b}`
    const cur = freq.get(key)
    if (cur) cur.n++
    else freq.set(key, { c: [data[i], data[i + 1], data[i + 2]], n: 1 })
  }

  const sorted = [...freq.values()].sort((a, b) => b.n - a.n)
  // สีที่พบมากสุด = พื้นหลัง
  const bgC = sorted[0]?.c ?? [255, 255, 255]
  const bgLum = luminance(bgC[0], bgC[1], bgC[2])

  // สีข้อความ = สีที่ต่าง luminance จากพื้นหลังมากสุด (พบพอสมควร)
  let fgC: [number, number, number] = bgLum > 128 ? [0, 0, 0] : [255, 255, 255]
  let maxDiff = 0
  for (const { c, n } of sorted) {
    if (n < 2) continue
    const diff = Math.abs(luminance(c[0], c[1], c[2]) - bgLum)
    if (diff > maxDiff) {
      maxDiff = diff
      fgC = c
    }
  }

  return { bg: toHex(bgC[0], bgC[1], bgC[2]), fg: toHex(fgC[0], fgC[1], fgC[2]) }
}

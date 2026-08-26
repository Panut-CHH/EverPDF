import { app } from 'electron'
import { join, basename } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { RecentFile } from '@shared/types'

const MAX = 8
const storePath = (): string => join(app.getPath('userData'), 'recent.json')

/** อ่านรายการไฟล์ล่าสุด (กรองไฟล์ที่ถูกลบออกแล้ว) */
export function getRecent(): RecentFile[] {
  try {
    const raw = JSON.parse(readFileSync(storePath(), 'utf-8')) as RecentFile[]
    return raw.filter((r) => existsSync(r.path))
  } catch {
    return []
  }
}

/** เพิ่มไฟล์เข้าอันดับล่าสุด (เลื่อนขึ้นบนสุด, ตัดซ้ำ) */
export function addRecent(path: string): void {
  try {
    const list = getRecent().filter((r) => r.path !== path)
    list.unshift({ path, name: basename(path) })
    writeFileSync(storePath(), JSON.stringify(list.slice(0, MAX), null, 2))
  } catch {
    /* เขียนไม่ได้ก็ข้าม */
  }
}

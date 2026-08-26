/**
 * ชนิดข้อมูลกลางที่ใช้ร่วมกันทั้ง main / preload / renderer
 * เก็บไว้ที่เดียวเพื่อกันความไม่ตรงกันระหว่างฝั่ง Node กับฝั่ง UI
 */

/** ผลลัพธ์การเปิดไฟล์จาก native dialog */
export interface OpenFileResult {
  canceled: boolean
  filePath?: string
  /** เนื้อไฟล์ PDF เป็น bytes (ส่งข้าม IPC เป็น Uint8Array) */
  data?: Uint8Array
}

/** คำสั่งบันทึกไฟล์ */
export interface SaveFileRequest {
  /** ถ้ามี path เดิม = Save ทับ, ถ้าไม่มี = Save As (เปิด dialog) */
  filePath?: string
  data: Uint8Array
  /** ชื่อไฟล์เริ่มต้นตอน Save As */
  defaultName?: string
}

export interface SaveFileResult {
  canceled: boolean
  filePath?: string
}

/** พารามิเตอร์สำหรับลงลายเซ็นดิจิทัล (PKI) ที่ main process */
export interface DigitalSignRequest {
  /** bytes ของ PDF ที่จะเซ็น (ควรเป็นไฟล์ที่ยัง flatten annotation แล้ว) */
  pdf: Uint8Array
  /** path ของไฟล์ใบรับรอง .pfx / .p12 */
  p12Path: string
  /** รหัสผ่านของใบรับรอง */
  passphrase: string
  /** ข้อมูล metadata ของลายเซ็น (ไม่บังคับ) */
  reason?: string
  location?: string
  contactInfo?: string
  signerName?: string
}

export interface DigitalSignResult {
  ok: boolean
  /** PDF ที่เซ็นแล้ว */
  signed?: Uint8Array
  error?: string
}

/** ข้อมูลลายเซ็นดิจิทัลหนึ่งอันจากการตรวจสอบ */
export interface SignatureInfo {
  signer: string
  issuer: string
  validFrom: string
  validTo: string
  signingTime?: string
  /** เนื้อหาไม่ถูกแก้ไขหลังเซ็น (ไดเจสต์ + ลายเซ็นถูกต้อง) */
  integrity: boolean
  /** ลายเซ็นครอบคลุมทั้งไฟล์ */
  coversWholeDoc: boolean
  error?: string
}

export interface VerifyResult {
  hasSignature: boolean
  signatures: SignatureInfo[]
}

/** ไฟล์ที่เขียนลงโฟลเดอร์ (export หลายไฟล์) */
export interface NamedFile {
  name: string
  data: Uint8Array
}

/** รูปที่เปิดมา (สำหรับสร้าง PDF จากรูป) */
export interface OpenedImage {
  name: string
  data: Uint8Array
  mime: string
}

export interface RecentFile {
  path: string
  name: string
}

/** ช่องทาง IPC ทั้งหมด รวมไว้เป็น const กันพิมพ์ผิด */
export const IPC = {
  openFile: 'file:open',
  openByPath: 'file:openByPath',
  saveFile: 'file:save',
  saveBinary: 'file:saveBinary',
  pickP12: 'file:pickP12',
  writeFilesToDir: 'file:writeToDir',
  openImages: 'file:openImages',
  getRecent: 'file:getRecent',
  printPdf: 'file:print',
  digitalSign: 'sign:digital',
  verifySign: 'sign:verify',
  onMenuOpen: 'menu:open',
  onMenuSave: 'menu:save'
} as const

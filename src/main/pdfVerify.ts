import forge from 'node-forge'
import type { SignatureInfo, VerifyResult } from '@shared/types'

/** ดึงบล็อกลายเซ็นทั้งหมด (ByteRange + Contents) ออกจากไฟล์ */
function extractSignatureBlocks(buf: Buffer): {
  byteRange: number[]
  signed: Buffer
  der: Buffer
}[] {
  const text = buf.toString('latin1')
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g
  const blocks: { byteRange: number[]; signed: Buffer; der: Buffer }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const a = +m[1]
    const b = +m[2]
    const c = +m[3]
    const d = +m[4]
    // เนื้อหาที่ถูกเซ็น = ช่วง [a, a+b) ต่อกับ [c, c+d)
    const signed = Buffer.concat([buf.subarray(a, a + b), buf.subarray(c, c + d)])
    // /Contents <hex> อยู่ระหว่าง a+b ถึง c
    const gap = buf.subarray(a + b, c).toString('latin1')
    const hex = gap.match(/<([0-9A-Fa-f]+)>/)
    if (!hex) continue
    blocks.push({ byteRange: [a, b, c, d], signed, der: Buffer.from(hex[1], 'hex') })
  }
  return blocks
}

function cn(field: forge.pki.Certificate['subject']): string {
  const f = field.getField('CN')
  return f ? f.value : '(ไม่ระบุ)'
}

/** ตรวจสอบลายเซ็นดิจิทัลทั้งหมดในไฟล์ PDF */
export function verifyPdf(bytes: Uint8Array): VerifyResult {
  const buf = Buffer.from(bytes)
  const blocks = extractSignatureBlocks(buf)
  if (blocks.length === 0) return { hasSignature: false, signatures: [] }

  const signatures: SignatureInfo[] = blocks.map((blk) => {
    try {
      // parseAllBytes:false เพราะ /Contents ถูก pad ด้วย 00 เผื่อพื้นที่ CMS
      // (cast: @types/node-forge ยังไม่มี overload สำหรับ options object)
      const asn1 = (forge.asn1.fromDer as any)(
        forge.util.createBuffer(blk.der.toString('binary')),
        { parseAllBytes: false }
      )
      const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData
      const cert = p7.certificates[0]
      const rc: any = (p7 as any).rawCapture

      const digestOid = forge.asn1.derToOid(rc.digestAlgorithm)
      const mdAlgo = (forge.pki.oids as Record<string, string>)[digestOid] || 'sha256'
      const mdFactory = (forge.md as any)[mdAlgo]

      // 1) ไดเจสต์ของเนื้อหาที่เซ็น
      const contentMd = mdFactory.create()
      contentMd.update(blk.signed.toString('binary'))
      const computedDigest = contentMd.digest().getBytes()

      // 2) หา messageDigest + signingTime จาก authenticatedAttributes
      let signedDigest: string | null = null
      let signingTime: string | undefined
      const authAttrs = rc.authenticatedAttributes as any[]
      for (const attr of authAttrs) {
        const oid = forge.asn1.derToOid(attr.value[0].value)
        const name = (forge.pki.oids as Record<string, string>)[oid]
        if (name === 'messageDigest') {
          signedDigest = attr.value[1].value[0].value
        } else if (name === 'signingTime') {
          const raw = attr.value[1].value[0].value
          signingTime = raw instanceof Date ? raw.toISOString() : String(raw)
        }
      }
      const digestMatches = signedDigest !== null && signedDigest === computedDigest

      // 3) ตรวจลายเซ็นเหนือ authenticatedAttributes (DER ของ SET)
      const set = forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SET,
        true,
        authAttrs
      )
      const attrDer = forge.asn1.toDer(set).getBytes()
      const attrMd = mdFactory.create()
      attrMd.update(attrDer)
      let sigValid = false
      try {
        sigValid = (cert.publicKey as forge.pki.rsa.PublicKey).verify(
          attrMd.digest().getBytes(),
          rc.signature
        )
      } catch {
        sigValid = false
      }

      const coversWholeDoc =
        blk.byteRange[0] === 0 && blk.byteRange[2] + blk.byteRange[3] === buf.length

      return {
        signer: cn(cert.subject),
        issuer: cn(cert.issuer),
        validFrom: cert.validity.notBefore.toISOString(),
        validTo: cert.validity.notAfter.toISOString(),
        signingTime,
        integrity: digestMatches && sigValid,
        coversWholeDoc
      }
    } catch (err) {
      return {
        signer: '(อ่านไม่ได้)',
        issuer: '',
        validFrom: '',
        validTo: '',
        integrity: false,
        coversWholeDoc: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  })

  return { hasSignature: true, signatures }
}

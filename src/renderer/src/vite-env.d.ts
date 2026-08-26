/// <reference types="vite/client" />

// worker import ของ Vite (เช่น pdf.worker.min.mjs?worker)
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

// asset imports (Vite แปลงเป็น URL ที่ถูกต้องทั้ง dev/prod)
declare module '*.png' {
  const src: string
  export default src
}
declare module '*?url' {
  const src: string
  export default src
}

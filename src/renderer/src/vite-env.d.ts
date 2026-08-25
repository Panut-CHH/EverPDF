/// <reference types="vite/client" />

// worker import ของ Vite (เช่น pdf.worker.min.mjs?worker)
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

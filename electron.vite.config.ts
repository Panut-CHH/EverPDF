import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * electron-vite แบ่ง build เป็น 3 ส่วน: main / preload / renderer
 * - main & preload รันบน Node → externalize deps (ไม่ bundle node_modules)
 * - renderer เป็นเว็บ (React) → ใช้ Vite ปกติ + plugin react
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          // worker OCR แยกไฟล์ (fork เป็น pure Node)
          ocrWorker: resolve('src/main/ocrWorker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') }
      }
    },
    // pdfjs worker เป็นไฟล์แยก ต้องให้ Vite จัดการเป็น asset
    worker: { format: 'es' },
    plugins: [react()]
  }
})

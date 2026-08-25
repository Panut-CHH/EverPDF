import type { EverPdfApi } from './index'

declare global {
  interface Window {
    api: EverPdfApi
  }
}

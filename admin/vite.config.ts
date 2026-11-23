import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { buildPwaOptions } from './pwa.config'
import { ocrAssets } from './ocr.assets'

export default defineConfig({
  plugins: [
    vue(),
    ocrAssets(),
    VitePWA(buildPwaOptions({ VITE_PWA_KILL: process.env.VITE_PWA_KILL })),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  build: {
    rollupOptions: {
      output: {
        // OCR kutubxonalari alohida, nomi aniq bo'laklar: service worker ularni precache qilmasligi uchun (pwa.config.ts)
        manualChunks(id: string) {
          if (id.includes('node_modules/pdfjs-dist')) return 'ocr-pdfjs'
          if (id.includes('tesseract.js')) return 'ocr-tesseract'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.{test,spec}.ts'],
  },
})

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Imtihon ilovasi: PWA/service worker YO'Q (qotib qolish xavfi). Faqat /api/v1/exam-client chaqiriladi.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': { target: process.env.EXAM_API_PROXY || 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: { target: 'es2020', sourcemap: false },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.{test,spec}.ts'],
  },
})

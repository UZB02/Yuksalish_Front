import type { VitePWAOptions } from 'vite-plugin-pwa'

/** Standart ilova nomi (backend manifest default'i bilan bir xil). */
export const APP_NAME = 'Yuksalish EDU'

export interface PwaEnv {
  /** VITE_PWA_KILL=1: service worker o'zini o'chiradigan (kill-switch) build */
  VITE_PWA_KILL?: string
}

/**
 * Admin ilovasi uchun PWA sozlamalari.
 *  - faqat app shell precache qilinadi;
 *  - API HECH QACHON keshlanmaydi (bolalar ma'lumoti, tokenlar) - runtime kesh yo'q;
 *  - registerType 'prompt': yangi versiya foydalanuvchi roziligi (yoki xavfsiz marshrut almashuvi) bilan.
 */
export function buildPwaOptions(env: PwaEnv = {}): Partial<VitePWAOptions> {
  return {
    registerType: 'prompt',
    injectRegister: false,
    selfDestroying: env.VITE_PWA_KILL === '1',
    includeAssets: ['favicon-32x32.png', 'favicon.ico', 'apple-touch-icon-180x180.png'],
    // Manifest statik emas: backend dinamik beradi (GET /api/v1/branding/manifest.webmanifest),
    // chunki ilova nomi va ikonkalari Sozlamalar > Brending dan o'zgaradi. index.html da <link rel="manifest">.
    manifest: false,
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      // OCR (Rasm/PDF -> matn): katta fayllar (wasm, til modellari, tesseract/pdf.js bo'laklari) PRECACHE QILINMAYDI:
      // ilovani o'rnatishda hamma o'qituvchi ~15 MB yuklab olmasin. Ular talab bo'yicha keshlanadi (pastda)
      globIgnores: ['ocr/**', '**/ocr-*.js', '**/tesseract*.js', '**/pdf*.js'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      // ATAYLAB skipWaiting yo'q: yangi versiya faqat foydalanuvchi roziligi bilan faollashadi
      skipWaiting: false,
      // ATAYLAB: /api/ so'rovlari hech qachon keshlanmaydi (NetworkOnly). Bu yerga
      // CacheFirst/StaleWhileRevalidate/NetworkFirst qo'shmang: javoblarda bolalar ma'lumoti bor.
      runtimeCaching: [
        { urlPattern: /^\/api\//, handler: 'NetworkOnly' },
        // OCR fayllari: o'zgarmas (versiya paketga qotirilgan), shuning uchun CacheFirst; hajm va muddat cheklangan.
        // Til modellarini tesseract.js o'zi ham IndexedDB da saqlaydi; bu kesh wasm/worker/pdf.js uchun.
        {
          urlPattern: /^\/(?:ocr\/|assets\/(?:ocr-|tesseract|pdf)[^/]*\.m?js$)/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'ocr-assets',
            expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 90 },
            cacheableResponse: { statuses: [200] },
          },
        },
      ],
    },
    devOptions: { enabled: false },
  }
}

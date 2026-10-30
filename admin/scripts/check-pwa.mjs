// Build'dan keyin: node scripts/check-pwa.mjs  (npm run check:pwa)
// dist/ da manifest, sw.js, ikonkalar bor va service worker API'ni keshlamasligini tekshiradi.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const errors = []
const need = (file) => {
  if (!existsSync(join(dist, file))) errors.push(`dist/${file} topilmadi`)
}

for (const f of [
  'sw.js',
  'index.html',
  'pwa-192x192.png',
  'pwa-512x512.png',
]) {
  need(f)
}
need('maskable-icon-512x512.png')

if (errors.length === 0) {
  // Manifest backenddan dinamik keladi (GET /api/v1/branding/manifest.webmanifest): dist da bo'lmaydi
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  if (!html.includes('href="/api/v1/branding/manifest.webmanifest"'))
    errors.push('index.html: dinamik manifest havolasi yo‘q')
  if (existsSync(join(dist, 'manifest.webmanifest')))
    errors.push('dist/manifest.webmanifest statik manifest bo‘lmasligi kerak (backend beradi)')

  const sw = readFileSync(join(dist, 'sw.js'), 'utf8')
  if (!sw.includes('denylist:[/^\\/api\\//]')) errors.push('sw.js: /api denylist yo‘q')
  for (const bad of ['CacheFirst', 'StaleWhileRevalidate', 'NetworkFirst']) {
    if (sw.includes(bad)) errors.push(`sw.js ichida ${bad}: API keshlanib qolishi mumkin`)
  }
}

if (errors.length > 0) {
  console.error('PWA tekshiruvi muvaffaqiyatsiz:\n - ' + errors.join('\n - '))
  process.exit(1)
}
console.log('PWA tekshiruvi: OK')

// `npm run pwa:icons`: brand-src/yuksalish-mark-source.png (shaffof belgi, 1024x1024) dan
// PWA ikonkalarini public/ ga yaratadi. Natija repoga commit qilinadi (Docker build paytida qayta yaratilmaydi).
//  - shaffof (64/192/512): belgi + ~8% chekka;
//  - maskable 512: oq fon, belgi 80% xavfsiz zonada (doira maskasi kesmaydi);
//  - apple-touch 180: oq fon, ~12% chekka;
//  - favicon.ico (16/32/48, PNG) + favicon-32x32.png + brand/yuksalish-mark.png (UI uchun 256px).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const pub = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url))
const src = fileURLToPath(new URL('../brand-src/yuksalish-mark-source.png', import.meta.url))
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }
const NONE = { r: 0, g: 0, b: 0, alpha: 0 }

async function icon(size, padding, background) {
  const inner = Math.round(size * (1 - 2 * padding))
  const mark = await sharp(src).resize(inner, inner, { fit: 'contain', background: NONE }).toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: false })
    .toBuffer()
}
const out = async (name, buf) => {
  buf = await sharp(buf).png({ compressionLevel: 9, effort: 10 }).toBuffer()
  writeFileSync(pub(name), buf)
}

await out('pwa-64x64.png', await icon(64, 0.08, NONE))
await out('pwa-192x192.png', await icon(192, 0.08, NONE))
await out('pwa-512x512.png', await icon(512, 0.08, NONE))
await out('maskable-icon-512x512.png', await icon(512, 0.1, WHITE))
await out('apple-touch-icon-180x180.png', await icon(180, 0.12, WHITE))
await out('favicon-32x32.png', await icon(32, 0.04, NONE))
await out('brand/yuksalish-mark.png', await icon(256, 0, NONE))

// favicon.ico: PNG-lar ICO konteyneriga o'ralgan
const sizes = [16, 32, 48]
const pngs = []
for (const s of sizes) pngs.push(await icon(s, 0.04, NONE))
const head = Buffer.alloc(6)
head.writeUInt16LE(1, 2)
head.writeUInt16LE(sizes.length, 4)
let offset = 6 + 16 * sizes.length
const dir = sizes.map((s, i) => {
  const e = Buffer.alloc(16)
  e[0] = s
  e[1] = s
  e.writeUInt16LE(1, 4)
  e.writeUInt16LE(32, 6)
  e.writeUInt32LE(pngs[i].length, 8)
  e.writeUInt32LE(offset, 12)
  offset += pngs[i].length
  return e
})
writeFileSync(pub('favicon.ico'), Buffer.concat([head, ...dir, ...pngs]))
console.log('PWA ikonkalari yaratildi')

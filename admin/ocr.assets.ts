import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * OCR fayllarini (worker, wasm yadro, til modellari) npm paketlaridan `dist/ocr/...` ga ko'chiradi: ular repoga
 * COMMIT QILINMAYDI (git hajmi o'smaydi), docker build'dagi `npm ci` paketlarni o'zi tushiradi (versiyalar
 * package-lock da qotirilgan). Ish vaqtida hech qanday tashqi CDN yo'q: hammasi o'z originidan (`/ocr/`).
 *
 *   /ocr/worker.min.js                       tesseract.js ishchi skripti
 *   /ocr/tesseract-core-{simd-,}lstm.{js,wasm}   SIMD bor/yo'q brauzer uchun (relaxedsimd va LSTM-bo'lmagan variantlar olinmagan)
 *   (yadro fayllari ishchi skript bilan BIR papkada: Emscripten .wasm ni ishchi skriptga nisbatan qidiradi)
 *   /ocr/lang/<til>.traineddata.gz            4.0.0_best_int (butun sonli "best": kichik va aniq)
 *
 * Service worker bularni PRECACHE qilmaydi (pwa.config.ts globIgnores); talab bo'yicha CacheFirst bilan keshlanadi.
 */
const require_ = createRequire(import.meta.url)

/** Qaysi modellar paketga kiradi. Papka nomi paketdagi variant (4.0.0_best_int: ~9,5 MB jami; 4.0.0: ~26 MB) */
export const OCR_LANGS = ['eng', 'rus', 'uzb', 'uzb_cyrl'] as const
export const OCR_MODEL_DIR = '4.0.0_best_int'

function pkgDir(name: string): string {
  return dirname(require_.resolve(`${name}/package.json`))
}

export function ocrAssetMap(): Map<string, string> {
  const map = new Map<string, string>()
  const tess = pkgDir('tesseract.js')
  map.set('ocr/worker.min.js', join(tess, 'dist', 'worker.min.js'))
  const core = pkgDir('tesseract.js-core')
  for (const f of [
    'tesseract-core-simd-lstm.js',
    'tesseract-core-simd-lstm.wasm',
    'tesseract-core-lstm.js',
    'tesseract-core-lstm.wasm',
  ]) {
    map.set(`ocr/${f}`, join(core, f))
  }
  for (const l of OCR_LANGS) {
    map.set(
      `ocr/lang/${l}.traineddata.gz`,
      join(pkgDir(`@tesseract.js-data/${l}`), OCR_MODEL_DIR, `${l}.traineddata.gz`),
    )
  }
  return map
}

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
}

export function ocrAssets(): Plugin {
  return {
    name: 'yuksalish-ocr-assets',
    // dev: /ocr/... to'g'ridan-to'g'ri node_modules dan
    configureServer(server) {
      const map = ocrAssetMap()
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!.replace(/^\//, '')
        const file = map.get(url)
        if (!file || !existsSync(file)) return next()
        const ext = url.slice(url.lastIndexOf('.'))
        res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readFileSync(file))
      })
    },
    // build: dist/ocr/...
    generateBundle() {
      for (const [fileName, file] of ocrAssetMap()) {
        if (!existsSync(file)) {
          this.error(`OCR fayli topilmadi: ${file} (npm ci bajarilganmi?)`)
        }
        this.emitFile({ type: 'asset', fileName, source: readFileSync(file) })
      }
    },
  }
}

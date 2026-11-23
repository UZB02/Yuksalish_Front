import { preprocessPixels, type PrepMode } from './ocrPreprocess'

/**
 * OCR yadrosi (BU MODUL FAQAT TALAB BO'YICHA, dinamik import bilan yuklanadi: `tesseract.js` va `pdfjs-dist` asosiy
 * bundle'ga kirmaydi). Hamma narsa o'qituvchining brauzerida ishlaydi; rasm serverga yuborilmaydi.
 * Fayllar o'z originidan (`/ocr/...`): ocr.assets.ts build'da paketlardan ko'chiradi.
 */
export type OcrLang = 'uzb' | 'uzb_cyrl' | 'rus' | 'eng'
export const OCR_LANGS: OcrLang[] = ['uzb', 'uzb_cyrl', 'rus', 'eng']
export const DEFAULT_LANGS: OcrLang[] = ['uzb', 'eng']
/** Rasmning eng uzun tomoni (px): ko'proq xotira/vaqt, aniqlikka deyarli foyda yo'q */
export const MAX_SIDE = 2400
/** Shundan ko'p sahifada ogohlantiramiz (xotira va vaqt) */
export const MANY_PAGES = 20

export interface OcrStatus {
  /** 'loading': til/yadro yuklanmoqda; 'recognizing': sahifa o'qilmoqda */
  phase: 'loading' | 'recognizing'
  /** 0..1 (joriy bosqich) */
  progress: number
}

const base = () => (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

/** WebAssembly SIMD qo'llab-quvvatlanadimi (aks holda SIMD'siz yadro) */
export function hasWasmSimd(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
        253, 15, 253, 98, 11,
      ]),
    )
  } catch {
    return false
  }
}

export interface OcrSession {
  recognize(canvas: HTMLCanvasElement): Promise<string>
  terminate(): Promise<void>
}

/** Tesseract ishchisini ishga tushiradi (til fayllari bir marta yuklanadi va brauzer keshida/IndexedDB da qoladi) */
export async function createOcrSession(
  langs: OcrLang[],
  onStatus: (s: OcrStatus) => void,
): Promise<OcrSession> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(langs, 1, {
    workerPath: `${base()}/ocr/worker.min.js`,
    corePath: `${base()}/ocr/tesseract-core-${hasWasmSimd() ? 'simd-' : ''}lstm.js`,
    langPath: `${base()}/ocr/lang`,
    // blob: ishchi emas, o'z originidan: CSP (worker-src 'self') bilan mos
    workerBlobURL: false,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onStatus({ phase: 'recognizing', progress: m.progress })
      else onStatus({ phase: 'loading', progress: m.progress })
    },
  })
  return {
    async recognize(canvas) {
      const r = await worker.recognize(canvas)
      return r.data.text
    },
    async terminate() {
      await worker.terminate()
    },
  }
}

function sizeToMax(w: number, h: number): { w: number; h: number } {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

/** Rasm faylini (EXIF yo'nalishi hisobga olingan) kanvasga chizadi; `rotate`: 90° burilishlar soni (0..3) */
export async function imageToCanvas(file: Blob, rotate = 0): Promise<HTMLCanvasElement> {
  let src: CanvasImageSource & { width: number; height: number }
  let close: (() => void) | undefined
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    src = bmp
    close = () => bmp.close()
  } catch {
    const url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('image'))
      img.src = url
    })
    URL.revokeObjectURL(url)
    src = img
  }
  const { w, h } = sizeToMax(src.width, src.height)
  const turn = ((rotate % 4) + 4) % 4
  const c = document.createElement('canvas')
  c.width = turn % 2 ? h : w
  c.height = turn % 2 ? w : h
  const x = c.getContext('2d')!
  x.fillStyle = '#fff'
  x.fillRect(0, 0, c.width, c.height)
  x.translate(c.width / 2, c.height / 2)
  x.rotate((turn * Math.PI) / 2)
  x.drawImage(src, -w / 2, -h / 2, w, h)
  close?.()
  return c
}

/** Kanvasga oddiy tayyorlash (kulrang/kontrast/qora-oq) qo'llaydi */
export function prepareCanvas(c: HTMLCanvasElement, mode: PrepMode): HTMLCanvasElement {
  if (mode === 'none') return c
  const x = c.getContext('2d')!
  const id = x.getImageData(0, 0, c.width, c.height)
  preprocessPixels(id.data, c.width, c.height, mode)
  x.putImageData(id, 0, 0)
  return c
}

/** Kanvas xotirasini bo'shatish (mobil qurilmada muhim) */
export function freeCanvas(c: HTMLCanvasElement) {
  c.width = 0
  c.height = 0
}

export interface PdfHandle {
  pages: number
  /** 1 dan boshlab sahifani kanvasga chizadi (eng uzun tomon MAX_SIDE gacha) */
  render(page: number, rotate?: number): Promise<HTMLCanvasElement>
  destroy(): Promise<void>
}

/** PDF ni ochadi (pdfjs-dist faqat shu yerda yuklanadi); sahifalar birma-bir chiziladi */
export async function openPdf(file: Blob): Promise<PdfHandle> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
  return {
    pages: doc.numPages,
    async render(n, rotate = 0) {
      const page = await doc.getPage(n)
      const v1 = page.getViewport({ scale: 1 })
      const scale = Math.min(4, MAX_SIDE / Math.max(v1.width, v1.height))
      const vp = page.getViewport({ scale, rotation: (page.rotate + (rotate % 4) * 90) % 360 })
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(vp.width))
      c.height = Math.max(1, Math.round(vp.height))
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise
      page.cleanup()
      return c
    },
    async destroy() {
      await doc.destroy()
    },
  }
}

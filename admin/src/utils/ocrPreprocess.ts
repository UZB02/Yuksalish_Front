/**
 * OCR uchun oddiy rasm tayyorlash (brauzerda, serverga hech narsa yuborilmaydi).
 *  - 'none': o'zgarishsiz;
 *  - 'stretch': kulrang + kontrastni cho'zish (1%-99% persentil): odatda yetarli;
 *  - 'binarize': kulrang + lokal o'rtacha bo'yicha qora-oq: g'ira-shira yoritilgan telefon suratlari uchun.
 * `data`: RGBA (ImageData.data), joyida o'zgartiriladi.
 */
export type PrepMode = 'none' | 'stretch' | 'binarize'

export function preprocessPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mode: PrepMode,
): Uint8ClampedArray {
  if (mode === 'none') return data
  const n = width * height
  const gray = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    gray[i] = (data[i * 4]! * 299 + data[i * 4 + 1]! * 587 + data[i * 4 + 2]! * 114) / 1000
  }
  const put = (i: number, v: number) => {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  if (mode === 'stretch') {
    const hist = new Uint32Array(256)
    for (let i = 0; i < n; i++) hist[gray[i]!]!++
    let lo = 0
    let hi = 255
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]!
      if (acc >= n * 0.01) {
        lo = v
        break
      }
    }
    acc = 0
    for (let v = 255; v >= 0; v--) {
      acc += hist[v]!
      if (acc >= n * 0.01) {
        hi = v
        break
      }
    }
    const span = Math.max(1, hi - lo)
    for (let i = 0; i < n; i++) put(i, Math.max(0, Math.min(255, ((gray[i]! - lo) * 255) / span)))
    return data
  }
  // binarize: integral tasvir bilan lokal o'rtacha
  const w1 = width + 1
  const integral = new Float64Array(w1 * (height + 1))
  for (let y = 0; y < height; y++) {
    let row = 0
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x]!
      integral[(y + 1) * w1 + x + 1] = integral[y * w1 + x + 1]! + row
    }
  }
  const r = Math.max(8, Math.round(Math.min(width, height) / 24))
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(height - 1, y + r)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(width - 1, x + r)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const sum =
        integral[(y1 + 1) * w1 + x1 + 1]! -
        integral[y0 * w1 + x1 + 1]! -
        integral[(y1 + 1) * w1 + x0]! +
        integral[y0 * w1 + x0]!
      put(y * width + x, gray[y * width + x]! < (sum / area) * 0.88 ? 0 : 255)
    }
  }
  return data
}

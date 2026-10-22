/**
 * Backend DTO dagi `photo` havolasi ("/api/v1/photos/<id>?exp=&sig=") ni brauzerga mos manzilga aylantiradi.
 * VITE_API_BASE_URL ("https://api.example.uz/api/v1") berilgan bo'lsa, rasm ham shu originda ochiladi.
 * Havola imzolangan (Bearer shart emas), shuning uchun oddiy <img src> ishlaydi.
 */
const BASE: string = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export function resolvePhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^(https?:|blob:|data:)/i.test(path)) return path
  return BASE + path.replace(/^\/api\/v1/, '')
}

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Yuklashdan oldingi tekshiruv: 'type' | 'size' | null (server baribir qayta tekshiradi). */
export function validatePhotoFile(file: Pick<File, 'type' | 'size'>): 'type' | 'size' | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return 'type'
  if (file.size > PHOTO_MAX_BYTES) return 'size'
  return null
}

const DOWNSCALE_OVER = 1.5 * 1024 * 1024
const DOWNSCALE_SIDE = 1280

/**
 * Katta rasmni (telefon kamerasi) yuklashdan oldin kichraytiradi: trafik va 5 MB chegarasi uchun.
 * Imkon bo'lmasa (eski brauzer, xato) asl fayl qaytadi - server manba hisoblanadi.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (file.size <= DOWNSCALE_OVER || typeof createImageBitmap !== 'function') return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, DOWNSCALE_SIDE / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close?.()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

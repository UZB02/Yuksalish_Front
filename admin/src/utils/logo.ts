export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Yuklashdan oldingi tekshiruv: 'type' | 'size' | null (SVG qabul qilinmaydi; server baribir tekshiradi). */
export function validateLogoFile(file: Pick<File, 'type' | 'size'>): 'type' | 'size' | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return 'type'
  if (file.size > LOGO_MAX_BYTES) return 'size'
  return null
}

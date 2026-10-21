const base = () =>
  String(import.meta.env.VITE_PUBLIC_URL || 'http://localhost:5174').replace(/\/+$/, '')

/** Ochiq reyting manzili: maktab uchun `${base}/${slug}`, umumiy uchun `${base}/global`. */
export const publicRatingUrl = (slug: string | 'global') => `${base()}/${slug}`

/** Clipboard API yo'q yoki taqiqlangan bo'lsa execCommand zaxirasi. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      el.remove()
      return ok
    } catch {
      return false
    }
  }
}

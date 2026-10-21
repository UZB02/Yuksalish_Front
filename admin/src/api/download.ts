import { http } from './http'

/** Content-Disposition sarlavhasidan fayl nomini ajratadi (filename* va filename). */
export function parseFilename(header: string | undefined | null): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // oddiy filename ga o'tamiz
    }
  }
  const plain = /filename\s*=\s*("([^"]+)"|[^;]+)/i.exec(header)
  const name = plain?.[2] ?? plain?.[1]
  return name ? name.trim() : null
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface DownloadOptions {
  params?: Record<string, unknown>
  fallbackName: string
}

/** Autentifikatsiya sarlavhasi bilan faylni (blob) yuklab oladi va saqlaydi. */
export async function downloadFile(url: string, options: DownloadOptions): Promise<string> {
  const res = await http.get<Blob>(url, { params: options.params, responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const name = parseFilename(disposition) ?? options.fallbackName
  saveBlob(res.data, name)
  return name
}

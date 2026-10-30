import type { Router } from 'vue-router'

const FLAG_KEY = 'chunk-reload-at'
/** Shu muddat ichida ikkinchi marta reload qilinmaydi (cheksiz aylanishdan himoya). */
const COOLDOWN_MS = 30_000

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk .* failed/i

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return CHUNK_ERROR_RE.test(message)
}

export interface ChunkGuardDeps {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  reload?: (target: string) => void
  now?: () => number
}

function defaultStorage() {
  try {
    return sessionStorage
  } catch {
    return null
  }
}

/**
 * Deploydan keyin eski sahifa o'chib ketgan chunk'ni so'rasa ("Failed to fetch dynamically imported
 * module"), manzilni bir marta to'liq qayta yuklaydi. Reload sessionStorage bayrog'i bilan cheklangan.
 */
export function installChunkErrorGuard(router: Router, deps: ChunkGuardDeps = {}) {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage
  const reload = deps.reload ?? ((target: string) => window.location.assign(target))
  const now = deps.now ?? Date.now

  router.onError((error, to) => {
    if (!isChunkLoadError(error) || !storage) return
    let last = 0
    try {
      last = Number(storage.getItem(FLAG_KEY) ?? 0)
    } catch {
      // ignore
    }
    if (last && now() - last < COOLDOWN_MS) return
    try {
      storage.setItem(FLAG_KEY, String(now()))
    } catch {
      return // bayroqni yozib bo'lmasa, loop xavfi bor: reload qilmaymiz
    }
    reload(to.fullPath)
  })

  // Muvaffaqiyatli navigatsiyadan keyin bayroq tozalanadi (keyingi deploy uchun yana ishlaydi).
  router.afterEach(() => {
    try {
      storage?.removeItem(FLAG_KEY)
    } catch {
      // ignore
    }
  })
}

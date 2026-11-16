import type { EventType } from './types'

export interface AntiCheatOptions {
  /** Hodisani serverga yuborish (xato bo'lsa jim; test davom etadi) */
  send: (type: EventType, at: string) => void
  /** O'quvchiga ko'rsatiladigan ogohlantirish */
  warn: (message: string) => void
  /** Hodisa vaqti manbai (testlar uchun) */
  now?: () => number
  message?: string
}

/** Bir xil hodisa shuncha ms ichida takror qayd etilmaydi (blur + visibilitychange ikkilanishi) */
const DEDUPE_MS = 1500

/**
 * Oynadan/yorliqdan chiqish va to'liq ekrandan chiqishni qayd etadi. Test DAVOM etadi (bloklanmaydi):
 * server hodisani saqlaydi (nazoratchi ko'radi) va o'quvchiga ogohlantirish chiqadi.
 * Qaytaradi: tozalash funksiyasi.
 */
export function installAntiCheat(
  o: AntiCheatOptions,
  doc: Document = document,
  win: Window = window,
) {
  const now = o.now ?? Date.now
  const last = new Map<EventType, number>()
  let lastAny = 0
  const report = (type: EventType) => {
    const t = now()
    if (t - (last.get(type) ?? -Infinity) < DEDUPE_MS) return
    // Bir vaqtda kelgan blur va visibility_hidden: bitta ogohlantirish
    const quiet = t - lastAny < DEDUPE_MS
    last.set(type, t)
    lastAny = t
    o.send(type, new Date(t).toISOString())
    if (!quiet) o.warn(o.message ?? 'Oynadan chiqish qayd qilindi')
  }
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') report('visibility_hidden')
  }
  const onBlur = () => report('blur')
  const onFullscreen = () => {
    if (!doc.fullscreenElement) report('fullscreen_exit')
  }
  doc.addEventListener('visibilitychange', onVisibility)
  win.addEventListener('blur', onBlur)
  doc.addEventListener('fullscreenchange', onFullscreen)
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    win.removeEventListener('blur', onBlur)
    doc.removeEventListener('fullscreenchange', onFullscreen)
  }
}

/** To'liq ekranni so'rash (majburlanmaydi; ba'zi qurilmalarda qo'llab-quvvatlanmaydi) */
export async function requestFullscreen(doc: Document = document): Promise<boolean> {
  try {
    if (!doc.documentElement.requestFullscreen) return false
    await doc.documentElement.requestFullscreen()
    return true
  } catch {
    return false
  }
}

/**
 * Taymer: haqiqiy deadline serverda. Klient soati noto'g'ri bo'lishi mumkin, shuning uchun
 * offset = serverNow - clientNow (javob olingan paytda) hisoblanadi va qolgan vaqt shu bilan ko'rsatiladi.
 */
export const computeOffset = (serverNowIso: string, clientNowMs: number): number =>
  new Date(serverNowIso).getTime() - clientNowMs

/** Qolgan millisekund (0 dan past emas) */
export const remainingMs = (deadlineIso: string, offsetMs: number, clientNowMs: number): number =>
  Math.max(0, new Date(deadlineIso).getTime() - (clientNowMs + offsetMs))

/** "mm:ss" yoki 1 soatdan ko'p bo'lsa "h:mm:ss" */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

/** Oxirgi 5 daqiqa: ogohlantirish rangi */
export const isLowTime = (ms: number): boolean => ms <= 5 * 60_000

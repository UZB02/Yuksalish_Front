const p2 = (n: number) => String(n).padStart(2, '0')

/** Sana: 14.10.2026 21:30 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** Sana: 14.10.2026 (ISO satrdan, vaqt mintaqasi siljishisiz) */
export function formatDate(value: string | null | undefined): string {
  const iso = toDateInput(value)
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** ISO sanani `<input type="date">` qiymatiga (yyyy-mm-dd) aylantiradi. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  return m?.[1] ?? ''
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

/** Asia/Tashkent vaqtida: 14.10.2026 21:30:05 (audit log uchun; brauzer mintaqasidan mustaqil). */
export function formatDateTimeTashkent(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`
}

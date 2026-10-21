/**
 * Global + maktab override sozlamalari uchun umumiy (turdan mustaqil) funksiyalar.
 * Scoring, reyting va ochiq ko'rinish sozlamalari shu mantiqdan foydalanadi.
 */
export type Flags<K extends string> = Record<K, boolean>

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** O'zgargan kalitlar (massiv qiymatlar ham to'g'ri solishtiriladi). */
export function diffValues<T extends object, K extends keyof T & string>(
  before: T,
  after: T,
  keys: readonly K[],
): K[] {
  return keys.filter((k) => !same(before[k], after[k]))
}

/** Serverdagi override (qisman) dan "qaysi maydonlar override qilingan" xaritasi. */
export function flagsFromOverride<T extends object, K extends keyof T & string>(
  override: Partial<T> | null,
  keys: readonly K[],
): Flags<K> {
  const flags = {} as Flags<K>
  for (const k of keys) flags[k] = !!override && Object.prototype.hasOwnProperty.call(override, k)
  return flags
}

/** Maktab formasi qiymatlari: override qilingan maydon - override qiymati, qolgani - global. */
export function mergeValues<T extends object>(global: T, override: Partial<T> | null): T {
  return { ...global, ...(override ?? {}) }
}

/** Faqat belgilangan maydonlar; hech biri bo'lmasa null (override olib tashlanadi). */
export function pickOverride<T extends object, K extends keyof T & string>(
  values: T,
  flags: Flags<K>,
  keys: readonly K[],
): Partial<T> | null {
  const out: Partial<T> = {}
  for (const k of keys) if (flags[k]) out[k] = values[k]
  return Object.keys(out).length > 0 ? out : null
}

/** Override o'chirilganda maydon global qiymatga qaytariladi. */
export function resetFlagValue<T extends object, K extends keyof T & string>(
  values: T,
  global: T,
  key: K,
  on: boolean,
): T {
  return on ? values : { ...values, [key]: global[key] }
}

/** Faqat global bo'lishi mumkin bo'lgan kalitlar override qiymatidan chiqarib tashlanadi. */
export function omitKeys<T extends object>(values: T, keys: readonly string[]): Partial<T> {
  const out = { ...values } as Record<string, unknown>
  for (const k of keys) delete out[k]
  return out as Partial<T>
}

/** Forma komponenti yangi to'liq qiymat chiqarganda faqat o'zgargan kalitlarni `set` ga uzatadi. */
export function applyChanges<T extends object, K extends keyof T & string>(
  current: T,
  next: T,
  keys: readonly K[],
  set: (key: K, value: T[K]) => void,
): void {
  for (const k of keys) if (current[k] !== next[k]) set(k, next[k])
}

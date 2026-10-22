/**
 * Qidiruv uchun matnni normallashtiradi: kichik harf, ortiqcha bo'shliqsiz,
 * o'zbekcha apostrof variantlari (' ‘ ’ ʻ ʼ `) bitta belgiga va diakritiklarsiz.
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bb\u02bc\u02b9\u2032\u00b4`]/g, "'")
    .toLowerCase()
    .trim()
}

/** `query` bo'sh bo'lsa yoki `text` ichida (istalgan joyda) uchrasa true. */
export function matchesSearch(text: string, query: string): boolean {
  const q = normalizeSearch(query)
  return q === '' || normalizeSearch(text).includes(q)
}

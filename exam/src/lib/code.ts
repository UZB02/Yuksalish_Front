/**
 * Shaxsiy kirish kodi: kiritishni normallashtirish (backend `normalizeEntryCode` bilan bir xil qoida).
 * Kodda 0/O, 1/I/L yo'q, uzunligi 9 belgi, ko'rinishi XXX-XXX-XXX.
 */
export const CODE_LENGTH = 9
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Kirillcha lotinga o'xshash harflar (katta va kichik) */
const CYRILLIC: Record<string, string> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  У: 'Y',
}

export function normalizeCode(input: string): string {
  let out = ''
  for (const ch of input.toUpperCase()) out += CYRILLIC[ch] ?? ch
  return out.replace(/[^A-Z0-9]/g, '')
}

export const isWellFormedCode = (n: string): boolean =>
  n.length === CODE_LENGTH && [...n].every((c) => ALPHABET.includes(c))

/** Yozilayotganda XXX-XXX-XXX ko'rinishiga keltiradi (ortiqcha belgilar kesiladi) */
export function formatCodeInput(input: string): string {
  const n = normalizeCode(input).slice(0, CODE_LENGTH)
  return n.match(/.{1,3}/g)?.join('-') ?? ''
}

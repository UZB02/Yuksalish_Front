/**
 * OCR matnini paste-parser uchun tozalaydi (faqat shubhasiz holatlar):
 *  1. Qator boshidagi 1-2 belgilik axlat ("| D) 10", "i А) 20", "cl Ответ: B", "| 4 B) 60") olib tashlanadi.
 *  2. Kirill variant harflari (А В С Е) faqat matnda Б/Г variantlari YO'Q bo'lsa lotin A B C E ga o'giriladi:
 *     OCR (rus tili) lotin "B" ni kirill "В" deb o'qiydi, parser esa kirill В ni "C" o'rni deb hisoblaydi.
 */
const HOMOGLYPH: Record<string, string> = {
  А: 'A',
  В: 'B',
  С: 'C',
  Е: 'E',
  а: 'a',
  в: 'b',
  с: 'c',
  е: 'e',
}
const ANSWER = String.raw`(?:Ответ|Javob|Жавоб|Answer)\s*:`
const JUNK = new RegExp(
  String.raw`^(?:\S{1,2}\s+){1,2}(?=[A-EА-ГВСЕa-eа-гвсе]\s*\)|\d{1,3}\s*[.)]\s|${ANSWER})`,
  'u',
)
const OPT_HOMO = /^(\s*)([АВСЕавсе])(\s*[).])/u
const ANS_HOMO = /^((?:Ответ|Жавоб)\s*:\s*)([АВСЕавсе])(?![\p{L}])/u

export function cleanOcrText(text: string): string {
  let lines = text.split('\n').map((l) => l.replace(JUNK, ''))
  const trueCyr = lines.some((l) => /^\s*[БГбг]\s*[).]/.test(l))
  if (!trueCyr) {
    lines = lines.map((l) =>
      l
        .replace(OPT_HOMO, (_m, a: string, c: string, b: string) => a + HOMOGLYPH[c] + b)
        .replace(ANS_HOMO, (_m, a: string, c: string) => a + HOMOGLYPH[c]),
    )
  }
  return lines.join('\n')
}

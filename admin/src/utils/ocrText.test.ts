import { describe, expect, it } from 'vitest'
import { cleanOcrText } from './ocrText'

describe('cleanOcrText', () => {
  it('qator boshidagi axlat belgilarni olib tashlaydi', () => {
    const out = cleanOcrText('i А) 20\n| D) 10\ncl Ответ: B\n| 4 B) 60\ni 5. Какой газ?')
    expect(out).toBe('A) 20\nD) 10\nОтвет: B\nB) 60\n5. Какой газ?')
  })

  it("kirill А В С ni lotinga o'giradi (Б/Г yo'q bo'lsa)", () => {
    const out = cleanOcrText('1. Savol\nА) 1\nВ) 2\nС) 3\nD) 4\nОтвет: В')
    expect(out).toBe('1. Savol\nA) 1\nB) 2\nC) 3\nD) 4\nОтвет: B')
  })

  it("haqiqiy kirill ketma-ketligi (А Б В Г) o'zgarmaydi", () => {
    const t = '1. Савол\nА) 1\nБ) 2\nВ) 3\nГ) 4\nОтвет: В'
    expect(cleanOcrText(t)).toBe(t)
  })

  it('oddiy matn va raqamlarni buzmaydi', () => {
    const t = '12. 3 + 4 = ?\nA) 7\nB) 8\nJavob: A'
    expect(cleanOcrText(t)).toBe(t)
  })
})

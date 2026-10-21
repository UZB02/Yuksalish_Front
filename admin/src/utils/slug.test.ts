import { describe, expect, it } from 'vitest'
import { SLUG_PATTERN, slugify } from './slug'

describe('slugify', () => {
  it('lotin nomni slug ga aylantiradi', () => {
    expect(slugify('5-sonli Maktab')).toBe('5-sonli-maktab')
  })
  it("o'zbek apostroflarini olib tashlaydi", () => {
    expect(slugify("O'zbekiston g'oyasi")).toBe('ozbekiston-goyasi')
  })
  it('kirill harflarini transliteratsiya qiladi', () => {
    expect(slugify('Ёшлик мактаби')).toBe('yoshlik-maktabi')
  })
  it('natija slug andozasiga mos', () => {
    expect(SLUG_PATTERN.test(slugify('  Yuksalish -- Maktabi!  '))).toBe(true)
    expect(slugify('!!!')).toBe('')
  })
})

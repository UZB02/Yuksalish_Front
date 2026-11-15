import { describe, expect, it } from 'vitest'
import type { Question, QuestionBlock } from '@/api/types'
import {
  QUESTION_LIMITS,
  addAcceptedAnswer,
  addBlock,
  addOption,
  defaultForm,
  emptyBlock,
  formFromQuestion,
  moveBlock,
  nextOptionId,
  removeBlock,
  removeOption,
  toPayload,
  toggleCorrect,
  updateBlock,
  validateForm,
  type QuestionForm,
} from './examQuestion'

const t = (key: string) => key
const text = (s: string): QuestionBlock => ({ type: 'text', text: s })
const math = (s: string): QuestionBlock => ({ type: 'math', tex: s })

describe('blok amallari', () => {
  const blocks = [text('a'), math('x^2'), text('c')]

  it("qo'shish: yangi blok oxiriga, limitdan oshmaydi, asl massiv o'zgarmaydi", () => {
    const next = addBlock(blocks, emptyBlock('image'))
    expect(next).toHaveLength(4)
    expect(next[3]).toEqual({ type: 'image', assetId: '' })
    expect(blocks).toHaveLength(3)
    expect(addBlock(blocks, emptyBlock('text'), 3)).toBe(blocks)
    expect(emptyBlock('text')).toEqual({ type: 'text', text: '' })
    expect(emptyBlock('math')).toEqual({ type: 'math', tex: '' })
  })

  it("o'chirish", () => {
    expect(removeBlock(blocks, 1)).toEqual([text('a'), text('c')])
    expect(removeBlock(blocks, 9)).toEqual(blocks)
  })

  it('tartibni almashtirish: yuqoriga/pastga, chegarada o`zgarmaydi', () => {
    expect(moveBlock(blocks, 1, -1)).toEqual([math('x^2'), text('a'), text('c')])
    expect(moveBlock(blocks, 1, 1)).toEqual([text('a'), text('c'), math('x^2')])
    expect(moveBlock(blocks, 0, -1)).toBe(blocks)
    expect(moveBlock(blocks, 2, 1)).toBe(blocks)
    expect(moveBlock(blocks, 5, 1)).toBe(blocks)
    expect(blocks[0]).toEqual(text('a')) // asl o'zgarmadi
  })

  it("matn/formula/rasmni yangilash faqat tanlangan blokka ta'sir qiladi", () => {
    expect(updateBlock(blocks, 0, { text: 'yangi' })[0]).toEqual(text('yangi'))
    expect(updateBlock(blocks, 1, { tex: '\\frac{1}{2}' })[1]).toEqual(math('\\frac{1}{2}'))
    expect(updateBlock([emptyBlock('image')], 0, { assetId: 'abc' })[0]).toEqual({
      type: 'image',
      assetId: 'abc',
    })
    expect(updateBlock(blocks, 0, { text: 'x' })[2]).toBe(blocks[2])
  })
})

describe('variantlar', () => {
  it('nextOptionId: band bo`lmagan birinchi harf', () => {
    expect(nextOptionId([])).toBe('a')
    expect(
      nextOptionId([
        { id: 'a', content: [] },
        { id: 'c', content: [] },
      ]),
    ).toBe('b')
    const all = Array.from('abcdefghijklmnopqrstuvwxyz').map((id) => ({ id, content: [] }))
    expect(nextOptionId(all)).toBe('o27')
  })

  it("addOption 10 tagacha qo'shadi, yangi variant bo'sh matn bloki bilan", () => {
    let o = defaultForm().options
    expect(o.map((x) => x.id)).toEqual(['a', 'b'])
    for (let i = 0; i < 12; i++) o = addOption(o)
    expect(o).toHaveLength(QUESTION_LIMITS.options)
    expect(new Set(o.map((x) => x.id)).size).toBe(10)
    expect(o[9]!.content).toEqual([text('')])
  })

  it("removeOption to'g'ri javobdan ham chiqaradi", () => {
    const f: QuestionForm = {
      ...defaultForm('s'),
      options: [
        { id: 'a', content: [text('1')] },
        { id: 'b', content: [text('2')] },
        { id: 'c', content: [text('3')] },
      ],
      correctOptionId: 'b',
      correctOptionIds: ['b', 'c'],
    }
    const r = removeOption(f, 'b')
    expect(r.options.map((o) => o.id)).toEqual(['a', 'c'])
    expect(r.correctOptionId).toBe('')
    expect(r.correctOptionIds).toEqual(['c'])
    expect(removeOption(f, 'a').correctOptionId).toBe('b')
  })

  it('toggleCorrect', () => {
    expect(toggleCorrect(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleCorrect(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('qisqa javoblar (chip)', () => {
  it("bo'sh va takroriy (katta-kichik harfsiz) qo'shilmaydi, bo'shliq kesiladi", () => {
    expect(addAcceptedAnswer([], '  ')).toEqual([])
    expect(addAcceptedAnswer([], '  Olma ')).toEqual(['Olma'])
    expect(addAcceptedAnswer(['Olma'], 'olma')).toEqual(['Olma'])
    expect(addAcceptedAnswer(['Olma'], 'Nok')).toEqual(['Olma', 'Nok'])
  })
  it('20 tadan ko`p emas', () => {
    const full = Array.from({ length: 20 }, (_, i) => `j${i}`)
    expect(addAcceptedAnswer(full, 'yangi')).toBe(full)
  })
})

describe('forma <-> payload', () => {
  const base = (): QuestionForm => ({
    ...defaultForm('math', 't1'),
    content: [text('2+2?')],
    options: [
      { id: 'a', content: [text('3')] },
      { id: 'b', content: [text('4')] },
    ],
    correctOptionId: 'b',
  })

  it('single: faqat optionId yuboriladi', () => {
    const p = toPayload(base())
    expect(p).toMatchObject({
      topicId: 't1',
      type: 'single',
      answer: { optionId: 'b' },
      points: 1,
      difficulty: 2,
      status: 'draft',
    })
    expect(p.options).toHaveLength(2)
  })

  it('multi: optionIds va partialCredit', () => {
    const p = toPayload({
      ...base(),
      type: 'multi',
      correctOptionIds: ['a', 'b'],
      partialCredit: true,
    })
    expect(p.answer).toEqual({ optionIds: ['a', 'b'], partialCredit: true })
  })

  it('short/essay: variantlar yuborilmaydi', () => {
    const s = toPayload({ ...base(), type: 'short', acceptedAnswers: ['4', 'to`rt'] })
    expect(s.options).toEqual([])
    expect(s.answer).toEqual({ acceptedAnswers: ['4', 'to`rt'] })
    expect(toPayload({ ...base(), type: 'essay', rubric: '  mezon ' }).answer).toEqual({
      rubric: 'mezon',
    })
    expect(toPayload({ ...base(), type: 'essay', rubric: '  ' }).answer).toEqual({})
  })

  it('formFromQuestion serverdagi savolni formaga aylantiradi (arxiv -> qoralama)', () => {
    const q: Question = {
      id: '1',
      subjectId: 's1',
      subjectName: 'Matematika',
      topicId: 't1',
      topicName: 'Kasrlar',
      difficulty: 3,
      type: 'multi',
      points: 2,
      status: 'archived',
      version: 4,
      authorId: 'u',
      authorName: 'U',
      isMine: true,
      isShared: false,
      sharedWithMe: false,
      canEdit: true,
      createdAt: '',
      updatedAt: '',
      content: [text('q')],
      options: [{ id: 'a', content: [text('x')] }],
      answer: { optionIds: ['a'], partialCredit: true },
    }
    const f = formFromQuestion(q)
    expect(f).toMatchObject({
      topicId: 't1',
      difficulty: 3,
      type: 'multi',
      correctOptionIds: ['a'],
      partialCredit: true,
      status: 'draft',
    })
    // Nusxa: forma o'zgarishi asl obyektga ta'sir qilmaydi
    f.content.push(text('y'))
    expect(q.content).toHaveLength(1)
  })
})

describe('validateForm', () => {
  const ok = (): QuestionForm => ({
    ...defaultForm('math', 't1'),
    content: [text('savol')],
    options: [
      { id: 'a', content: [text('1')] },
      { id: 'b', content: [text('2')] },
    ],
    correctOptionId: 'a',
  })

  it("to'g'ri forma xatosiz", () => expect(validateForm(ok(), t)).toEqual({}))

  it('fan, matn, ball', () => {
    const e = validateForm({ ...ok(), subjectId: '', content: [text('  ')], points: 0 }, t)
    expect(e).toMatchObject({
      subjectId: 'exams.errors.subject',
      content: 'exams.errors.contentEmpty',
      points: 'exams.errors.points',
    })
    expect(validateForm({ ...ok(), points: 101 }, t).points).toBeTruthy()
    expect(validateForm({ ...ok(), content: [text('a'), text('')] }, t).content).toBe(
      'exams.errors.blockEmpty',
    )
    expect(
      validateForm({ ...ok(), content: [{ type: 'image', assetId: '' }] }, t).content,
    ).toBeTruthy()
  })

  it("single/multi: variantlar soni, bo'sh variant, to'g'ri javob", () => {
    expect(validateForm({ ...ok(), options: [ok().options[0]!] }, t).options).toBe(
      'exams.errors.optionsMin',
    )
    expect(
      validateForm({ ...ok(), options: [ok().options[0]!, { id: 'b', content: [text(' ')] }] }, t)
        .options,
    ).toBe('exams.errors.optionEmpty')
    expect(validateForm({ ...ok(), correctOptionId: '' }, t).answer).toBe(
      'exams.errors.correctSingle',
    )
    expect(validateForm({ ...ok(), type: 'multi', correctOptionIds: [] }, t).answer).toBe(
      'exams.errors.correctMulti',
    )
    expect(validateForm({ ...ok(), type: 'multi', correctOptionIds: ['b'] }, t)).toEqual({})
  })

  it('short: kamida bitta javob; essay: kalit shart emas', () => {
    expect(validateForm({ ...ok(), type: 'short', acceptedAnswers: [] }, t).answer).toBe(
      'exams.errors.acceptedMin',
    )
    expect(validateForm({ ...ok(), type: 'short', acceptedAnswers: ['4'] }, t)).toEqual({})
    expect(validateForm({ ...ok(), type: 'essay' }, t)).toEqual({})
  })
})

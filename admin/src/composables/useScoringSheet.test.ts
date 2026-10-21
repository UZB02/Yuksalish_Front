import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scoresApi } from '@/api/scores.api'
import type { ScoringSettings, ScoringSheet, ScoringSheetStudent } from '@/api/types'
import { useScoringSheet } from './useScoringSheet'

vi.mock('@/api/scores.api', () => ({ scoresApi: { sheet: vi.fn(), bulk: vi.fn() } }))

const settings: ScoringSettings = {
  minScore: 0,
  maxScore: 100,
  requireBehaviorType: true,
  commentRequiredBelow: 60,
  editWindowHours: 24,
  backdateDays: 3,
  dailyAggregation: 'average',
}

function student(id: string, over: Partial<ScoringSheetStudent> = {}): ScoringSheetStudent {
  return {
    studentId: id,
    fullName: `O'quvchi ${id}`,
    studentCode: null,
    myScore: null,
    dayScore: null,
    scoresCount: 0,
    ...over,
  }
}

function scored(id: string, value: number, editable = true): ScoringSheetStudent {
  return student(id, {
    dayScore: value,
    scoresCount: 1,
    myScore: {
      id: `sc-${id}`,
      studentId: id,
      value,
      behaviorTypeId: 'b1',
      comment: null,
      editable,
    } as never,
  })
}

function sheetOf(students: ScoringSheetStudent[], s = settings): ScoringSheet {
  return { class: { id: 'c1', name: '7-A' }, date: '2026-10-16', settings: s, students }
}

async function setup(students: ScoringSheetStudent[], s = settings) {
  vi.mocked(scoresApi.sheet).mockResolvedValue(sheetOf(students, s))
  const sh = useScoringSheet(() => 'c1')
  await sh.load()
  return sh
}

describe('useScoringSheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it("yuklangach hech narsa o'zgargan emas, progress saqlangan baholarni sanaydi", async () => {
    const sh = await setup([scored('1', 90), student('2'), student('3')])
    expect(sh.changedCount.value).toBe(0)
    expect(sh.scoredCount.value).toBe(1)
    expect(sh.total.value).toBe(3)
    expect(sh.statusOf(sh.rows.value[0]!)).toBe('saved')
    expect(sh.statusOf(sh.rows.value[1]!)).toBe('empty')
    expect(sh.canSave.value).toBe(false)
  })

  it("dirty tracking: o'zgartirish va asl holatga qaytarish", async () => {
    const sh = await setup([scored('1', 90)])
    sh.patch('1', { value: '80' })
    expect(sh.changedCount.value).toBe(1)
    expect(sh.statusOf(sh.rows.value[0]!)).toBe('dirty')
    sh.patch('1', { value: '90' })
    expect(sh.changedCount.value).toBe(0)
  })

  it('diapazon, butun son, xulq turi va izoh majburiyligi (chegaradan past ball)', async () => {
    const sh = await setup([student('1')])
    sh.patch('1', { value: '150', behaviorTypeId: 'b1' })
    expect(sh.errorsOf(sh.rows.value[0]!).value).toBe('range')
    sh.patch('1', { value: '12.5' })
    expect(sh.errorsOf(sh.rows.value[0]!).value).toBe('integer')
    sh.patch('1', { value: '50' })
    expect(sh.errorsOf(sh.rows.value[0]!).comment).toBe('commentRequired')
    sh.patch('1', { comment: 'Darsga tayyor emas' })
    expect(sh.errorsOf(sh.rows.value[0]!)).toEqual({})
    sh.patch('1', { behaviorTypeId: null })
    expect(sh.errorsOf(sh.rows.value[0]!).behavior).toBe('behaviorRequired')
  })

  it("xulq turi majburiy bo'lmasa xato emas; izoh chegarasi o'chiq bo'lsa talab qilinmaydi", async () => {
    const sh = await setup([student('1')], {
      ...settings,
      requireBehaviorType: false,
      commentRequiredBelow: null,
    })
    sh.patch('1', { value: '10' })
    expect(sh.errorsOf(sh.rows.value[0]!)).toEqual({})
    expect(sh.canSave.value).toBe(true)
  })

  it("xatoli qator bo'lsa saqlash o'chirilgan va bulk so'rovga tushmaydi", async () => {
    const sh = await setup([student('1'), student('2')])
    sh.patch('1', { value: '95', behaviorTypeId: 'b1' })
    sh.patch('2', { value: '200', behaviorTypeId: 'b1' })
    expect(sh.canSave.value).toBe(false)
    expect(sh.invalidDirty.value).toHaveLength(1)
    expect(sh.buildItems().map((i) => i.studentId)).toEqual(['1'])
  })

  it("bulk payload faqat o'zgargan qatorlarni yuboradi", async () => {
    const sh = await setup([scored('1', 90), scored('2', 70), student('3')])
    sh.patch('2', { value: '75' })
    sh.patch('3', { value: '88', behaviorTypeId: 'b2', comment: '  yaxshi  ' })
    vi.mocked(scoresApi.bulk).mockResolvedValue({ created: 1, updated: 1, failed: [] })
    await sh.save()
    expect(scoresApi.bulk).toHaveBeenCalledWith({
      classId: 'c1',
      date: sh.date.value,
      items: [
        { studentId: '2', value: 75, behaviorTypeId: 'b1', comment: null },
        { studentId: '3', value: 88, behaviorTypeId: 'b2', comment: 'yaxshi' },
      ],
    })
  })

  it("failed qatorlar xato bilan qoladi, qolganlari saqlangan holatga o'tadi", async () => {
    const sh = await setup([student('1'), student('2')])
    sh.patch('1', { value: '90', behaviorTypeId: 'b1' })
    sh.patch('2', { value: '80', behaviorTypeId: 'b1' })
    vi.mocked(scoresApi.bulk).mockResolvedValue({
      created: 1,
      updated: 0,
      failed: [{ studentId: '2', code: 'CONFLICT', message: 'Dublikat' }],
    })
    // Server qayta yuklanganda 1-o'quvchi baholangan, 2-si yo'q
    vi.mocked(scoresApi.sheet).mockResolvedValue(sheetOf([scored('1', 90), student('2')]))
    await sh.save()
    const [r1, r2] = sh.rows.value
    expect(sh.statusOf(r1!)).toBe('saved')
    expect(sh.statusOf(r2!)).toBe('error')
    expect(r2!.serverError).toBe('Dublikat')
    expect(r2!.draft.value).toBe('80') // qoralama yo'qolmadi
    expect(sh.changedCount.value).toBe(1)
    // Qayta tahrirlash xatoni tozalaydi
    sh.patch('2', { value: '81' })
    expect(r2!.serverError).toBeNull()
  })

  it("tahrir oynasi o'tgan (editable=false) qator qulflangan va o'zgarmaydi", async () => {
    const sh = await setup([scored('1', 90, false)])
    expect(sh.statusOf(sh.rows.value[0]!)).toBe('locked')
    sh.patch('1', { value: '10' })
    expect(sh.rows.value[0]!.draft.value).toBe('90')
    expect(sh.changedCount.value).toBe(0)
  })

  it("ommaviy qo'llash faqat tanlangan va qulflanmagan qatorlarga", async () => {
    const sh = await setup([student('1'), student('2'), scored('3', 90, false)])
    sh.selectAll(['1', '3'], true)
    sh.applyToSelected({ value: '100', behaviorTypeId: 'b1' })
    expect(sh.rows.value[0]!.draft.value).toBe('100')
    expect(sh.rows.value[1]!.draft.value).toBe('')
    expect(sh.rows.value[2]!.draft.value).toBe('90')
    expect(sh.changedCount.value).toBe(1)
  })

  it('discard hamma qoralamani asliga qaytaradi', async () => {
    const sh = await setup([scored('1', 90)])
    sh.patch('1', { value: '10' })
    sh.discard()
    expect(sh.hasUnsaved.value).toBe(false)
    expect(sh.rows.value[0]!.draft.value).toBe('90')
  })
})

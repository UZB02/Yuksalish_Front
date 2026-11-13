import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scoresApi } from '@/api/scores.api'
import type { BehaviorType, ScoringSettings, ScoringSheet, ScoringSheetStudent } from '@/api/types'
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
  autoFillScoreFromBehaviorType: false,
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

const tp = (id: string, defaultScore: number | null, ratingPenalty = 0): BehaviorType =>
  ({
    id,
    name: id,
    kind: 'positive',
    color: '#16a34a',
    defaultScore,
    ratingPenalty,
  }) as BehaviorType
// bp: "Dars paytida bezovtalik", reytingdan -20 ayiriladi (ballsiz ham saqlanadi)
const TYPES = [tp('b1', 95), tp('b2', 60), tp('b0', null), tp('bp', null, 20)]

async function setup(students: ScoringSheetStudent[], s = settings, penaltyEnabled = false) {
  vi.mocked(scoresApi.sheet).mockResolvedValue(sheetOf(students, s))
  const sh = useScoringSheet(
    () => 'c1',
    () => TYPES,
    () => penaltyEnabled,
  )
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

  it("faqat xulq turi tanlangan qator o'zgarish hisoblanadi; jarimasiz turda ball xatosi ko'rsatiladi", async () => {
    const sh = await setup([student('1'), student('2')], settings, true)
    sh.patch('1', { behaviorTypeId: 'b2' }) // jarimasi yo'q tur
    expect(sh.changedCount.value).toBe(1)
    expect(sh.statusOf(sh.rows.value[0]!)).toBe('error')
    expect(sh.errorsOf(sh.rows.value[0]!).value).toBe('required')
    expect(sh.invalidDirty.value).toHaveLength(1)
    expect(sh.canSave.value).toBe(false)
    sh.patch('1', { value: '70' })
    expect(sh.canSave.value).toBe(true)
    sh.patch('1', { value: '', behaviorTypeId: null })
    expect(sh.changedCount.value).toBe(0)
  })

  describe('faqat jarima qaydi (ballsiz)', () => {
    it("jarimali tur + jarima yoqilgan: ball bo'sh bo'lsa xato yo'q, qator o'zgarish, payload value=null", async () => {
      const sh = await setup([student('1'), student('2')], settings, true)
      sh.patch('1', { behaviorTypeId: 'bp' })
      expect(sh.changedCount.value).toBe(1)
      expect(sh.errorsOf(sh.rows.value[0]!)).toEqual({})
      expect(sh.statusOf(sh.rows.value[0]!)).toBe('dirty')
      expect(sh.invalidDirty.value).toHaveLength(0)
      expect(sh.canSave.value).toBe(true)
      expect(sh.buildItems()).toEqual([
        { studentId: '1', value: null, behaviorTypeId: 'bp', comment: null },
      ])
    })

    it("jarima o'chiq bo'lsa ball majburiy (eski xatti-harakat)", async () => {
      const sh = await setup([student('1')], settings, false)
      sh.patch('1', { behaviorTypeId: 'bp' })
      expect(sh.errorsOf(sh.rows.value[0]!).value).toBe('required')
      expect(sh.canSave.value).toBe(false)
    })

    it("jarimasiz tur (jarima yoqilgan bo'lsa ham) ball talab qiladi", async () => {
      const sh = await setup([student('1')], settings, true)
      sh.patch('1', { behaviorTypeId: 'b0' })
      expect(sh.errorsOf(sh.rows.value[0]!).value).toBe('required')
      expect(sh.canSave.value).toBe(false)
    })

    it("ball yozilsa oddiy baho (ikkalasi); ballni o'chirsa yana jarima qaydi", async () => {
      const sh = await setup([student('1')], settings, true)
      sh.patch('1', { behaviorTypeId: 'bp' })
      sh.patch('1', { value: '70' })
      expect(sh.errorsOf(sh.rows.value[0]!)).toEqual({})
      expect(sh.buildItems()[0]).toMatchObject({ value: 70, behaviorTypeId: 'bp' })
      sh.patch('1', { value: '' })
      expect(sh.errorsOf(sh.rows.value[0]!)).toEqual({})
      expect(sh.buildItems()[0]).toMatchObject({ value: null, behaviorTypeId: 'bp' })
      // chegaradan past ball izohni talab qiladi, ballsiz jarima qaydida izoh talab qilinmaydi
      sh.patch('1', { value: '50' })
      expect(sh.errorsOf(sh.rows.value[0]!).comment).toBe('commentRequired')
      sh.patch('1', { value: '' })
      expect(sh.errorsOf(sh.rows.value[0]!).comment).toBeUndefined()
    })

    it("serverdan kelgan ballsiz qayd: ball maydoni bo'sh, 'saqlangan', o'zgarish emas", async () => {
      const sh = await setup(
        [
          student('1', {
            scoresCount: 1,
            myScore: {
              id: 'sc-1',
              studentId: '1',
              value: null,
              behaviorPenalty: 20,
              behaviorTypeId: 'bp',
              comment: null,
              editable: true,
            } as never,
          }),
        ],
        settings,
        true,
      )
      expect(sh.rows.value[0]!.draft.value).toBe('')
      expect(sh.changedCount.value).toBe(0)
      expect(sh.statusOf(sh.rows.value[0]!)).toBe('saved')
      expect(sh.scoredCount.value).toBe(1)
      // oddiy ballga o'tkazish
      sh.patch('1', { value: '80' })
      expect(sh.buildItems()[0]).toMatchObject({ value: 80 })
    })

    it('ommaviy qo`llash: jarimali tur ballsiz tanlangan qatorlarga o`tadi', async () => {
      const sh = await setup([student('1'), student('2'), student('3')], settings, true)
      sh.toggleSelect('1', true)
      sh.toggleSelect('2', true)
      sh.applyToSelected({ behaviorTypeId: 'bp' })
      expect(sh.changedCount.value).toBe(2)
      expect(sh.invalidDirty.value).toHaveLength(0)
      expect(sh.buildItems().map((i) => [i.studentId, i.value])).toEqual([
        ['1', null],
        ['2', null],
      ])
    })

    it("saqlash: bulk so'rovga value=null ketadi", async () => {
      const sh = await setup([student('1')], settings, true)
      sh.patch('1', { behaviorTypeId: 'bp' })
      vi.mocked(scoresApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
      await sh.save()
      expect(scoresApi.bulk).toHaveBeenCalledWith({
        classId: 'c1',
        date: expect.any(String),
        items: [{ studentId: '1', value: null, behaviorTypeId: 'bp', comment: null }],
      })
    })
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

  describe("xulq turidan ball avtomatik to'ldirish", () => {
    const ON = { ...settings, autoFillScoreFromBehaviorType: true }

    it("bo'sh ball to'ldiriladi, keyin tur almashsa yangilanadi (avtomatik), qo'lda o'zgartirilsa — yo'q", async () => {
      const sh = await setup([student('1')], ON)
      sh.patch('1', { behaviorTypeId: 'b1' })
      expect(sh.rows.value[0]!.draft.value).toBe('95')
      sh.patch('1', { behaviorTypeId: 'b2' })
      expect(sh.rows.value[0]!.draft.value).toBe('60')
      sh.patch('1', { value: '77' })
      sh.patch('1', { behaviorTypeId: 'b1' })
      expect(sh.rows.value[0]!.draft.value).toBe('77')
    })

    it("tanlovni bekor qilish ballni o'zgartirmaydi; standart ballsiz turga o'tilsa avtomatik ball tozalanadi", async () => {
      const sh = await setup([student('1')], ON)
      sh.patch('1', { behaviorTypeId: 'b1' })
      sh.patch('1', { behaviorTypeId: null })
      expect(sh.rows.value[0]!.draft.value).toBe('95')
      sh.patch('1', { behaviorTypeId: 'b0' })
      expect(sh.rows.value[0]!.draft.value).toBe('')
      expect(sh.rows.value[0]!.autoFilled).toBe(false)
    })

    it("avtomatik 95 dan jarimali turga o'tilsa eski ball qolmaydi, ballsiz jarima qaydi bo'ladi", async () => {
      const sh = await setup([student('1')], ON, true)
      sh.patch('1', { behaviorTypeId: 'b1' })
      expect(sh.rows.value[0]!.draft.value).toBe('95')
      sh.patch('1', { behaviorTypeId: 'bp' })
      expect(sh.rows.value[0]!.draft.value).toBe('')
      expect(sh.invalidDirty.value).toHaveLength(0)
      expect(sh.buildItems()[0]).toMatchObject({ value: null, behaviorTypeId: 'bp' })
      // yana standart balli turga qaytsa — qayta to'ldiriladi
      sh.patch('1', { behaviorTypeId: 'b2' })
      expect(sh.rows.value[0]!.draft.value).toBe('60')
    })

    it("qo'lda yozilgan ball jarimali turga o'tilganda saqlanib qoladi", async () => {
      const sh = await setup([student('1')], ON, true)
      sh.patch('1', { value: '85', behaviorTypeId: 'b1' })
      sh.patch('1', { behaviorTypeId: 'bp' })
      expect(sh.rows.value[0]!.draft.value).toBe('85')
      expect(sh.buildItems()[0]).toMatchObject({ value: 85, behaviorTypeId: 'bp' })
    })

    it("serverdan yuklangan saqlangan ball qo'lda hisoblanadi (almashtirilmaydi)", async () => {
      const sh = await setup([scored('1', 80)], ON)
      sh.patch('1', { behaviorTypeId: 'b2' })
      expect(sh.rows.value[0]!.draft.value).toBe('80')
    })

    it("qo'lda yozilgan ball keyin bo'shatilsa yana to'ldiriladi", async () => {
      const sh = await setup([student('1')], ON)
      sh.patch('1', { value: '50' })
      sh.patch('1', { value: '' })
      sh.patch('1', { behaviorTypeId: 'b1' })
      expect(sh.rows.value[0]!.draft.value).toBe('95')
    })

    it("sozlama o'chiq bo'lsa hech narsa o'zgarmaydi", async () => {
      const sh = await setup([student('1')])
      sh.patch('1', { behaviorTypeId: 'b1' })
      expect(sh.rows.value[0]!.draft.value).toBe('')
    })

    it("bulk: aniq ball bo'lmasa har qator qoidasi; aniq ball berilsa u qo'llanadi", async () => {
      const sh = await setup([student('1'), student('2'), student('3'), scored('4', 70)], ON)
      sh.patch('2', { value: '55' }) // qo'lda
      for (const id of ['1', '2', '4']) sh.toggleSelect(id, true)
      sh.applyToSelected({ behaviorTypeId: 'b1' })
      const v = (id: string) => sh.rows.value.find((r) => r.studentId === id)!.draft.value
      expect(v('1')).toBe('95')
      expect(v('2')).toBe('55')
      expect(v('3')).toBe('')
      expect(v('4')).toBe('70')
      sh.applyToSelected({ behaviorTypeId: 'b2', value: '88' })
      expect(v('1')).toBe('88')
      expect(v('4')).toBe('88')
    })
  })
})

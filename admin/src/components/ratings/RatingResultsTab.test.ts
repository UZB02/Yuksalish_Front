import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { RatingResultDetail, RatingResultMeta } from '@/api/types'
import { ratingsApi } from '@/api/ratings.api'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import LatestWinnersCard from './LatestWinnersCard.vue'
import RatingResultsTab from './RatingResultsTab.vue'

vi.mock('@/api/ratings.api', () => ({
  ratingsApi: { results: vi.fn(), result: vi.fn(), announce: vi.fn(), deleteResult: vi.fn() },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const meta = (over: Partial<RatingResultMeta> = {}): RatingResultMeta => ({
  id: 'r1',
  periodType: 'week',
  periodKey: 'week:2026-11-09',
  label: '9–15-noyabr',
  from: '2026-11-09',
  to: '2026-11-14',
  periodTo: '2026-11-15',
  announcedAt: '2026-11-14T13:00:00.000Z',
  manual: false,
  studentsCount: 3,
  classesCount: 2,
  ...over,
})
const detail = (): RatingResultDetail => ({
  ...meta(),
  settings: {
    method: 'average',
    weights: { conduct: 50, subjects: 50 },
    minScoresCount: 3,
    tieBreak: ['daysCount', 'alphabetical'],
  },
  students: [
    {
      studentId: 's1',
      fullName: 'Valiyev Vali',
      classId: 'c1',
      className: '5-A',
      grade: 5,
      score: 100,
      rank: 1,
      daysCount: 3,
      scoresCount: 3,
    },
    {
      studentId: 's2',
      fullName: 'Aliyev Ali',
      classId: 'c1',
      className: '5-A',
      grade: 5,
      score: 80,
      rank: 2,
      daysCount: 3,
      scoresCount: 3,
    },
  ],
  classes: [{ classId: 'c1', name: '5-A', grade: 5, score: 90, rank: 1, ratedStudents: 2 }],
})

const mountTab = () =>
  mount(RatingResultsTab, {
    global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('RatingResultsTab', () => {
  it("bo'sh bo'lsa holat xabarini ko'rsatadi", async () => {
    vi.mocked(ratingsApi.results).mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    })
    const w = mountTab()
    await flushPromises()
    expect(w.text()).toContain(uz.ratings.results.empty)
    expect(w.find('[data-testid="results-list"]').exists()).toBe(false)
  })

  it("arxiv ro'yxatini ko'rsatadi va bosilganda batafsil jadvallarni ochadi", async () => {
    vi.mocked(ratingsApi.results).mockResolvedValue({
      items: [meta()],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    vi.mocked(ratingsApi.result).mockResolvedValue(detail())
    const w = mountTab()
    await flushPromises()
    const row = w.get('[data-testid="result-week:2026-11-09"]')
    expect(row.text()).toContain("O'tgan hafta g'oliblari — 9–15-noyabr")
    expect(row.text()).toContain("3 ta o'quvchi")
    await row.trigger('click')
    await flushPromises()
    expect(ratingsApi.result).toHaveBeenCalledWith('r1')
    expect(w.get('[data-testid="results-detail-title"]').text()).toContain('9–15-noyabr')
    expect(w.text()).toContain('Valiyev Vali')
    expect(w.text()).toContain('5-A')
    // arxivda "O'zgarish" ustuni yo'q
    expect(w.text()).not.toContain(uz.ratings.changeCol)
    await w.get('[data-testid="results-back"]').trigger('click')
    expect(w.find('[data-testid="results-list"]').exists()).toBe(true)
  })

  it("'hozir e'lon qilish' tugmasi superadmin bo'lmaganlarga ko'rinmaydi", async () => {
    vi.mocked(ratingsApi.results).mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    })
    const w = mountTab()
    await flushPromises()
    expect(w.find('[data-testid="results-announce"]').exists()).toBe(false)
  })
})

const asRole = (role: 'superadmin' | 'school_admin' | 'teacher') =>
  useAuthStore().setSession('tok', {
    id: '1',
    fullName: 'A',
    username: 'a',
    role,
    schoolId: 's1',
    permissions: [],
    isActive: true,
    lastLoginAt: null,
    createdAt: '',
  })
const listOf = (items: RatingResultMeta[]) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
})

describe('RatingResultsTab: yakunni o‘chirish', () => {
  const KEY = 'week:2026-11-09'

  it("o'chirish tugmasi faqat superadminga ko'rinadi", async () => {
    vi.mocked(ratingsApi.results).mockResolvedValue(listOf([meta()]))
    for (const role of ['school_admin', 'teacher'] as const) {
      asRole(role)
      const w = mountTab()
      await flushPromises()
      expect(w.find(`[data-testid="result-delete-${KEY}"]`).exists()).toBe(false)
    }
    asRole('superadmin')
    const w = mountTab()
    await flushPromises()
    expect(w.find(`[data-testid="result-delete-${KEY}"]`).exists()).toBe(true)
  })

  it("tasdiqlansa API chaqiriladi, toast chiqadi va ro'yxat yangilanadi", async () => {
    asRole('superadmin')
    vi.mocked(ratingsApi.results)
      .mockResolvedValueOnce(listOf([meta(), meta({ id: 'r2', periodKey: 'week:2026-11-02' })]))
      .mockResolvedValueOnce(listOf([meta({ id: 'r2', periodKey: 'week:2026-11-02' })]))
    vi.mocked(ratingsApi.deleteResult).mockResolvedValue({ id: 'r1' })
    const w = mountTab()
    await flushPromises()
    await w.get(`[data-testid="result-delete-${KEY}"]`).trigger('click')
    const { state, settle } = useConfirm()
    expect(state.open).toBe(true)
    expect(state.options.title).toBe("Yakunni o'chirish")
    expect(state.options.variant).toBe('danger')
    expect(state.options.confirmText).toBe("O'chirish")
    expect(state.options.message).toContain("«9–15-noyabr» natijasi arxivdan o'chiriladi")
    expect(ratingsApi.deleteResult).not.toHaveBeenCalled()
    settle(true)
    await flushPromises()
    expect(ratingsApi.deleteResult).toHaveBeenCalledWith('r1')
    expect(ratingsApi.results).toHaveBeenCalledTimes(2)
    expect(useToast().toasts.some((x) => x.message === "Yakun o'chirildi")).toBe(true)
    expect(w.find(`[data-testid="result-${KEY}"]`).exists()).toBe(false)
    expect(w.find('[data-testid="result-week:2026-11-02"]').exists()).toBe(true)
  })

  it("bekor qilinsa hech narsa o'chmaydi va ro'yxat qayta yuklanmaydi", async () => {
    asRole('superadmin')
    vi.mocked(ratingsApi.results).mockResolvedValue(listOf([meta()]))
    const w = mountTab()
    await flushPromises()
    await w.get(`[data-testid="result-delete-${KEY}"]`).trigger('click')
    useConfirm().settle(false)
    await flushPromises()
    expect(ratingsApi.deleteResult).not.toHaveBeenCalled()
    expect(ratingsApi.results).toHaveBeenCalledTimes(1)
  })

  it("batafsil ko'rinishda ham o'chiriladi va ro'yxatga qaytadi", async () => {
    asRole('superadmin')
    vi.mocked(ratingsApi.results)
      .mockResolvedValueOnce(listOf([meta()]))
      .mockResolvedValueOnce(listOf([]))
    vi.mocked(ratingsApi.result).mockResolvedValue(detail())
    vi.mocked(ratingsApi.deleteResult).mockResolvedValue({ id: 'r1' })
    const w = mountTab()
    await flushPromises()
    await w.get(`[data-testid="result-${KEY}"]`).trigger('click')
    await flushPromises()
    await w.get('[data-testid="results-detail-delete"]').trigger('click')
    useConfirm().settle(true)
    await flushPromises()
    expect(ratingsApi.deleteResult).toHaveBeenCalledWith('r1')
    expect(w.find('[data-testid="results-detail-title"]').exists()).toBe(false)
    expect(w.text()).toContain(uz.ratings.results.empty)
  })

  it("xato bo'lsa ro'yxat yangilanmaydi", async () => {
    asRole('superadmin')
    vi.mocked(ratingsApi.results).mockResolvedValue(listOf([meta()]))
    vi.mocked(ratingsApi.deleteResult).mockRejectedValue(new Error('x'))
    const w = mountTab()
    await flushPromises()
    await w.get(`[data-testid="result-delete-${KEY}"]`).trigger('click')
    useConfirm().settle(true)
    await flushPromises()
    expect(ratingsApi.results).toHaveBeenCalledTimes(1)
  })
})

describe('LatestWinnersCard', () => {
  it("oxirgi bo'sh bo'lmagan arxivning top 3 sini ko'rsatadi", async () => {
    vi.mocked(ratingsApi.results).mockResolvedValue({
      items: [meta({ id: 'empty', studentsCount: 0 }), meta()],
      meta: { page: 1, limit: 5, total: 2, totalPages: 1 },
    })
    vi.mocked(ratingsApi.result).mockResolvedValue(detail())
    const w = mount(LatestWinnersCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(ratingsApi.result).toHaveBeenCalledWith('r1')
    const card = w.get('[data-testid="latest-winners"]')
    expect(card.text()).toContain("O'tgan hafta g'oliblari")
    expect(card.text()).toContain('9–15-noyabr')
    expect(card.text()).toContain('Valiyev Vali')
  })

  it("arxiv yo'q yoki xato bo'lsa karta yashirin", async () => {
    vi.mocked(ratingsApi.results).mockRejectedValue(new Error('x'))
    const w = mount(LatestWinnersCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('[data-testid="latest-winners"]').exists()).toBe(false)
  })
})

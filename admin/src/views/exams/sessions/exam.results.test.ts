import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import type { ExamResultDetail, ExamResultRow, ExamResultsResponse, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'

const api = {
  sessionResults: vi.fn(),
  resultDetail: vi.fn(),
  gradeEssay: vi.fn(),
  publishResults: vi.fn(),
  resultsAnalysis: vi.fn(),
  downloadResults: vi.fn(),
  fetchAssetBlob: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import ExamResultsView from './ExamResultsView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
const click = async (el: Element | null) => {
  ;(el as HTMLElement).click()
  await flushPromises()
}
const setIn = async (id: string, v: string) => {
  const el = $(id) as HTMLInputElement
  el.value = v
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}

const row = (over: Partial<ExamResultRow>): ExamResultRow => ({
  key: 'k',
  kind: 'student',
  fullName: 'Ism',
  className: '7-A',
  status: 'submitted',
  earned: 5,
  max: 10,
  percent: 50,
  passed: null,
  answered: 3,
  total: 3,
  timeSpentSec: 600,
  warnings: 0,
  essayPending: 0,
  rank: 1,
  ...over,
})

const results = (over: Partial<ExamResultsResponse> = {}): ExamResultsResponse => ({
  session: {
    id: 'e1',
    title: 'Nazorat 1',
    status: 'closed',
    resultsMode: 'score',
    resultsPublished: false,
    publishedAt: null,
    passPercent: 60,
    scheduledStart: '2026-12-01T05:00:00.000Z',
    endsAt: '2026-12-01T05:40:00.000Z',
  },
  summary: {
    participants: 4,
    started: 3,
    submitted: 3,
    averagePercent: 61.7,
    maxPercent: 90,
    minPercent: 40,
    passPercent: 60,
    passRate: 66.7,
    passedCount: 2,
    essayPending: 1,
  },
  rows: [
    row({
      key: 'a',
      fullName: 'Aliyev Vali',
      percent: 90,
      earned: 9,
      rank: 1,
      passed: true,
      className: '7-A',
      timeSpentSec: 900,
    }),
    row({
      key: 'b',
      fullName: 'Bobur Karimov',
      percent: 55.5,
      earned: 5.5,
      rank: 2,
      passed: false,
      className: '7-B',
      essayPending: 1,
      timeSpentSec: 300,
    }),
    row({
      key: 'c',
      fullName: 'Zilola Rahimova',
      percent: 55.5,
      earned: 5.5,
      rank: 2,
      passed: false,
      className: '7-A',
      timeSpentSec: 1200,
    }),
    row({
      key: 'd',
      fullName: 'Dilnoza Yusupova',
      status: 'not_started',
      earned: null,
      max: null,
      percent: null,
      rank: null,
      passed: null,
      answered: 0,
      total: 0,
      timeSpentSec: null,
    }),
  ],
  ...over,
})

const detail = (): ExamResultDetail => ({
  participant: { key: 'b', fullName: 'Bobur Karimov', className: '7-B' },
  status: 'submitted',
  score: { earned: 5.5, max: 10, essayPending: 1 },
  percent: 55,
  questions: [
    {
      id: 'q1',
      index: 1,
      type: 'single',
      points: 2,
      content: [{ type: 'text', text: 'Bitta javob' }],
      options: [
        { id: 'a', content: [{ type: 'text', text: 'Birinchi' }] },
        { id: 'b', content: [{ type: 'text', text: 'Ikkinchi' }] },
      ],
      given: 'a',
      flagged: false,
      correct: { optionIds: ['b'] },
      got: 0,
      ok: false,
      graded: null,
      grade: null,
    },
    {
      id: 'q2',
      index: 2,
      type: 'essay',
      points: 5,
      content: [{ type: 'text', text: 'Esse savoli' }],
      options: [],
      given: '<img src=x onerror=alert(1)> Esse javobi',
      flagged: false,
      correct: { rubric: 'Mezon matni' },
      got: null,
      ok: null,
      graded: false,
      grade: null,
    },
  ],
})

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('t', {
    id: 'u1',
    role: 'school_admin',
    schoolId: 's1',
    permissions: [],
  } as unknown as User)
  const empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/exams/sessions/:id/results',
        name: 'exam-session-results',
        component: ExamResultsView,
      },
      { path: '/exams/sessions', name: 'exam-sessions', component: empty },
      { path: '/exams/sessions/:id', name: 'exam-session', component: empty },
    ],
  })
  await router.push('/exams/sessions/e1/results')
  await router.isReady()
  const w = mount(
    { template: '<RouterView />' },
    { global: { plugins: [pinia, i18n, router] }, attachTo: document.body },
  )
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  api.sessionResults.mockResolvedValue(results())
  api.resultDetail.mockResolvedValue(detail())
})

describe('ExamResultsView (natijalar)', () => {
  it('breadcrumb, umumiy ko`rsatkichlar va jadval (o`rinlar, %, o`tdi, esse belgisi)', async () => {
    const { w } = await mountView()
    expect(w.get('[data-testid="exam-breadcrumb"]').text()).toContain('Imtihonlar')
    expect(w.get('[data-testid="exam-breadcrumb"]').text()).toContain('Nazorat 1')
    expect(w.get('[data-testid="sum-participants"]').text()).toBe('4')
    expect(w.get('[data-testid="sum-submitted"]').text()).toBe('3')
    expect(w.get('[data-testid="sum-average"]').text()).toBe('61.7%')
    expect(w.get('[data-testid="sum-maxmin"]').text()).toBe('90 / 40')
    expect(w.get('[data-testid="sum-pass"]').text()).toBe('66.7%')
    const rows = w.findAll('[data-testid="result-row"]')
    expect(rows.map((r) => r.get('[data-testid="cell-rank"]').text())).toEqual(['1', '2', '2', '—'])
    expect(rows[0]!.get('[data-testid="cell-passed"]').text()).toBe('Ha')
    expect(rows[1]!.get('[data-testid="cell-passed"]').text()).toBe("Yo'q")
    expect(rows[1]!.get('[data-testid="essay-badge"]').text()).toContain('1 ta esse')
    expect(rows[3]!.get('[data-testid="cell-status"]').text()).toBe('Kirmagan')
    expect(rows[3]!.get('[data-testid="cell-score"]').text()).toBe('—')
  })

  it('o`tish bali belgilanmasa "O`tdi" ustuni va kartasi yo`q', async () => {
    const r = results()
    r.summary.passPercent = null
    r.summary.passRate = null
    api.sessionResults.mockResolvedValue(r)
    const { w } = await mountView()
    expect(w.find('[data-testid="sum-pass"]').exists()).toBe(false)
    expect(w.find('[data-testid="cell-passed"]').exists()).toBe(false)
  })

  it('filtrlar (qidiruv, sinf, holat) va saralash', async () => {
    const { w } = await mountView()
    const names = () => w.findAll('[data-testid="cell-name"]').map((x) => x.text())
    await w.get('[data-testid="filter-search"]').setValue('bobur')
    expect(names()).toEqual(['Bobur Karimov'])
    await w.get('[data-testid="filter-search"]').setValue('')
    await w.get('[data-testid="filter-class"]').setValue('7-A')
    expect(names()).toEqual(['Aliyev Vali', 'Zilola Rahimova', 'Dilnoza Yusupova'])
    await w.get('[data-testid="filter-status"]').setValue('not_started')
    expect(names()).toEqual(['Dilnoza Yusupova'])
    await w.get('[data-testid="filter-search"]').setValue('yo`q')
    expect(w.find('[data-testid="no-match"]').exists()).toBe(true)
    await w.get('[data-testid="filter-search"]').setValue('')
    await w.get('[data-testid="filter-class"]').setValue('')
    await w.get('[data-testid="filter-status"]').setValue('')
    await w.get('[data-testid="sort-name"]').trigger('click')
    expect(names()).toEqual(['Aliyev Vali', 'Bobur Karimov', 'Dilnoza Yusupova', 'Zilola Rahimova'])
    await w.get('[data-testid="sort-name"]').trigger('click') // teskari
    expect(names()[0]).toBe('Zilola Rahimova')
    await w.get('[data-testid="sort-time"]').trigger('click')
    expect(names()[0]).toBe('Bobur Karimov') // eng tez (300 s)
    await w.get('[data-testid="sort-percent"]').trigger('click')
    expect(names()[0]).toBe('Aliyev Vali')
  })

  it('ishtirokchi tafsiloti: javob/to`g`ri javob; esse oddiy matn (HTML ishlamaydi), mezon; baholash formasi validatsiyasi va saqlash', async () => {
    api.gradeEssay.mockResolvedValue({ earned: 8, max: 10, essayPending: 0 })
    const { w } = await mountView()
    await w.findAll('[data-testid="result-row"]')[1]!.trigger('click')
    await flushPromises()
    expect(api.resultDetail).toHaveBeenCalledWith('e1', 'b')
    const text = document.body.textContent ?? ''
    expect(text).toContain('Ikkinchi') // to'g'ri javob matni
    expect($('given').textContent).toContain('Birinchi')
    expect($('essay-rubric').textContent).toContain('Mezon matni')
    // HTML matn sifatida: <img> elementi yaratilmagan
    expect($('essay-text').textContent).toContain('<img src=x')
    expect(document.body.querySelector('[data-testid="essay-text"] img')).toBeNull()
    await setIn('grade-points', '5.3')
    await click($('grade-save'))
    expect(api.gradeEssay).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('0 dan 5 gacha')
    await setIn('grade-points', '6')
    await click($('grade-save'))
    expect(api.gradeEssay).not.toHaveBeenCalled()
    await setIn('grade-points', '3.5')
    await setIn('grade-comment', 'Yaxshi')
    await click($('grade-save'))
    expect(api.gradeEssay).toHaveBeenCalledWith('e1', 'b', 'q2', { points: 3.5, comment: 'Yaxshi' })
    // saqlangach qaytadan yuklanadi (umumiy ball yangilanishi uchun) va ro'yxat ham
    expect(api.sessionResults.mock.calls.length).toBeGreaterThan(1)
    expect(api.resultDetail.mock.calls.length).toBeGreaterThan(1)
    void w
  })

  it('e`lon qilish: after_publish rejimida tugma; esse kutilsa tasdiq; boshqa rejimlarda faqat ma`lumot', async () => {
    api.sessionResults.mockResolvedValue(
      results({ session: { ...results().session, resultsMode: 'after_publish' } }),
    )
    api.publishResults.mockResolvedValue({ published: true, publishedAt: 'x' })
    const { w } = await mountView()
    expect(w.find('[data-testid="immediate-info"]').exists()).toBe(false)
    expect(w.get('[data-testid="publish-state"]').text()).toBe(uz.examResults.publish.notPublished)
    await w.get('[data-testid="publish"]').trigger('click')
    await flushPromises()
    const c = useConfirm()
    expect(c.state.open).toBe(true)
    expect(c.state.options.message).toContain('1 ta esse')
    c.settle(true)
    await flushPromises()
    expect(api.publishResults).toHaveBeenCalledWith('e1', { published: true, confirmPending: true })
    // e'lon qilingan: qaytarib olish
    api.sessionResults.mockResolvedValue(
      results({
        session: { ...results().session, resultsMode: 'after_publish', resultsPublished: true },
      }),
    )
    const m = await mountView()
    expect(m.w.find('[data-testid="publish"]').exists()).toBe(false)
    api.publishResults.mockResolvedValue({ published: false, publishedAt: null })
    await m.w.get('[data-testid="unpublish"]').trigger('click')
    await flushPromises()
    expect(api.publishResults).toHaveBeenLastCalledWith('e1', {
      published: false,
      confirmPending: false,
    })
  })

  it('esse kutilmasa e`lon qilishda tasdiq so`ralmaydi; darhol rejimlarda tugma yo`q', async () => {
    const r = results({ session: { ...results().session, resultsMode: 'after_publish' } })
    r.summary.essayPending = 0
    api.sessionResults.mockResolvedValue(r)
    api.publishResults.mockResolvedValue({ published: true, publishedAt: 'x' })
    const { w } = await mountView()
    await w.get('[data-testid="publish"]').trigger('click')
    await flushPromises()
    expect(useConfirm().state.open).toBe(false)
    expect(api.publishResults).toHaveBeenCalledWith('e1', {
      published: true,
      confirmPending: false,
    })
    api.sessionResults.mockResolvedValue(
      results({ session: { ...results().session, resultsMode: 'score_answers' } }),
    )
    const m = await mountView()
    expect(m.w.get('[data-testid="immediate-info"]').text()).toBe(
      uz.examResults.publish.immediate.score_answers,
    )
    expect(m.w.find('[data-testid="publish"]').exists()).toBe(false)
  })

  it('savollar tahlili: tab ochilganda yuklanadi; ko`rsatkichlar va belgilar', async () => {
    api.resultsAnalysis.mockResolvedValue({
      submittedAttempts: 4,
      questions: [
        {
          id: 'q1',
          index: 1,
          type: 'single',
          points: 2,
          content: [{ type: 'text', text: 'Oson savol' }],
          shown: 4,
          answered: 4,
          correctPercent: 100,
          averagePoints: 2,
          options: [
            {
              id: 'a',
              content: [{ type: 'text', text: 'To`g`ri' }],
              chosen: 4,
              percent: 100,
              correct: true,
            },
            {
              id: 'b',
              content: [{ type: 'text', text: 'Xato' }],
              chosen: 0,
              percent: 0,
              correct: false,
            },
          ],
          flags: ['too_easy'],
        },
        {
          id: 'q2',
          index: 2,
          type: 'single',
          points: 1,
          content: [{ type: 'text', text: 'Qiyin savol' }],
          shown: 4,
          answered: 4,
          correctPercent: 0,
          averagePoints: 0,
          options: [
            {
              id: 'a',
              content: [{ type: 'text', text: 'Chalg`ituvchi' }],
              chosen: 4,
              percent: 100,
              correct: false,
            },
          ],
          flags: ['too_hard', 'distractor'],
        },
      ],
    })
    const { w } = await mountView()
    expect(api.resultsAnalysis).not.toHaveBeenCalled()
    await w.get('[data-testid="tab-analysis"]').trigger('click')
    await flushPromises()
    expect(api.resultsAnalysis).toHaveBeenCalledWith('e1')
    const qs = w.findAll('[data-testid="analysis-question"]')
    expect(qs).toHaveLength(2)
    expect(qs[0]!.get('[data-testid="q-correct"]').text()).toContain('100%')
    expect(qs[0]!.get('[data-testid="q-flag"]').text()).toBe('Juda oson')
    expect(qs[1]!.findAll('[data-testid="q-flag"]').map((x) => x.text())).toEqual([
      'Juda qiyin',
      "Chalg'ituvchi variant ko'p tanlangan",
    ])
    expect(w.find('[data-testid="results-table"]').exists()).toBe(false)
    await w.get('[data-testid="tab-results"]').trigger('click')
    expect(w.find('[data-testid="results-table"]').exists()).toBe(true)
    await w.get('[data-testid="tab-analysis"]').trigger('click')
    expect(api.resultsAnalysis).toHaveBeenCalledTimes(1) // keshlangan
  })

  it('tahlil: topshirilgan ish yo`q bo`lsa bo`sh holat', async () => {
    api.resultsAnalysis.mockResolvedValue({ submittedAttempts: 0, questions: [] })
    const { w } = await mountView()
    await w.get('[data-testid="tab-analysis"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="analysis-empty"]').exists()).toBe(true)
  })

  it('eksport tugmalari API ni to`g`ri format bilan chaqiradi', async () => {
    api.downloadResults.mockResolvedValue('x')
    const { w } = await mountView()
    await w.get('[data-testid="export-xlsx"]').trigger('click')
    await w.get('[data-testid="export-pdf"]').trigger('click')
    await flushPromises()
    expect(api.downloadResults).toHaveBeenNthCalledWith(1, 'e1', 'xlsx')
    expect(api.downloadResults).toHaveBeenNthCalledWith(2, 'e1', 'pdf')
  })

  it('yuklash xatosi: xabar', async () => {
    api.sessionResults.mockRejectedValue(new Error('x'))
    const { w } = await mountView()
    expect(w.text()).toContain(uz.examResults.loadFailed)
  })
})

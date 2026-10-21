import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { Role, SchoolClass, Subject, Teacher } from '@/api/types'
import { classesApi } from '@/api/classes.api'
import { scoresApi } from '@/api/scores.api'
import SubjectAssignmentsEditor from '@/components/domain/SubjectAssignmentsEditor.vue'
import RatingWeightsEditor from '@/components/settings/RatingWeightsEditor.vue'
import { useAuthStore } from '@/stores/auth'
import { DEFAULT_RATING, validateRating } from '@/utils/ratingForm'
import { formatSetting } from '@/utils/settingsFormat'
import { NAV_ITEMS } from '@/constants/navigation'
import { canAccess } from '@/router/guards'
import ConductPanel from './ConductPanel.vue'
import GradeButtons from './GradeButtons.vue'

vi.mock('@/api/classes.api', () => ({ classesApi: { list: vi.fn() } }))
vi.mock('@/api/scores.api', () => ({ scoresApi: { todayProgress: vi.fn() } }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const t = (k: string) => k

const subjects = [
  { id: 's1', name: 'Matematika', isActive: true },
  { id: 's2', name: 'Fizika', isActive: true },
  { id: 's3', name: 'Eski fan', isActive: false },
] as Subject[]
const teachers = [
  { id: 't1', fullName: 'Aliyev A.' },
  { id: 't2', fullName: 'Valiyev V.' },
] as Teacher[]

describe('GradeButtons', () => {
  it('2/3/4/5 tugmalari; tanlanganini belgilaydi va qiymat chiqaradi', async () => {
    const w = mount(GradeButtons, {
      props: { modelValue: 4 },
      global: { plugins: [i18n] },
    })
    const btns = w.findAll('button[role="radio"]')
    expect(btns.map((b) => b.text())).toEqual(['2', '3', '4', '5'])
    expect(btns.map((b) => b.attributes('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ])
    await btns[3]!.trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([5])
  })

  it('disabled bo`lsa bosilmaydi', async () => {
    const w = mount(GradeButtons, {
      props: { modelValue: null, disabled: true },
      global: { plugins: [i18n] },
    })
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })
})

describe('SubjectAssignmentsEditor', () => {
  const mountEditor = (modelValue: { subjectId: string; teacherId: string }[]) =>
    mount(SubjectAssignmentsEditor, {
      props: { modelValue, subjects, teachers },
      global: { plugins: [i18n] },
    })

  it("qator qo'shadi va olib tashlaydi", async () => {
    const w = mountEditor([{ subjectId: 's1', teacherId: 't1' }])
    expect(w.findAll('[data-testid="assignment-row"]')).toHaveLength(1)
    const buttons = w.findAll('button')
    // oxirgi tugma - "Fan qo'shish"
    await buttons[buttons.length - 1]!.trigger('click')
    expect(w.emitted('update:modelValue')![0]![0]).toEqual([
      { subjectId: 's1', teacherId: 't1' },
      { subjectId: '', teacherId: '' },
    ])
    await buttons[0]!.trigger('click')
    expect(w.emitted('update:modelValue')![1]![0]).toEqual([])
  })

  it('boshqa qatorda tanlangan fan ikkinchi qatorda ko`rinmaydi; nofaol fan faqat o`zida', () => {
    const w = mountEditor([
      { subjectId: 's1', teacherId: 't1' },
      { subjectId: 's3', teacherId: 't2' },
    ])
    const selects = w.findAll('select')
    const opts = (i: number) => selects[i]!.findAll('option').map((o) => o.element.value)
    // 1-qator (fan): s1 + s2 (s3 nofaol va boshqa qatorda), 2-qator: s3 (o'zi) + s2
    expect(opts(0)).toContain('s1')
    expect(opts(0)).not.toContain('s3')
    expect(opts(2)).toContain('s3')
    expect(opts(2)).not.toContain('s1')
  })

  it("o'zgargan fan/o'qituvchi tanlovi chiqariladi", async () => {
    const w = mountEditor([{ subjectId: '', teacherId: '' }])
    const selects = w.findAll('select')
    await selects[0]!.setValue('s2')
    expect(w.emitted('update:modelValue')![0]![0]).toEqual([{ subjectId: 's2', teacherId: '' }])
    await selects[1]!.setValue('t2')
    expect(w.emitted('update:modelValue')![1]![0]).toEqual([{ subjectId: '', teacherId: 't2' }])
  })
})

describe('RatingWeightsEditor va sozlamalar', () => {
  it('bittasini o`zgartirsa ikkinchisi 100 gacha to`ldiriladi', async () => {
    const w = mount(RatingWeightsEditor, {
      props: { modelValue: { conduct: 50, subjects: 50 } },
      global: { plugins: [i18n] },
    })
    const inputs = w.findAll('input')
    await inputs[0]!.setValue('70')
    expect(w.emitted('update:modelValue')![0]![0]).toEqual({ conduct: 70, subjects: 30 })
    await inputs[1]!.setValue('150') // 0..100 ga qisqartiriladi
    expect(w.emitted('update:modelValue')![1]![0]).toEqual({ conduct: 0, subjects: 100 })
    await inputs[0]!.setValue('')
    const last = w.emitted('update:modelValue')!.at(-1)![0] as { conduct: number }
    expect(Number.isNaN(last.conduct)).toBe(true)
  })

  it('validateRating: yig`indi 100 va butun son shart', () => {
    expect(validateRating(DEFAULT_RATING, t)).toEqual({})
    expect(
      validateRating({ ...DEFAULT_RATING, weights: { conduct: 60, subjects: 50 } }, t).weights,
    ).toBe('settingsRating.errors.weightsSum')
    expect(
      validateRating({ ...DEFAULT_RATING, weights: { conduct: 50.5, subjects: 49.5 } }, t).weights,
    ).toBe('settingsRating.errors.weightsInt')
    expect(
      validateRating({ ...DEFAULT_RATING, weights: { conduct: NaN, subjects: 50 } }, t).weights,
    ).toBe('settingsRating.errors.weightsInt')
    expect(
      validateRating({ ...DEFAULT_RATING, weights: { conduct: -10, subjects: 110 } }, t).weights,
    ).toBe('settingsRating.errors.weightsInt')
    expect(
      validateRating({ ...DEFAULT_RATING, weights: { conduct: 100, subjects: 0 } }, t),
    ).toEqual({})
  })

  it('formatSetting weights', () => {
    const tt = (k: string, p?: Record<string, unknown>) => `${k}:${p?.conduct}/${p?.subjects}`
    expect(formatSetting(tt, 'weights', { conduct: 70, subjects: 30 })).toBe(
      'settingsRating.weightsSummary:70/30',
    )
  })
})

describe('menyu ruxsatlari', () => {
  const ctxOf = (role: Role, permissions: string[]) => ({
    hasRole: (roles?: Role[]) => !roles || roles.length === 0 || roles.includes(role),
    hasPermission: (p?: string) => !p || role === 'superadmin' || permissions.includes(p),
  })
  const names = (c: ReturnType<typeof ctxOf>) =>
    NAV_ITEMS.filter((i) => canAccess(c, i)).map((i) => i.name)

  it('Fanlar sahifasi subjects.manage ruxsati bilan (superadmin doim)', () => {
    expect(names(ctxOf('school_admin', ['classes.manage']))).not.toContain('subjects')
    expect(names(ctxOf('school_admin', ['subjects.manage']))).toContain('subjects')
    expect(names(ctxOf('superadmin', []))).toContain('subjects')
    expect(names(ctxOf('teacher', ['scores.create']))).not.toContain('subjects')
  })

  it("Fan baholari menyusi: grades.create bor o'qituvchi/admin uchun", () => {
    expect(names(ctxOf('teacher', ['scores.create', 'grades.create']))).toContain('grading')
    expect(names(ctxOf('teacher', ['scores.create']))).not.toContain('grading')
    expect(names(ctxOf('school_admin', ['grades.create']))).toContain('grading')
    expect(names(ctxOf('school_admin', ['dashboard.view']))).not.toContain('grading')
  })
})

describe('ConductPanel: xulq bahosi faqat sinf rahbari uchun', () => {
  const classes = [
    { id: 'c1', name: '5-A', homeroomTeacherId: 'me', studentsCount: 20 },
    { id: 'c2', name: '6-A', homeroomTeacherId: 'other', studentsCount: 22 },
  ] as SchoolClass[]

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(classesApi.list).mockResolvedValue({
      items: classes,
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    })
    vi.mocked(scoresApi.todayProgress).mockResolvedValue([])
  })

  function login(role: Role, id: string) {
    useAuthStore().setSession('tok', {
      id,
      role,
      fullName: 'X',
      username: 'x',
      schoolId: 's',
      permissions: [],
      isActive: true,
      lastLoginAt: null,
      createdAt: '',
    })
  }
  const stubs = { RouterLink: { template: '<a><slot /></a>' } }

  it("o'qituvchiga faqat o'zi rahbar bo'lgan sinflar ko'rinadi", async () => {
    login('teacher', 'me')
    const w = mount(ConductPanel, { global: { plugins: [i18n], stubs } })
    await flushPromises()
    expect(w.findAll('[data-testid="conduct-link"]')).toHaveLength(1)
    expect(w.text()).toContain('5-A')
    expect(w.text()).not.toContain('6-A')
  })

  it("sinf rahbari bo'lmagan o'qituvchiga aniq xabar", async () => {
    login('teacher', 'nobody')
    const w = mount(ConductPanel, { global: { plugins: [i18n], stubs } })
    await flushPromises()
    expect(w.find('[data-testid="conduct-not-homeroom"]').exists()).toBe(true)
    expect(w.text()).toContain('Siz sinf rahbari emassiz')
    expect(w.findAll('[data-testid="conduct-link"]')).toHaveLength(0)
  })

  it('admin barcha sinflarni ko`radi', async () => {
    login('school_admin', 'adm')
    const w = mount(ConductPanel, { global: { plugins: [i18n], stubs } })
    await flushPromises()
    expect(w.findAll('[data-testid="conduct-link"]')).toHaveLength(2)
  })
})

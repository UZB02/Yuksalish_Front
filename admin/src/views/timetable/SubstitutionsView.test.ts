import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import {
  timetableApi,
  type DayLessonDto,
  type FreeTeacher,
  type OverrideDto,
} from '@/api/timetable.api'
import type { User } from '@/api/types'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import SubstitutionsView from './SubstitutionsView.vue'

vi.mock('@/api/timetable.api', () => ({
  timetableApi: {
    options: vi.fn(),
    overview: vi.fn(),
    teacherDay: vi.fn(),
    overrides: vi.fn(),
    freeTeachers: vi.fn(),
    createOverride: vi.fn(),
    moveLesson: vi.fn(),
    deleteOverride: vi.fn(),
  },
}))
const api = vi.mocked(timetableApi)
const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const user: User = {
  id: 'u1',
  fullName: 'Admin',
  username: 'a',
  role: 'school_admin',
  schoolId: 's1',
  permissions: ['timetable.substitute'],
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
}

const lesson = (over: Partial<DayLessonDto> = {}): DayLessonDto => ({
  classId: 'c1',
  class: { id: 'c1', name: '2-B' },
  lessonNo: 2,
  subject: { id: 'math', name: 'Matematika' },
  teacher: { id: 't1', fullName: 'Aliyev Vali' },
  originalTeacher: null,
  source: 'timetable',
  overrideType: null,
  overrideId: null,
  cancelled: false,
  ...over,
})
const ov = (over: Partial<OverrideDto> = {}): OverrideDto => ({
  id: 'o1',
  classId: 'c1',
  class: { id: 'c1', name: '2-B' },
  date: '2026-11-02',
  lessonNo: 2,
  type: 'substitute',
  subject: { id: 'math', name: 'Matematika' },
  teacher: { id: 't2', fullName: 'Karimov Sami' },
  originalSubject: { id: 'math', name: 'Matematika' },
  originalTeacher: { id: 't1', fullName: 'Aliyev Vali' },
  room: null,
  reason: 'Kasal',
  moveGroupId: null,
  createdAt: '2026-11-01T00:00:00Z',
  createdBy: { id: 'u1', fullName: 'Admin' },
  ...over,
})
const FREE: FreeTeacher[] = [
  { id: 't2', fullName: 'Karimov Sami', free: true, teachesSubject: true, lessonsThatDay: 3 },
  { id: 't3', fullName: 'Band Olim', free: false, teachesSubject: false, lessonsThatDay: 6 },
]

let wrapper: VueWrapper | null = null
const body = () => document.body

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('tok', user)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(SubstitutionsView, {
    global: { plugins: [pinia, i18n, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

/** BaseSelect (combobox): qiymatni to'g'ridan-to'g'ri o'rnatish */
async function pick(testid: string, value: string) {
  const sel = wrapper!
    .findAllComponents(BaseSelect)
    .find((c) => c.vm.$attrs['data-testid'] === testid)
  expect(sel, testid).toBeTruthy()
  sel!.vm.$emit('update:modelValue', value)
  await flushPromises()
}
const pickAbsentTeacher = () => pick('absent-teacher', 't1')
async function click(sel: string) {
  const el = body().querySelector<HTMLElement>(sel)
  expect(el, sel).toBeTruthy()
  el!.click()
  await flushPromises()
}
const err = () => body().querySelector('[data-testid="override-error"]')?.textContent?.trim()
const submitBtn = () => body().querySelector<HTMLButtonElement>('[data-testid="override-submit"]')!

beforeEach(() => {
  vi.clearAllMocks()
  api.options.mockResolvedValue({
    subjects: [
      { id: 'math', name: 'Matematika' },
      { id: 'eng', name: 'Ingliz tili' },
    ],
    teachers: [
      { id: 't1', fullName: 'Aliyev Vali' },
      { id: 't2', fullName: 'Karimov Sami' },
    ],
    classAssignments: [],
    subjectTeachers: {},
  })
  api.overview.mockResolvedValue({
    today: '2026-11-02',
    classes: [{ classId: 'c1', name: '2-B', grade: 2 } as never],
  })
  api.overrides.mockResolvedValue({ items: [] })
  api.teacherDay.mockResolvedValue({ date: '2026-11-02', isWorkday: true, lessons: [lesson()] })
  api.freeTeachers.mockResolvedValue({ items: FREE })
  api.createOverride.mockResolvedValue(ov())
  api.deleteOverride.mockResolvedValue(undefined as never)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  useConfirm().settle(false)
})

describe('SubstitutionsView', () => {
  it('yuklanganda sana uchun ozgarishlar soraladi; oqituvchi tanlanmaguncha darslar yoq', async () => {
    const w = await mountView()
    expect(api.overrides).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(api.teacherDay).not.toHaveBeenCalled()
    expect(w.text()).toContain(uz.substitutions.pickTeacher)
    expect(w.find('[data-testid="changes-empty"]').exists()).toBe(true)
  })

  it('sana almashtirilganda ozgarishlar qayta yuklanadi', async () => {
    const w = await mountView()
    api.overrides.mockClear()
    await w.get('[data-testid="day-next"]').trigger('click')
    await flushPromises()
    expect(api.overrides).toHaveBeenCalledTimes(1)
  })

  it('oqituvchi tanlanganda uning kun darslari yuklanadi', async () => {
    const w = await mountView()
    await pickAbsentTeacher()
    expect(api.teacherDay).toHaveBeenCalledWith(expect.any(String), 't1')
    const rows = w.findAll('[data-testid="day-lesson"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('2-B · 2-dars · Matematika')
    for (const a of ['substitute', 'cancel', 'move', 'replace']) {
      expect(rows[0]!.find(`[data-testid="act-${a}"]`).exists()).toBe(true)
    }
  })

  it('dam olish kuni xabari', async () => {
    api.teacherDay.mockResolvedValue({ date: '2026-11-01', isWorkday: false, lessons: [] })
    const w = await mountView()
    await pickAbsentTeacher()
    expect(w.find('[data-testid="not-workday"]').exists()).toBe(true)
    expect(w.find('[data-testid="lessons-empty"]').exists()).toBe(true)
  })

  it('orinbosar: bosh/band belgilari, band tanlanmaydi, togri body yuboriladi', async () => {
    const w = await mountView()
    await pickAbsentTeacher()
    await w.get('[data-testid="act-substitute"]').trigger('click')
    await flushPromises()
    expect(api.freeTeachers).toHaveBeenCalledWith(expect.any(String), 2, 'math')
    const free = body().querySelector('[data-testid="teacher-t2"]')!
    expect(free.textContent).toContain(uz.substitutions.picker.free)
    expect(free.textContent).toContain(uz.substitutions.picker.teachesSubject)
    const busy = body().querySelector<HTMLButtonElement>('[data-testid="teacher-t3"]')!
    expect(busy.disabled).toBe(true)
    expect(busy.textContent).toContain(uz.substitutions.picker.busy)
    expect(submitBtn().disabled).toBe(true)

    await click('[data-testid="teacher-t2"]')
    await click('[data-testid="override-submit"]')
    expect(api.createOverride).toHaveBeenCalledWith({
      classId: 'c1',
      date: expect.any(String),
      lessonNo: 2,
      type: 'substitute',
      teacherId: 't2',
    })
    expect(useToast().toasts.some((x) => x.message === uz.substitutions.toast.substitute)).toBe(
      true,
    )
    expect(api.teacherDay).toHaveBeenCalledTimes(2)
  })

  it('409 xatosi: server xabari oynada korsatiladi, oyna yopilmaydi', async () => {
    api.createOverride.mockRejectedValue(new ApiError('CONFLICT', 'Oqituvchi shu darsda band', 409))
    const w = await mountView()
    await pickAbsentTeacher()
    await w.get('[data-testid="act-substitute"]').trigger('click')
    await flushPromises()
    await click('[data-testid="teacher-t2"]')
    await click('[data-testid="override-submit"]')
    expect(err()).toBe('Oqituvchi shu darsda band')
    expect(submitBtn()).toBeTruthy()
  })

  it('bekor qilish: sabab bilan, faqat kerakli maydonlar', async () => {
    const w = await mountView()
    await pickAbsentTeacher()
    await w.get('[data-testid="act-cancel"]').trigger('click')
    await flushPromises()
    const reason = body().querySelector<HTMLInputElement>('[data-testid="reason"]')!
    reason.value = ' Kasal '
    reason.dispatchEvent(new Event('input'))
    await click('[data-testid="override-submit"]')
    expect(api.createOverride).toHaveBeenCalledWith({
      classId: 'c1',
      date: expect.any(String),
      lessonNo: 2,
      type: 'cancel',
      reason: 'Kasal',
    })
  })

  it('fanni almashtirish: fan + oqituvchi yuboriladi', async () => {
    const w = await mountView()
    await pickAbsentTeacher()
    await w.get('[data-testid="act-replace"]').trigger('click')
    await flushPromises()
    expect(api.options).toHaveBeenCalledWith('c1')
    await pick('subject-select', 'eng')
    expect(api.freeTeachers).toHaveBeenLastCalledWith(expect.any(String), 2, 'eng')
    await click('[data-testid="teacher-t2"]')
    await click('[data-testid="override-submit"]')
    expect(api.createOverride).toHaveBeenCalledWith({
      classId: 'c1',
      date: expect.any(String),
      lessonNo: 2,
      type: 'replace',
      subjectId: 'eng',
      teacherId: 't2',
    })
  })

  it('kochirish: yangi sana va dars raqami (oqituvchi ixtiyoriy)', async () => {
    api.moveLesson.mockResolvedValue({ items: [ov(), ov({ id: 'o2' })] })
    const w = await mountView()
    await pickAbsentTeacher()
    await w.get('[data-testid="act-move"]').trigger('click')
    await flushPromises()
    const d = body().querySelector<HTMLInputElement>('[data-testid="move-date"]')!
    d.value = '2026-11-05'
    d.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(submitBtn().disabled).toBe(true)
    await pick('move-lesson', '4')
    await click('[data-testid="override-submit"]')
    expect(api.moveLesson).toHaveBeenCalledWith({
      classId: 'c1',
      from: { date: expect.any(String), lessonNo: 2 },
      to: { date: '2026-11-05', lessonNo: 4 },
      teacherId: undefined,
      reason: undefined,
    })
  })

  it('qoshimcha dars: sinf, dars, fan, oqituvchi', async () => {
    const w = await mountView()
    await w.get('[data-testid="add-extra"]').trigger('click')
    await flushPromises()
    expect(api.overview).toHaveBeenCalled()
    await pick('extra-class', 'c1')
    expect(api.options).toHaveBeenCalledWith('c1')
    await pick('extra-lesson', '6')
    await pick('subject-select', 'eng')
    await click('[data-testid="teacher-t2"]')
    await click('[data-testid="override-submit"]')
    expect(api.createOverride).toHaveBeenCalledWith({
      classId: 'c1',
      date: expect.any(String),
      lessonNo: 6,
      type: 'extra',
      subjectId: 'eng',
      teacherId: 't2',
    })
  })

  it('ozgarishlar royxati: turi, asl -> yangi oqituvchi, sabab; tartiblangan', async () => {
    api.overrides.mockResolvedValue({
      items: [
        ov({ id: 'o9', class: { id: 'c2', name: '5-A' }, lessonNo: 1 }),
        ov({ id: 'o3', type: 'cancel', teacher: null, reason: null, lessonNo: 4 }),
        ov({ id: 'o1' }),
      ],
    })
    const w = await mountView()
    const items = w.findAll('[data-testid="change-item"]')
    expect(items).toHaveLength(3)
    expect(items[0]!.text()).toContain('2-B · 2-dars')
    expect(items[1]!.text()).toContain('2-B · 4-dars')
    expect(items[2]!.text()).toContain('5-A')
    expect(items[0]!.text()).toContain(uz.substitutions.type.substitute)
    expect(items[0]!.text()).toContain('Aliyev Vali → Karimov Sami')
    expect(items[0]!.text()).toContain('Sabab: Kasal')
    expect(items[1]!.text()).toContain(uz.substitutions.type.cancel)
  })

  it('kochirilgan juftlik Kochirildi belgisi bilan', async () => {
    api.overrides.mockResolvedValue({ items: [ov({ moveGroupId: 'g1', type: 'cancel' })] })
    const w = await mountView()
    expect(w.get('[data-testid="change-item"]').text()).toContain(uz.substitutions.type.moved)
  })

  it('undo: tasdiqlansa DELETE va qayta yuklash', async () => {
    api.overrides.mockResolvedValue({ items: [ov()] })
    const w = await mountView()
    api.overrides.mockClear()
    await w.get('[data-testid="change-undo"]').trigger('click')
    useConfirm().settle(true)
    await flushPromises()
    expect(api.deleteOverride).toHaveBeenCalledWith('o1')
    expect(api.overrides).toHaveBeenCalledTimes(1)
  })

  it('undo rad etilsa hech narsa ochmaydi', async () => {
    api.overrides.mockResolvedValue({ items: [ov()] })
    const w = await mountView()
    await w.get('[data-testid="change-undo"]').trigger('click')
    useConfirm().settle(false)
    await flushPromises()
    expect(api.deleteOverride).not.toHaveBeenCalled()
  })

  it('almashtirilgan darsda belgi va undo korinadi, amallar yoq', async () => {
    api.teacherDay.mockResolvedValue({
      date: '2026-11-02',
      isWorkday: true,
      lessons: [
        lesson({
          overrideType: 'substitute',
          overrideId: 'o1',
          source: 'override',
          teacher: { id: 't2', fullName: 'Karimov Sami' },
          originalTeacher: { id: 't1', fullName: 'Aliyev Vali' },
        }),
      ],
    })
    const w = await mountView()
    await pickAbsentTeacher()
    const row = w.get('[data-testid="day-lesson"]')
    expect(row.text()).toContain(uz.substitutions.type.substitute)
    expect(row.find('[data-testid="act-substitute"]').exists()).toBe(false)
    await row.get('[data-testid="lesson-undo"]').trigger('click')
    useConfirm().settle(true)
    await flushPromises()
    expect(api.deleteOverride).toHaveBeenCalledWith('o1')
  })

  it('bir soatda ikkita dars: har bir qator alohida, amal aynan tanlangan darsga (targetTeacherId)', async () => {
    api.teacherDay.mockResolvedValue({
      date: '2026-11-02',
      isWorkday: true,
      lessons: [
        lesson({
          subject: { id: 'eng', name: 'Ingliz tili' },
          teacher: { id: 't1', fullName: 'Aliyeva' },
          targetTeacherId: 't1',
        }),
        lesson({
          subject: { id: 'eng', name: 'Ingliz tili' },
          teacher: { id: 't9', fullName: "G'aniyeva" },
          targetTeacherId: 't9',
        }),
      ],
    })
    const w = await mountView()
    await pickAbsentTeacher()
    const rows = w.findAll('[data-testid="day-lesson"]')
    expect(rows).toHaveLength(2)
    // ikkinchi (G'aniyeva) darsini bekor qilish
    await rows[1]!.get('[data-testid="act-cancel"]').trigger('click')
    await flushPromises()
    expect(body().textContent).toContain("G'aniyeva")
    await click('[data-testid="override-submit"]')
    expect(api.createOverride).toHaveBeenCalledWith({
      classId: 'c1',
      date: expect.any(String),
      lessonNo: 2,
      type: 'cancel',
      targetTeacherId: 't9',
    })
    // o'rinbosar ham o'z darsiga
    api.createOverride.mockClear()
    await w
      .findAll('[data-testid="day-lesson"]')[0]!
      .get('[data-testid="act-substitute"]')
      .trigger('click')
    await flushPromises()
    await click('[data-testid="teacher-t2"]')
    await click('[data-testid="override-submit"]')
    expect(api.createOverride).toHaveBeenCalledWith({
      classId: 'c1',
      date: expect.any(String),
      lessonNo: 2,
      type: 'substitute',
      targetTeacherId: 't1',
      teacherId: 't2',
    })
  })

  it("kochirish: manba darsning targetTeacherId si from ga qo'shiladi", async () => {
    api.teacherDay.mockResolvedValue({
      date: '2026-11-02',
      isWorkday: true,
      lessons: [lesson({ targetTeacherId: 't1' })],
    })
    api.moveLesson.mockResolvedValue({ items: [ov(), ov({ id: 'o2' })] })
    const w = await mountView()
    await pickAbsentTeacher()
    await w.get('[data-testid="act-move"]').trigger('click')
    await flushPromises()
    const d = body().querySelector<HTMLInputElement>('[data-testid="move-date"]')!
    d.value = '2026-11-05'
    d.dispatchEvent(new Event('input'))
    await flushPromises()
    await pick('move-lesson', '4')
    await click('[data-testid="override-submit"]')
    expect(api.moveLesson).toHaveBeenCalledWith({
      classId: 'c1',
      from: { date: expect.any(String), lessonNo: 2, targetTeacherId: 't1' },
      to: { date: '2026-11-05', lessonNo: 4 },
      teacherId: undefined,
      reason: undefined,
    })
  })

  it('ozgarishlarni yuklash xatosi korsatiladi', async () => {
    api.overrides.mockRejectedValue(new ApiError('INTERNAL', 'x', 500))
    const w = await mountView()
    expect(w.find('[data-testid="changes-error"]').exists()).toBe(true)
  })
})

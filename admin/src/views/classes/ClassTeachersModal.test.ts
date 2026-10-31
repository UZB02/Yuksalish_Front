import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { SchoolClass, Subject, Teacher } from '@/api/types'
import { classesApi } from '@/api/classes.api'
import { subjectsApi } from '@/api/subjects.api'
import { __resetBodyLock } from '@/composables/useBodyLock'
import ClassTeachersModal from './ClassTeachersModal.vue'

vi.mock('@/api/classes.api', () => ({ classesApi: { update: vi.fn() } }))
vi.mock('@/api/subjects.api', () => ({ subjectsApi: { list: vi.fn() } }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const page = <T>(items: T[]) => ({
  items,
  meta: { page: 1, limit: 100, total: items.length, totalPages: 1 },
})
const teachers = [
  { id: 't1', fullName: 'Aliyev A.' },
  { id: 't2', fullName: 'Karimov K.' },
  { id: 't3', fullName: 'Saidova S.' },
  { id: 't4', fullName: 'Nazarov N.' },
] as Teacher[]
const subjects = [
  { id: 's1', name: 'Matematika', isActive: true },
  { id: 's2', name: 'Fizika', isActive: true },
] as Subject[]
const klass = {
  id: 'c1',
  name: '7-A',
  homeroomTeacherId: 't1',
  // t1 - rahbar, t2 - fan o'qituvchisi, t3 - fansiz qo'shimcha
  teacherIds: ['t1', 't2', 't3'],
  subjects: [{ subjectId: 's1', subject: null, teacherId: 't2', teacher: null }],
} as unknown as SchoolClass

function mountModal() {
  return mount(ClassTeachersModal, {
    props: { open: true, schoolClass: klass, teachers },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

beforeEach(() => {
  vi.mocked(subjectsApi.list).mockResolvedValue(page(subjects))
  vi.mocked(classesApi.update).mockResolvedValue(klass)
})
afterEach(() => {
  document.body.innerHTML = ''
  __resetBodyLock()
  vi.clearAllMocks()
})

const body = () => document.body

describe('ClassTeachersModal: rahbar, fanlar va qo`shimcha o`qituvchilar', () => {
  it('mavjud biriktirishlar to`ldiriladi; qo`shimchalarda rahbar va fan o`qituvchisi chiqmaydi', async () => {
    const w = mountModal()
    await flushPromises()
    expect(body().querySelectorAll('[data-testid="assignment-row"]')).toHaveLength(1)
    const extras = body().querySelector('[data-testid="assign-extras"]')!
    expect(extras.textContent).toContain('Saidova S.')
    expect(extras.textContent).toContain('Nazarov N.')
    expect(extras.textContent).not.toContain('Aliyev A.')
    expect(extras.textContent).not.toContain('Karimov K.')
    expect(extras.textContent).toContain('(1)')
    w.unmount()
  })

  it('bitta PATCH bilan saqlaydi: rahbar, fanlar va faqat fansiz qo`shimchalar', async () => {
    const w = mountModal()
    await flushPromises()
    ;(body().querySelector('[data-testid="assign-save"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(classesApi.update).toHaveBeenCalledWith('c1', {
      homeroomTeacherId: 't1',
      teacherIds: ['t3'],
      subjects: [{ subjectId: 's1', teacherId: 't2' }],
    })
    expect(w.emitted('saved')).toHaveLength(1)
    w.unmount()
  })

  it("bir fanga ikkinchi o'qituvchi: fan boshqa qatorda ham tanlanadi, ikkala juftlik saqlanadi; aynan takror bloklanadi", async () => {
    const w = mountModal()
    await flushPromises()
    const add = Array.from(body().querySelectorAll('button')).find((b) =>
      b.textContent?.includes(uz.classes.addSubject),
    )!
    add.click()
    await flushPromises()
    const rows = body().querySelectorAll('[data-testid="assignment-row"]')
    expect(rows).toHaveLength(2)
    const [subjSel, teachSel] = Array.from(
      rows[1]!.querySelectorAll('select'),
    ) as HTMLSelectElement[]
    // Matematika (1-qatorda tanlangan) 2-qator uchun ham tanlanadi
    expect(Array.from(subjSel!.options).map((o) => o.value)).toContain('s1')
    subjSel!.value = 's1'
    subjSel!.dispatchEvent(new Event('change'))
    await flushPromises()
    // t2 (s1 ga allaqachon biriktirilgan) bu qatorda taklif qilinmaydi
    const second = body().querySelectorAll('[data-testid="assignment-row"]')[1]!
    const tsel = second.querySelectorAll('select')[1] as HTMLSelectElement
    expect(Array.from(tsel.options).map((o) => o.value)).not.toContain('t2')
    expect(Array.from(tsel.options).map((o) => o.value)).toContain('t4')
    void teachSel
    tsel.value = 't4'
    tsel.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(body().querySelector('[data-testid="assignment-duplicate"]')).toBeNull()
    ;(body().querySelector('[data-testid="assign-save"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(classesApi.update).toHaveBeenCalledWith('c1', {
      homeroomTeacherId: 't1',
      teacherIds: ['t3'],
      subjects: [
        { subjectId: 's1', teacherId: 't2' },
        { subjectId: 's1', teacherId: 't4' },
      ],
    })
    w.unmount()
  })

  it('to`liq bo`lmagan fan qatori bilan saqlanmaydi', async () => {
    const w = mountModal()
    await flushPromises()
    const add = Array.from(body().querySelectorAll('button')).find((b) =>
      b.textContent?.includes(uz.classes.addSubject),
    )
    expect(add).toBeTruthy()
    add!.click()
    await flushPromises()
    ;(body().querySelector('[data-testid="assign-save"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(classesApi.update).not.toHaveBeenCalled()
    w.unmount()
  })
})

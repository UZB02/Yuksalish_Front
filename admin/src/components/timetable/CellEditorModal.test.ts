import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { selectOption } from '@/test-utils/selectOption'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { TimetableOptions } from '@/api/timetable.api'
import { __resetBodyLock } from '@/composables/useBodyLock'
import CellEditorModal from './CellEditorModal.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const OPTIONS: TimetableOptions = {
  subjects: [
    { id: 'eng', name: 'Ingliz tili' },
    { id: 'math', name: 'Matematika' },
  ],
  teachers: [
    { id: 'al', fullName: 'Aliyeva' },
    { id: 'ga', fullName: "G'aniyeva" },
    { id: 'm', fullName: 'Karimov' },
  ],
  // Ingliz tili — ikki o'qituvchi (har biri alohida kurs)
  classAssignments: [
    { subjectId: 'eng', teacherId: 'al' },
    { subjectId: 'eng', teacherId: 'ga' },
    { subjectId: 'math', teacherId: 'm' },
  ],
  subjectTeachers: { eng: ['al', 'ga'], math: ['m'] },
}

function mountModal(value?: Parameters<typeof mount>[1] extends never ? never : unknown) {
  return mount(CellEditorModal, {
    props: {
      open: true,
      weekday: 3,
      lessonNo: 1,
      options: OPTIONS,
      value: value as never,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}
const body = () => document.body
/** Qidiruvli BaseSelect (combobox): data-testid trigger tugmasida; variant yorlig'i bo'yicha tanlanadi */
const trigger = (testid: string) => body().querySelector(`[data-testid="${testid}"]`) as HTMLElement
const choose = (testid: string, label: string) =>
  selectOption(new DOMWrapper(trigger(testid).parentElement!), label)

afterEach(() => {
  document.body.innerHTML = ''
  __resetBodyLock()
})

describe('CellEditorModal: bir katakda bir nechta dars', () => {
  it("juftliklar alohida variant: 'Ingliz tili · Aliyeva' va 'Ingliz tili · G'aniyeva'", async () => {
    const w = mountModal()
    await flushPromises()
    trigger('cell-pair').click()
    await flushPromises()
    const labels = Array.from(body().querySelectorAll('[role="option"]')).map((o) =>
      o.textContent?.trim(),
    )
    expect(labels).toContain('Ingliz tili · Aliyeva')
    expect(labels).toContain("Ingliz tili · G'aniyeva")
    expect(labels).toContain('Matematika · Karimov')
    w.unmount()
  })

  it("ikkala ingliz tili o'qituvchisi bir katakka qo'shiladi va massiv bo'lib saqlanadi", async () => {
    const w = mountModal()
    await flushPromises()
    await choose('cell-pair', 'Ingliz tili · Aliyeva')
    await flushPromises()
    // bo'sh qator to'ldirildi: hali bitta dars
    expect(body().querySelectorAll('[data-testid^="cell-line-"]')).toHaveLength(1)
    await choose('cell-pair', "Ingliz tili · G'aniyeva")
    await flushPromises()
    expect(body().querySelectorAll('[data-testid^="cell-line-"]')).toHaveLength(2)
    ;(body().querySelector('[data-testid="cell-save"]') as HTMLButtonElement).click()
    await flushPromises()
    const saved = w.emitted('save')![0]![0] as {
      subjectId: string
      teacherId: string
      subjectName: string
      teacherName: string
    }[]
    expect(saved.map((l) => [l.subjectId, l.teacherId])).toEqual([
      ['eng', 'al'],
      ['eng', 'ga'],
    ])
    expect(saved.map((l) => l.teacherName)).toEqual(['Aliyeva', "G'aniyeva"])
    w.unmount()
  })

  it("mavjud darslar ochiladi; dars qo'shish/olib tashlash; bir o'qituvchi ikki marta bo'lmaydi", async () => {
    const w = mountModal([
      {
        subjectId: 'eng',
        teacherId: 'al',
        room: '5',
        subjectName: 'Ingliz tili',
        teacherName: 'Aliyeva',
      },
    ])
    await flushPromises()
    expect(body().querySelectorAll('[data-testid^="cell-line-"]')).toHaveLength(1)
    // "Shu soatga yana bir dars qo'shish" -> bo'sh qator; to'ldirilmaguncha saqlab bo'lmaydi
    ;(body().querySelector('[data-testid="cell-add-line"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(body().querySelectorAll('[data-testid^="cell-line-"]')).toHaveLength(2)
    expect((body().querySelector('[data-testid="cell-save"]') as HTMLButtonElement).disabled).toBe(
      true,
    )
    // 2-qatorda ham Aliyeva -> takror o'qituvchi xabari va saqlash o'chiq
    await choose('cell-subject-1', 'Ingliz tili')
    await flushPromises()
    await choose('cell-teacher-1', 'al')
    await flushPromises()
    expect(body().querySelector('[data-testid="cell-dup"]')).not.toBeNull()
    expect((body().querySelector('[data-testid="cell-save"]') as HTMLButtonElement).disabled).toBe(
      true,
    )
    // G'aniyeva ga almashtirilsa to'g'ri
    await choose('cell-teacher-1', 'ga')
    await flushPromises()
    expect(body().querySelector('[data-testid="cell-dup"]')).toBeNull()
    expect((body().querySelector('[data-testid="cell-save"]') as HTMLButtonElement).disabled).toBe(
      false,
    )
    // 2-darsni olib tashlash
    ;(body().querySelector('[data-testid="cell-remove-line-1"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(body().querySelectorAll('[data-testid^="cell-line-"]')).toHaveLength(1)
    ;(body().querySelector('[data-testid="cell-save"]') as HTMLButtonElement).click()
    await flushPromises()
    const saved = w.emitted('save')![0]![0] as { teacherId: string; room: string | null }[]
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ teacherId: 'al', room: '5' })
    w.unmount()
  })

  it("fan tanlanganda o'qituvchi sukut bo'yicha biriktirilganlardan birinchisi", async () => {
    const w = mountModal()
    await flushPromises()
    await choose('cell-subject', 'Matematika')
    await flushPromises()
    // o'qituvchi tanlovi: biriktirilgan Karimov avtomatik tanlandi
    expect(trigger('cell-teacher').textContent).toContain('Karimov')
    w.unmount()
  })
})

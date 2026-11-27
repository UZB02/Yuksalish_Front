import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import uz from '@/locales/uz.json'
import type {
  ExamBlock,
  ExamBlockInput,
  ExamResultsResponse,
  FileTestView,
  MyBlockDetail,
  User,
} from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

const api = {
  setBlockContent: vi.fn(),
  replaceTestFile: vi.fn(),
  correctVariant: vi.fn(),
  resultDetail: vi.fn(),
  fileTest: vi.fn(),
  saveFileTest: vi.fn(),
  parseFileKey: vi.fn(),
  uploadTestFile: vi.fn(),
  fetchTestFile: vi.fn(),
  myBlock: vi.fn(),
  markBlockReady: vi.fn(),
  myBlocksSummary: vi.fn(),
  myBlocks: vi.fn(),
  listTopics: vi.fn(),
  suggestTeachers: vi.fn(),
  previewBlocks: vi.fn(),
  sessionResults: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import BlocksEditor from './BlocksEditor.vue'
import MyBlockView from './MyBlockView.vue'
import FileTestEditor from '@/components/exams/FileTestEditor.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})
const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
const $$ = (sel: string) => Array.from(document.body.querySelectorAll(sel)) as HTMLElement[]
const type = async (el: HTMLElement, v: string, ev = 'input') => {
  ;(el as HTMLInputElement).value = v
  el.dispatchEvent(new Event(ev, { bubbles: true }))
  await flushPromises()
}
const click = async (id: string) => {
  $(id).click()
  await flushPromises()
}

const file = (id: string, kind: 'pdf' | 'image' = 'pdf', size = 400_000) => ({
  id,
  kind,
  contentType: kind === 'pdf' ? 'application/pdf' : 'image/webp',
  size,
  width: 0,
  height: 0,
  pages: kind === 'pdf' ? 8 : 1,
  state: 'ready' as const,
})
const view = (over: Partial<FileTestView> = {}): FileTestView => ({
  role: 'contributor',
  content: 'file',
  delivery: 'screen',
  hasBank: false,
  hasFile: true,
  locked: false,
  lockReason: null,
  status: 'open',
  readyBy: null,
  questions: 2,
  variants: [
    {
      letter: 'A',
      kind: 'pdf',
      files: [file('f1')],
      key: [
        { no: 1, type: 'choice', options: 4, correct: ['C'], points: 1 },
        { no: 2, type: 'short', accepted: ['25'], points: 2 },
      ],
    },
  ],
  ...over,
})

// FilePreview og'ir (pdfjs): soxta
const PreviewStub = defineComponent({
  props: ['files', 'kind'],
  setup: (p) => () =>
    h('div', { 'data-testid': 'file-preview-stub' }, `${p.kind}:${p.files.length}`),
})

function mountEditor(v: FileTestView = view()) {
  api.fileTest.mockResolvedValue(v)
  const w = mount(FileTestEditor, {
    props: { sessionId: 's1', blockId: 'b1' },
    global: { plugins: [i18n], stubs: { FilePreview: PreviewStub } },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  for (const t of [...useToast().toasts]) useToast().dismiss(t.id)
})

describe('FileTestEditor: variantlar, fayl, kalit', () => {
  it('yuklanadi: variant yorlig`i, kalit qatorlari, fayl ro`yxati; saqlash tugmasi o`zgarishsiz yopiq', async () => {
    mountEditor()
    await flushPromises()
    expect($('variant-tab-A').textContent).toContain('A varianti')
    expect($('variant-tab-A').textContent).toContain('(2)')
    expect($('key-summary').textContent).toContain('2 ta savol, jami 3 ball')
    expect($('key-row-1')).toBeTruthy()
    expect($('key-opt-1-C').getAttribute('aria-pressed')).toBe('true')
    expect(($('key-short-2') as HTMLInputElement).value).toBe('25')
    expect($('file-item-0').textContent).toContain('PDF')
    expect($('file-item-0').textContent).toContain('8 sahifa')
    expect($('file-preview-stub').textContent).toBe('pdf:1')
    expect(($('filetest-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('qulflangan blok: faqat ko`rish (tahrir va saqlash elementlari yo`q)', async () => {
    mountEditor(view({ locked: true, lockReason: 'ready' }))
    await flushPromises()
    expect($('key-row-1')).toBeTruthy()
    expect($('filetest-save')).toBeNull()
    expect($('file-pick')).toBeNull()
    expect($('variant-add')).toBeNull()
    expect($('key-paste-text')).toBeNull()
    expect(($('key-opt-1-A') as HTMLButtonElement).disabled).toBe(true)
  })

  it('kalitni jadvalda tahrirlash: to`g`ri harf, ko`p harf, tur, qisqa javoblar, ball; saqlash so`rovi', async () => {
    const w = mountEditor()
    await flushPromises()
    await click('key-opt-1-B') // C ga B qo'shildi: ko'p to'g'ri javob
    expect(
      $$('[data-testid^="key-opt-1-"][aria-pressed="true"]').map((x) => x.textContent?.trim()),
    ).toEqual(['B', 'C'])
    await type($('key-options-1'), '3', 'change') // 3 ta variant: C qoladi (A-C)
    expect($('key-opt-1-D')).toBeNull()
    await type($('key-short-2'), '25 | 25,0 | 25.0', 'change')
    await type($('key-points-2'), '2,5', 'change')
    await type($('key-count'), '3', 'change') // yangi qator
    expect($('key-row-3')).toBeTruthy()
    await type($('key-type-3'), 'short', 'change')
    await type($('key-short-3'), 'Toshkent', 'change')
    expect($('filetest-dirty')).toBeTruthy()
    expect($('filetest-save').hasAttribute('disabled')).toBe(false)
    api.saveFileTest.mockImplementation(async (_s: string, _b: string, body: unknown) => ({
      ...view(),
      questions: 3,
      variants: [{ ...(body as { variants: object[] }).variants[0], files: [file('f1')] }],
    }))
    await click('filetest-save')
    expect(api.saveFileTest).toHaveBeenCalledTimes(1)
    const body = api.saveFileTest.mock.calls[0]![2] as {
      variants: { letter: string; kind: string; files: string[]; key: unknown[] }[]
    }
    expect(body.variants).toHaveLength(1)
    expect(body.variants[0]).toMatchObject({ letter: 'A', kind: 'pdf', files: ['f1'] })
    expect(body.variants[0]!.key).toEqual([
      { no: 1, type: 'choice', options: 3, correct: ['B', 'C'], points: 1 },
      { no: 2, type: 'short', accepted: ['25', '25,0', '25.0'], points: 2.5 },
      { no: 3, type: 'short', accepted: ['Toshkent'], points: 1 },
    ])
    expect(w.emitted('changed')).toBeTruthy()
    expect($('filetest-dirty')).toBeNull() // saqlangach toza
  })

  it('tez kiritish: matn serverda o`qiladi va kalitga qo`llanadi; xatolar ko`rsatiladi va kalit o`zgarmaydi', async () => {
    mountEditor(view({ variants: [{ letter: 'A', kind: 'pdf', files: [file('f1')], key: [] }] }))
    await flushPromises()
    api.parseFileKey.mockResolvedValueOnce({
      items: [],
      errors: ['2-savol takrorlangan'],
      warnings: [],
    })
    await type($('key-paste-text'), '1-A 2-B 2-C')
    await click('key-paste-apply')
    expect($('key-paste-errors').textContent).toContain('takrorlangan')
    expect($('key-row-1')).toBeNull()
    api.parseFileKey.mockResolvedValueOnce({
      items: [
        { no: 1, type: 'choice', options: 4, correct: ['C'], points: 1 },
        { no: 2, type: 'choice', options: 4, correct: ['B', 'D'], points: 1 },
        { no: 4, type: 'short', accepted: ['25'], points: 1 },
      ],
      errors: [],
      warnings: ["Kalitda 1 ta savol yo'q: 3"],
    })
    await type($('key-paste-text'), '1-C 2-B,D 4-25')
    await click('key-paste-apply')
    expect(api.parseFileKey).toHaveBeenLastCalledWith('s1', 'b1', {
      text: '1-C 2-B,D 4-25',
      options: 4,
      points: 1,
    })
    expect($('key-paste-warnings').textContent).toContain('3')
    // raqamlar 1..N ga tartiblanadi
    expect($$('[data-testid^="key-row-"]').length).toBe(3)
    expect($('key-row-3')).toBeTruthy()
    expect(($('key-short-3') as HTMLInputElement).value).toBe('25')
    expect($('key-opt-2-D').getAttribute('aria-pressed')).toBe('true')
  })

  it('variant qo`shish, PDF yuklash, rasmlar tartibi; variantlar mosligi ogohlantirishi', async () => {
    mountEditor()
    await flushPromises()
    await click('variant-add')
    expect($('variant-tab-B')).toBeTruthy()
    expect($('filetest-empty')).toBeNull()
    // B: PDF yuklash
    api.uploadTestFile.mockResolvedValueOnce({ file: file('f2') })
    const input = $('file-input') as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF-1.4'], 'b.pdf', { type: 'application/pdf' })],
      configurable: true,
    })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(api.uploadTestFile).toHaveBeenCalledWith('s1', 'b1', expect.any(File))
    expect($('file-item-0').textContent).toContain('PDF')
    // rasm rejimi: bir nechta rasm, tartib
    await click('file-kind-image')
    expect($$('[data-testid^="file-item-"]').length).toBe(0) // rejim almashdi: fayllar bo'sh
    api.uploadTestFile
      .mockResolvedValueOnce({ file: file('i1', 'image', 90_000) })
      .mockResolvedValueOnce({ file: file('i2', 'image', 80_000) })
    const input2 = $('file-input') as HTMLInputElement
    expect(input2.multiple).toBe(true)
    Object.defineProperty(input2, 'files', {
      value: [
        new File(['a'], 'a.png', { type: 'image/png' }),
        new File(['b'], 'b.png', { type: 'image/png' }),
      ],
      configurable: true,
    })
    input2.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect($$('[data-testid^="file-item-"]').length).toBe(2)
    await click('file-down-0')
    expect($('file-preview-stub').textContent).toBe('image:2')
    // B kalit: bo'sh, A da 2 ta savol: mos emas
    expect($('filetest-mismatch').textContent).toContain('savollar soni bir xil emas')
    await type($('key-count'), '2', 'change')
    expect($('filetest-mismatch').textContent).toContain("ballar yig'indisi")
    for (const n of [1, 2]) await click(`key-opt-${n}-A`)
    await type($('key-points-1'), '1', 'change')
    await type($('key-points-2'), '2', 'change')
    expect($('filetest-mismatch')).toBeNull()
    // saqlash: tartib saqlanadi (i2, i1)
    api.saveFileTest.mockResolvedValue(view())
    await click('filetest-save')
    const body = api.saveFileTest.mock.calls[0]![2] as {
      variants: { letter: string; kind: string; files: string[] }[]
    }
    expect(body.variants.map((v) => v.letter)).toEqual(['A', 'B'])
    expect(body.variants[1]).toMatchObject({ kind: 'image', files: ['i2', 'i1'] })
  })

  it('variantni o`chirish tasdiq bilan', async () => {
    mountEditor(
      view({
        variants: [
          { letter: 'A', kind: 'pdf', files: [file('f1')], key: view().variants[0]!.key },
          { letter: 'B', kind: 'pdf', files: [file('f2')], key: view().variants[0]!.key },
        ],
      }),
    )
    await flushPromises()
    await click('variant-tab-B')
    const p = (async () => {
      $('variant-remove').click()
      await flushPromises()
    })()
    await p
    const c = useConfirm()
    expect(c.state.open).toBe(true)
    c.settle(true)
    await flushPromises()
    expect($('variant-tab-B')).toBeNull()
    expect($('variant-tab-A')).toBeTruthy()
  })

  it('yuklash xatosi: toast, fayl qo`shilmaydi', async () => {
    mountEditor()
    await flushPromises()
    api.uploadTestFile.mockRejectedValueOnce(new Error('x'))
    const input = $('file-input') as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF'], 'b.pdf')],
      configurable: true,
    })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(useToast().toasts.length).toBeGreaterThan(0)
    expect($('file-item-0').textContent).toContain('PDF') // oldingi fayl o'zgarmagan
    expect($('filetest-dirty')).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
describe('MyBlockView: fayl bloki', () => {
  const detail = (content: 'bank' | 'file', over: Partial<MyBlockDetail['block']> = {}) =>
    ({
      role: 'contributor',
      exam: { id: 's1', title: 'DTM', contribDeadline: null },
      block: {
        id: 'b1',
        subjectId: 'sub',
        subjectName: 'Matematika',
        title: 'Matematika',
        targetCount: 2,
        count: 2,
        status: 'open',
        content,
        locked: false,
        lockReason: null,
        canMarkReady: true,
        ...over,
      },
      questions: [],
      rules: [],
    }) as unknown as MyBlockDetail

  const saveSpy = vi.fn()
  const EditorStub = defineComponent({
    emits: ['changed'],
    setup(_p, { expose }) {
      const dirty = { value: true }
      expose({ save: saveSpy, dirty: dirty.value })
      return () => h('div', { 'data-testid': 'editor-stub' })
    },
  })

  async function mountBlock(content: 'bank' | 'file', over: Partial<MyBlockDetail['block']> = {}) {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setSession('t', {
      id: 'u1',
      role: 'teacher',
      schoolId: 's1',
      permissions: [],
    } as unknown as User)
    api.myBlock.mockResolvedValue(detail(content, over))
    api.listTopics.mockResolvedValue([])
    api.myBlocksSummary.mockResolvedValue({ pending: 0, total: 0 })
    api.myBlocks.mockResolvedValue([])
    const empty = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/exams/blocks/:sessionId/:blockId', name: 'cur', component: MyBlockView },
        { path: '/exams/tasks', name: 'exam-tasks', component: empty },
        { path: '/exams/sessions/:id', name: 'exam-session', component: empty },
        { path: '/exams/blocks/:sessionId/:blockId/x', name: 'exam-my-block', component: empty },
      ],
    })
    await router.push('/exams/blocks/s1/b1')
    await router.isReady()
    const w = mount(
      { template: '<RouterView />' },
      {
        global: { plugins: [pinia, i18n, router], stubs: { FileTestEditor: EditorStub } },
        attachTo: document.body,
      },
    )
    mounted.push(w)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
    await flushPromises()
    return w
  }

  it('file: savollar banki tablari va ro`yxati yo`q, fayl tahrirlagich bor; bank: eskicha', async () => {
    await mountBlock('file')
    expect($('editor-stub')).toBeTruthy()
    expect($('myblock-tabs')).toBeNull()
    expect($('myblock-questions')).toBeNull()
    mounted.pop()!.unmount()
    document.body.innerHTML = ''
    await mountBlock('bank')
    expect($('editor-stub')).toBeNull()
    expect($('myblock-tabs')).toBeTruthy()
    expect($('myblock-questions')).toBeTruthy()
  })

  it('usul almashtirish: mazmun bo`lsa tasdiq, `from` bilan so`rov; bekor qilinsa yuborilmaydi; qulf bo`lsa tugma yo`q', async () => {
    api.setBlockContent.mockResolvedValue({})
    await mountBlock('bank', { hasBank: true })
    expect($('myblock-mode')).toBeTruthy()
    expect($('mode-bank').getAttribute('aria-checked')).toBe('true')
    $('mode-file').click()
    await flushPromises()
    expect(useConfirm().state.open).toBe(true)
    expect(useConfirm().state.options.message).toContain('yashirin')
    useConfirm().settle(false)
    await flushPromises()
    expect(api.setBlockContent).not.toHaveBeenCalled()
    $('mode-file').click()
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(api.setBlockContent).toHaveBeenCalledWith('s1', 'b1', { content: 'file', from: 'bank' })
    expect(api.myBlock.mock.calls.length).toBeGreaterThanOrEqual(2) // qayta yuklandi
    mounted.pop()!.unmount()
    document.body.innerHTML = ''
    api.setBlockContent.mockClear()
    // mazmun yo'q: tasdiqsiz
    await mountBlock('bank', { hasBank: false, hasFile: false, count: 0 })
    $('mode-file').click()
    await flushPromises()
    expect(api.setBlockContent).toHaveBeenCalledTimes(1)
    mounted.pop()!.unmount()
    document.body.innerHTML = ''
    // qulf: almashtirish yo'q
    await mountBlock('bank', { locked: true, lockReason: 'status' })
    expect($('myblock-mode')).toBeNull()
  })

  it('"Tugatdim": saqlanmagan fayl testi avval saqlanadi', async () => {
    api.markBlockReady.mockResolvedValue({ blockId: 'b1', status: 'ready' })
    await mountBlock('file')
    $('myblock-ready').click()
    await flushPromises()
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(api.markBlockReady).toHaveBeenCalledWith('s1', 'b1', true)
    expect(saveSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      api.markBlockReady.mock.invocationCallOrder[0]!,
    )
  })
})

// ---------------------------------------------------------------------------------------------
describe('BlocksEditor: ustada usul tanlanmaydi (§23)', () => {
  it('"Savollar manbai" tanlovi yo`q, maqsad maydoni avvalgidek', async () => {
    const w = mount(BlocksEditor, {
      props: {
        modelValue: [
          {
            subjectId: 'sub1',
            title: '',
            targetCount: 10,
            coefficient: 1,
            durationMin: 30,
            contributorIds: [],
            items: [],
          },
        ] as ExamBlockInput[],
        subjects: [{ id: 'sub1', name: 'Matematika' }],
        meta: null,
        scoringMode: 'points',
        timingMode: 'common',
        serverBlocks: [] as ExamBlock[],
        simple: true,
      },
      global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
      attachTo: document.body,
    })
    mounted.push(w)
    await flushPromises()
    expect($('block-target-0')).toBeTruthy()
    expect($('block-content-0')).toBeNull()
    expect(document.body.textContent).not.toContain('Savollar manbai')
  })
})

describe('FileTestEditor: yetkazish (ekranda/qog`ozda), muddati tugagan fayl', () => {
  it('qog`ozga o`tish: fayl bo`limi yo`qoladi, fayllar olib tashlanadi (tasdiq), saqlashda delivery=paper va files=[]', async () => {
    mountEditor()
    await flushPromises()
    expect($('file-pick')).toBeTruthy()
    expect($('delivery-screen').getAttribute('aria-checked')).toBe('true')
    $('delivery-paper').click()
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect($('file-pick')).toBeNull()
    expect($('file-preview-stub')).toBeNull()
    expect($('delivery-paper').getAttribute('aria-checked')).toBe('true')
    expect($('delivery-help').textContent).toContain('chop etib')
    api.saveFileTest.mockImplementation(
      async (_s: string, _b: string, body: { delivery: string }) =>
        view({ delivery: body.delivery as 'paper' }),
    )
    await click('filetest-save')
    const body = api.saveFileTest.mock.calls[0]![2] as {
      delivery: string
      variants: { files: string[]; key: unknown[] }[]
    }
    expect(body.delivery).toBe('paper')
    expect(body.variants[0]!.files).toEqual([])
    expect(body.variants[0]!.key).toHaveLength(2)
  })

  it('qog`ozda yuklangan fayl bo`lmasa tasdiq so`ralmaydi', async () => {
    mountEditor(
      view({
        delivery: 'paper',
        variants: [{ letter: 'A', kind: 'pdf', files: [], key: view().variants[0]!.key }],
      }),
    )
    await flushPromises()
    expect($('delivery-paper').getAttribute('aria-checked')).toBe('true')
    expect($('file-pick')).toBeNull()
    expect($('key-row-1')).toBeTruthy()
    $('delivery-screen').click()
    await flushPromises()
    expect($('file-pick')).toBeTruthy()
    expect($('file-reupload-hint')).toBeTruthy() // kalit bor, fayl yo'q: nusxadan keyingi holat
  })

  it('muddati tugagan fayl: belgi, ko`rinish yo`q, tuzuvchi qayta yuklaydi (kalit o`zgarmaydi); o`qituvchida tugma yo`q', async () => {
    const expired = view({
      role: 'composer',
      variants: [
        {
          letter: 'A',
          kind: 'pdf',
          files: [{ ...file('f1'), state: 'expired' }],
          key: view().variants[0]!.key,
        },
      ],
    })
    mountEditor(expired)
    await flushPromises()
    expect($('file-expired-0').textContent).toContain('fayl muddati tugagan')
    expect($('file-preview-stub')).toBeNull()
    api.replaceTestFile.mockResolvedValue(view({ role: 'composer' }))
    const input = $('file-replace-0') as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF'], 'n.pdf')],
      configurable: true,
    })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(api.replaceTestFile).toHaveBeenCalledWith('s1', 'b1', 'f1', expect.any(File))
    expect($('file-expired-0')).toBeNull()
    expect($('key-row-2')).toBeTruthy()
    mounted.pop()!.unmount()
    document.body.innerHTML = ''
    mountEditor(view({ role: 'contributor', variants: expired.variants }))
    await flushPromises()
    expect($('file-expired-0')).toBeTruthy()
    expect($('file-replace-0')).toBeNull()
  })
})

describe('qog`oz variantini tuzatish (natijalar oynasi)', () => {
  it('qog`ozli blok: variant tanlanadi, tuzatish so`rovi yuboriladi va tafsilot yangilanadi; ekranli blokda yo`q', async () => {
    const { default: Modal } = await import('./ParticipantResultModal.vue')
    const detail = (variant: string | null, delivery: 'paper' | 'screen' = 'paper') => ({
      participant: { key: 'k1', fullName: 'Aliyev Bobur', className: '7-A' },
      status: 'submitted',
      score: { earned: 3, max: 5, essayPending: 0 },
      variant,
      fileBlocks: [{ blockId: 'b1', title: 'Matematika', delivery, letters: ['A', 'B'], variant }],
      questions: [
        {
          id: 'fk:b1:A:1',
          blockId: 'b1',
          index: 1,
          type: 'single',
          points: 1,
          content: [{ type: 'text', text: 'A varianti: 1-savol' }],
          options: [],
          given: 'A',
          flagged: false,
          correct: { optionIds: ['A'] },
          got: 1,
          ok: true,
          graded: null,
          grade: null,
        },
      ],
    })
    api.resultDetail.mockResolvedValueOnce(detail('A')).mockResolvedValueOnce(detail('B'))
    api.correctVariant.mockResolvedValue({ variant: 'B', previous: 'A' })
    const w = mount(Modal, {
      props: { open: true, sessionId: 's1', participantKey: 'k1', canGrade: true },
      global: { plugins: [createPinia(), i18n] },
      attachTo: document.body,
    })
    mounted.push(w)
    await flushPromises()
    expect($('variant-fix-b1').textContent).toContain('Qog')
    expect(($('variant-fix-apply') as HTMLButtonElement).disabled).toBe(true) // joriy variant tanlangan
    await type($('variant-fix-select'), 'B', 'change')
    expect(($('variant-fix-apply') as HTMLButtonElement).disabled).toBe(false)
    await click('variant-fix-apply')
    expect(api.correctVariant).toHaveBeenCalledWith('s1', 'k1', { blockId: 'b1', variant: 'B' })
    expect(api.resultDetail).toHaveBeenCalledTimes(2)
    expect(w.emitted('changed')).toBeTruthy()
    mounted.pop()!.unmount()
    document.body.innerHTML = ''
    api.resultDetail.mockResolvedValue(detail('A', 'screen'))
    const w2 = mount(Modal, {
      props: { open: true, sessionId: 's1', participantKey: 'k1', canGrade: true },
      global: { plugins: [createPinia(), i18n] },
      attachTo: document.body,
    })
    mounted.push(w2)
    await flushPromises()
    expect($('variant-fix-b1')).toBeNull()
  })
})

describe('natijalar: variant ustuni', () => {
  it('jadvalda faqat variantli ishtirokchi bo`lsa "Variant" ustuni chiqadi', async () => {
    const { default: ExamResultsView } = await import('./ExamResultsView.vue')
    const base = (variant: string | null): ExamResultsResponse =>
      ({
        session: {
          id: 's1',
          title: 'DTM',
          status: 'closed',
          resultsMode: 'score',
          resultsPublished: false,
          publishedAt: null,
          passPercent: null,
          scheduledStart: '2026-12-01T10:00:00.000Z',
          endsAt: '2026-12-01T11:00:00.000Z',
        },
        blocks: [],
        summary: {
          participants: 1,
          started: 1,
          submitted: 1,
          averagePercent: 80,
          maxPercent: 80,
          minPercent: 80,
          passPercent: null,
          passRate: null,
          passedCount: 0,
          essayPending: 0,
        },
        rows: [
          {
            key: 'k1',
            kind: 'student',
            fullName: 'Aliyev Bobur',
            className: '7-A',
            status: 'submitted',
            earned: 4,
            max: 5,
            percent: 80,
            passed: null,
            answered: 4,
            total: 4,
            timeSpentSec: 600,
            warnings: 0,
            essayPending: 0,
            rank: 1,
            variant,
          },
        ],
      }) as never
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setSession('t', {
      id: 'u1',
      role: 'school_admin',
      schoolId: 's1',
      permissions: [],
    } as unknown as User)
    const empty = { template: '<div />' }
    for (const v of ['B', null]) {
      api.sessionResults.mockResolvedValue(base(v))
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/exams/sessions/:id/results', name: 'cur', component: ExamResultsView },
          { path: '/exams/sessions', name: 'exam-sessions', component: empty },
          { path: '/exams/sessions/:id', name: 'exam-session', component: empty },
          { path: '/exams/results', name: 'exam-results-list', component: empty },
        ],
      })
      await router.push('/exams/sessions/s1/results')
      await router.isReady()
      const w = mount(
        { template: '<RouterView />' },
        { global: { plugins: [pinia, i18n, router] }, attachTo: document.body },
      )
      mounted.push(w)
      await flushPromises()
      await new Promise((r) => setTimeout(r, 0))
      await flushPromises()
      ;($('view-table') as HTMLElement).click()
      await flushPromises()
      if (v) {
        expect($('col-variant').textContent).toContain('Variant')
        expect($('cell-variant').textContent).toContain('B')
      } else {
        expect($('col-variant')).toBeNull()
        expect($('cell-variant')).toBeNull()
      }
      mounted.pop()!.unmount()
      document.body.innerHTML = ''
    }
  })
})

beforeEach(() => {
  useConfirm().settle(false)
})

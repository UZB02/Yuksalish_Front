import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { PastePreview, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'

const api = { blockPastePreview: vi.fn(), blockPasteCommit: vi.fn(), pastePreview: vi.fn() }
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

// OCR yadrosi soxta: haqiqiy tesseract/pdfjs yuklanmaydi (ular dinamik import bilan faqat "Tanib olish" bosilganda keladi)
const engine = {
  MANY_PAGES: 20,
  createOcrSession: vi.fn(),
  openPdf: vi.fn(),
  imageToCanvas: vi.fn(),
  prepareCanvas: vi.fn((c: unknown) => c),
  freeCanvas: vi.fn(),
}
vi.mock('@/utils/ocr-engine', () => engine)

import OcrQuestions from './OcrQuestions.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mounted: { unmount: () => void }[] = []
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const file = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type })
const canvasOf = (name: string) => ({ __canvas: name }) as unknown as HTMLCanvasElement

let session: { recognize: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }
let statusCb: (s: { phase: 'loading' | 'recognizing'; progress: number }) => void = () => undefined

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  engine.createOcrSession.mockReset()
  engine.openPdf.mockReset()
  engine.imageToCanvas.mockReset()
  engine.prepareCanvas.mockClear()
  engine.freeCanvas.mockClear()
  session = {
    recognize: vi.fn(async (c: { __canvas: string }) => `OCR ${c.__canvas}`),
    terminate: vi.fn(async () => undefined),
  }
  engine.createOcrSession.mockImplementation(async (_l: string[], cb: typeof statusCb) => {
    statusCb = cb
    return session
  })
  engine.imageToCanvas.mockImplementation(async (f: File, rot: number) =>
    canvasOf(`${f.name}@${rot}`),
  )
  localStorage.clear()
  useConfirm().settle(false)
})
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

function mk(userId = 'u1') {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('t', {
    id: userId,
    role: 'teacher',
    schoolId: 's1',
    permissions: [],
  } as unknown as User)
  const w = mount(OcrQuestions, {
    props: { mode: 'block', sessionId: 'e1', blockId: 'b1', examTitle: 'DTM' },
    global: { plugins: [pinia, i18n] },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}
async function pick(w: ReturnType<typeof mk>, files: File[], testid = 'ocr-file') {
  const input = w.get(`[data-testid="${testid}"]`)
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
}
const names = (w: ReturnType<typeof mk>) =>
  w.findAll('[data-testid="ocr-name"]').map((x) => x.text())

describe('OCR paneli: fayllar', () => {
  it('maslahat va maxfiylik matni; rasm/PDF qabul qilinadi, boshqa tur rad etiladi; kamera kiritishi alohida', async () => {
    const w = mk()
    expect(w.get('[data-testid="ocr-hint"]').text()).toBe(
      "Aniq, tekis, yorug' rasm yuklang: sahifa to'g'ri turgan, soyasiz, matn xira emas bo'lsin.",
    )
    expect(w.text()).toContain('serverga yuborilmaydi')
    expect(w.get('[data-testid="ocr-file"]').attributes('accept')).toContain('image/*')
    expect(w.get('[data-testid="ocr-file"]').attributes('accept')).toContain('application/pdf')
    expect(w.get('[data-testid="ocr-camera"]').attributes('capture')).toBe('environment')
    expect(w.get('[data-testid="ocr-start"]').attributes('disabled')).toBeDefined()
    await pick(w, [
      file('a.jpg', 'image/jpeg'),
      file('b.png', 'image/png'),
      file('c.pdf', 'application/pdf'),
      file('x.docx', 'application/msword'),
    ])
    expect(names(w)).toEqual(['a.jpg', 'b.png', 'c.pdf'])
    expect(w.get('[data-testid="ocr-error"]').text()).toContain('x.docx')
    expect(w.get('[data-testid="ocr-start"]').attributes('disabled')).toBeUndefined()
    // kameradan olingan rasm ham ro'yxatga qo'shiladi
    await pick(w, [file('foto.jpg', 'image/jpeg')], 'ocr-camera')
    expect(names(w)).toEqual(['a.jpg', 'b.png', 'c.pdf', 'foto.jpg'])
  })

  it('tartib (yuqoriga/pastga), burish va olib tashlash', async () => {
    const w = mk()
    await pick(w, [
      file('1.jpg', 'image/jpeg'),
      file('2.jpg', 'image/jpeg'),
      file('3.jpg', 'image/jpeg'),
    ])
    await w.get('[data-testid="ocr-down-0"]').trigger('click')
    expect(names(w)).toEqual(['2.jpg', '1.jpg', '3.jpg'])
    await w.get('[data-testid="ocr-up-2"]').trigger('click')
    expect(names(w)).toEqual(['2.jpg', '3.jpg', '1.jpg'])
    await w.get('[data-testid="ocr-up-0"]').trigger('click') // chegarada o'zgarmaydi
    expect(names(w)).toEqual(['2.jpg', '3.jpg', '1.jpg'])
    await w.get('[data-testid="ocr-rotate-1"]').trigger('click')
    expect(w.get('[data-testid="ocr-rot-1"]').text()).toBe('90°')
    await w.get('[data-testid="ocr-remove-0"]').trigger('click')
    expect(names(w)).toEqual(['3.jpg', '1.jpg'])
  })
})

describe('OCR paneli: tillar', () => {
  it('standart: o`zbek lotin + ingliz; tanlov foydalanuvchi bo`yicha saqlanadi va qayta tiklanadi; kamida bitta til kerak', async () => {
    const w = mk('u1')
    const on = (l: string) =>
      (w.get(`[data-testid="ocr-lang-${l}"] input`).element as HTMLInputElement).checked
    expect(['uzb', 'uzb_cyrl', 'rus', 'eng'].map(on)).toEqual([true, false, false, true])
    await w.get('[data-testid="ocr-lang-rus"] input').setValue(true)
    await w.get('[data-testid="ocr-lang-eng"] input').setValue(false)
    expect(JSON.parse(localStorage.getItem('exams.ocr.langs.u1')!)).toEqual(['uzb', 'rus'])
    w.unmount()
    mounted.pop()
    const again = mk('u1')
    const on2 = (l: string) =>
      (again.get(`[data-testid="ocr-lang-${l}"] input`).element as HTMLInputElement).checked
    expect(['uzb', 'uzb_cyrl', 'rus', 'eng'].map(on2)).toEqual([true, false, true, false])
    // boshqa foydalanuvchi: standart
    const other = mk('u2')
    expect(
      (other.get('[data-testid="ocr-lang-eng"] input').element as HTMLInputElement).checked,
    ).toBe(true)
    // hamma til o'chsa: xabar va boshlab bo'lmaydi
    await again.get('[data-testid="ocr-lang-uzb"] input').setValue(false)
    await again.get('[data-testid="ocr-lang-rus"] input').setValue(false)
    await pick(again, [file('a.jpg', 'image/jpeg')])
    expect(again.find('[data-testid="ocr-no-lang"]').exists()).toBe(true)
    expect(again.get('[data-testid="ocr-start"]').attributes('disabled')).toBeDefined()
  })

  it('localStorage ishlamasa ham panel ishlaydi (standart tillar)', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      const w = mk()
      expect(
        (w.get('[data-testid="ocr-lang-uzb"] input').element as HTMLInputElement).checked,
      ).toBe(true)
      await w.get('[data-testid="ocr-lang-rus"] input').setValue(true)
      expect(
        (w.get('[data-testid="ocr-lang-rus"] input').element as HTMLInputElement).checked,
      ).toBe(true)
    } finally {
      get.mockRestore()
      set.mockRestore()
    }
  })
})

describe('OCR: ishga tushirish, ketma-ketlik, progress, bekor qilish', () => {
  it('sahifalar tartib bilan ketma-ket o`qiladi (rasm + PDF sahifalari), matn bo`sh qator bilan birlashadi va "Matnni joylash" oynasiga tushadi; ishchi to`xtatiladi', async () => {
    api.blockPastePreview.mockResolvedValue({
      stats: { total: 0, ok: 0, problems: 0 },
      items: [],
      ignored: [],
      limits: { maxQuestions: 200, maxBytes: 70000 },
    } satisfies PastePreview)
    const pdf = {
      pages: 2,
      render: vi.fn(async (n: number, rot: number) => canvasOf(`pdf-p${n}@${rot}`)),
      destroy: vi.fn(async () => undefined),
    }
    engine.openPdf.mockResolvedValue(pdf)
    const order: string[] = []
    session.recognize.mockImplementation(async (c: { __canvas: string }) => {
      order.push(c.__canvas)
      await sleep(5)
      return `Matn ${c.__canvas}`
    })
    const w = mk()
    await pick(w, [file('a.jpg', 'image/jpeg'), file('doc.pdf', 'application/pdf')])
    await w.get('[data-testid="ocr-rotate-0"]').trigger('click')
    await w.get('[data-testid="ocr-prep"]').setValue('binarize')
    expect(engine.createOcrSession).not.toHaveBeenCalled() // kutubxonalar faqat boshlanganda
    await w.get('[data-testid="ocr-start"]').trigger('click')
    await flushPromises()
    await sleep(60)
    await flushPromises()
    expect(engine.createOcrSession).toHaveBeenCalledWith(['uzb', 'eng'], expect.any(Function))
    expect(order).toEqual(['a.jpg@1', 'pdf-p1@0', 'pdf-p2@0'])
    expect(engine.prepareCanvas).toHaveBeenCalledTimes(3)
    expect((engine.prepareCanvas.mock.calls[0] as unknown[])[1]).toBe('binarize')
    expect(engine.freeCanvas).toHaveBeenCalledTimes(3)
    const ta = w.get('[data-testid="paste-text"]').element as HTMLTextAreaElement
    expect(ta.value).toBe('Matn a.jpg@1\n\nMatn pdf-p1@0\n\nMatn pdf-p2@0')
    expect(session.terminate).toHaveBeenCalledTimes(1)
    expect(pdf.destroy).toHaveBeenCalled()
    expect(w.find('[data-testid="ocr-progress"]').exists()).toBe(false)
  })

  it('progress: "3/8-sahifa: n%" va til yuklash bosqichi; bekor qilish ishchini to`xtatadi', async () => {
    let fail: (e: Error) => void = () => undefined
    session.recognize.mockImplementation(() => new Promise<string>((_r, rej) => (fail = rej)))
    // haqiqiy ishchi to'xtatilsa kutilayotgan recognize rad etiladi
    session.terminate.mockImplementation(async () => fail(new Error('terminated')))
    const w = mk()
    await pick(w, [
      file('1.jpg', 'image/jpeg'),
      file('2.jpg', 'image/jpeg'),
      file('3.jpg', 'image/jpeg'),
    ])
    await w.get('[data-testid="ocr-start"]').trigger('click')
    await flushPromises()
    statusCb({ phase: 'loading', progress: 0.4 })
    await flushPromises()
    expect(w.get('[data-testid="ocr-status"]').text()).toMatch(/1\/3-sahifa|40% \(bir marta\)/)
    statusCb({ phase: 'recognizing', progress: 0.5 })
    await flushPromises()
    expect(w.get('[data-testid="ocr-status"]').text()).toBe('1/3-sahifa: 50%')
    expect(w.find('[data-testid="ocr-cancel"]').exists()).toBe(true)
    // fayl tugmalari bloklanadi
    expect(w.find('[data-testid="ocr-remove-0"]').exists()).toBe(false)
    await w.get('[data-testid="ocr-cancel"]').trigger('click')
    await flushPromises()
    await sleep(10)
    expect(session.terminate).toHaveBeenCalled()
    expect(w.find('[data-testid="ocr-progress"]').exists()).toBe(false)
    expect(w.find('[data-testid="ocr-result"]').exists()).toBe(false) // hech narsa tanilmadi
    expect(w.find('[data-testid="ocr-error"]').exists()).toBe(false) // bekor qilish xato emas
    expect(session.recognize).toHaveBeenCalledTimes(1) // 2-sahifaga o'tilmadi
  })

  it('20 dan ko`p sahifa: ogohlantirish; rad etilsa hech narsa boshlanmaydi', async () => {
    engine.openPdf.mockResolvedValue({
      pages: 25,
      render: vi.fn(),
      destroy: vi.fn(async () => undefined),
    })
    const w = mk()
    await pick(w, [file('big.pdf', 'application/pdf', 5000)])
    const c = useConfirm()
    const p = w.get('[data-testid="ocr-start"]').trigger('click')
    await flushPromises()
    expect(c.state.open).toBe(true)
    expect(c.state.options.message).toContain('25 ta sahifa')
    c.settle(false)
    await p
    await flushPromises()
    expect(engine.createOcrSession).not.toHaveBeenCalled()
    expect(w.find('[data-testid="ocr-progress"]').exists()).toBe(false)
  })

  it('xato: tushunarli xabar, ishchi baribir to`xtatiladi', async () => {
    session.recognize.mockRejectedValue(new Error('wasm'))
    const w = mk()
    await pick(w, [file('a.jpg', 'image/jpeg')])
    await w.get('[data-testid="ocr-start"]').trigger('click')
    await flushPromises()
    await sleep(10)
    expect(w.get('[data-testid="ocr-error"]').text()).toContain('Tanib olib bo')
    expect(session.terminate).toHaveBeenCalled()
  })
})

describe('OCR matni -> jonli ko`rinish -> saqlash', () => {
  it('tanilgan matn tahrirlanadi, tahlilchiga ketadi (blok rejimi) va saqlanganda "committed" chiqadi', async () => {
    const preview: PastePreview = {
      stats: { total: 1, ok: 1, problems: 0 },
      items: [
        {
          idx: 1,
          number: 1,
          line: 1,
          content: [{ type: 'text', text: 'Savol' }],
          options: [
            { id: 'A', content: [{ type: 'text', text: 'bir' }] },
            { id: 'B', content: [{ type: 'text', text: 'ikki' }] },
          ],
          correct: ['B'],
          type: 'single',
          warnings: [],
          pickable: false,
        },
      ],
      ignored: [],
      limits: { maxQuestions: 200, maxBytes: 70000 },
    }
    api.blockPastePreview.mockResolvedValue(preview)
    api.blockPasteCommit.mockResolvedValue({ created: 1, ids: ['q1'], skipped: [], failed: [] })
    session.recognize.mockResolvedValue('1. Savol\nA) bir\nB) ikki\nJavob: B')
    const w = mk()
    await pick(w, [file('a.jpg', 'image/jpeg')])
    await w.get('[data-testid="ocr-start"]').trigger('click')
    await flushPromises()
    await sleep(400)
    await flushPromises()
    expect(api.blockPastePreview).toHaveBeenCalledWith(
      'e1',
      'b1',
      '1. Savol\nA) bir\nB) ikki\nJavob: B',
    )
    expect(w.get('[data-testid="paste-count"]').text()).toBe('1 ta savol topildi')
    // o'qituvchi OCR xatosini tuzatadi: jonli ko'rinish qayta so'raydi
    await w.get('[data-testid="paste-text"]').setValue('1. Savol!\nA) bir\nB) ikki\nJavob: B')
    await sleep(400)
    await flushPromises()
    expect(api.blockPastePreview).toHaveBeenLastCalledWith(
      'e1',
      'b1',
      '1. Savol!\nA) bir\nB) ikki\nJavob: B',
    )
    await w.get('[data-testid="paste-commit"]').trigger('click')
    await flushPromises()
    await sleep(20)
    await flushPromises()
    expect(api.blockPasteCommit).toHaveBeenCalled()
    expect(w.emitted('committed')).toHaveLength(1)
  })
})

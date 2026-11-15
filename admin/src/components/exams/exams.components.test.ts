import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { QuestionBlock } from '@/api/types'

const katexRender = vi.fn()
vi.mock('katex', async (orig) => {
  const real = await orig<typeof import('katex')>()
  return {
    default: {
      ...real.default,
      render: (tex: string, el: HTMLElement, opts: object) => {
        katexRender(tex, el, opts)
        return real.default.render(tex, el, opts)
      },
    },
  }
})
const uploadAsset = vi.fn()
const fetchAssetBlob = vi.fn()
vi.mock('@/api/exams.api', () => ({
  examsApi: {
    uploadAsset: (...a: unknown[]) => uploadAsset(...a),
    fetchAssetBlob: (...a: unknown[]) => fetchAssetBlob(...a),
  },
}))

import AcceptedAnswers from './AcceptedAnswers.vue'
import BlockEditor from './BlockEditor.vue'
import BlocksView from './BlocksView.vue'
import MathView from './MathView.vue'
import OptionsEditor from './OptionsEditor.vue'
import QuestionPreview from './QuestionPreview.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const opts = { global: { plugins: [i18n] } }
const text = (s: string): QuestionBlock => ({ type: 'text', text: s })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('KaTeX: xavfsiz ko`rsatish (v-html yo`q)', () => {
  it('katex.render(element) trust:false va throwOnError:false bilan chaqiriladi', async () => {
    const w = mount(MathView, { ...opts, props: { tex: '\\frac{a}{b}' }, attachTo: document.body })
    await flushPromises()
    await vi.waitFor(() => expect(katexRender).toHaveBeenCalled())
    const [tex, el, options] = katexRender.mock.calls[0]!
    expect(tex).toBe('\\frac{a}{b}')
    expect(el).toBe(w.element)
    expect(options).toMatchObject({ trust: false, throwOnError: false })
    expect(w.element.querySelector('.katex')).not.toBeNull()
    w.unmount()
  })

  it("zararli satr HTML sifatida talqin qilinmaydi: <img>/<script> elementi paydo bo'lmaydi", async () => {
    const evil = '\\text{<img src=x onerror=alert(1)><script>alert(2)</script>}'
    const w = mount(MathView, { ...opts, props: { tex: evil }, attachTo: document.body })
    await vi.waitFor(() => expect(katexRender).toHaveBeenCalled())
    expect(w.element.querySelector('img')).toBeNull()
    expect(w.element.querySelector('script')).toBeNull()
    expect(w.element.innerHTML).not.toContain('<img')
    // \href kabi buyruqlar trust:false da havola yaratmaydi
    const w2 = mount(MathView, {
      ...opts,
      props: { tex: '\\href{javascript:alert(1)}{x}' },
      attachTo: document.body,
    })
    await vi.waitFor(() => expect(katexRender).toHaveBeenCalledTimes(2))
    expect(w2.element.querySelector('a')).toBeNull()
    w.unmount()
    w2.unmount()
  })

  it("bo'sh formula render qilinmaydi; xato formula tashlamaydi", async () => {
    const w = mount(MathView, { ...opts, props: { tex: '  ' } })
    await flushPromises()
    expect(katexRender).not.toHaveBeenCalled()
    await w.setProps({ tex: '\\frac{' })
    await vi.waitFor(() => expect(katexRender).toHaveBeenCalled())
  })

  it("exams komponentlari manbasida v-html va innerHTML yo'q", () => {
    const sources = import.meta.glob('./*.vue', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const views = import.meta.glob('../../views/exams/*.vue', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const all = { ...sources, ...views }
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(8)
    for (const [file, src] of Object.entries(all)) {
      expect(src, file).not.toMatch(/v-html\s*=/)
      expect(src, file).not.toMatch(
        /\.innerHTML|\.outerHTML|insertAdjacentHTML|createContextualFragment/,
      )
    }
  })

  it('BlocksView: matn interpolatsiya bilan (HTML matn sifatida ko`rinadi)', () => {
    const w = mount(BlocksView, {
      ...opts,
      props: { blocks: [text('<b>qalin</b> <script>x</script>')] },
    })
    expect(w.find('b').exists()).toBe(false)
    expect(w.find('script').exists()).toBe(false)
    expect(w.text()).toContain('<b>qalin</b>')
  })
})

describe('BlockEditor', () => {
  const mountEditor = (modelValue: QuestionBlock[]) =>
    mount(BlockEditor, { ...opts, props: { modelValue } })
  const last = (w: ReturnType<typeof mountEditor>) =>
    w.emitted('update:modelValue')!.at(-1)![0] as QuestionBlock[]

  it("matn, formula va rasm bloklarini qo'shadi", async () => {
    const w = mountEditor([text('a')])
    await w.get('[data-testid="add-math"]').trigger('click')
    expect(last(w)).toEqual([text('a'), { type: 'math', tex: '' }])
    await w.get('[data-testid="add-image"]').trigger('click')
    expect(last(w)[1]).toEqual({ type: 'image', assetId: '' })
    await w.get('[data-testid="add-text"]').trigger('click')
    expect(last(w)[1]).toEqual(text(''))
  })

  it("blokni siljitadi va o'chiradi", async () => {
    const w = mountEditor([text('1'), text('2'), text('3')])
    const items = w.findAll('[data-testid="block-item"]')
    await items[1]!.get('[data-testid="block-up"]').trigger('click')
    expect(last(w)).toEqual([text('2'), text('1'), text('3')])
    await items[1]!.get('[data-testid="block-down"]').trigger('click')
    expect(last(w)).toEqual([text('1'), text('3'), text('2')])
    await items[0]!.get('[data-testid="block-remove"]').trigger('click')
    expect(last(w)).toEqual([text('2'), text('3')])
    expect(items[0]!.get('[data-testid="block-up"]').attributes('disabled')).toBeDefined()
    expect(items[2]!.get('[data-testid="block-down"]').attributes('disabled')).toBeDefined()
  })

  it('matn va formula tahriri; formula jonli ko`rinishi MathView orqali', async () => {
    const w = mountEditor([text('a'), { type: 'math', tex: 'x^2' }])
    await w.get('[data-testid="block-text"]').setValue('yangi matn')
    expect(last(w)[0]).toEqual(text('yangi matn'))
    await w.get('[data-testid="block-math"]').setValue('\\sqrt{2}')
    expect(last(w)[1]).toEqual({ type: 'math', tex: '\\sqrt{2}' })
    expect(w.findComponent(MathView).props('tex')).toBe('x^2')
  })

  it("limitga yetganda qo'shish tugmalari o'chadi", () => {
    const w = mount(BlockEditor, { ...opts, props: { modelValue: [text('a')], max: 1 } })
    for (const id of ['add-text', 'add-math', 'add-image']) {
      expect(w.get(`[data-testid="${id}"]`).attributes('disabled')).toBeDefined()
    }
  })

  it('rasm yuklash: assetId blokka yoziladi; noto`g`ri tur va katta fayl serverga bormaydi', async () => {
    uploadAsset.mockResolvedValue({
      id: 'asset1',
      contentType: 'image/webp',
      size: 1,
      width: 1,
      height: 1,
    })
    fetchAssetBlob.mockResolvedValue(new Blob(['x'], { type: 'image/webp' }))
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const w = mountEditor([{ type: 'image', assetId: '' }])
    const input = w.get('[data-testid="block-file"]')
    const setFiles = (file: File) =>
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })

    setFiles(new File(['x'], 'a.gif', { type: 'image/gif' }))
    await input.trigger('change')
    setFiles(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))
    await input.trigger('change')
    expect(uploadAsset).not.toHaveBeenCalled()

    setFiles(new File(['x'], 'ok.png', { type: 'image/png' }))
    await input.trigger('change')
    await flushPromises()
    expect(uploadAsset).toHaveBeenCalledTimes(1)
    expect(last(w)).toEqual([{ type: 'image', assetId: 'asset1' }])
  })
})

describe('OptionsEditor', () => {
  const options = [
    { id: 'a', content: [text('3')] },
    { id: 'b', content: [text('4')] },
    { id: 'c', content: [text('5')] },
  ]
  const props = (extra: Record<string, unknown> = {}) => ({
    type: 'single' as const,
    options,
    correctOptionId: '',
    correctOptionIds: [] as string[],
    partialCredit: false,
    ...extra,
  })

  it("single: radio bilan bitta to'g'ri javob", async () => {
    const w = mount(OptionsEditor, { ...opts, props: props() })
    const radios = w.findAll('[data-testid="option-correct"]')
    expect(radios).toHaveLength(3)
    expect(radios[0]!.attributes('type')).toBe('radio')
    await radios[1]!.setValue(true)
    expect(w.emitted('update:correctOptionId')![0]).toEqual(['b'])
    expect(w.find('[data-testid="partial-credit"]').exists()).toBe(false)
  })

  it("multi: checkbox, qisman ball tugmasi, variant qo'shish/o'chirish", async () => {
    const w = mount(OptionsEditor, {
      ...opts,
      props: props({ type: 'multi', correctOptionIds: ['a'] }),
    })
    const boxes = w.findAll('[data-testid="option-correct"]')
    expect(boxes[0]!.attributes('type')).toBe('checkbox')
    await boxes[1]!.setValue(true)
    expect(w.emitted('update:correctOptionIds')![0]).toEqual([['a', 'b']])
    await w.get('[data-testid="partial-credit"] button').trigger('click')
    expect(w.emitted('update:partialCredit')![0]).toEqual([true])
    await w.get('[data-testid="option-add"]').trigger('click')
    expect((w.emitted('update:options')![0]![0] as unknown[]).length).toBe(4)
    await w.findAll('[data-testid="option-remove"]')[2]!.trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['c'])
  })

  it('2 ta variantda o`chirish tugmasi o`chiq', () => {
    const w = mount(OptionsEditor, { ...opts, props: props({ options: options.slice(0, 2) }) })
    for (const b of w.findAll('[data-testid="option-remove"]')) {
      expect(b.attributes('disabled')).toBeDefined()
    }
  })
})

describe('AcceptedAnswers (chip)', () => {
  it("Enter bilan qo'shadi, takroriyni rad etadi, chipni olib tashlaydi", async () => {
    const w = mount(AcceptedAnswers, { ...opts, props: { modelValue: ['Olma'] } })
    const input = w.get('[data-testid="accepted-input"]')
    await input.setValue('olma')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')).toBeUndefined() // takror
    await input.setValue('12,5')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')![0]).toEqual([['Olma', '12,5']])
    await w.get('[data-testid="accepted-chip"] button').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([[]])
  })
})

describe("QuestionPreview: o'quvchi ko'rinishi, javob kalitisiz", () => {
  const question = {
    type: 'single' as const,
    points: 2,
    content: [text('2+2 nechiga teng?')],
    options: [
      { id: 'a', content: [text('3')] },
      { id: 'b', content: [text('4')] },
    ],
  }

  it("variantlar ko'rinadi, to'g'ri javob belgisi, kalit yoki rubrika ko'rinmaydi", () => {
    const w = mount(QuestionPreview, { ...opts, props: { question } })
    expect(w.text()).toContain('2+2 nechiga teng?')
    expect(w.findAll('[data-testid="preview-option"]')).toHaveLength(2)
    expect(
      w.findAll('input[type="radio"]').every((i) => !(i.element as HTMLInputElement).checked),
    ).toBe(true)
    const html = w.html().toLowerCase()
    for (const leak of ['correct', 'checked', 'rubrika', 'mezon', "variant to'g'ri"]) {
      expect(html).not.toContain(leak)
    }
    // Komponent kalit propini umuman e'lon qilmaydi
    expect(Object.keys(QuestionPreview.props ?? {})).toEqual(['question'])
  })

  it("qo'shimcha `answer` maydoni berilsa ham DOM ga chiqmaydi", () => {
    const leaky = {
      ...question,
      answer: { optionId: 'b', acceptedAnswers: ['MAXFIY'], rubric: 'SIR' },
    }
    const w = mount(QuestionPreview, { ...opts, props: { question: leaky } })
    expect(w.html()).not.toContain('MAXFIY')
    expect(w.html()).not.toContain('SIR')
  })

  it('multi, short va essay turlari', async () => {
    const multi = mount(QuestionPreview, {
      ...opts,
      props: { question: { ...question, type: 'multi' as const } },
    })
    expect(multi.findAll('input[type="checkbox"]')).toHaveLength(2)
    const short = mount(QuestionPreview, {
      ...opts,
      props: { question: { ...question, type: 'short' as const, options: [] } },
    })
    expect(short.find('[data-testid="preview-short"]').exists()).toBe(true)
    expect(short.find('[data-testid="preview-option"]').exists()).toBe(false)
    const essay = mount(QuestionPreview, {
      ...opts,
      props: { question: { ...question, type: 'essay' as const, options: [] } },
    })
    expect(essay.find('[data-testid="preview-essay"]').exists()).toBe(true)
  })

  it("bo'sh savol: yordamchi matn", () => {
    const w = mount(QuestionPreview, { ...opts, props: { question: { ...question, content: [] } } })
    expect(w.text()).toContain(uz.exams.preview.empty)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { useConfirm } from '@/composables/useConfirm'
import PhotoUploader from './PhotoUploader.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const file = (type = 'image/jpeg', size = 1000, name = 'a.jpg') => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

async function choose(w: ReturnType<typeof mountIt>, f: File) {
  const input = w.get('[data-testid="photo-input"]')
  Object.defineProperty(input.element, 'files', { value: [f], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

function mountIt(props: Record<string, unknown> = {}) {
  return mount(PhotoUploader, {
    props: { name: 'Aliyev Vali', ...props } as never,
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }),
  )
})

describe('PhotoUploader', () => {
  it("rasm yo'q: bosh harflar va 'Rasm yuklash'; O'chirish tugmasi yo'q", () => {
    const w = mountIt()
    expect(w.text()).toContain('Rasm yuklash')
    expect(w.find('[data-testid="photo-remove"]').exists()).toBe(false)
    expect(w.get('[data-testid="avatar"]').text()).toBe('AV')
  })

  it("rasm bor: 'Almashtirish' va 'O'chirish' ko'rinadi", () => {
    const w = mountIt({ photo: '/api/v1/photos/a?exp=1&sig=s' })
    expect(w.text()).toContain('Almashtirish')
    expect(w.find('[data-testid="photo-remove"]').exists()).toBe(true)
    expect(w.get('img').attributes('src')).toContain('/photos/a')
  })

  it("canEdit=false: faqat avatar, boshqaruv yo'q", () => {
    const w = mountIt({ photo: '/api/v1/photos/a', canEdit: false })
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
  })

  it('noto`g`ri tur va katta hajm uzbekcha xato bilan rad etiladi, upload chaqirilmaydi', async () => {
    const upload = vi.fn().mockResolvedValue(undefined)
    const w = mountIt({ upload })
    await choose(w, file('image/gif', 100, 'a.gif'))
    expect(w.get('[data-testid="photo-error"]').text()).toBe(
      'Faqat JPG, PNG yoki WebP rasm yuklash mumkin',
    )
    await choose(w, file('image/png', 6 * 1024 * 1024, 'a.png'))
    expect(w.get('[data-testid="photo-error"]').text()).toBe('Rasm hajmi 5 MB dan oshmasligi kerak')
    expect(upload).not.toHaveBeenCalled()
  })

  it('tanlangan fayl darhol yuklanadi; yuklash paytida band holat', async () => {
    let done!: () => void
    const upload = vi.fn(() => new Promise<void>((r) => (done = r)))
    const w = mountIt({ upload })
    const f = file()
    await choose(w, f)
    expect(upload).toHaveBeenCalledWith(f)
    expect(w.find('[data-testid="photo-busy"]').exists()).toBe(true)
    done()
    await flushPromises()
    expect(w.find('[data-testid="photo-busy"]').exists()).toBe(false)
    expect(w.find('[data-testid="photo-error"]').exists()).toBe(false)
  })

  it('server xatosi ko`rsatiladi', async () => {
    const upload = vi.fn().mockRejectedValue({ code: 'VALIDATION_ERROR', message: 'Rasm buzilgan' })
    const w = mountIt({ upload })
    await choose(w, file())
    expect(w.find('[data-testid="photo-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="photo-busy"]').exists()).toBe(false)
  })

  it("o'chirish: tasdiqlashdan keyin chaqiriladi; bekor qilinsa chaqirilmaydi", async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const w = mountIt({ photo: '/api/v1/photos/a', upload: vi.fn(), remove })
    await w.get('[data-testid="photo-remove"]').trigger('click')
    await flushPromises()
    expect(useConfirm().state.open).toBe(true)
    useConfirm().settle(false)
    await flushPromises()
    expect(remove).not.toHaveBeenCalled()

    await w.get('[data-testid="photo-remove"]').trigger('click')
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it("kechiktirilgan rejim (yangi yozuv): 'pick'/'clear' hodisalari, preview ko'rinadi", async () => {
    const w = mountIt()
    const f = file()
    await choose(w, f)
    expect(w.emitted('pick')?.[0]).toEqual([f])
    expect(w.get('img').attributes('src')).toBe('blob:x')
    expect(w.text()).toContain('saqlanganda yuklanadi')
    await w.get('[data-testid="photo-remove"]').trigger('click')
    expect(w.emitted('clear')).toHaveLength(1)
    expect(w.find('img').exists()).toBe(false)
  })
})

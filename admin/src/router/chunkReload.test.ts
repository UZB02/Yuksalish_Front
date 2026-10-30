import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { installChunkErrorGuard, isChunkLoadError } from './chunkReload'

function memStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/x.js')

describe('isChunkLoadError', () => {
  it('chunk xatolarini taniydi', () => {
    expect(isChunkLoadError(chunkError())).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true)
    expect(isChunkLoadError(new Error('Something else'))).toBe(false)
  })
})

describe('installChunkErrorGuard', () => {
  const ok = { template: '<div />' }
  let storage: ReturnType<typeof memStorage>
  let reload: Mock<(target: string) => void>
  let shouldFail: boolean

  function setup() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: ok },
        {
          path: '/lazy',
          component: () => (shouldFail ? Promise.reject(chunkError()) : Promise.resolve(ok)),
        },
        { path: '/boom', component: () => Promise.reject(new Error('boom')) },
      ],
    })
    installChunkErrorGuard(router, { storage, reload })
    return router
  }

  beforeEach(() => {
    storage = memStorage()
    reload = vi.fn<(target: string) => void>()
    shouldFail = true
  })

  it("chunk xatosida manzilni bir marta to'liq qayta yuklaydi", async () => {
    const router = setup()
    await router.push('/').catch(() => undefined)
    await router.push('/lazy').catch(() => undefined)
    expect(reload).toHaveBeenCalledWith('/lazy')
  })

  it('loop-safe: ketma-ket ikkinchi xatoda reload qilmaydi', async () => {
    const router = setup()
    await router.push('/').catch(() => undefined)
    await router.push('/lazy').catch(() => undefined)
    await router.push('/lazy').catch(() => undefined)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("chunk bo'lmagan xatoda reload qilmaydi", async () => {
    const router = setup()
    await router.push('/').catch(() => undefined)
    await router.push('/boom').catch(() => undefined)
    expect(reload).not.toHaveBeenCalled()
  })

  it('muvaffaqiyatli navigatsiyadan keyin bayroq tozalanadi (keyingi deploy uchun)', async () => {
    const router = setup()
    await router.push('/').catch(() => undefined)
    await router.push('/lazy').catch(() => undefined)
    expect(reload).toHaveBeenCalledTimes(1)
    shouldFail = false
    await router.push('/lazy')
    shouldFail = true
    // Eslatma: chunk bir marta yuklangach vue-router uni keshlaydi, shuning uchun /boom emas yangi yo'l kerak
    expect(storage.getItem('chunk-reload-at')).toBeNull()
  })

  it("storage yo'q bo'lsa reload qilmaydi (loop xavfi)", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: ok },
        { path: '/lazy', component: () => Promise.reject(chunkError()) },
      ],
    })
    installChunkErrorGuard(router, { storage: null, reload })
    await router.push('/').catch(() => undefined)
    await router.push('/lazy').catch(() => undefined)
    expect(reload).not.toHaveBeenCalled()
  })
})

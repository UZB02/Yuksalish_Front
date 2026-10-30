import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureInstallEvents,
  DISMISS_KEY,
  DISMISS_MS,
  resetInstallPromptState,
  useInstallPrompt,
  VISITS_KEY,
} from './useInstallPrompt'

function fakeInstallEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: string }>
  }
  e.prompt = vi.fn().mockResolvedValue(undefined)
  e.userChoice = Promise.resolve({ outcome })
  return e
}

describe('useInstallPrompt', () => {
  let cleanup: (() => void) | null = null

  beforeEach(() => {
    cleanup?.()
    cleanup = null
    resetInstallPromptState()
    localStorage.clear()
    sessionStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function capture() {
    cleanup = captureInstallEvents()
  }

  it('beforeinstallprompt ushlanadi va preventDefault qilinadi', () => {
    capture()
    const e = fakeInstallEvent()
    window.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(useInstallPrompt().canPrompt.value).toBe(true)
  })

  it('promptInstall brauzer oynasini ochadi va natijani qaytaradi', async () => {
    capture()
    const e = fakeInstallEvent('dismissed')
    window.dispatchEvent(e)
    const ip = useInstallPrompt()
    expect(await ip.promptInstall()).toBe('dismissed')
    expect(e.prompt).toHaveBeenCalledOnce()
    // Hodisa bir marta ishlatiladi
    expect(ip.canPrompt.value).toBe(false)
    expect(await ip.promptInstall()).toBe('unavailable')
  })

  it("hodisa bo'lmasa install() yo'riqnomani ochadi", async () => {
    capture()
    const ip = useInstallPrompt()
    await ip.install()
    expect(ip.instructionsOpen.value).toBe(true)
  })

  it("appinstalled bo'lgach install UI yashiriladi", () => {
    capture()
    window.dispatchEvent(fakeInstallEvent())
    const ip = useInstallPrompt()
    window.dispatchEvent(new Event('appinstalled'))
    expect(ip.canInstall.value).toBe(false)
    expect(ip.canPrompt.value).toBe(false)
  })

  it("o'rnatilgan (standalone) ilovada install UI ko'rsatilmaydi", () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(display-mode: standalone)' }))
    capture()
    window.dispatchEvent(fakeInstallEvent())
    const ip = useInstallPrompt()
    expect(ip.canInstall.value).toBe(false)
    expect(ip.bannerVisible.value).toBe(false)
  })

  describe('banner', () => {
    it("birinchi tashrifda yo'q, ikkinchisida chiqadi", () => {
      capture()
      window.dispatchEvent(fakeInstallEvent())
      expect(useInstallPrompt().bannerVisible.value).toBe(false)

      cleanup?.()
      sessionStorage.clear() // yangi sessiya = ikkinchi tashrif
      capture()
      window.dispatchEvent(fakeInstallEvent())
      expect(useInstallPrompt().bannerVisible.value).toBe(true)
    })

    it("yopilgach 30 kun ko'rsatilmaydi, keyin yana chiqadi", () => {
      localStorage.setItem(VISITS_KEY, '5')
      let now = 1_000_000
      capture()
      window.dispatchEvent(fakeInstallEvent())
      const ip = useInstallPrompt(() => now)
      expect(ip.bannerVisible.value).toBe(true)

      ip.dismissBanner()
      expect(localStorage.getItem(DISMISS_KEY)).toBe(String(now))
      expect(ip.bannerVisible.value).toBe(false)

      now += DISMISS_MS - 1
      expect(useInstallPrompt(() => now).bannerVisible.value).toBe(false)
      now += 2
      expect(useInstallPrompt(() => now).bannerVisible.value).toBe(true)
    })

    it('localStorage ishlamasa ham yiqilmaydi', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      expect(() => capture()).not.toThrow()
      spy.mockRestore()
    })
  })
})

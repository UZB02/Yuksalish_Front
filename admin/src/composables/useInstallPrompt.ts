import { computed, ref, shallowRef } from 'vue'
import { currentPlatform, isStandalone } from '@/utils/platform'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const DISMISS_KEY = 'pwa-install-dismissed-at'
export const VISITS_KEY = 'pwa-visits'
const VISIT_SESSION_KEY = 'pwa-visit-counted'
/** Banner yopilgach shuncha vaqt ko'rsatilmaydi. */
export const DISMISS_MS = 30 * 24 * 60 * 60 * 1000
/** Banner shu tashrifdan boshlab chiqadi (birinchi tashrifda bezovta qilmaymiz). */
export const BANNER_MIN_VISITS = 2

function readNumber(key: string): number {
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function write(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // ignore
  }
}

// Modul darajasidagi holat: hodisa mount'dan oldin ushlanadi, komponentlar keyin ulanadi.
const deferred = shallowRef<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)
const standalone = ref(false)
const dismissedAt = ref(0)
const visits = ref(0)
const instructionsOpen = ref(false)

/**
 * `beforeinstallprompt` va `appinstalled` hodisalarini ushlaydi (main.ts da mount'dan oldin chaqiriladi).
 * Brauzerning o'z mini-paneli chiqmasligi uchun `preventDefault()` qilinadi.
 */
export function captureInstallEvents(win: Window = window): () => void {
  standalone.value = isStandalone()
  dismissedAt.value = readNumber(DISMISS_KEY)
  visits.value = readNumber(VISITS_KEY)

  // Tashrif sessiya boshiga bir marta sanaladi
  try {
    if (!sessionStorage.getItem(VISIT_SESSION_KEY)) {
      sessionStorage.setItem(VISIT_SESSION_KEY, '1')
      visits.value += 1
      write(VISITS_KEY, visits.value)
    }
  } catch {
    // ignore
  }

  const onBeforeInstall = (e: Event) => {
    e.preventDefault()
    deferred.value = e as BeforeInstallPromptEvent
  }
  const onInstalled = () => {
    installed.value = true
    deferred.value = null
    instructionsOpen.value = false
  }
  win.addEventListener('beforeinstallprompt', onBeforeInstall)
  win.addEventListener('appinstalled', onInstalled)
  return () => {
    win.removeEventListener('beforeinstallprompt', onBeforeInstall)
    win.removeEventListener('appinstalled', onInstalled)
  }
}

export function useInstallPrompt(now: () => number = Date.now) {
  const platform = currentPlatform()

  /** Brauzer o'zi o'rnatish oynasini ochishga tayyor (Android / desktop Chrome, Edge). */
  const canPrompt = computed(() => !!deferred.value && !standalone.value && !installed.value)
  /** O'rnatilgan ilova ichida yoki o'rnatib bo'lingan bo'lsa install UI ko'rsatilmaydi. */
  const canInstall = computed(() => !standalone.value && !installed.value)
  const recentlyDismissed = computed(
    () => dismissedAt.value > 0 && now() - dismissedAt.value < DISMISS_MS,
  )
  const bannerVisible = computed(
    () =>
      canInstall.value &&
      (canPrompt.value || platform === 'ios-safari') &&
      !recentlyDismissed.value &&
      visits.value >= BANNER_MIN_VISITS,
  )

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = deferred.value
    if (!event) return 'unavailable'
    // Hodisadan faqat bir marta foydalanish mumkin
    deferred.value = null
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') installed.value = true
    return outcome
  }

  /** Menyu bandi: imkon bo'lsa brauzer oynasi, aks holda qadamma-qadam yo'riqnoma. */
  async function install() {
    if (canPrompt.value) {
      await promptInstall()
      return
    }
    instructionsOpen.value = true
  }

  function dismissBanner() {
    dismissedAt.value = now()
    write(DISMISS_KEY, dismissedAt.value)
  }

  return {
    platform,
    canPrompt,
    canInstall,
    bannerVisible,
    instructionsOpen,
    promptInstall,
    install,
    dismissBanner,
    openInstructions: () => {
      instructionsOpen.value = true
    },
    closeInstructions: () => {
      instructionsOpen.value = false
    },
  }
}

/** Faqat testlar uchun. */
export function resetInstallPromptState() {
  deferred.value = null
  installed.value = false
  standalone.value = false
  dismissedAt.value = 0
  visits.value = 0
  instructionsOpen.value = false
}

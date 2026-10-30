import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { brandingApi } from '@/api/branding.api'
import type { Branding } from '@/api/types'
import { i18n } from '@/i18n'
import { resolvePhotoUrl } from '@/utils/photo'

export const BRANDING_CACHE_KEY = 'branding'

function readCache(): Branding | null {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Branding
    return typeof v?.appName === 'string' ? v : null
  } catch {
    return null
  }
}

function writeCache(v: Branding) {
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(v))
  } catch {
    // localStorage mavjud emas: kesh siz ishlaydi
  }
}

/** <link rel=...> ni topadi; originalni data-orig-href da saqlab, keyin tiklash mumkin */
function swapLinks(selector: string, href: string | null, type?: string) {
  document.querySelectorAll<HTMLLinkElement>(selector).forEach((el) => {
    if (!el.dataset.origHref) el.dataset.origHref = el.getAttribute('href') ?? ''
    if (!el.dataset.origType) el.dataset.origType = el.getAttribute('type') ?? ''
    if (href) {
      el.setAttribute('href', href)
      if (type) el.setAttribute('type', type)
      el.removeAttribute('sizes')
    } else {
      el.setAttribute('href', el.dataset.origHref)
      if (el.dataset.origType) el.setAttribute('type', el.dataset.origType)
    }
  })
}

/** Platforma brendingi (nom + logo): sidebar, login, sarlavha, favicon */
export const useBrandingStore = defineStore('branding', () => {
  const data = ref<Branding | null>(readCache())
  const pageTitle = ref('')

  const appName = computed(() => data.value?.appName ?? i18n.global.t('app.name'))
  const shortName = computed(() => data.value?.shortName ?? appName.value)
  const logoSrc = computed(() => resolvePhotoUrl(data.value?.logoUrl))

  function applyDocument() {
    document.title = pageTitle.value ? `${pageTitle.value} · ${appName.value}` : appName.value
    const icons = data.value?.icons ?? null
    swapLinks('link[rel="icon"]', icons ? resolvePhotoUrl(icons.favicon) : null, 'image/png')
    swapLinks('link[rel="apple-touch-icon"]', icons ? resolvePhotoUrl(icons.apple180) : null)
  }

  function set(next: Branding) {
    data.value = next
    writeCache(next)
    applyDocument()
  }

  function setPageTitle(title: string) {
    pageTitle.value = title
    applyDocument()
  }

  /** Keshdagi qiymat darhol qo'llanadi (birinchi chizish), keyin server bilan yangilanadi */
  async function init() {
    applyDocument()
    try {
      set(await brandingApi.get())
    } catch {
      // tarmoq yo'q / server javob bermadi: kesh yoki standart nom bilan davom etamiz
    }
  }

  return { data, appName, shortName, logoSrc, pageTitle, set, setPageTitle, applyDocument, init }
})

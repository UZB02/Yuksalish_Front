export type Platform =
  | 'ios-safari'
  | 'ios-other'
  | 'android-chromium'
  | 'desktop-chromium'
  | 'firefox-desktop'
  | 'firefox-android'
  | 'safari-macos'
  | 'in-app'
  | 'other'

export interface PlatformEnv {
  userAgent: string
  maxTouchPoints?: number
}

/** Telegram / Instagram / Facebook kabi ilova ichidagi brauzerlar (WebView): o'rnatish ishlamaydi. */
const IN_APP_RE =
  /FBAN|FBAV|FB_IAB|Instagram|Telegram|MicroMessenger|Line\/|TikTok|musical_ly|; wv\)/i

/** Brauzer muhitini (User-Agent) aniqlaydi. Sof funksiya: testlash oson. */
export function detectPlatform(env: PlatformEnv): Platform {
  const ua = env.userAgent
  if (IN_APP_RE.test(ua)) return 'in-app'

  const isIosDevice =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (env.maxTouchPoints ?? 0) > 1)
  if (isIosDevice) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser/.test(ua)) return 'ios-other'
    // "Safari" belgisi yo'q WKWebView - ilova ichidagi brauzer
    return /Safari/.test(ua) ? 'ios-safari' : 'in-app'
  }

  if (/Android/.test(ua)) return /Firefox/.test(ua) ? 'firefox-android' : 'android-chromium'
  if (/Firefox/.test(ua)) return 'firefox-desktop'
  if (/Chrome|Chromium|Edg\/|OPR\//.test(ua)) return 'desktop-chromium'
  if (/Macintosh/.test(ua) && /Safari/.test(ua)) return 'safari-macos'
  return 'other'
}

export function currentPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  return detectPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  })
}

/** Ilova o'rnatilgan holda (alohida oynada) ishlayaptimi. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const modes = ['standalone', 'fullscreen', 'window-controls-overlay']
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia.bind(window)
    if (modes.some((m) => mq(`(display-mode: ${m})`).matches)) return true
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

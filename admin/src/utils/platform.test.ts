import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectPlatform, isStandalone } from './platform'

const UA = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1',
  iosWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0',
  telegramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS',
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
}

describe('detectPlatform', () => {
  it.each([
    [UA.iosSafari, 0, 'ios-safari'],
    [UA.iosChrome, 0, 'ios-other'],
    [UA.iosWebView, 0, 'in-app'],
    [UA.ipadDesktopMode, 5, 'ios-safari'],
    [UA.androidChrome, 5, 'android-chromium'],
    [UA.androidWebView, 5, 'in-app'],
    [UA.androidFirefox, 5, 'firefox-android'],
    [UA.instagram, 0, 'in-app'],
    [UA.telegramIos, 0, 'in-app'],
    [UA.winChrome, 0, 'desktop-chromium'],
    [UA.winEdge, 0, 'desktop-chromium'],
    [UA.winFirefox, 0, 'firefox-desktop'],
    [UA.macSafari, 0, 'safari-macos'],
    ['SomeUnknownBrowser/1.0', 0, 'other'],
  ])('%s -> %s', (userAgent, maxTouchPoints, expected) => {
    expect(detectPlatform({ userAgent, maxTouchPoints })).toBe(expected)
  })
})

describe('isStandalone', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubDisplayMode(active: string | null) {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: active !== null && q === `(display-mode: ${active})`,
    }))
  }

  it.each(['standalone', 'fullscreen', 'window-controls-overlay'])('%s rejimi', (mode) => {
    stubDisplayMode(mode)
    expect(isStandalone()).toBe(true)
  })

  it('oddiy brauzer oynasida false', () => {
    stubDisplayMode(null)
    expect(isStandalone()).toBe(false)
  })

  it('iOS navigator.standalone', () => {
    stubDisplayMode(null)
    vi.stubGlobal('navigator', { standalone: true })
    expect(isStandalone()).toBe(true)
  })
})

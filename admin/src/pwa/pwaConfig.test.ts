import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_NAME, buildPwaOptions } from '../../pwa.config'

describe('PWA sozlamalari', () => {
  const opts = buildPwaOptions()

  it('manifest statik emas: backend beradi, index.html unga ulangan', () => {
    expect(APP_NAME).toBe('Yuksalish EDU')
    expect(opts.manifest).toBe(false)
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain('<link rel="manifest" href="/api/v1/branding/manifest.webmanifest" />')
  })

  it("prompt rejimi, skipWaiting o'chiq, dev'da o'chiq", () => {
    expect(opts.registerType).toBe('prompt')
    expect(opts.workbox?.skipWaiting).toBe(false)
    expect(opts.devOptions?.enabled).toBe(false)
  })

  it('SPA fallback /api ni chetlab otadi', () => {
    const w = opts.workbox!
    expect(w.navigateFallback).toBe('/index.html')
    expect(w.navigateFallbackDenylist?.some((re) => re.test('/api/v1/students'))).toBe(true)
    expect(w.navigateFallbackDenylist?.some((re) => re.test('/classes'))).toBe(false)
  })

  it('API hech qachon keshlanmaydi: faqat NetworkOnly, faqat /api/', () => {
    const rules = opts.workbox!.runtimeCaching ?? []
    for (const rule of rules) {
      expect(rule.handler).toBe('NetworkOnly')
      expect(rule.urlPattern).toBeInstanceOf(RegExp)
      expect((rule.urlPattern as RegExp).test('/api/v1/x')).toBe(true)
      expect((rule.urlPattern as RegExp).test('/assets/app.js')).toBe(false)
    }
  })

  it('kill-switch: VITE_PWA_KILL=1 bolganda selfDestroying', () => {
    expect(buildPwaOptions({}).selfDestroying).toBe(false)
    expect(buildPwaOptions({ VITE_PWA_KILL: '0' }).selfDestroying).toBe(false)
    expect(buildPwaOptions({ VITE_PWA_KILL: '1' }).selfDestroying).toBe(true)
  })
})

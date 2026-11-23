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

  it('API hech qachon keshlanmaydi: /api/ ga tegishli qoida faqat NetworkOnly', () => {
    const rules = opts.workbox!.runtimeCaching ?? []
    const api = rules.filter((r) => (r.urlPattern as RegExp).test('/api/v1/x'))
    expect(api).toHaveLength(1)
    expect(api[0]!.handler).toBe('NetworkOnly')
    expect((api[0]!.urlPattern as RegExp).test('/assets/app.js')).toBe(false)
    // boshqa qoidalar API ni ushlamaydi (keshlash faqat OCR fayllari uchun)
    for (const r of rules.filter((x) => x !== api[0])) {
      expect((r.urlPattern as RegExp).test('/api/v1/exams/questions')).toBe(false)
    }
  })

  it('OCR fayllari precache qilinmaydi, talab bo`yicha CacheFirst bilan keshlanadi (cheklangan)', () => {
    const w = opts.workbox!
    expect(w.globIgnores).toEqual(expect.arrayContaining(['ocr/**']))
    const ocr = (w.runtimeCaching ?? []).find((r) => r.handler === 'CacheFirst')!
    const re = ocr.urlPattern as RegExp
    expect(re.test('/ocr/tesseract-core-simd-lstm.wasm')).toBe(true)
    expect(re.test('/ocr/lang/uzb.traineddata.gz')).toBe(true)
    expect(re.test('/assets/ocr-engine-AbC123.js')).toBe(true)
    expect(re.test('/assets/pdf.worker.min-x1.mjs')).toBe(true)
    expect(re.test('/assets/index-AbC.js')).toBe(false)
    expect(re.test('/api/v1/ocr/x')).toBe(false)
    expect(ocr.options?.expiration?.maxEntries).toBeLessThanOrEqual(30)
    expect(ocr.options?.cacheName).toBe('ocr-assets')
  })

  it('kill-switch: VITE_PWA_KILL=1 bolganda selfDestroying', () => {
    expect(buildPwaOptions({}).selfDestroying).toBe(false)
    expect(buildPwaOptions({ VITE_PWA_KILL: '0' }).selfDestroying).toBe(false)
    expect(buildPwaOptions({ VITE_PWA_KILL: '1' }).selfDestroying).toBe(true)
  })
})

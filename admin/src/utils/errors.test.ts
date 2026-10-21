import { describe, expect, it, vi } from 'vitest'
import { ApiError, toApiError } from '@/api/errors'
import { applyServerErrors, errorMessage } from './errors'

describe('applyServerErrors', () => {
  it("details ni maydonlarga bog'laydi", () => {
    const setErrors = vi.fn()
    const err = new ApiError('VALIDATION_ERROR', 'x', 400, [
      { path: 'body.slug', message: 'Band' },
      { path: 'unknown', message: 'ignored' },
    ])
    expect(applyServerErrors(err, setErrors, ['name', 'slug'])).toBe(true)
    expect(setErrors).toHaveBeenCalledWith({ slug: 'Band' })
  })

  it("details bo'lmasa false qaytaradi", () => {
    const setErrors = vi.fn()
    expect(applyServerErrors(new ApiError('CONFLICT', 'x', 409), setErrors, ['slug'])).toBe(false)
    expect(setErrors).not.toHaveBeenCalled()
  })
})

describe('errorMessage / toApiError', () => {
  const t = (k: string) => (k === 'errors.codes.FORBIDDEN' ? "Ruxsat yo'q" : k)

  it("kod bo'yicha o'zbekcha xabar beradi", () => {
    expect(errorMessage(new ApiError('FORBIDDEN', 'x', 403), t)).toBe("Ruxsat yo'q")
  })
  it("noma'lum kodda umumiy xabar", () => {
    expect(errorMessage(new Error('x'), t)).toBe('errors.unknown')
  })
  it("javobsiz xato NETWORK bo'ladi", () => {
    expect(toApiError(new Error('Network Error')).code).toBe('NETWORK')
  })
  it("shartnomasiz javobda status bo'yicha kod tanlanadi", () => {
    const e = toApiError({ response: { status: 429, data: undefined }, message: 'x' })
    expect(e.code).toBe('RATE_LIMITED')
  })
})

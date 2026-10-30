import { describe, expect, it, vi } from 'vitest'
import { createUpdatePolicy } from './updatePolicy'
import { isAnythingDirty, registerDirtySource } from '@/composables/useDirtyRegistry'

describe('createUpdatePolicy', () => {
  it("dirty bo'lsa hech qachon reload qilmaydi", () => {
    const reload = vi.fn()
    const policy = createUpdatePolicy({ isDirty: () => true, reload })
    policy.markPending()
    expect(policy.applyNow()).toBe(false)
    expect(policy.applyOnNavigation()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it("marshrut almashganda toza bo'lsa reload qiladi", () => {
    const reload = vi.fn()
    const policy = createUpdatePolicy({ isDirty: () => false, reload })
    policy.markPending()
    expect(policy.applyOnNavigation()).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })

  it("yangilanish kutilmayotgan bo'lsa navigatsiyada reload yo'q", () => {
    const reload = vi.fn()
    const policy = createUpdatePolicy({ isDirty: () => false, reload })
    expect(policy.applyOnNavigation()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it("'Yangilash' tugmasi toza holatda darhol qo'llaydi", () => {
    const reload = vi.fn()
    const policy = createUpdatePolicy({ isDirty: () => false, reload })
    expect(policy.applyNow()).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('dirty registri bilan: forma saqlangach (toza) reload ruxsat etiladi', () => {
    let dirty = true
    const unregister = registerDirtySource(() => dirty)
    const reload = vi.fn()
    const policy = createUpdatePolicy({ isDirty: isAnythingDirty, reload })
    policy.markPending()
    expect(policy.applyOnNavigation()).toBe(false)
    dirty = false
    expect(policy.applyOnNavigation()).toBe(true)
    unregister()
    expect(isAnythingDirty()).toBe(false)
  })
})

describe('dirty registry', () => {
  it("manba xato tashlasa xavfsiz tomonga (dirty) o'tadi", () => {
    const off = registerDirtySource(() => {
      throw new Error('x')
    })
    expect(isAnythingDirty()).toBe(true)
    off()
    expect(isAnythingDirty()).toBe(false)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { auditApi } from '@/api/audit.api'
import type { AuditLogItem, Role, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import AuditLogView from './AuditLogView.vue'
import AuditDetailModal from './AuditDetailModal.vue'

vi.mock('@/api/audit.api', () => ({ auditApi: { list: vi.fn(), filters: vi.fn() } }))
vi.mock('@/api/schools.api', () => ({
  schoolsApi: {
    list: vi.fn(async () => ({
      items: [{ id: 's1', name: 'Demo maktab' }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    })),
  },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const item = (over: Partial<AuditLogItem> = {}): AuditLogItem => ({
  id: 'a1',
  createdAt: '2026-10-17T05:30:00.000Z',
  user: { id: 'u1', fullName: 'Karimova Nodira', username: 'demo.teacher1', role: 'teacher' },
  schoolId: 's1',
  school: { id: 's1', name: 'Demo maktab' },
  action: 'scores.update',
  entity: 'score',
  entityId: 'e1',
  before: { value: 80, comment: 'a' },
  after: { value: 90, comment: 'a' },
  ip: '10.0.0.1',
  ...over,
})

const page = (items: AuditLogItem[], total = items.length, totalPages = 1) => ({
  items,
  meta: { page: 1, limit: 50, total, totalPages },
})

async function mountView(role: Role = 'school_admin', query: Record<string, string> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('tok', {
    id: 'u',
    fullName: 'U',
    username: 'u',
    role,
    schoolId: 's1',
    permissions: ['audit.view'],
    isActive: true,
    lastLoginAt: null,
    createdAt: '',
  } as User)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/audit-logs', name: 'audit-logs', component: AuditLogView }],
  })
  await router.push({ path: '/audit-logs', query })
  await router.isReady()
  const w = mount(AuditLogView, { global: { plugins: [pinia, i18n, router] } })
  await flushPromises()
  return { w, router }
}

describe('AuditLogView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auditApi.filters).mockResolvedValue({
      actions: ['auth.login', 'scores.create', 'scores.update'],
      entities: ['score', 'student'],
      users: [
        { id: 'u1', fullName: 'Karimova Nodira', username: 'demo.teacher1', role: 'teacher' },
      ],
    })
    vi.mocked(auditApi.list).mockResolvedValue(page([item()]))
  })

  it("jadval: foydalanuvchi, rol, o'qiladigan harakat label va IP", async () => {
    const { w } = await mountView()
    expect(w.text()).toContain('Karimova Nodira')
    expect(w.text()).toContain("O'qituvchi")
    expect(w.text()).toContain("Xulq bahosini o'zgartirdi")
    expect(w.text()).toContain('10.0.0.1')
  })

  it("vaqt Asia/Tashkent bo'yicha aniq ko'rsatiladi (UTC 05:30 -> 10:30:00)", async () => {
    const { w } = await mountView()
    expect(w.text()).toContain('17.10.2026 10:30:00')
  })

  it("noma'lum action xom ko'rinishida (fallback)", async () => {
    vi.mocked(auditApi.list).mockResolvedValue(page([item({ action: 'weird.new_action' })]))
    const { w } = await mountView()
    expect(w.text()).toContain('weird.new_action')
  })

  it("boshlang'ich so'rov: faqat page/limit; URL dagi filtrlar so'rovga o'tadi", async () => {
    await mountView('school_admin')
    expect(auditApi.list).toHaveBeenLastCalledWith({ page: 1, limit: 50 })
    vi.clearAllMocks()
    vi.mocked(auditApi.filters).mockResolvedValue({ actions: [], entities: [], users: [] })
    vi.mocked(auditApi.list).mockResolvedValue(page([]))
    await mountView('school_admin', {
      action: 'scores.',
      from: '2026-10-01',
      page: '2',
      limit: '100',
    })
    expect(auditApi.list).toHaveBeenLastCalledWith({
      action: 'scores.',
      from: '2026-10-01',
      page: 2,
      limit: 100,
    })
  })

  it('harakat guruhi tanlansa action prefiks (`scores.`) yuboriladi va URL ga yoziladi', async () => {
    const { w, router } = await mountView()
    await w.find('[data-testid="filter-group"]').setValue('scores')
    await flushPromises()
    expect(router.currentRoute.value.query.action).toBe('scores.')
    expect(auditApi.list).toHaveBeenLastCalledWith({ action: 'scores.', page: 1, limit: 50 })
    // aniq harakat guruh ichidan
    await w.find('[data-testid="filter-action"]').setValue('scores.create')
    await flushPromises()
    expect(auditApi.list).toHaveBeenLastCalledWith({ action: 'scores.create', page: 1, limit: 50 })
    expect(router.currentRoute.value.query.action).toBe('scores.create')
  })

  it("filtr o'zgarganda 1-sahifaga qaytadi; sahifa hajmi URL da", async () => {
    vi.mocked(auditApi.list).mockResolvedValue(page([item()], 200, 4))
    const { w, router } = await mountView('school_admin', { page: '3' })
    expect(router.currentRoute.value.query.page).toBe('3')
    await w.find('[data-testid="filter-group"]').setValue('auth')
    await flushPromises()
    expect(router.currentRoute.value.query.page).toBeUndefined()
    await w.find('[data-testid="audit-limit"]').setValue('100')
    await flushPromises()
    expect(router.currentRoute.value.query.limit).toBe('100')
  })

  it('maktab filtri faqat superadmin uchun', async () => {
    const admin = await mountView('school_admin')
    expect(admin.w.text()).not.toContain('Barcha maktablar')
    const sup = await mountView('superadmin')
    expect(sup.w.text()).toContain('Barcha maktablar')
  })

  it("bo'sh natija va xato holatlari", async () => {
    vi.mocked(auditApi.list).mockResolvedValue(page([]))
    const empty = await mountView()
    expect(empty.w.text()).toContain('Yozuvlar topilmadi')
    vi.mocked(auditApi.list).mockRejectedValue(new Error('boom'))
    const failed = await mountView()
    expect(failed.w.text()).toContain("Ma'lumotlarni yuklab bo'lmadi")
  })

  it('qatorni bosganda tafsilot oynasi: before/after diff', async () => {
    const { w } = await mountView()
    await w.find('[data-testid="audit-open"]').trigger('click')
    await flushPromises()
    const body = document.body
    expect(body.querySelector('[data-testid="audit-detail"]')).not.toBeNull()
    const rows = body.querySelectorAll('[data-testid="audit-diff"] li')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toContain('value')
    expect(rows[0]!.textContent).toContain('80')
    expect(rows[0]!.textContent).toContain('90')
    w.unmount()
  })
})

describe('AuditDetailModal', () => {
  const mountModal = (it: AuditLogItem | null) =>
    mount(AuditDetailModal, {
      props: { item: it },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })

  it("diff: qo'shilgan / olib tashlangan / o'zgargan; xom JSON tugmasi", async () => {
    const w = mountModal(item({ before: { a: 1, gone: 2 }, after: { a: 5, added: { x: 1 } } }))
    await flushPromises()
    const kinds = [...document.body.querySelectorAll('[data-testid="audit-diff"] li')].map((l) =>
      l.getAttribute('data-kind'),
    )
    expect(kinds.sort()).toEqual(['added', 'changed', 'removed'])
    const toggle = [...document.body.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Xom JSON'),
    )!
    toggle.click()
    await flushPromises()
    const raw = document.body.querySelector('[data-testid="audit-raw"]')!
    expect(JSON.parse(raw.textContent!)).toEqual({
      before: { a: 1, gone: 2 },
      after: { a: 5, added: { x: 1 } },
    })
    w.unmount()
  })

  it("truncated belgisi ko'rsatiladi; before/after null bo'lsa o'zgarish yo'q xabari", async () => {
    const t = mountModal(item({ before: { a: 1, truncated: true }, after: { a: 2 } }))
    await flushPromises()
    expect(document.body.querySelector('[data-testid="audit-truncated"]')).not.toBeNull()
    t.unmount()
    const n = mountModal(item({ before: null, after: null }))
    await flushPromises()
    expect(document.body.textContent).toContain("O'zgargan maydon yo'q")
    n.unmount()
  })
})

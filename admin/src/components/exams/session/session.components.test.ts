import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type { ExamSession, ExamSessionParticipant } from '@/api/types'
import { useToast } from '@/composables/useToast'
import { buildBoardRows, type BoardRow } from '@/utils/examBoard'

const api = {
  warnParticipant: vi.fn(),
  terminateParticipant: vi.fn(),
  grantTime: vi.fn(),
  getSession: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import BulkDialogs from './BulkDialogs.vue'
import ExamHero from './ExamHero.vue'
import ExamStatStrip from './ExamStatStrip.vue'
import ExamToolbar from './ExamToolbar.vue'
import StudentDrawer from './StudentDrawer.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const T0 = new Date('2026-12-01T10:00:00.000Z').getTime()
const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
const $$ = (id: string) => [...document.body.querySelectorAll(`[data-testid="${id}"]`)]
const mounted: VueWrapper[] = []
const part = (key: string, over: Partial<ExamSessionParticipant> = {}) =>
  ({
    key,
    kind: 'student',
    fullName: `Ism ${key}`,
    className: '7-A',
    grade: 7,
    origin: null,
    hasPin: true,
    hasCode: true,
    fullTimeGranted: false,
    extraMinutes: 0,
    ...over,
  }) as ExamSessionParticipant
const rowsOf = (
  specs: { key: string; status: string; extra?: number; full?: boolean }[],
): BoardRow[] =>
  buildBoardRows(
    specs.map((s) => part(s.key, { extraMinutes: s.extra ?? 0, fullTimeGranted: s.full ?? false })),
    {
      live: {
        items: specs.map((s) => ({
          key: s.key,
          status: s.status,
          answered: 1,
          total: 2,
          leaves: 0,
          terminated: null,
          lastSeenAt: new Date(T0).toISOString(),
        })),
        staleAfterSec: 60,
      } as never,
      nowMs: T0,
      staleMs: 60_000,
    },
  )

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((f) => f.mockReset())
  for (const t of [...useToast().toasts]) useToast().dismiss(t.id)
})
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

function dialogs(mode: 'warn' | 'grant' | 'stop' | 'grantOne', rows: BoardRow[]) {
  const w = mount(BulkDialogs, {
    props: { mode, rows, sessionId: 'e1' },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}
const type = async (id: string, v: string) => {
  const el = $(id) as HTMLInputElement
  el.value = v
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}
const click = async (id: string) => {
  $(id).click()
  await flushPromises()
}

describe('BulkDialogs: ogohlantirish', () => {
  const rows = () =>
    rowsOf([
      { key: 'k1', status: 'in_progress' },
      { key: 'k2', status: 'in_progress' },
      { key: 'k3', status: 'joined' },
    ])

  it('faqat yechayotganlarga: soni ko`rsatiladi; KETMA-KET yuboriladi', async () => {
    const order: string[] = []
    let release1: () => void = () => undefined
    api.warnParticipant.mockImplementation((_s: string, key: string) => {
      order.push(key)
      return key === 'k1' ? new Promise<void>((r) => (release1 = r)) : Promise.resolve({})
    })
    const w = dialogs('warn', rows())
    await flushPromises()
    expect($('warn-only-solving').textContent).toContain('2')
    await type('warn-text', 'Diqqat')
    await click('warn-send')
    // birinchisi tugamaguncha ikkinchisi boshlanmaydi
    expect(order).toEqual(['k1'])
    release1()
    await flushPromises()
    expect(order).toEqual(['k1', 'k2'])
    expect(api.warnParticipant).toHaveBeenCalledTimes(2) // k3 (kirgan) yuborilmaydi
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.emitted('done')![0]).toEqual([[]])
    expect(JSON.stringify(useToast().toasts)).toContain('Ogohlantirish yuborildi')
  })

  it('tezlik cheklovi: "X ta yuborildi, Y ta o`tkazildi" sababi bilan; o`tkazilganlar tanlovda qoladi', async () => {
    api.warnParticipant
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new ApiError('RATE_LIMITED', 'x', 429, [{ path: '', message: '10 soniya kuting' }]),
      )
    const w = dialogs('warn', rows())
    await flushPromises()
    await type('warn-text', 'Diqqat')
    await click('warn-send')
    expect($('bulk-result').textContent).toContain(
      '1 ta yuborildi, 1 ta o‘tkazildi'.replace('‘', "'"),
    )
    expect($('bulk-result').textContent).toContain('Ism k2: 10 soniya kuting')
    expect(w.emitted('done')![0]).toEqual([['k2']])
    expect(w.emitted('close')).toBeUndefined()
  })

  it('matn majburiy; bitta o`quvchida server xatosi dialogda qoladi', async () => {
    api.warnParticipant.mockRejectedValue(
      new ApiError('RATE_LIMITED', 'x', 429, [{ path: '', message: '10 soniya kuting' }]),
    )
    dialogs('warn', rowsOf([{ key: 'k1', status: 'in_progress' }]))
    await flushPromises()
    await click('warn-send')
    expect($('warn-error').textContent).toContain('Matn kiriting')
    expect(api.warnParticipant).not.toHaveBeenCalled()
    await click('warn-preset-p1')
    await click('warn-send')
    expect($('warn-error').textContent).toContain('10 soniya')
  })

  it('yechayotgan yo`q: tugma o`chiq', async () => {
    dialogs('warn', rowsOf([{ key: 'k3', status: 'joined' }]))
    await flushPromises()
    expect($('warn-none')).not.toBeNull()
    expect(($('warn-send') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('BulkDialogs: vaqt berish', () => {
  const fresh = (list: Partial<ExamSessionParticipant>[]) =>
    ({ participants: list.map((p, i) => part(`k${i + 1}`, p)) }) as unknown as ExamSession

  it('"+N" har kimning HOZIRGI qiymatiga qo`shiladi (sessiya qayta o`qiladi), to`liq vaqt saqlanadi', async () => {
    api.getSession.mockResolvedValue(
      fresh([{ extraMinutes: 10 }, { extraMinutes: 0, fullTimeGranted: true }]),
    )
    api.grantTime.mockResolvedValue({})
    const w = dialogs(
      'grant',
      rowsOf([
        { key: 'k1', status: 'in_progress', extra: 0 },
        { key: 'k2', status: 'in_progress', extra: 0 },
      ]),
    )
    await flushPromises()
    await type('bulk-grant-minutes', '15')
    await click('bulk-grant-confirm')
    expect(api.getSession).toHaveBeenCalledWith('e1')
    expect(api.grantTime).toHaveBeenNthCalledWith(1, 'e1', 'k1', {
      fullTime: false,
      extraMinutes: 25,
    })
    expect(api.grantTime).toHaveBeenNthCalledWith(2, 'e1', 'k2', {
      fullTime: true,
      extraMinutes: 15,
    })
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('240 dan oshsa o`tkaziladi va hisobotda ko`rinadi; qolganlariga qo`shiladi', async () => {
    api.getSession.mockResolvedValue(fresh([{ extraMinutes: 235 }, { extraMinutes: 5 }]))
    api.grantTime.mockResolvedValue({})
    const w = dialogs(
      'grant',
      rowsOf([
        { key: 'k1', status: 'in_progress' },
        { key: 'k2', status: 'in_progress' },
      ]),
    )
    await flushPromises()
    await type('bulk-grant-minutes', '15')
    await click('bulk-grant-confirm')
    expect(api.grantTime).toHaveBeenCalledTimes(1)
    expect(api.grantTime).toHaveBeenCalledWith('e1', 'k2', { fullTime: false, extraMinutes: 20 })
    expect($('bulk-result').textContent).toContain(
      '1 ta qo‘shildi, 1 ta o‘tkazildi'.replace(/‘/g, "'"),
    )
    expect($('bulk-result').textContent).toContain('240')
    expect(w.emitted('done')![0]).toEqual([['k1']])
  })

  it('1..240 tekshiriladi; tekshiruvdan o`tmasa so`rov yo`q', async () => {
    dialogs('grant', rowsOf([{ key: 'k1', status: 'in_progress' }]))
    await flushPromises()
    await type('bulk-grant-minutes', '300')
    await click('bulk-grant-confirm')
    expect(api.getSession).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(uz.examBoard.bulk.grantRange)
  })

  it('band bo`lganda ikkinchi bosish yangi so`rov boshlamaydi', async () => {
    let release: (v: unknown) => void = () => undefined
    api.getSession.mockImplementation(() => new Promise((r) => (release = r)))
    dialogs('grant', rowsOf([{ key: 'k1', status: 'in_progress' }]))
    await flushPromises()
    await click('bulk-grant-confirm')
    await click('bulk-grant-confirm')
    expect(api.getSession).toHaveBeenCalledTimes(1)
    release(fresh([{}]))
    await flushPromises()
  })

  it('bitta o`quvchi: mutlaq qiymat va to`liq vaqt yuboriladi', async () => {
    api.grantTime.mockResolvedValue({})
    const w = dialogs('grantOne', rowsOf([{ key: 'k1', status: 'in_progress' }]))
    await flushPromises()
    await type('grant-extra', '12')
    await click('grant-confirm')
    expect(api.grantTime).toHaveBeenCalledWith('e1', 'k1', { fullTime: false, extraMinutes: 12 })
    expect(w.emitted('close')).toHaveLength(1)
  })
})

describe('BulkDialogs: to`xtatish', () => {
  const three = () =>
    rowsOf([
      { key: 'k1', status: 'in_progress' },
      { key: 'k2', status: 'in_progress' },
      { key: 'k3', status: 'in_progress' },
    ])

  it('ismlar ro`yxati va soni bilan qizil tugma; sabab majburiy', async () => {
    dialogs('stop', three())
    await flushPromises()
    expect($('stop-names').textContent).toContain('Ism k2')
    expect($('stop-confirm').textContent).toContain('3')
    await click('stop-confirm')
    expect($('stop-error').textContent).toContain('Sabab kiriting')
    expect(api.terminateParticipant).not.toHaveBeenCalled()
  })

  it('qisman xato: qolganlari tanlovda qoladi, hisobot ko`rinadi', async () => {
    api.terminateParticipant
      .mockResolvedValueOnce({ score: { earned: 1, max: 2 } })
      .mockRejectedValueOnce(new ApiError('CONFLICT', 'allaqachon topshirgan', 409))
      .mockResolvedValueOnce({ score: { earned: 1, max: 2 } })
    const w = dialogs('stop', three())
    await flushPromises()
    await type('stop-reason', 'Telefon')
    await click('stop-confirm')
    expect(api.terminateParticipant).toHaveBeenCalledTimes(3)
    expect(api.terminateParticipant).toHaveBeenCalledWith('e1', 'k1', 'Telefon')
    expect($('bulk-result').textContent).toContain('2 ta to')
    expect($('bulk-result').textContent).toContain('Ism k2')
    expect(w.emitted('done')![0]).toEqual([['k2']])
    expect(w.emitted('close')).toBeUndefined()
    expect(w.emitted('changed')).toBeTruthy()
  })

  it('ikki marta bosish takroriy so`rov yubormaydi', async () => {
    let release: (v: unknown) => void = () => undefined
    api.terminateParticipant.mockImplementation(() => new Promise((r) => (release = r)))
    dialogs('stop', rowsOf([{ key: 'k1', status: 'in_progress' }]))
    await flushPromises()
    await type('stop-reason', 'Sabab')
    await click('stop-confirm')
    await click('stop-confirm')
    expect(api.terminateParticipant).toHaveBeenCalledTimes(1)
    release({ score: { earned: 4, max: 20 } })
    await flushPromises()
    expect(JSON.stringify(useToast().toasts)).toContain('4 / 20')
  })
})

describe('ExamHero: asosiy tugmalar va menyu', () => {
  const base = (over: Partial<ExamSession> = {}) =>
    ({
      id: 'e1',
      title: 'Sinov',
      type: 'quiz',
      status: 'draft',
      subjectName: null,
      classes: [{ id: 'c', name: '7-A' }],
      scheduledStart: '2026-12-01T05:00:00.000Z',
      durationMin: 40,
      endsAt: new Date(T0 + 90 * 60_000).toISOString(),
      code: '123456',
      timeUp: false,
      hasAttempts: false,
      ...Object.fromEntries(
        [
          'canEdit',
          'canSubmit',
          'canApprove',
          'canOpen',
          'canClose',
          'canCancel',
          'canPrint',
          'canDelete',
          'canReopen',
          'canExtend',
          'canViewResults',
          'canCopy',
          'canReturnToDraft',
        ].map((k) => [k, false]),
      ),
      ...over,
    }) as unknown as ExamSession
  function hero(s: ExamSession, extra: Record<string, unknown> = {}) {
    const w = mount(ExamHero, {
      props: {
        s,
        pill: 'Holat',
        nowMs: T0,
        busy: false,
        canPublish: false,
        missingNames: [],
        reviewTarget: null,
        canRemind: false,
        hasBlocks: false,
        ...extra,
      },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }
  const ids = (w: VueWrapper) =>
    w.findAll('[data-testid^="act-"]').map((x) => x.attributes('data-testid'))
  const menuKeys = async () => {
    const t = $('menu-trigger')
    if (!t) return []
    t.click()
    await flushPromises()
    return $$('menu-panel')[0]
      ? [...document.body.querySelectorAll('[data-testid^="menu-item-"]')].map((x) =>
          x.getAttribute('data-testid')!.replace('menu-item-', ''),
        )
      : []
  }

  it('qoralama: Rejalashtirish; tasdiqlanmagan fan: "<Fan>ni tasdiqlash" (hech kim tugatmagan: o`chiq)', async () => {
    expect(ids(hero(base({ canSubmit: true })))).toEqual(['act-submit'])
    mounted.pop()!.unmount()
    const w = hero(base({ canSubmit: true }), {
      hasBlocks: true,
      missingNames: ['Fizika'],
      reviewTarget: { id: 'b', name: 'Fizika' },
    })
    expect(ids(w)).toEqual(['act-review'])
    expect(w.get('[data-testid="act-review"]').text()).toBe('Fizikani tasdiqlash')
    mounted.pop()!.unmount()
    const w2 = hero(base({ canSubmit: true }), { hasBlocks: true, missingNames: ['Fizika'] })
    expect(w2.get('[data-testid="act-review"]').attributes('disabled')).toBeDefined()
    expect(w2.get('[data-testid="act-review"]').attributes('title')).toBeTruthy()
  })

  it('tasdiq kutmoqda: Tasdiqlash + Rad etish; rejalashtirilgan: Boshlash + kartochkalar', () => {
    expect(ids(hero(base({ status: 'pending_approval', canApprove: true })))).toEqual([
      'act-approve',
      'act-reject',
    ])
    mounted.pop()!.unmount()
    expect(ids(hero(base({ status: 'scheduled', canOpen: true, canPrint: true })))).toEqual([
      'act-open',
      'act-print',
    ])
  })

  it('ochiq: Vaqt qo`shish + Yopish va qolgan vaqt taymeri (server vaqti bo`yicha)', () => {
    const w = hero(base({ status: 'open', canExtend: true, canClose: true }))
    expect(ids(w)).toEqual(['act-extend', 'act-close'])
    expect(w.get('[data-testid="hero-timer"]').text()).toBe('1:30:00')
  })

  it('yopilgan: Excel + (e`lon qilish shart bajarilsa) E`lon qilish, aks holda Natijalar', () => {
    const s = base({ status: 'closed', canViewResults: true })
    expect(ids(hero(s))).toEqual(['act-excel', 'act-results'])
    mounted.pop()!.unmount()
    expect(ids(hero(s, { canPublish: true }))).toEqual(['act-excel', 'act-publish'])
    mounted.pop()!.unmount()
    expect(ids(hero(base({ status: 'closed', canViewResults: false })))).toEqual([])
  })

  it('har bir can* bayrog`i: menyuda amal bor/yo`q; xavflilar ajratgichdan keyin', async () => {
    const flags: [keyof ExamSession, string, Partial<ExamSession>][] = [
      ['canEdit', 'edit', { status: 'draft' }],
      ['canViewResults', 'results', { status: 'scheduled' }],
      ['canReopen', 'reopen', { status: 'closed' }],
      ['canCopy', 'copy', { status: 'closed' }],
      ['canPrint', 'print', { status: 'closed' }],
      ['canCancel', 'cancel', { status: 'draft' }],
      ['canDelete', 'delete', { status: 'draft' }],
      ['canReturnToDraft', 'return', { status: 'scheduled' }],
    ]
    for (const [flag, key, over] of flags) {
      const on = hero(base({ ...over, [flag]: true }))
      expect(await menuKeys(), `${String(flag)} yoqilgan`).toContain(key)
      on.unmount()
      mounted.pop()
      document.body.innerHTML = ''
      const off = hero(base({ ...over, [flag]: false }))
      expect(await menuKeys(), `${String(flag)} o'chiq`).not.toContain(key)
      off.unmount()
      mounted.pop()
      document.body.innerHTML = ''
    }
    // urinishli imtihonda "qoralamaga qaytarish" yo'q
    hero(base({ status: 'scheduled', canReturnToDraft: true, hasAttempts: true }))
    expect(await menuKeys()).not.toContain('return')
    document.body.innerHTML = ''
    // xavflilar ajratgichdan keyin
    hero(base({ canEdit: true, canDelete: true }))
    await menuKeys()
    expect(document.body.querySelector('[role="separator"]')).not.toBeNull()
  })

  it('asosiy tugmada bor amal menyuda takrorlanmaydi; kod rejalashtirilgan/ochiqda ko`rinadi', async () => {
    const w = hero(base({ status: 'open', canExtend: true, canClose: true, canCopy: true }))
    expect(await menuKeys()).toEqual(['copy'])
    expect(w.get('[data-testid="hero-code"]').text()).toContain('123456')
    mounted.pop()!.unmount()
    const d = hero(base({ status: 'draft' }))
    expect(d.find('[data-testid="hero-code"]').exists()).toBe(false)
  })
})

describe('ExamStatStrip va ExamToolbar', () => {
  it('filtr katagi aria-pressed; bosilsa signal; filtrsiz katak tugma emas', async () => {
    const w = mount(ExamStatStrip, {
      props: {
        active: 'all',
        cells: [
          { key: 'all', label: 'all', value: '5', filter: 'all' },
          { key: 'problem', label: 'problem', value: '1', filter: 'problem' },
          { key: 'average', label: 'average', value: '50%' },
        ],
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-testid="stat-all"]').attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-testid="stat-problem"]').attributes('aria-pressed')).toBe('false')
    expect(w.get('[data-testid="stat-average"]').element.tagName).toBe('DIV')
    await w.get('[data-testid="stat-problem"]').trigger('click')
    expect(w.emitted('filter')![0]).toEqual(['problem'])
  })

  const tb = (over: Record<string, unknown> = {}) =>
    mount(ExamToolbar, {
      props: {
        tabs: [
          { key: 'students', label: 'O‘quvchilar' },
          { key: 'info', label: 'Ma‘lumot' },
        ],
        tab: 'students',
        q: '',
        showSearch: true,
        canAdd: true,
        selectedCount: 0,
        canWarn: true,
        canGrant: true,
        canStop: true,
        ...over,
      },
      global: { plugins: [i18n] },
    })

  it('varaqlar role=tab; tanlov bo`lsa shu joyda "N ta tanlandi" va ruxsatli amallar', async () => {
    const w = tb()
    expect(w.findAll('[role="tab"]')).toHaveLength(2)
    expect(w.find('[data-testid="toggle-add"]').exists()).toBe(true)
    await w.setProps({ selectedCount: 3 })
    expect(w.get('[data-testid="sel-count"]').text()).toBe('3 ta tanlandi')
    expect(w.find('[role="tab"]').exists()).toBe(false)
    expect(
      ['bulk-warn', 'bulk-grant', 'bulk-stop', 'bulk-clear'].every((id) =>
        w.find(`[data-testid="${id}"]`).exists(),
      ),
    ).toBe(true)
    await w.setProps({ canWarn: false, canStop: false })
    expect(w.find('[data-testid="bulk-warn"]').exists()).toBe(false)
    expect(w.find('[data-testid="bulk-stop"]').exists()).toBe(false)
    expect(w.find('[data-testid="bulk-grant"]').exists()).toBe(true)
  })
})

describe('StudentDrawer', () => {
  const drawer = (rows: BoardRow[], over: Record<string, unknown> = {}) => {
    const w = mount(StudentDrawer, {
      props: {
        row: rows[0]!,
        stage: 'during',
        shownCode: undefined,
        blockNames: {},
        canGrant: true,
        canIntervene: true,
        canClose: true,
        editable: true,
        canViewResults: true,
        ...over,
      },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('yechayotganda barcha shaxsiy amallar bor; bayroqlar bo`yicha yo`qoladi', async () => {
    const w = drawer(rowsOf([{ key: 'k1', status: 'in_progress' }]))
    const all = [
      'live-warn',
      'live-stop',
      'grant-open',
      'allow-reentry',
      'regen-pin',
      'remove-participant',
    ]
    expect(all.every((id) => $(id))).toBe(true)
    await w.setProps({ canGrant: false, canIntervene: false, canClose: false, editable: false })
    expect(all.some((id) => $(id))).toBe(false)
  })

  it('kirmagan/topshirganda ogohlantirish va to`xtatish yo`q', () => {
    drawer(rowsOf([{ key: 'k1', status: 'submitted' }]))
    expect($('live-warn')).toBeNull()
    expect($('live-stop')).toBeNull()
  })

  it('Esc yopadi; dialog aria-modal; amallar signal yuboradi', async () => {
    const w = drawer(rowsOf([{ key: 'k1', status: 'in_progress' }]))
    const d = $('student-drawer')
    expect(d.getAttribute('role')).toBe('dialog')
    expect(d.getAttribute('aria-modal')).toBe('true')
    $('live-warn').click()
    $('grant-open').click()
    expect(w.emitted('warn')).toHaveLength(1)
    expect(w.emitted('grant')).toHaveLength(1)
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('yangilanish (qator ma`lumoti o`zgarishi) panelni yopmaydi', async () => {
    const w = drawer(rowsOf([{ key: 'k1', status: 'in_progress' }]))
    await w.setProps({ row: rowsOf([{ key: 'k1', status: 'in_progress' }])[0]! })
    expect(w.emitted('close')).toBeUndefined()
    expect($('student-drawer')).not.toBeNull()
  })

  it('Keyin: fanlar bo`yicha ball va "Javoblarini ko`rish"', async () => {
    const r = buildBoardRows([part('k1')], {
      results: {
        rows: [
          {
            key: 'k1',
            status: 'submitted',
            earned: 15,
            max: 20,
            percent: 75,
            passed: true,
            answered: 5,
            total: 5,
            essayPending: 0,
            blocks: [{ blockId: 'b1', earned: 15, max: 20 }],
          },
        ],
      } as never,
      nowMs: T0,
      staleMs: 60_000,
    })
    const w = drawer(r, { stage: 'after', blockNames: { b1: 'Matematika' } })
    expect($('drawer-total').textContent).toContain('15')
    expect($('drawer-block-b1').textContent).toContain('Matematika')
    expect($('drawer-block-b1').textContent).toContain('75%')
    $('drawer-view-answers').click()
    expect(w.emitted('viewAnswers')).toHaveLength(1)
  })
})

describe('BulkDialogs: so`rovlar ketayotganda qulf', () => {
  const four = () =>
    rowsOf([
      { key: 'k1', status: 'in_progress' },
      { key: 'k2', status: 'in_progress' },
      { key: 'k3', status: 'in_progress' },
      { key: 'k4', status: 'in_progress' },
    ])
  const freshFour = () =>
    ({
      participants: ['k1', 'k2', 'k3', 'k4'].map((k) => part(k)),
    }) as unknown as ExamSession
  /** Har grantTime chaqiruvi qo'lda hal qilinadi */
  function deferred() {
    const pending: (() => void)[] = []
    api.grantTime.mockImplementation(() => new Promise<void>((r) => pending.push(() => r())))
    return {
      pending,
      async next() {
        pending.shift()!()
        await flushPromises()
      },
    }
  }
  async function start(w: VueWrapper) {
    await type('bulk-grant-minutes', '15')
    $('bulk-grant-confirm').click()
    await flushPromises()
    return w
  }
  const esc = () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

  it('band paytida X/Esc/"Bekor qilish" oynani yopmaydi; taraqqiyot "1 / 4" ko`rinadi', async () => {
    api.getSession.mockResolvedValue(freshFour())
    const d = deferred()
    const w = dialogs('grant', four())
    await flushPromises()
    await start(w)
    expect($('bulk-progress').textContent?.trim()).toBe('0 / 4')
    esc()
    await flushPromises()
    const cancel = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === uz.common.cancel,
    ) as HTMLButtonElement
    expect(cancel.disabled).toBe(true)
    cancel.click()
    await flushPromises()
    expect(w.emitted('close')).toBeUndefined()
    await d.next()
    expect($('bulk-progress').textContent?.trim()).toBe('1 / 4')
    for (let i = 0; i < 3; i++) await d.next()
    expect(api.grantTime).toHaveBeenCalledTimes(4)
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('yarim yo`lda rejim almashsa/qayta ochilsa ikkinchi sikl boshlanmaydi: so`rovlar soni aniq 4', async () => {
    api.getSession.mockResolvedValue(freshFour())
    const d = deferred()
    const w = dialogs('grant', four())
    await flushPromises()
    await start(w)
    await d.next()
    await w.setProps({ mode: null })
    await w.setProps({ mode: 'grant', rows: four() })
    await flushPromises()
    // qulf saqlanadi: tugma bosilsa ham yangi sikl yo'q
    $('bulk-grant-confirm')?.click()
    await flushPromises()
    for (let i = 0; i < 3; i++) await d.next()
    await flushPromises()
    expect(api.grantTime).toHaveBeenCalledTimes(4)
    expect(api.getSession).toHaveBeenCalledTimes(1)
  })

  it('sessionId sikl boshida eslab qolinadi: props o`zgarsa ham boshqa imtihonga so`rov ketmaydi', async () => {
    api.getSession.mockResolvedValue(freshFour())
    const d = deferred()
    const w = dialogs('grant', four())
    await flushPromises()
    await start(w)
    await d.next()
    await w.setProps({ sessionId: 'e2' })
    for (let i = 0; i < 3; i++) await d.next()
    expect(api.grantTime.mock.calls.map((c) => c[0])).toEqual(['e1', 'e1', 'e1', 'e1'])
  })

  it('komponent olib tashlansa qolgan so`rovlar to`xtaydi', async () => {
    api.getSession.mockResolvedValue(freshFour())
    const d = deferred()
    const w = dialogs('grant', four())
    await flushPromises()
    await start(w)
    await d.next()
    w.unmount()
    mounted.pop()
    await d.pending.shift()?.()
    await flushPromises()
    expect(api.grantTime).toHaveBeenCalledTimes(2)
  })

  it('ogohlantirish va to`xtatish ham band paytida yopilmaydi', async () => {
    const calls: (() => void)[] = []
    api.warnParticipant.mockImplementation(() => new Promise<void>((r) => calls.push(() => r())))
    const w = dialogs('warn', four())
    await flushPromises()
    await type('warn-text', 'Diqqat')
    $('warn-send').click()
    await flushPromises()
    expect($('bulk-progress').textContent?.trim()).toBe('0 / 4')
    esc()
    await flushPromises()
    expect(w.emitted('close')).toBeUndefined()
    for (let i = 0; i < 4; i++) {
      calls.shift()!()
      await flushPromises()
    }
    expect(api.warnParticipant).toHaveBeenCalledTimes(4)
  })
})

describe('Tor ekran va ko`rinish tafsilotlari', () => {
  it('asboblar qatori: qidiruv va "Qo`shish" bitta o`ralgan qatorda (qidiruv flex-1)', () => {
    const w = mount(ExamToolbar, {
      props: {
        tabs: [{ key: 'students', label: 'O' }],
        tab: 'students',
        q: '',
        showSearch: true,
        canAdd: true,
        selectedCount: 0,
        canWarn: true,
        canGrant: true,
        canStop: true,
      },
      global: { plugins: [i18n] },
    })
    const search = w.get('[data-testid="board-search"]').element
    const add = w.get('[data-testid="toggle-add"]').element
    expect(search.closest('div')).toBe(add.closest('div'))
    expect(search.closest('label')!.className).toContain('flex-1')
  })

  it('ProgressRing: 0% da yoy chizilmaydi (nuqta yo`q), >0 da chiziladi', async () => {
    const { default: ProgressRing } = await import('./ProgressRing.vue')
    expect(mount(ProgressRing, { props: { pct: 0 } }).findAll('circle')).toHaveLength(1)
    expect(mount(ProgressRing, { props: { pct: 40 } }).findAll('circle')).toHaveLength(2)
  })

  it('raqamlar qatori: 5 katak telefonda 3+2 (6 ustun, 2/2/2 va 3/3), kompyuterda 5 ustun', () => {
    const cells = ['a', 'b', 'c', 'd', 'e'].map((k) => ({
      key: k,
      label: 'all',
      value: '1',
      filter: 'all' as const,
    }))
    const w = mount(ExamStatStrip, { props: { cells, active: 'all' }, global: { plugins: [i18n] } })
    expect(w.get('[data-testid="stat-strip"]').classes()).toContain('grid-cols-6')
    expect(w.get('[data-testid="stat-strip"]').classes()).toContain('sm:grid-cols-5')
    const spans = w
      .findAll('[data-testid^="stat-"]')
      .filter(
        (x) =>
          x.attributes('data-testid') !== 'stat-strip' &&
          x.attributes('data-testid') !== 'stat-value',
      )
    expect(spans.map((x) => x.classes().find((c) => /^col-span-\d$/.test(c)))).toEqual([
      'col-span-2',
      'col-span-2',
      'col-span-2',
      'col-span-3',
      'col-span-3',
    ])
    const six = mount(ExamStatStrip, {
      props: { cells: [...cells, { ...cells[0]!, key: 'f' }], active: 'all' },
      global: { plugins: [i18n] },
    })
    expect(six.get('[data-testid="stat-strip"]').classes()).toContain('grid-cols-6')
    expect(six.findAll('.col-span-2')).toHaveLength(6)
  })

  it('drawer: PIN yozuvi "PIN: tayyor" ko`rinishida', () => {
    const r = rowsOf([{ key: 'k1', status: 'in_progress' }])
    mounted.push(
      mount(StudentDrawer, {
        props: {
          row: r[0]!,
          stage: 'during',
          shownCode: undefined,
          blockNames: {},
          canGrant: false,
          canIntervene: false,
          canClose: false,
          editable: false,
          canViewResults: false,
        },
        global: { plugins: [i18n] },
        attachTo: document.body,
      }),
    )
    expect($('pin-status').textContent?.trim()).toBe('PIN: tayyor')
  })
})

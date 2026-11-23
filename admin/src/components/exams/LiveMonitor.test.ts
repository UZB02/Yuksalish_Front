import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { ExamLiveResponse, ExamLiveRow } from '@/api/types'
import { ApiError } from '@/api/errors'
import { useToast } from '@/composables/useToast'

const api = { sessionLive: vi.fn(), warnParticipant: vi.fn(), terminateParticipant: vi.fn() }
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import LiveMonitor from './LiveMonitor.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const T0 = new Date('2026-12-01T10:00:00.000Z').getTime()
const iso = (ms: number) => new Date(ms).toISOString()

const row = (over: Partial<ExamLiveRow> = {}): ExamLiveRow => ({
  key: 'k1',
  kind: 'student',
  fullName: 'Aliyev Vali',
  className: '7-A',
  status: 'in_progress',
  answered: 5,
  total: 20,
  block: null,
  startedAt: iso(T0 - 600_000),
  submittedAt: null,
  deadline: iso(T0 + 25 * 60_000),
  lastSeenAt: iso(T0 - 12_000),
  leaves: 0,
  leaveDetail: { blur: 0, fullscreen: 0, hidden: 0 },
  lastLeaveAt: null,
  reconnects: 0,
  warningsSent: 0,
  warningsPending: 0,
  lastWarnAt: null,
  terminated: null,
  fullTimeGranted: false,
  extraMinutes: 0,
  allowReentry: false,
  ...over,
})
const counts = (items: ExamLiveRow[]) => ({
  total: items.length,
  notStarted: items.filter((i) => i.status === 'not_started').length,
  joined: items.filter((i) => i.status === 'joined').length,
  inProgress: items.filter((i) => i.status === 'in_progress' && !i.terminated).length,
  submitted: items.filter((i) => i.status === 'submitted' && !i.terminated).length,
  terminated: items.filter((i) => i.terminated).length,
  warned: items.filter((i) => i.warningsSent > 0).length,
  withLeaves: items.filter((i) => i.leaves > 0).length,
})
const resp = (items: ExamLiveRow[], over: Partial<ExamLiveResponse> = {}): ExamLiveResponse => ({
  serverNow: iso(Date.now()),
  session: {
    id: 'e1',
    title: 'Sinov',
    status: 'open',
    timingMode: 'common',
    scheduledStart: iso(T0 - 900_000),
    endsAt: iso(T0 + 25 * 60_000),
  },
  canIntervene: true,
  staleAfterSec: 60,
  counts: counts(items),
  items,
  joinAlert: { failures: 0, lastAt: null, alertAt: null },
  ...over,
})

const mounted: VueWrapper[] = []
function mk() {
  setActivePinia(createPinia())
  const w = mount(LiveMonitor, {
    props: { sessionId: 'e1', stage: '5.' },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms)
const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
const names = (w: VueWrapper) => w.findAll('[data-testid="live-name"]').map((x) => x.text())

let hiddenFlag = false
function setHidden(v: boolean) {
  hiddenFlag = v
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  hiddenFlag = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hiddenFlag })
  Object.values(api).forEach((f) => f.mockReset())
  api.sessionLive.mockImplementation(async () => resp([row()]))
})
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Jonli kuzatuv: mazmun', () => {
  it('hisoblagichlar, qator maydonlari, "12 s oldin", qolgan vaqt', async () => {
    const items = [
      row(),
      row({
        key: 'k2',
        fullName: 'Karimova Zilola',
        status: 'not_started',
        answered: 0,
        total: 0,
        lastSeenAt: null,
        deadline: null,
      }),
      row({
        key: 'k3',
        fullName: 'Sobirov Jasur',
        status: 'joined',
        answered: 0,
        total: 0,
        deadline: null,
      }),
      row({
        key: 'k4',
        fullName: 'Toshev Anvar',
        status: 'submitted',
        submittedAt: iso(T0 - 60_000),
      }),
      row({
        key: 'k5',
        fullName: 'Umarov Said',
        status: 'submitted',
        terminated: { at: iso(T0 - 30_000), byName: 'Nazoratchi A', reason: 'Ko‘chirdi' },
      }),
    ]
    api.sessionLive.mockResolvedValue(resp(items))
    const w = mk()
    await tick()
    const c = (k: string) => w.get(`[data-testid="count-${k}"] [data-testid="count-value"]`).text()
    expect(
      ['total', 'notStarted', 'joined', 'inProgress', 'submitted', 'terminated', 'warned'].map(c),
    ).toEqual(['5', '1', '1', '1', '1', '1', '0'])
    expect(w.get('h2').text()).toContain('5.')
    const first = w.get('[data-key="k1"]')
    expect(first.get('[data-testid="live-answered"]').text()).toContain('5 / 20')
    expect(first.get('[data-testid="live-timeleft"]').text()).toBe('25:00')
    expect(first.get('[data-testid="live-lastseen"] dd').text()).toBe('12 s oldin')
    expect(first.find('[data-testid="live-stale"]').exists()).toBe(false)
    expect(first.attributes('data-problem')).toBe('0')
    // to'xtatilgan: belgi va sabab, amallar yo'q
    const stopped = w.get('[data-key="k5"]')
    expect(stopped.attributes('data-phase')).toBe('terminated')
    expect(stopped.get('[data-testid="live-status-cell"]').text()).toBe("To'xtatilgan")
    expect(stopped.get('[data-testid="live-terminated-reason"]').text()).toContain('Ko‘chirdi')
    expect(stopped.find('[data-testid="live-warn"]').exists()).toBe(false)
    expect(w.get('[data-key="k4"]').find('[data-testid="live-stop"]').exists()).toBe(false)
    expect(w.get('[data-key="k2"]').get('[data-testid="live-timeleft"]').text()).toBe('—')
  })

  it('aloqa yo`q: 60 s dan ortiq jim bo`lsa "aloqa yo`q" (muammo)', async () => {
    api.sessionLive.mockImplementation(async () => resp([row({ lastSeenAt: iso(T0 - 50_000) })]))
    const w = mk()
    await tick()
    expect(w.find('[data-testid="live-stale"]').exists()).toBe(false)
    expect(w.get('[data-key="k1"]').attributes('data-problem')).toBe('0')
    await tick(15_000) // oxirgi signalga 65 s bo'ldi
    expect(w.get('[data-testid="live-stale"]').text()).toBe("aloqa yo'q")
    expect(w.get('[data-key="k1"]').attributes('data-problem')).toBe('1')
  })

  it('oynadan chiqish: ajratib ko`rsatiladi (belgi, soni, oxirgi vaqt); yangi chiqish "Yangi!" bilan miltillaydi', async () => {
    const withLeaves = (n: number) =>
      resp([
        row({
          leaves: n,
          leaveDetail: { blur: n, fullscreen: 0, hidden: 0 },
          lastLeaveAt: n ? iso(T0 + 1000) : null,
        }),
        row({ key: 'k2', fullName: 'Ahmedov Bobur' }),
      ])
    api.sessionLive.mockResolvedValue(withLeaves(0))
    const w = mk()
    await tick()
    expect(w.get('[data-key="k1"]').attributes('data-flash')).toBe('0')
    expect(w.get('[data-key="k1"] [data-testid="live-leaves"] dd').text()).toBe('0')
    // 1 marta chiqdi
    api.sessionLive.mockResolvedValue(withLeaves(1))
    await tick(5000)
    const r1 = w.get('[data-key="k1"]')
    expect(r1.attributes('data-problem')).toBe('1')
    expect(r1.attributes('data-flash')).toBe('1')
    expect(r1.get('[data-testid="live-leaves-count"]').text()).toBe('1 marta')
    expect(r1.find('[data-testid="live-leave-new"]').exists()).toBe(true)
    expect(r1.get('[data-testid="live-leaves-last"]').text()).toMatch(/oxirgi: \d\d:\d\d:\d\d/)
    expect(r1.classes().join(' ')).toContain('border-danger')
    // 2 marta: hisoblagich oshadi, yana "yangi"
    api.sessionLive.mockResolvedValue(withLeaves(2))
    await tick(5000)
    expect(w.get('[data-key="k1"] [data-testid="live-leaves-count"]').text()).toBe('2 marta')
    // 15 s dan keyin miltillash tugaydi, lekin chiqishlar va muammo belgisi qoladi
    api.sessionLive.mockResolvedValue(withLeaves(2))
    await tick(16_000)
    const r2 = w.get('[data-key="k1"]')
    expect(r2.attributes('data-flash')).toBe('0')
    expect(r2.attributes('data-problem')).toBe('1')
    expect(r2.get('[data-testid="live-leaves-count"]').text()).toBe('2 marta')
  })

  it('birinchi yuklashda mavjud chiqishlar "yangi" hisoblanmaydi', async () => {
    api.sessionLive.mockResolvedValue(
      resp([
        row({
          leaves: 3,
          leaveDetail: { blur: 3, fullscreen: 0, hidden: 0 },
          lastLeaveAt: iso(T0),
        }),
      ]),
    )
    const w = mk()
    await tick()
    expect(w.get('[data-key="k1"]').attributes('data-flash')).toBe('0')
    expect(w.get('[data-key="k1"]').attributes('data-problem')).toBe('1')
  })

  it('blokma-blok: joriy blok va ogohlantirish holati', async () => {
    api.sessionLive.mockResolvedValue(
      resp([
        row({
          block: {
            id: 'B2',
            title: 'Ona tili',
            index: 1,
            total: 3,
            deadline: iso(T0 + 10 * 60_000),
          },
          warningsSent: 2,
          warningsPending: 1,
        }),
      ]),
    )
    const w = mk()
    await tick()
    expect(w.get('[data-testid="live-block"]').text()).toContain('Blok 2/3')
    expect(w.get('[data-testid="live-block"]').text()).toContain('Ona tili')
    expect(w.get('[data-testid="live-timeleft"]').text()).toBe('10:00')
    expect(w.get('[data-testid="live-warnings"]').text()).toContain('2 ta yuborilgan')
    expect(w.get('[data-testid="live-warn-pending"]').text()).toContain("1 ta ko'rilmagan")
    expect(w.get('[data-testid="count-warned"] [data-testid="count-value"]').text()).toBe('1')
  })
})

describe('Jonli kuzatuv: filtr, qidiruv, saralash', () => {
  const items = () => [
    row({ key: 'a', fullName: 'Aliyev', status: 'submitted' }),
    row({ key: 'b', fullName: 'Botirov' }),
    row({
      key: 'c',
      fullName: 'Valiyev',
      leaves: 2,
      leaveDetail: { blur: 2, fullscreen: 0, hidden: 0 },
      lastLeaveAt: iso(T0),
    }),
    row({
      key: 'd',
      fullName: 'Davronov',
      status: 'not_started',
      lastSeenAt: null,
      answered: 0,
      total: 0,
    }),
    row({ key: 'e', fullName: 'Egamov', lastSeenAt: iso(T0 - 90_000) }),
  ]
  it('standart: muammolilar birinchi (ko`p chiqqan, keyin aloqasiz), keyin yechayotganlar, kirmaganlar, topshirganlar', async () => {
    api.sessionLive.mockResolvedValue(resp(items()))
    const w = mk()
    await tick()
    expect(names(w)).toEqual(['Valiyev', 'Egamov', 'Botirov', 'Davronov', 'Aliyev'])
    await w.get('[data-testid="live-sort"]').setValue('name')
    expect(names(w)).toEqual(['Aliyev', 'Botirov', 'Davronov', 'Egamov', 'Valiyev'])
  })

  it('qidiruv ism bo`yicha, holat filtri va "faqat muammolilar"', async () => {
    api.sessionLive.mockResolvedValue(resp(items()))
    const w = mk()
    await tick()
    await w.get('[data-testid="live-search"]').setValue('yev')
    expect(names(w).sort()).toEqual(['Aliyev', 'Valiyev'])
    await w.get('[data-testid="live-search"]').setValue('')
    await w.get('[data-testid="live-filter-status"]').setValue('not_started')
    expect(names(w)).toEqual(['Davronov'])
    await w.get('[data-testid="live-filter-status"]').setValue('submitted')
    expect(names(w)).toEqual(['Aliyev'])
    await w.get('[data-testid="live-filter-status"]').setValue('')
    await w.get('[data-testid="live-only-problems"] button').trigger('click')
    expect(names(w)).toEqual(['Valiyev', 'Egamov'])
    await w.get('[data-testid="live-search"]').setValue('zzz')
    expect(w.find('[data-testid="live-empty"]').text()).toContain("Filtrga mos ishtirokchi yo'q")
  })
})

describe('Jonli kuzatuv: polling', () => {
  it('har 5 soniyada yangilanadi', async () => {
    mk()
    await tick()
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    await tick(5000)
    expect(api.sessionLive).toHaveBeenCalledTimes(2)
    await tick(10_000)
    expect(api.sessionLive).toHaveBeenCalledTimes(4)
  })

  it('bir vaqtda faqat bitta so`rov: javob kechiksa yangisi boshlanmaydi', async () => {
    let release: (v: ExamLiveResponse) => void = () => undefined
    api.sessionLive.mockImplementation(() => new Promise<ExamLiveResponse>((r) => (release = r)))
    mk()
    await tick()
    await tick(30_000)
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    release(resp([row()]))
    await tick()
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    await tick(5000)
    expect(api.sessionLive).toHaveBeenCalledTimes(2)
  })

  it('sahifa yashirin bo`lsa to`xtaydi, ko`ringach darhol davom etadi', async () => {
    const w = mk()
    await tick()
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    setHidden(true)
    await tick()
    expect(w.get('[data-testid="live-status"]').text()).toContain('yashirin')
    await tick(60_000)
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    setHidden(false)
    await tick()
    expect(api.sessionLive).toHaveBeenCalledTimes(2) // darhol
    await tick(5000)
    expect(api.sessionLive).toHaveBeenCalledTimes(3)
    expect(w.get('[data-testid="live-status"]').text()).not.toContain('yashirin')
  })

  it('xato: xabar ko`rsatiladi va qayta uriniladi; o`chirilganda taymer to`xtaydi', async () => {
    api.sessionLive.mockRejectedValueOnce(new ApiError('INTERNAL', 'xato', 500))
    const w = mk()
    await tick()
    expect(w.get('[data-testid="live-status"]').text()).toContain('Qayta uriniladi')
    await tick(5000)
    expect(api.sessionLive).toHaveBeenCalledTimes(2)
    expect(w.get('[data-testid="live-status"]').text()).not.toContain('Qayta uriniladi')
    w.unmount()
    mounted.pop()
    api.sessionLive.mockClear()
    await tick(30_000)
    expect(api.sessionLive).not.toHaveBeenCalled()
  })
})

describe('Jonli kuzatuv: ogohlantirish va to`xtatish', () => {
  it('ogohlantirish: tayyor matn, matn majburiy, 200 belgi, yuboriladi va ro`yxat yangilanadi', async () => {
    api.warnParticipant.mockResolvedValue({ warningId: 'w1', sentAt: iso(T0) })
    const w = mk()
    await tick()
    await w.get('[data-testid="live-warn"]').trigger('click')
    await tick()
    expect($('warn-dialog').textContent).toContain('Aliyev Vali')
    // bo'sh matn
    $('warn-send').click()
    await tick()
    expect($('warn-error').textContent).toContain('Matn kiriting')
    expect(api.warnParticipant).not.toHaveBeenCalled()
    // tayyor matn
    $('warn-preset-p2').click()
    await tick()
    expect(($('warn-text') as HTMLTextAreaElement).value).toBe('Telefoningizni olib qo‘ying.')
    expect($('warn-counter').textContent).toBe('28/200')
    expect(($('warn-text') as HTMLTextAreaElement).maxLength).toBe(200)
    // o'z matni
    const ta = $('warn-text') as HTMLTextAreaElement
    ta.value = '  Diqqat qiling!  '
    ta.dispatchEvent(new Event('input'))
    await tick()
    api.sessionLive.mockClear()
    $('warn-send').click()
    await tick()
    expect(api.warnParticipant).toHaveBeenCalledWith('e1', 'k1', 'Diqqat qiling!')
    expect($('warn-dialog')).toBeNull()
    expect(JSON.stringify(useToast().toasts)).toContain('Ogohlantirish yuborildi')
    expect(api.sessionLive).toHaveBeenCalledTimes(1) // darhol yangilandi
  })

  it('ogohlantirish: server xatosi (tezlik cheklovi) dialogda ko`rinadi', async () => {
    api.warnParticipant.mockRejectedValue(
      new ApiError(
        'RATE_LIMITED',
        'Ogohlantirish juda tez-tez yuborilmoqda: 10 soniya kuting',
        429,
      ),
    )
    const w = mk()
    await tick()
    await w.get('[data-testid="live-warn"]').trigger('click')
    await tick()
    $('warn-preset-p1').click()
    await tick()
    $('warn-send').click()
    await tick()
    expect($('warn-error').textContent).toContain('10 soniya')
    expect($('warn-dialog')).not.toBeNull()
  })

  it('to`xtatish: sabab majburiy; tasdiqlangach yuboriladi, ball xabari, "changed" signali', async () => {
    api.terminateParticipant.mockResolvedValue({ terminated: true, score: { earned: 4, max: 20 } })
    const w = mk()
    await tick()
    await w.get('[data-testid="live-stop"]').trigger('click')
    await tick()
    expect($('stop-dialog').textContent).toContain('Aliyev Vali')
    $('stop-confirm').click()
    await tick()
    expect($('stop-error').textContent).toContain('Sabab kiriting')
    expect(api.terminateParticipant).not.toHaveBeenCalled()
    const ta = $('stop-reason') as HTMLTextAreaElement
    ta.value = '  Telefondan foydalandi '
    ta.dispatchEvent(new Event('input'))
    await tick()
    $('stop-confirm').click()
    await tick()
    expect(api.terminateParticipant).toHaveBeenCalledWith('e1', 'k1', 'Telefondan foydalandi')
    expect($('stop-dialog')).toBeNull()
    expect(JSON.stringify(useToast().toasts)).toContain('4 / 20')
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('to`xtatish xatosi (allaqachon topshirgan) dialogda qoladi', async () => {
    api.terminateParticipant.mockRejectedValue(
      new ApiError('CONFLICT', 'O‘quvchi imtihonni allaqachon topshirgan', 409),
    )
    const w = mk()
    await tick()
    await w.get('[data-testid="live-stop"]').trigger('click')
    await tick()
    const ta = $('stop-reason') as HTMLTextAreaElement
    ta.value = 'Sabab'
    ta.dispatchEvent(new Event('input'))
    await tick()
    $('stop-confirm').click()
    await tick()
    expect($('stop-error').textContent).toContain('allaqachon topshirgan')
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('imtihon ochiq emas (faqat ko`rish): amal tugmalari yo`q; faqat yechayotgan o`quvchida tugmalar bor', async () => {
    api.sessionLive.mockResolvedValue(
      resp([row(), row({ key: 'k2', fullName: 'Botirov', status: 'joined' })], {
        canIntervene: false,
      }),
    )
    const w = mk()
    await tick()
    expect(w.find('[data-testid="live-readonly"]').exists()).toBe(true)
    expect(w.find('[data-testid="live-warn"]').exists()).toBe(false)
    expect(w.find('[data-testid="live-stop"]').exists()).toBe(false)
    api.sessionLive.mockResolvedValue(
      resp([row(), row({ key: 'k2', fullName: 'Botirov', status: 'joined' })]),
    )
    await tick(5000)
    expect(w.findAll('[data-testid="live-warn"]')).toHaveLength(1)
    expect(w.find('[data-key="k2"] [data-testid="live-warn"]').exists()).toBe(false)
  })
})

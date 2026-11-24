import { describe, expect, it } from 'vitest'
import type {
  ExamLiveResponse,
  ExamLiveRow,
  ExamResultRow,
  ExamResultsResponse,
  ExamSessionParticipant,
} from '@/api/types'
import {
  buildBoardRows,
  distribution,
  fmtNum,
  fmtPct,
  fmtLeft,
  grantPlan,
  groupSections,
  layoutOf,
  matchesFilter,
  matchesSearch,
  pruneSelection,
  ringPct,
  sectionAverage,
  sortRows,
  stageOf,
  startsInParts,
  statCells,
  subjectAverages,
  warnTargets,
  type BoardRow,
  type BoardStage,
  type FilterKey,
} from './examBoard'

const T0 = new Date('2026-12-01T10:00:00.000Z').getTime()
const iso = (ms: number) => new Date(ms).toISOString()

const part = (key: string, name: string, over: Partial<ExamSessionParticipant> = {}) =>
  ({
    key,
    kind: 'student',
    fullName: name,
    className: '7-A',
    grade: 7,
    origin: null,
    hasPin: true,
    hasCode: true,
    fullTimeGranted: false,
    extraMinutes: 0,
    ...over,
  }) as ExamSessionParticipant

const liveRow = (key: string, over: Partial<ExamLiveRow> = {}) =>
  ({
    key,
    kind: 'student',
    fullName: key,
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
  }) as ExamLiveRow
const live = (items: ExamLiveRow[]) => ({ items, staleAfterSec: 60 }) as unknown as ExamLiveResponse

const resRow = (key: string, over: Partial<ExamResultRow> = {}) =>
  ({
    key,
    kind: 'student',
    fullName: key,
    className: '7-A',
    status: 'submitted',
    earned: 10,
    max: 20,
    percent: 50,
    passed: null,
    answered: 20,
    total: 20,
    timeSpentSec: 100,
    warnings: 0,
    essayPending: 0,
    rank: null,
    ...over,
  }) as ExamResultRow
const results = (rows: ExamResultRow[], summary: Record<string, unknown> = {}) =>
  ({
    session: { passPercent: null },
    summary: { averagePercent: 50, maxPercent: 90, ...summary },
    rows,
  }) as unknown as ExamResultsResponse

const build = (parts: ExamSessionParticipant[], liveItems: ExamLiveRow[], now = T0) =>
  buildBoardRows(parts, { live: live(liveItems), nowMs: now, staleMs: 60_000 })

describe('stageOf', () => {
  it('holatlar bosqichlarga: oldin / paytida / keyin', () => {
    expect(
      ['draft', 'pending_approval', 'scheduled', 'cancelled'].map((s) => stageOf(s as never)),
    ).toEqual(['before', 'before', 'before', 'before'])
    expect(stageOf('open')).toBe('during')
    expect(stageOf('closed')).toBe('after')
  })
})

describe('buildBoardRows', () => {
  it('ro`yxat (participants) asos; jonli qator key bo`yicha ulanadi, jonlisi yo`q kirmagan bo`ladi', () => {
    const rows = build([part('a', 'Aliyev'), part('b', 'Botirov')], [liveRow('a')])
    expect(rows.map((r) => [r.key, r.phase])).toEqual([
      ['a', 'in_progress'],
      ['b', 'not_started'],
    ])
    expect(rows[0]!.answered).toBe(5)
    expect(rows[0]!.timeLeftMs).toBe(25 * 60_000)
    expect(rows[0]!.idleSec).toBe(12)
    expect(rows[1]!.timeLeftMs).toBeNull()
  })

  it('aloqa yo`q: 60 s dan ortiq jimlik (faqat yechayotgan); oynadan chiqish: muammo', () => {
    const rows = build(
      [part('a', 'A'), part('b', 'B'), part('c', 'C')],
      [
        liveRow('a', { lastSeenAt: iso(T0 - 50_000) }),
        liveRow('b', { lastSeenAt: iso(T0 - 65_000) }),
        liveRow('c', { leaves: 2 }),
      ],
    )
    expect(rows.map((r) => [r.stale, r.leaving, r.problem])).toEqual([
      [false, false, false],
      [true, false, true],
      [false, true, true],
    ])
  })

  it('to`xtatilgan: terminated fazasi, sabab va kim to`xtatgani', () => {
    const rows = build(
      [part('a', 'A')],
      [
        liveRow('a', {
          status: 'submitted',
          terminated: { at: iso(T0), byName: 'Nazoratchi', reason: 'Ko‘chirdi' },
        }),
      ],
    )
    expect(rows[0]!.phase).toBe('terminated')
    expect(rows[0]!.terminated).toEqual({ reason: 'Ko‘chirdi', byName: 'Nazoratchi' })
    expect(rows[0]!.problem).toBe(false)
  })

  it('yangi chiqish belgisi (flashUntil) faqat muddati o`tmaguncha', () => {
    const base = { live: live([liveRow('a', { leaves: 1 })]), nowMs: T0, staleMs: 60_000 }
    const on = buildBoardRows([part('a', 'A')], {
      ...base,
      flashUntil: { a: T0 + 1000 },
      tickMs: T0,
    })
    const off = buildBoardRows([part('a', 'A')], { ...base, flashUntil: { a: T0 - 1 }, tickMs: T0 })
    expect(on[0]!.flashing).toBe(true)
    expect(off[0]!.flashing).toBe(false)
  })

  it('urinishlar (live yo`q) va natijalar bilan ham to`ldiriladi', () => {
    const rows = buildBoardRows([part('a', 'A'), part('b', 'B')], {
      attempts: {
        items: [
          {
            key: 'a',
            status: 'in_progress',
            answered: 3,
            total: 6,
            warnings: 2,
            lastSeenAt: null,
            deadline: null,
            allowReentry: false,
          },
        ],
        joinAlert: { failures: 0, lastAt: null, alertAt: null },
      } as never,
      results: results([resRow('b', { percent: 80, earned: 16, passed: true })]),
      nowMs: T0,
      staleMs: 60_000,
    })
    expect(rows[0]).toMatchObject({ phase: 'in_progress', answered: 3, total: 6, leaves: 2 })
    expect(rows[1]!.result).toMatchObject({ percent: 80, earned: 16, passed: true })
  })
})

describe('filtrlar, qidiruv va tartib', () => {
  const rows = (): BoardRow[] =>
    build(
      [
        part('a', 'Aliyev'),
        part('b', 'Botirov'),
        part('c', 'Valiyev'),
        part('d', 'Davronov'),
        part('e', 'Egamov'),
      ],
      [
        liveRow('a', { status: 'submitted' }),
        liveRow('b'),
        liveRow('c', { leaves: 2, leaveDetail: { blur: 2, fullscreen: 0, hidden: 0 } }),
        liveRow('d', { status: 'not_started', lastSeenAt: null, answered: 0, total: 0 }),
        liveRow('e', { lastSeenAt: iso(T0 - 90_000) }),
      ],
    )

  it('Paytida: muammolilar birinchi (chiqqan, keyin aloqasiz), keyin yechayotgan, kirmagan, topshirgan', () => {
    const names = sortRows(rows(), 'during').map((r) => r.key)
    // c (2 marta chiqdi) -> e (aloqa yo'q) -> b (yechyapti) -> d (kirmagan) -> a (topshirdi)
    expect(names).toEqual(['c', 'e', 'b', 'd', 'a'])
  })

  it('Oldin: ism bo`yicha; Keyin: ball kamayishi, natijasizlar oxirida', () => {
    const r = rows()
    expect(sortRows(r, 'before').map((x) => x.fullName)).toEqual([
      'Aliyev',
      'Botirov',
      'Davronov',
      'Egamov',
      'Valiyev',
    ])
    const after = buildBoardRows([part('a', 'A'), part('b', 'B'), part('c', 'C')], {
      results: results([resRow('a', { percent: 40 }), resRow('c', { percent: 90 })]),
      nowMs: T0,
      staleMs: 60_000,
    })
    expect(sortRows(after, 'after').map((x) => x.key)).toEqual(['c', 'a', 'b'])
  })

  it('Paytida filtr yig`indilari mos: Hammasi = Yechyapti + Topshirdi + Kirmagan + To`xtatilgan', () => {
    const r = build(
      [part('a', 'A'), part('b', 'B'), part('c', 'C'), part('d', 'D')],
      [
        liveRow('a'),
        liveRow('b', { status: 'joined' }),
        liveRow('c', { status: 'submitted' }),
        liveRow('d', {
          status: 'submitted',
          terminated: { at: iso(T0), byName: 'N', reason: 'x' },
        }),
      ],
    )
    const n = (f: FilterKey) => r.filter((x) => matchesFilter(x, f, 'during')).length
    expect(n('all')).toBe(4)
    expect(n('solving')).toBe(2)
    expect(n('submitted')).toBe(1)
    expect(n('terminated')).toBe(1)
    expect(n('notStarted')).toBe(0)
    expect(n('solving') + n('submitted') + n('notStarted') + n('terminated')).toBe(n('all'))
  })

  it('Keyin filtrlari: O`tdi / O`tmadi / Topshirmagan yig`indisi Hammasiga teng', () => {
    const r = buildBoardRows([part('a', 'A'), part('b', 'B'), part('c', 'C')], {
      results: results([
        resRow('a', { percent: 80, passed: true }),
        resRow('b', { percent: 20, passed: false }),
      ]),
      nowMs: T0,
      staleMs: 60_000,
    })
    const n = (f: FilterKey) => r.filter((x) => matchesFilter(x, f, 'after')).length
    expect([n('passed'), n('failed'), n('notSubmitted')]).toEqual([1, 1, 1])
    expect(n('passed') + n('failed') + n('notSubmitted')).toBe(n('all'))
    expect(n('submitted')).toBe(2)
  })

  it('qidiruv: ism bo`yicha, katta-kichik harfga sezgir emas', () => {
    const r = rows()
    expect(r.filter((x) => matchesSearch(x, 'YEV')).map((x) => x.key)).toEqual(['a', 'c'])
    expect(r.filter((x) => matchesSearch(x, '  '))).toHaveLength(5)
  })
})

describe('sinf bo`limlari va joylashuv', () => {
  const mk = (specs: [string, string | null, ExamSessionParticipant['kind']?, string?][]) =>
    buildBoardRows(
      specs.map(([k, cls, kind, origin]) =>
        part(k, k, { className: cls, kind: kind ?? 'student', origin: origin ?? null }),
      ),
      { nowMs: T0, staleMs: 60_000 },
    )

  it('sinflar tabiiy tartibda, sinfsizlar (nomzod, mehmon) oxirida alohida', () => {
    const s = groupSections(
      mk([
        ['1', '10-B'],
        ['2', '9-A'],
        ['3', null, 'guest', 'Boshqa maktab'],
        ['4', null, 'candidate', 'Kirish'],
        ['5', '10-A'],
      ]),
    )
    expect(s.map((x) => [x.kind, x.id])).toEqual([
      ['class', '9-A'],
      ['class', '10-A'],
      ['class', '10-B'],
      ['candidate', 'candidate'],
      ['guest', 'guest'],
    ])
  })

  it('layoutOf: 1 ta bo`lim to`liq kenglik (2/3/4 ustun), 2+ bo`lim lg da ikki ustun', () => {
    expect(layoutOf(1).wrap).not.toContain('lg:grid-cols-2')
    expect(layoutOf(1).grid).toContain('xl:grid-cols-4')
    expect(layoutOf(2).wrap).toContain('lg:grid-cols-2')
    expect(layoutOf(3).wrap).toContain('lg:grid-cols-2')
    expect(layoutOf(2).grid).toBe('grid-cols-2')
  })
})

describe('raqamlar qatori (statCells)', () => {
  const rowsDuring = () =>
    build(
      [part('a', 'A'), part('b', 'B'), part('c', 'C'), part('d', 'D'), part('e', 'E')],
      [
        liveRow('a'),
        liveRow('b', { leaves: 1 }),
        liveRow('c', { status: 'submitted' }),
        liveRow('d', { status: 'not_started' }),
      ],
    )
  const val = (cells: ReturnType<typeof statCells>, k: string) =>
    cells.find((c) => c.key === k)?.value

  it('Paytida: Hammasi/Muammoli/Yechyapti/Topshirdi/Kirmagan; To`xtatilgan faqat bo`lsa alohida', () => {
    const cells = statCells({ rows: rowsDuring(), stage: 'during', passPercent: null })
    expect(cells.map((c) => c.key)).toEqual([
      'all',
      'problem',
      'solving',
      'submitted',
      'notStarted',
    ])
    expect(cells.every((c) => c.filter)).toBe(true)
    expect(val(cells, 'all')).toBe('5')
    expect(val(cells, 'problem')).toBe('1')
    expect(val(cells, 'solving')).toBe('2')
    expect(val(cells, 'submitted')).toBe('1')
    // e: jonli qatori yo'q -> kirmagan; d ham kirmagan
    expect(val(cells, 'notStarted')).toBe('2')
    const withStopped = build(
      [part('a', 'A'), part('b', 'B')],
      [liveRow('a'), liveRow('b', { terminated: { at: iso(T0), byName: 'N', reason: 'x' } })],
    )
    const c2 = statCells({ rows: withStopped, stage: 'during', passPercent: null })
    expect(c2.map((c) => c.key)).toContain('terminated')
    expect(val(c2, 'terminated')).toBe('1')
    expect(c2.find((c) => c.key === 'terminated')!.filter).toBe('terminated')
  })

  it('Keyin: o`tish foizi bor = Hammasi/O`tdi/O`tmadi/Topshirmagan/O`rtacha; yo`q = Hammasi/Topshirdi/Topshirmagan/O`rtacha/Eng yuqori', () => {
    const r = buildBoardRows([part('a', 'A'), part('b', 'B'), part('c', 'C')], {
      results: results([
        resRow('a', { percent: 80, passed: true }),
        resRow('b', { percent: 20, passed: false }),
      ]),
      nowMs: T0,
      staleMs: 60_000,
    })
    const withPass = statCells({
      rows: r,
      stage: 'after',
      passPercent: 50,
      results: results([], { averagePercent: 50 }),
    })
    expect(withPass.map((c) => c.key)).toEqual([
      'all',
      'passed',
      'failed',
      'notSubmitted',
      'average',
    ])
    expect(withPass.filter((c) => c.filter).map((c) => c.filter)).toEqual([
      'all',
      'passed',
      'failed',
      'notSubmitted',
    ])
    expect(val(withPass, 'average')).toBe('50%')
    const noPass = statCells({
      rows: r,
      stage: 'after',
      passPercent: null,
      results: results([], { averagePercent: 50, maxPercent: 80 }),
    })
    expect(noPass.map((c) => c.key)).toEqual([
      'all',
      'submitted',
      'notSubmitted',
      'average',
      'highest',
    ])
    expect(val(noPass, 'submitted')).toBe('2')
    expect(val(noPass, 'highest')).toBe('80%')
  })

  it('Oldin: tayyorlik, fanlar a / n, o`quvchilar, boshlanishigacha (filtrsiz)', () => {
    const cells = statCells({
      rows: [],
      stage: 'before' as BoardStage,
      passPercent: null,
      readiness: 70,
      approved: 2,
      blocksTotal: 3,
      startsIn: '1 kun',
      classesCount: 2,
    })
    expect(cells.map((c) => c.value)).toEqual(['70%', '2 / 3', '0', '1 kun'])
    expect(cells.some((c) => c.filter)).toBe(false)
  })
})

describe('tanlov va ommaviy vaqt', () => {
  it('pruneSelection: ko`rinmay qolganlar tanlovdan chiqadi', () => {
    expect(pruneSelection(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual(['b', 'c'])
    expect(pruneSelection([], ['a'])).toEqual([])
  })

  it('warnTargets: faqat yechayotganlar', () => {
    const r = build(
      [part('a', 'A'), part('b', 'B'), part('c', 'C')],
      [liveRow('a'), liveRow('b', { status: 'joined' }), liveRow('c', { status: 'submitted' })],
    )
    expect(warnTargets(r).map((x) => x.key)).toEqual(['a'])
  })

  it('grantPlan: har kimning hozirgi qiymatiga qo`shiladi, 240 dan oshsa o`tkaziladi, to`liq vaqt belgisi saqlanadi', () => {
    const fresh = [
      part('a', 'A', { extraMinutes: 10 }),
      part('b', 'B', { extraMinutes: 235, fullTimeGranted: true }),
      part('c', 'C', { extraMinutes: 0, fullTimeGranted: true }),
    ]
    const plan = grantPlan(
      [
        { key: 'a', fullName: 'A' },
        { key: 'b', fullName: 'B' },
        { key: 'c', fullName: 'C' },
        { key: 'x', fullName: 'X' },
      ],
      fresh,
      15,
    )
    expect(plan[0]).toMatchObject({ key: 'a', extra: 25, fullTime: false, skipped: false })
    expect(plan[1]).toMatchObject({ key: 'b', skipped: true, reason: 'limit', current: 235 })
    expect(plan[2]).toMatchObject({ key: 'c', extra: 15, fullTime: true, skipped: false })
    // ro'yxatda endi yo'q o'quvchi: o'tkaziladi
    expect(plan[3]).toMatchObject({ key: 'x', skipped: true })
    // chegara: 225 + 15 = 240 ruxsat
    const edge = grantPlan(
      [{ key: 'a', fullName: 'A' }],
      [part('a', 'A', { extraMinutes: 225 })],
      15,
    )
    expect(edge[0]).toMatchObject({ extra: 240, skipped: false })
  })
})

describe('yordamchilar', () => {
  it('fmtLeft, startsInParts, ringPct, sectionAverage', () => {
    expect(fmtLeft(25 * 60_000)).toBe('25:00')
    expect(fmtLeft(3_725_000)).toBe('1:02:05')
    expect(fmtLeft(-5000)).toBe('00:00')
    expect(startsInParts(iso(T0 + 26 * 3_600_000 + 5 * 60_000), T0)).toEqual({ d: 1, h: 2, m: 5 })
    expect(startsInParts(iso(T0 - 1), T0)).toBeNull()
    const r = build([part('a', 'A'), part('b', 'B')], [liveRow('a', { answered: 10, total: 20 })])
    expect(ringPct(r[0]!, 'during')).toBe(50)
    expect(ringPct(r[1]!, 'during')).toBe(0)
    expect(sectionAverage(r, 'during')).toBe(25)
    expect(sectionAverage(r, 'before')).toBeNull()
  })

  it('distribution: 10 ta guruh, 100% oxirgisiga; natijasizlar hisobga olinmaydi', () => {
    const rows = [0, 9.9, 10, 55, 99, 100]
      .map((percent) => ({ result: { percent } }))
      .concat([{ result: null as never }])
    expect(distribution(rows)).toEqual([2, 1, 0, 0, 0, 1, 0, 0, 0, 2])
  })

  it('subjectAverages: fan bo`yicha ball yig`indisi / maksimal yig`indi', () => {
    const rows = [
      { result: { blocks: [{ blockId: 'm', earned: 10, max: 20 }] } },
      {
        result: {
          blocks: [
            { blockId: 'm', earned: 20, max: 20 },
            { blockId: 'f', earned: 1, max: 4 },
          ],
        },
      },
      { result: null },
    ]
    expect(subjectAverages(rows)).toEqual({ m: 75, f: 25 })
  })
})

describe('o`nlik vergul, topshirgan holati va bekor qilingan katak', () => {
  it('fmtNum / fmtPct: vergul, ortiqcha nolsiz', () => {
    expect(fmtNum(29.4)).toBe('29,4')
    expect(fmtNum(38)).toBe('38')
    expect(fmtNum(64.46)).toBe('64,5')
    expect(fmtPct(64.5)).toBe('64,5%')
    expect(fmtPct(80)).toBe('80%')
  })

  it('submitted: natija bor = true; natijalar yuklangan lekin yo`q = false; urinishdan; ikkalasi yo`q = null', () => {
    const ps = [part('a', 'A'), part('b', 'B')]
    const none = buildBoardRows(ps, { nowMs: T0, staleMs: 60_000 })
    expect(none.map((r) => r.submitted)).toEqual([null, null])
    const att = buildBoardRows(ps, {
      attempts: {
        items: [{ key: 'a', status: 'submitted', answered: 1, total: 1, warnings: 0 }],
        joinAlert: { failures: 0, lastAt: null, alertAt: null },
      } as never,
      nowMs: T0,
      staleMs: 60_000,
    })
    expect(att.map((r) => r.submitted)).toEqual([true, false])
    const res = buildBoardRows(ps, {
      results: results([resRow('b', { percent: 70 })]),
      nowMs: T0,
      staleMs: 60_000,
    })
    expect(res.map((r) => r.submitted)).toEqual([false, true])
  })

  it('Keyin: natijalar yuklanmagan va urinish ham yo`q bo`lsa kataklar "—"', () => {
    const rows = buildBoardRows([part('a', 'A')], { nowMs: T0, staleMs: 60_000 })
    const cells = statCells({ rows, stage: 'after', passPercent: null, resultsReady: false })
    const v = (k: string) => cells.find((c) => c.key === k)?.value
    expect([v('submitted'), v('notSubmitted'), v('average'), v('highest')]).toEqual([
      '—',
      '—',
      '—',
      '—',
    ])
    expect(v('all')).toBe('1')
  })

  it('Bekor qilingan: faqat Fanlar (bloklar bo`lsa), O`quvchilar, Holat', () => {
    const cells = statCells({
      rows: [],
      stage: 'before',
      passPercent: null,
      cancelled: true,
      statusText: 'Bekor qilingan',
      blocksTotal: 3,
      approved: 3,
      classesCount: 1,
    })
    expect(cells.map((c) => c.key)).toEqual(['subjects', 'students', 'status'])
    expect(cells[2]!.value).toBe('Bekor qilingan')
    const noBlocks = statCells({
      rows: [],
      stage: 'before',
      passPercent: null,
      cancelled: true,
      statusText: 'x',
    })
    expect(noBlocks.map((c) => c.key)).toEqual(['students', 'status'])
  })
})

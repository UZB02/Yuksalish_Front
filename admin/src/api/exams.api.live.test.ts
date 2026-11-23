import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExamLiveRaw } from './types'

const getData = vi.fn()
vi.mock('./http', () => ({
  getData: (...a: unknown[]) => getData(...a),
  getPage: vi.fn(),
  sendData: vi.fn(),
  deleteData: vi.fn(),
  http: {},
}))

import { examsApi, expandLive } from './exams.api'

const raw = (over: Partial<ExamLiveRaw> = {}): ExamLiveRaw =>
  ({
    serverNow: '2026-12-01T10:00:00.000Z',
    session: {
      id: 'e1',
      title: 'T',
      status: 'open',
      timingMode: 'common',
      scheduledStart: '2026-12-01T09:00:00.000Z',
      endsAt: '2026-12-01T10:30:00.000Z',
    },
    canIntervene: true,
    staleAfterSec: 60,
    counts: {
      total: 2,
      notStarted: 1,
      joined: 0,
      inProgress: 1,
      submitted: 0,
      terminated: 0,
      warned: 0,
      withLeaves: 1,
    },
    rosterKey: '2:100',
    roster: [
      { key: 'a', kind: 'student', fullName: 'Aliyev Vali', className: '7-A' },
      { key: 'b', kind: 'guest', fullName: 'Botir', className: 'Namangan', extraMinutes: 5 },
    ],
    rows: [
      { key: 'a', status: 'in_progress', answered: 3, total: 10, leaves: 2 },
      { key: 'b', status: 'not_started' },
    ],
    joinAlert: { failures: 0, lastAt: null, alertAt: null },
    ...over,
  }) as ExamLiveRaw

beforeEach(() => getData.mockReset())

describe('expandLive: ixcham javob to`liq qatorlarga', () => {
  it('ro`yxat maydonlari + standart qiymatlar (0/null/false) to`ldiriladi; kelgan qiymat ustun', () => {
    const r = raw()
    const full = expandLive(r, r.roster!)
    expect(full.items).toHaveLength(2)
    expect(full.items[0]).toMatchObject({
      key: 'a',
      fullName: 'Aliyev Vali',
      className: '7-A',
      status: 'in_progress',
      answered: 3,
      total: 10,
      leaves: 2,
      leaveDetail: { blur: 0, fullscreen: 0, hidden: 0 },
      lastSeenAt: null,
      terminated: null,
      warningsSent: 0,
      extraMinutes: 0,
    })
    expect(full.items[1]).toMatchObject({ key: 'b', kind: 'guest', extraMinutes: 5, answered: 0 })
    // tarmoq maydonlari tashlab yuboriladi
    expect(full).not.toHaveProperty('rows')
    expect(full).not.toHaveProperty('roster')
    expect(full).not.toHaveProperty('rosterKey')
    expect(full.counts.total).toBe(2)
  })
})

describe('examsApi.sessionLive: ro`yxat keshi', () => {
  it('birinchi so`rov kalitsiz; keyingisi rosterKey bilan, ro`yxatsiz javob keshdan to`ldiriladi; yangi ro`yxat kelsa almashadi', async () => {
    getData.mockResolvedValueOnce(raw({ rosterKey: '2:100' }))
    const a = await examsApi.sessionLive('S1')
    expect(getData).toHaveBeenLastCalledWith('/exams/sessions/S1/live', undefined)
    expect(a.items[0]!.fullName).toBe('Aliyev Vali')
    // keyingi javob ro'yxatsiz (kalit mos)
    getData.mockResolvedValueOnce(raw({ roster: undefined, rosterKey: '2:100' }))
    const b = await examsApi.sessionLive('S1')
    expect(getData).toHaveBeenLastCalledWith('/exams/sessions/S1/live', { roster: '2:100' })
    expect(b.items[0]!.fullName).toBe('Aliyev Vali')
    // ro'yxat o'zgardi: yangi roster keladi va kesh yangilanadi
    getData.mockResolvedValueOnce(
      raw({
        rosterKey: '2:200',
        roster: [
          { key: 'a', kind: 'student', fullName: 'Yangi Ism', className: '7-A' },
          { key: 'b', kind: 'guest', fullName: 'Botir', className: 'Namangan' },
        ],
      }),
    )
    expect((await examsApi.sessionLive('S1')).items[0]!.fullName).toBe('Yangi Ism')
    getData.mockResolvedValueOnce(raw({ roster: undefined, rosterKey: '2:200' }))
    expect((await examsApi.sessionLive('S1')).items[0]!.fullName).toBe('Yangi Ism')
    expect(getData).toHaveBeenLastCalledWith('/exams/sessions/S1/live', { roster: '2:200' })
  })

  it('imtihonlar alohida keshlanadi', async () => {
    getData.mockResolvedValueOnce(raw())
    await examsApi.sessionLive('S2')
    getData.mockResolvedValueOnce(raw())
    await examsApi.sessionLive('S3')
    expect(getData).toHaveBeenLastCalledWith('/exams/sessions/S3/live', undefined)
  })
})

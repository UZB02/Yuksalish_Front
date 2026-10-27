import { describe, expect, it } from 'vitest'
import {
  actionGroup,
  actionLabel,
  actionTone,
  auditParams,
  diffAudit,
  entityLabel,
  flatten,
  formatDiffValue,
  groupActions,
  parseAuditQuery,
  relativeTime,
  toAuditQuery,
} from './audit'

describe('flatten', () => {
  it('chuqur obyekt va massivlar kalit yollariga tekislanadi', () => {
    const m = flatten({ a: 1, b: { c: 'x', d: [10, { e: true }] }, f: null })
    expect(Object.fromEntries(m)).toEqual({
      a: 1,
      'b.c': 'x',
      'b.d[0]': 10,
      'b.d[1].e': true,
      f: null,
    })
  })
  it("bo'sh obyekt/massiv o'zi sifatida saqlanadi", () => {
    expect(Object.fromEntries(flatten({ a: {}, b: [] }))).toEqual({ a: {}, b: [] })
  })
})

describe('diffAudit', () => {
  it("faqat o'zgargan maydonlar: eski -> yangi", () => {
    const d = diffAudit({ score: 80, comment: 'a', same: 1 }, { score: 90, comment: 'a', same: 1 })
    expect(d.truncated).toBe(false)
    expect(d.changes).toEqual([{ path: 'score', kind: 'changed', before: 80, after: 90 }])
  })
  it("qo'shilgan va olib tashlangan maydonlar", () => {
    const d = diffAudit({ a: 1, gone: 2 }, { a: 1, added: 3 })
    expect(d.changes).toEqual([
      { path: 'gone', kind: 'removed', before: 2 },
      { path: 'added', kind: 'added', after: 3 },
    ])
  })
  it('chuqur obyekt: tekislangan yol bilan', () => {
    const d = diffAudit(
      { ratingImpact: { enabled: false, penalty: { late: 1 } } },
      { ratingImpact: { enabled: true, penalty: { late: 1 } } },
    )
    expect(d.changes).toEqual([
      { path: 'ratingImpact.enabled', kind: 'changed', before: false, after: true },
    ])
  })
  it('massiv elementlari indeks bilan solishtiriladi', () => {
    const d = diffAudit({ days: [1, 2, 3] }, { days: [1, 2] })
    expect(d.changes).toEqual([{ path: 'days[2]', kind: 'removed', before: 3 }])
  })
  it("before null (yaratish): hammasi qo'shilgan", () => {
    const d = diffAudit(null, { name: 'A', n: 1 })
    expect(d.changes).toEqual([
      { path: 'name', kind: 'added', after: 'A' },
      { path: 'n', kind: 'added', after: 1 },
    ])
  })
  it("after null (o'chirish): hammasi olib tashlangan", () => {
    const d = diffAudit({ name: 'A' }, null)
    expect(d.changes).toEqual([{ path: 'name', kind: 'removed', before: 'A' }])
  })
  it("ikkalasi ham null: o'zgarish yo'q", () => {
    expect(diffAudit(null, null)).toEqual({ changes: [], truncated: false })
    expect(diffAudit(undefined, undefined).changes).toEqual([])
  })
  it('truncated belgisi: aniqlanadi va diff ga kirmaydi', () => {
    const d = diffAudit({ a: 1, truncated: true }, { a: 2 })
    expect(d.truncated).toBe(true)
    expect(d.changes).toEqual([{ path: 'a', kind: 'changed', before: 1, after: 2 }])
    expect(diffAudit({ a: 1 }, { a: 1, truncated: true })).toEqual({ changes: [], truncated: true })
  })
  it("null ota yo'li chuqur obyektga almashganda shovqin yozuv tushiriladi", () => {
    const d = diffAudit({ values: null }, { values: { editWindowHours: 12 } })
    expect(d.changes).toEqual([{ path: 'values.editWindowHours', kind: 'added', after: 12 }])
    const r = diffAudit({ values: { a: 1 } }, { values: null })
    expect(r.changes).toEqual([{ path: 'values.a', kind: 'removed', before: 1 }])
  })
  it('qiymat formatlash', () => {
    expect(formatDiffValue(null)).toBe('-')
    expect(formatDiffValue('')).toBe('""')
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}')
    expect(formatDiffValue(false)).toBe('false')
  })
})

describe('harakat (action)', () => {
  const t = (k: string) => `T:${k}`
  const te = (k: string) => k === 'audit.actions.scores.create'
  it("tarjima bor bo'lsa label, yo'q bo'lsa xom action (fallback)", () => {
    expect(actionLabel('scores.create', t, te)).toBe('T:audit.actions.scores.create')
    expect(actionLabel('weird.thing', t, te)).toBe('weird.thing')
    expect(entityLabel(null, t, te)).toBe('-')
    expect(entityLabel('unknown_entity', t, te)).toBe('unknown_entity')
  })
  it('rang: create=success, update=info, delete=danger, auth=neutral, settings=primary', () => {
    expect(actionTone('scores.create')).toBe('success')
    expect(actionTone('students.import')).toBe('success')
    expect(actionTone('student.update')).toBe('info')
    expect(actionTone('scores.delete')).toBe('danger')
    expect(actionTone('auth.login')).toBe('neutral')
    expect(actionTone('auth.password_change')).toBe('neutral')
    expect(actionTone('auth.locked')).toBe('warning')
    expect(actionTone('settings.update')).toBe('primary')
    expect(actionTone('attendance.bulk')).toBe('info')
  })
  it("tarjima yo'q bo'lsa guruh va fe'ldan yig'iladi", () => {
    const t2 = (k: string) =>
      ({ 'audit.groups.subject': 'Fanlar', 'audit.verbs.delete': "o'chirdi" })[k] ?? k
    const te2 = (k: string) => k === 'audit.groups.subject' || k === 'audit.verbs.delete'
    expect(actionLabel('subject.delete', t2, te2)).toBe("Fanlar · o'chirdi")
    expect(actionLabel('subject.mystery', t2, te2)).toBe('Fanlar · mystery')
    expect(actionLabel('nogroup', t2, te2)).toBe('nogroup')
  })
  it('rasm yuklash yashil, o`chirish qizil', () => {
    expect(actionTone('teacher.photo_upload')).toBe('success')
    expect(actionTone('student.photo_delete')).toBe('danger')
  })
  it("guruhlash prefiks bo'yicha", () => {
    expect(actionGroup('scores.create')).toBe('scores')
    expect(groupActions(['scores.update', 'auth.login', 'scores.create'])).toEqual([
      { group: 'auth', actions: ['auth.login'] },
      { group: 'scores', actions: ['scores.create', 'scores.update'] },
    ])
  })
})

describe('audit URL holati', () => {
  it('standart holat: bosh query', () => {
    const s = parseAuditQuery({})
    expect(s).toMatchObject({ page: 1, limit: 50, action: '', search: '' })
    expect(toAuditQuery(s)).toEqual({})
  })
  it('filtrlar roundtrip; faqat standartdan farqlilar yoziladi', () => {
    const q = {
      from: '2026-10-01',
      to: '2026-10-17',
      userId: 'u1',
      action: 'scores.',
      entity: 'score',
      search: 'ali',
      page: '3',
      limit: '100',
    }
    const s = parseAuditQuery(q)
    expect(s).toMatchObject({ page: 3, limit: 100, action: 'scores.' })
    expect(toAuditQuery(s)).toEqual(q)
  })
  it('yaroqsiz sahifa/hajm/sana standartga qaytadi', () => {
    const s = parseAuditQuery({ page: '-2', limit: '7', from: '1/2/3' })
    expect(s).toMatchObject({ page: 1, limit: 50, from: '' })
  })
  it('API parametrlari: bosh filtrlar tushiriladi, page/limit bor', () => {
    expect(auditParams(parseAuditQuery({ action: 'auth.login', page: '2' }))).toEqual({
      action: 'auth.login',
      page: 2,
      limit: 50,
    })
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-10-17T10:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()
  it('hozirgina / daqiqa / soat / kun', () => {
    expect(relativeTime(ago(20_000), now)).toEqual({ unit: 'now', n: 0 })
    expect(relativeTime(ago(5 * 60_000), now)).toEqual({ unit: 'minutes', n: 5 })
    expect(relativeTime(ago(3 * 3_600_000), now)).toEqual({ unit: 'hours', n: 3 })
    expect(relativeTime(ago(2 * 86_400_000), now)).toEqual({ unit: 'days', n: 2 })
  })
  it('7 kundan eski - null', () => {
    expect(relativeTime(ago(8 * 86_400_000), now)).toBeNull()
  })
  it('maxDays = Infinity: kun, oy va yil birliklari', () => {
    const day = 86_400_000
    expect(relativeTime(ago(8 * day), now, Infinity)).toEqual({ unit: 'days', n: 8 })
    expect(relativeTime(ago(29 * day), now, Infinity)).toEqual({ unit: 'days', n: 29 })
    expect(relativeTime(ago(65 * day), now, Infinity)).toEqual({ unit: 'months', n: 2 })
    expect(relativeTime(ago(364 * day), now, Infinity)).toEqual({ unit: 'months', n: 11 })
    expect(relativeTime(ago(800 * day), now, Infinity)).toEqual({ unit: 'years', n: 2 })
  })
})

// ---- Before/after diff ----
export type DiffKind = 'added' | 'removed' | 'changed'

export interface DiffEntry {
  path: string
  kind: DiffKind
  before?: unknown
  after?: unknown
}

export interface AuditDiff {
  changes: DiffEntry[]
  /** Server katta obyektni qisqartirgan (`truncated: true`) */
  truncated: boolean
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Chuqur obyektni `a.b[0].c` ko'rinishidagi kalit yo'llariga tekislaydi (bo'sh obyekt/massiv - o'zi). */
export function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>()
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) {
      if (v.length === 0 && path) out.set(path, v)
      v.forEach((item, i) => walk(item, `${path}[${i}]`))
    } else if (isPlainObject(v)) {
      const keys = Object.keys(v)
      if (keys.length === 0 && path) out.set(path, v)
      for (const k of keys) walk(v[k], path ? `${path}.${k}` : k)
    } else if (path) {
      out.set(path, v)
    } else {
      out.set('(qiymat)', v)
    }
  }
  walk(value, prefix)
  return out
}

const same = (a: unknown, b: unknown) =>
  a === b || (typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b))

const isTruncated = (v: unknown) => isPlainObject(v) && v.truncated === true

function stripTruncated(v: unknown): unknown {
  if (!isPlainObject(v) || !('truncated' in v)) return v
  const { truncated: _t, ...rest } = v
  void _t
  return rest
}

/**
 * Eski/yangi qiymatlar farqi: faqat o'zgargan maydonlar (eski -> yangi), qo'shilgan va olib tashlangan.
 * `before` null bo'lsa hammasi "qo'shilgan", `after` null bo'lsa hammasi "olib tashlangan".
 */
export function diffAudit(before: unknown, after: unknown): AuditDiff {
  const truncated = isTruncated(before) || isTruncated(after)
  const b = before == null ? null : flatten(stripTruncated(before))
  const a = after == null ? null : flatten(stripTruncated(after))
  const changes: DiffEntry[] = []
  if (b) {
    for (const [path, bv] of b) {
      if (!a) changes.push({ path, kind: 'removed', before: bv })
      else if (!a.has(path)) changes.push({ path, kind: 'removed', before: bv })
      else if (!same(bv, a.get(path))) {
        changes.push({ path, kind: 'changed', before: bv, after: a.get(path) })
      }
    }
  }
  if (a) {
    for (const [path, av] of a) {
      if (!b || !b.has(path)) changes.push({ path, kind: 'added', after: av })
    }
  }
  return { changes: dropEmptyParents(changes), truncated }
}

const isEmptyValue = (v: unknown) =>
  v === null ||
  v === undefined ||
  (Array.isArray(v) && v.length === 0) ||
  (isPlainObject(v) && Object.keys(v).length === 0)

const isChildPath = (parent: string, path: string) =>
  path.startsWith(`${parent}.`) || path.startsWith(`${parent}[`)

/**
 * `values: null` -> `values: { a: 1 }` kabi almashuvda bo'sh "ota" yo'li shovqin: undan chuqurroq
 * yo'llar allaqachon ko'rsatilgan bo'lsa, bo'sh ota yozuvi tushiriladi.
 */
function dropEmptyParents(changes: DiffEntry[]): DiffEntry[] {
  return changes.filter((c) => {
    if (c.kind === 'changed') return true
    const value = c.kind === 'removed' ? c.before : c.after
    if (!isEmptyValue(value)) return true
    const opposite = c.kind === 'removed' ? 'added' : 'removed'
    return !changes.some((o) => o.kind === opposite && isChildPath(c.path, o.path))
  })
}

/** Diff qiymatini ko'rsatish: null -> "-", obyekt -> JSON, qolgani satr. */
export function formatDiffValue(v: unknown): string {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'string') return v === '' ? '""' : v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ---- Harakat (action) ----
export type ActionTone = 'success' | 'info' | 'danger' | 'neutral' | 'primary' | 'warning'

export const actionGroup = (action: string): string => action.split('.')[0] ?? action

/** Harakat rangi: create=yashil, update=ko'k, delete=qizil, auth/login=kulrang, settings=binafsha. */
export function actionTone(action: string): ActionTone {
  const [group = '', ...rest] = action.split('.')
  const verb = rest.join('.')
  if (group === 'auth') return verb === 'locked' || verb === 'refresh_reuse' ? 'warning' : 'neutral'
  if (group === 'settings') return 'primary'
  if (/(^|[._])(create|created|import|add|upload)/.test(verb)) return 'success'
  if (/(^|[._])(delete|remove|deactivate)/.test(verb)) return 'danger'
  if (/login|logout/.test(verb)) return 'neutral'
  return 'info'
}

/**
 * i18n kaliti `audit.actions.<action>`. Yo'q bo'lsa (yangi qo'shilgan harakat) guruh va fe'ldan
 * yig'iladi: "Fanlar · o'chirdi". Ikkalasi ham noma'lum bo'lsa xom action qaytariladi.
 */
export function actionLabel(
  action: string,
  t: (key: string) => string,
  te: (key: string) => boolean,
): string {
  const key = `audit.actions.${action}`
  if (te(key)) return t(key)
  const [group = '', ...rest] = action.split('.')
  const verb = rest.join('.')
  const groupKey = `audit.groups.${group}`
  const verbKey = `audit.verbs.${verb}`
  if (!verb || (!te(groupKey) && !te(verbKey))) return action
  return `${te(groupKey) ? t(groupKey) : group} · ${te(verbKey) ? t(verbKey) : verb}`
}

export function groupLabel(
  group: string,
  t: (key: string) => string,
  te: (key: string) => boolean,
): string {
  const key = `audit.groups.${group}`
  return te(key) ? t(key) : group
}

export function entityLabel(
  entity: string | null,
  t: (key: string) => string,
  te: (key: string) => boolean,
): string {
  if (!entity) return '-'
  const key = `audit.entities.${entity}`
  return te(key) ? t(key) : entity
}

/** Harakatlar ro'yxatini prefiks (guruh) bo'yicha ajratadi: { guruh: [action, ...] } (tartib saqlanadi). */
export function groupActions(actions: readonly string[]): { group: string; actions: string[] }[] {
  const map = new Map<string, string[]>()
  for (const a of [...actions].sort()) {
    const g = actionGroup(a)
    map.set(g, [...(map.get(g) ?? []), a])
  }
  return [...map].map(([group, list]) => ({ group, actions: list }))
}

// ---- URL holati ----
export interface AuditQueryState {
  from: string
  to: string
  userId: string
  /** aniq action yoki guruh prefiksi (`scores.`) */
  action: string
  entity: string
  schoolId: string
  search: string
  page: number
  limit: number
}

export const AUDIT_DEFAULTS: AuditQueryState = {
  from: '',
  to: '',
  userId: '',
  action: '',
  entity: '',
  schoolId: '',
  search: '',
  page: 1,
  limit: 50,
}

type Query = Record<string, unknown>
const str = (v: unknown): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? String(v[0] ?? '') : ''
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const LIMITS = [50, 100]

export function parseAuditQuery(query: Query): AuditQueryState {
  const page = Number(str(query.page))
  const limit = Number(str(query.limit))
  const date = (v: unknown) => (DATE_RE.test(str(v)) ? str(v) : '')
  return {
    from: date(query.from),
    to: date(query.to),
    userId: str(query.userId),
    action: str(query.action),
    entity: str(query.entity),
    schoolId: str(query.schoolId),
    search: str(query.search),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: LIMITS.includes(limit) ? limit : AUDIT_DEFAULTS.limit,
  }
}

/** Standart qiymatlar URL ga yozilmaydi. */
export function toAuditQuery(state: AuditQueryState): Record<string, string> {
  const q: Record<string, string> = {}
  for (const k of ['from', 'to', 'userId', 'action', 'entity', 'schoolId', 'search'] as const) {
    if (state[k]) q[k] = state[k]
  }
  if (state.page > 1) q.page = String(state.page)
  if (state.limit !== AUDIT_DEFAULTS.limit) q.limit = String(state.limit)
  return q
}

/** API parametrlari: bo'sh qiymatlar tushiriladi (clean ham qiladi), `to` kun oxirigacha qamrab olinadi serverda. */
export function auditParams(state: AuditQueryState) {
  return {
    ...toAuditQuery({ ...state, page: 1, limit: AUDIT_DEFAULTS.limit }),
    page: state.page,
    limit: state.limit,
  }
}

// ---- Nisbiy vaqt ----
export interface RelativeTime {
  unit: 'now' | 'minutes' | 'hours' | 'days'
  n: number
}

/** "5 daqiqa oldin" kabi nisbiy vaqt; 7 kundan eski bo'lsa `null` (faqat aniq sana ko'rsatiladi). */
export function relativeTime(iso: string, now: number = Date.now()): RelativeTime | null {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return { unit: 'now', n: 0 }
  if (min < 60) return { unit: 'minutes', n: min }
  const hours = Math.floor(min / 60)
  if (hours < 24) return { unit: 'hours', n: hours }
  const days = Math.floor(hours / 24)
  return days < 7 ? { unit: 'days', n: days } : null
}

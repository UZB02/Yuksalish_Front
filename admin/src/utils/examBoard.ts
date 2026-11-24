import type {
  ExamAttemptsResponse,
  ExamLiveResponse,
  ExamParticipantKind,
  ExamResultsResponse,
  ExamSession,
  ExamSessionParticipant,
  ExamSessionStatus,
} from '@/api/types'

/**
 * Imtihon sahifasi ("4B: sinflar yonma-yon") uchun sof funksiyalar: holatlar, filtrlar, tartib, sinf bo'limlari,
 * raqamlar qatori va ommaviy amallar rejasi. DOM va API yo'q: hammasi unit-test qilinadi.
 */

/** Sahifa bosqichi: Oldin (qoralama..rejalashtirilgan), Paytida (ochiq), Keyin (yopilgan) */
export type BoardStage = 'before' | 'during' | 'after'
export function stageOf(status: ExamSessionStatus): BoardStage {
  if (status === 'open') return 'during'
  if (status === 'closed') return 'after'
  return 'before'
}

export type BoardPhase =
  'not_started' | 'joined' | 'in_progress' | 'submitted' | 'auto_submitted' | 'terminated'

/** Ishtirokchi qatori: ro'yxat (s.participants) + jonli/urinish/natija ma'lumoti (key bo'yicha ulangan) */
export interface BoardRow {
  key: string
  fullName: string
  className: string | null
  origin: string | null
  kind: ExamParticipantKind
  p: ExamSessionParticipant
  phase: BoardPhase
  answered: number
  total: number
  leaves: number
  leaveDetail: { blur: number; fullscreen: number; hidden: number } | null
  lastLeaveAt: string | null
  lastSeenAt: string | null
  idleSec: number | null
  stale: boolean
  leaving: boolean
  flashing: boolean
  /** Aloqa yo'q yoki oynadan chiqqan (faqat yechayotganlar) */
  problem: boolean
  /** Qolgan vaqt (ms), faqat yechayotganda */
  timeLeftMs: number | null
  block: { index: number; total: number; title: string } | null
  warningsSent: number
  warningsPending: number
  terminated: { reason: string; byName: string | null } | null
  allowReentry: boolean
  /**
   * Topshirgan (Keyin bosqichi): natijalar yuklangan bo'lsa natija bor-yo'qligidan; yuklanmagan bo'lsa urinish
   * holatidan; ikkalasi ham bo'lmasa null ("noma'lum", noto'g'ri son chiqarilmaydi)
   */
  submitted: boolean | null
  /** Natija (yopilgan imtihon, canViewResults) */
  result: {
    earned: number
    max: number
    percent: number
    passed: boolean | null
    essayPending: number
    blocks: { blockId: string; earned: number; max: number }[]
  } | null
}

export interface BuildOpts {
  live?: ExamLiveResponse | null
  attempts?: ExamAttemptsResponse | null
  results?: ExamResultsResponse | null
  /** Server vaqti (ms): "n s oldin" va qolgan vaqt shunga ko'ra */
  nowMs: number
  /** Aloqa uzilgan deb hisoblash chegarasi (ms) */
  staleMs: number
  /** Yangi chiqish belgisi tugash vaqtlari (ms) */
  flashUntil?: Record<string, number>
  /** flashUntil bilan solishtiriladigan joriy vaqt (ms) */
  tickMs?: number
}

export const STALE_DEFAULT_SEC = 60

/** Ishtirokchilar ro'yxatiga jonli, urinish va natija qatorlarini key bo'yicha ulaydi */
export function buildBoardRows(participants: ExamSessionParticipant[], o: BuildOpts): BoardRow[] {
  const live = new Map((o.live?.items ?? []).map((r) => [r.key, r]))
  const att = new Map((o.attempts?.items ?? []).map((r) => [r.key, r]))
  const res = new Map((o.results?.rows ?? []).map((r) => [r.key, r]))
  const tick = o.tickMs ?? o.nowMs
  return participants.map((p) => {
    const l = live.get(p.key)
    const a = att.get(p.key)
    const r = res.get(p.key)
    const terminatedRaw =
      l?.terminated ?? (a?.terminated ? { ...a.terminated, byName: null } : null)
    const status = (l?.status ?? a?.status ?? r?.status ?? 'not_started') as BoardPhase
    const phase: BoardPhase = terminatedRaw || r?.terminated ? 'terminated' : status
    const lastSeenAt = l?.lastSeenAt ?? a?.lastSeenAt ?? null
    const running = phase === 'in_progress'
    const idleMs =
      lastSeenAt && (running || phase === 'joined') ? o.nowMs - Date.parse(lastSeenAt) : null
    const leaves = l?.leaves ?? a?.warnings ?? 0
    const stale = running && idleMs !== null && idleMs > o.staleMs
    const leaving = running && leaves > 0
    const dl = l?.block?.deadline ?? l?.deadline ?? a?.deadline ?? null
    const terminated = terminatedRaw
      ? {
          reason: terminatedRaw.reason,
          byName: (terminatedRaw as { byName?: string | null }).byName ?? null,
        }
      : r?.terminated
        ? { reason: r.terminated.reason, byName: r.terminated.byName }
        : null
    const hasResult = !!(r && r.percent !== null && r.earned !== null && r.max !== null)
    const submitted: boolean | null = hasResult
      ? true
      : o.results
        ? false
        : o.attempts
          ? phase === 'submitted' || phase === 'auto_submitted' || phase === 'terminated'
          : null
    return {
      key: p.key,
      fullName: p.fullName,
      className: p.className,
      origin: p.origin,
      kind: p.kind,
      p,
      phase,
      answered: l?.answered ?? a?.answered ?? r?.answered ?? 0,
      total: l?.total ?? a?.total ?? r?.total ?? 0,
      leaves,
      leaveDetail: l?.leaveDetail ?? null,
      lastLeaveAt: l?.lastLeaveAt ?? null,
      lastSeenAt,
      idleSec: idleMs === null ? null : Math.max(0, Math.floor(idleMs / 1000)),
      stale,
      leaving,
      flashing: (o.flashUntil?.[p.key] ?? 0) > tick,
      problem: stale || leaving,
      timeLeftMs: running && dl ? Date.parse(dl) - o.nowMs : null,
      block: l?.block ? { index: l.block.index, total: l.block.total, title: l.block.title } : null,
      warningsSent: l?.warningsSent ?? 0,
      warningsPending: l?.warningsPending ?? 0,
      terminated,
      allowReentry: l?.allowReentry ?? a?.allowReentry ?? false,
      submitted,
      result:
        r && r.percent !== null && r.earned !== null && r.max !== null
          ? {
              earned: r.earned,
              max: r.max,
              percent: r.percent,
              passed: r.passed,
              essayPending: r.essayPending ?? 0,
              blocks: r.blocks ?? [],
            }
          : null,
    }
  })
}

/** Kasr ajratgich vergul (loyiha qoidasi): 29,4 / 64,5 (ortiqcha nollarsiz, 1 xona) */
export function fmtNum(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',')
}
export const fmtPct = (n: number) => `${fmtNum(n)}%`

// ---- Filtrlar ----
export type FilterKey =
  | 'all'
  | 'problem'
  | 'solving'
  | 'submitted'
  | 'notStarted'
  | 'terminated'
  | 'passed'
  | 'failed'
  | 'notSubmitted'

const isFinished = (r: BoardRow) => r.phase === 'submitted' || r.phase === 'auto_submitted'

export function matchesFilter(r: BoardRow, f: FilterKey, stage: BoardStage): boolean {
  switch (f) {
    case 'all':
      return true
    case 'problem':
      return r.problem && r.phase === 'in_progress'
    case 'solving':
      return r.phase === 'joined' || r.phase === 'in_progress'
    case 'submitted':
      // Keyin: topshirganlar (to'xtatilganlar ham natijaga ega); Paytida: to'xtatilganlar alohida katak
      return stage === 'after' ? r.submitted === true : isFinished(r)
    case 'notStarted':
      return r.phase === 'not_started'
    case 'terminated':
      return r.phase === 'terminated'
    case 'passed':
      return r.result?.passed === true
    case 'failed':
      return r.result?.passed === false
    case 'notSubmitted':
      return r.submitted === false
  }
}

export function matchesSearch(r: BoardRow, q: string): boolean {
  const n = q.trim().toLowerCase()
  return !n || r.fullName.toLowerCase().includes(n)
}

// ---- Tartib ----
const RANK: Record<BoardPhase, number> = {
  in_progress: 1,
  joined: 2,
  not_started: 3,
  submitted: 4,
  auto_submitted: 4,
  terminated: 5,
}
const byName = (a: BoardRow, b: BoardRow) => a.fullName.localeCompare(b.fullName, 'uz')

/**
 * Paytida: muammoli (yangi chiqqanlar, ko'p chiqqanlar) -> yechyapti -> kirgan -> kirmagan -> topshirgan -> to'xtatilgan.
 * Keyin: ball kamayishi (natijasizlar oxirida). Oldin: ism.
 */
export function sortRows(rows: BoardRow[], stage: BoardStage): BoardRow[] {
  const list = [...rows]
  if (stage === 'after') {
    return list.sort((a, b) => {
      const pa = a.result?.percent ?? -1
      const pb = b.result?.percent ?? -1
      return pb - pa || byName(a, b)
    })
  }
  if (stage === 'before') return list.sort(byName)
  return list.sort((a, b) => {
    const ra = a.problem && a.phase === 'in_progress' ? 0 : RANK[a.phase]
    const rb = b.problem && b.phase === 'in_progress' ? 0 : RANK[b.phase]
    if (ra !== rb) return ra - rb
    if (ra === 0) {
      if (a.flashing !== b.flashing) return a.flashing ? -1 : 1
      if (a.leaves !== b.leaves) return b.leaves - a.leaves
    }
    return byName(a, b)
  })
}

// ---- Sinf bo'limlari ----
export interface BoardSection {
  /** Sinf nomi yoki "candidate" / "guest" / "none" */
  id: string
  kind: 'class' | 'candidate' | 'guest' | 'none'
  title: string
  rows: BoardRow[]
}

const natural = (a: string, b: string) => a.localeCompare(b, 'uz', { numeric: true })

/** Sinf bo'yicha bo'limlar; sinfsizlar (mehmon/nomzod) alohida bo'limlarda oxirida */
export function groupSections(rows: BoardRow[]): BoardSection[] {
  const map = new Map<string, BoardSection>()
  for (const r of rows) {
    const cls = r.className
    const id = cls ?? (r.kind === 'candidate' ? 'candidate' : r.kind === 'guest' ? 'guest' : 'none')
    const kind = cls
      ? 'class'
      : id === 'candidate'
        ? 'candidate'
        : id === 'guest'
          ? 'guest'
          : 'none'
    let s = map.get(id)
    if (!s) {
      s = { id, kind, title: cls ?? '', rows: [] }
      map.set(id, s)
    }
    s.rows.push(r)
  }
  const rank = { class: 0, candidate: 1, guest: 2, none: 3 }
  return [...map.values()].sort((a, b) =>
    a.kind !== b.kind ? rank[a.kind] - rank[b.kind] : natural(a.title, b.title),
  )
}

/** Bo'limlar soniga ko'ra tartib: 1 ta bo'lim - to'liq kenglik (2/3/4 ustunli katak), 2+ - lg da ikki ustun */
export function layoutOf(sectionCount: number): { wrap: string; grid: string } {
  return sectionCount <= 1
    ? { wrap: 'grid grid-cols-1', grid: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' }
    : { wrap: 'grid grid-cols-1 items-start gap-x-5 lg:grid-cols-2', grid: 'grid-cols-2' }
}

// ---- Raqamlar qatori ----
export interface StatCell {
  key: string
  /** i18n kaliti (examBoard.cells.*) */
  label: string
  value: string
  sub?: string
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  /** Bor bo'lsa katak filtr tugmasi (aria-pressed) */
  filter?: FilterKey
}

export interface StatCtx {
  rows: BoardRow[]
  stage: BoardStage
  passPercent: number | null
  results?: ExamResultsResponse | null
  /** Oldin: tayyorlik % va fanlar */
  readiness?: number
  approved?: number
  blocksTotal?: number
  /** Oldin: boshlanishigacha matn */
  startsIn?: string
  classesCount?: number
  /** Bekor qilingan imtihon: faqat Fanlar, O'quvchilar va Holat */
  cancelled?: boolean
  statusText?: string
  /** Keyin: natijalar yuklanganmi (yuklanmagan bo'lsa ball/foiz kataklari "—") */
  resultsReady?: boolean
}

const count = (rows: BoardRow[], f: FilterKey, stage: BoardStage) =>
  rows.filter((r) => matchesFilter(r, f, stage)).length

export function statCells(c: StatCtx): StatCell[] {
  const { rows, stage } = c
  const n = rows.length
  if (stage === 'before' && c.cancelled) {
    const out: StatCell[] = []
    if (c.blocksTotal) {
      out.push({
        key: 'subjects',
        label: 'subjects',
        value: `${c.approved ?? 0} / ${c.blocksTotal}`,
      })
    }
    out.push({
      key: 'students',
      label: 'students',
      value: String(n),
      sub: String(c.classesCount ?? 0),
    })
    out.push({ key: 'status', label: 'status', value: c.statusText ?? '—', tone: 'danger' })
    return out
  }
  if (stage === 'before') {
    return [
      { key: 'readiness', label: 'readiness', value: `${c.readiness ?? 0}%`, tone: 'primary' },
      {
        key: 'subjects',
        label: 'subjects',
        value: c.blocksTotal ? `${c.approved ?? 0} / ${c.blocksTotal}` : '—',
      },
      { key: 'students', label: 'students', value: String(n), sub: String(c.classesCount ?? 0) },
      { key: 'startsIn', label: 'startsIn', value: c.startsIn ?? '—' },
    ]
  }
  if (stage === 'during') {
    const out: StatCell[] = [
      { key: 'all', label: 'all', value: String(n), filter: 'all' },
      {
        key: 'problem',
        label: 'problem',
        value: String(count(rows, 'problem', stage)),
        tone: 'warning',
        filter: 'problem',
      },
      {
        key: 'solving',
        label: 'solving',
        value: String(count(rows, 'solving', stage)),
        filter: 'solving',
      },
      {
        key: 'submitted',
        label: 'submitted',
        value: String(count(rows, 'submitted', stage)),
        tone: 'success',
        filter: 'submitted',
      },
      {
        key: 'notStarted',
        label: 'notStarted',
        value: String(count(rows, 'notStarted', stage)),
        filter: 'notStarted',
      },
    ]
    const stopped = count(rows, 'terminated', stage)
    if (stopped > 0) {
      out.push({
        key: 'terminated',
        label: 'terminated',
        value: String(stopped),
        tone: 'danger',
        filter: 'terminated',
      })
    }
    return out
  }
  // after
  const ready = c.resultsReady !== false
  const dash = '—'
  const sum = ready ? c.results?.summary : undefined
  const avg = sum?.averagePercent
  const avgCell: StatCell = {
    key: 'average',
    label: 'average',
    value: avg === null || avg === undefined ? dash : fmtPct(avg),
    tone: 'primary',
  }
  /** Topshirgan/topshirmagan: natija yoki urinishdan; hech biri yo'q bo'lsa "—" */
  const known = rows.every((r) => r.submitted !== null)
  const subVal = known ? String(count(rows, 'submitted', stage)) : dash
  const notVal = known ? String(count(rows, 'notSubmitted', stage)) : dash
  const notSub: StatCell = {
    key: 'notSubmitted',
    label: 'notSubmitted',
    value: notVal,
    filter: 'notSubmitted',
  }
  if (c.passPercent !== null) {
    return [
      { key: 'all', label: 'all', value: String(n), filter: 'all' },
      {
        key: 'passed',
        label: 'passed',
        value: ready ? String(count(rows, 'passed', stage)) : dash,
        tone: 'success',
        filter: 'passed',
      },
      {
        key: 'failed',
        label: 'failed',
        value: ready ? String(count(rows, 'failed', stage)) : dash,
        tone: 'danger',
        filter: 'failed',
      },
      notSub,
      avgCell,
    ]
  }
  const top = sum?.maxPercent
  return [
    { key: 'all', label: 'all', value: String(n), filter: 'all' },
    { key: 'submitted', label: 'submitted', value: subVal, tone: 'success', filter: 'submitted' },
    notSub,
    avgCell,
    {
      key: 'highest',
      label: 'highest',
      value: top === null || top === undefined ? dash : fmtPct(top),
      tone: 'success',
    },
  ]
}

/** Tayyorlik foizi: fanlar tasdig'i 60%, ishtirokchilar bor 20%, hammada PIN tayyor 20% */
export function readinessPct(s: ExamSession): number {
  const blocks = (s.blocks ?? []).filter((b) => !b.legacy)
  const need = blocks.filter((b) => b.contributors.length > 0)
  const approved = need.filter((b) => b.status === 'ready' && b.readyBy !== 'contributor').length
  const subj = need.length ? approved / need.length : 1
  const hasP = s.participants.length > 0 ? 1 : 0
  const pins = s.participants.length
    ? s.participants.filter((p) => p.hasPin).length / s.participants.length
    : 0
  return Math.round(subj * 60 + hasP * 20 + pins * 20)
}

/** Boshlanishigacha: kun/soat/daqiqa (o'tgan bo'lsa null) */
export function startsInParts(
  startIso: string,
  nowMs: number,
): { d: number; h: number; m: number } | null {
  const ms = Date.parse(startIso) - nowMs
  if (!(ms > 0)) return null
  const m = Math.floor(ms / 60_000)
  return { d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60), m: m % 60 }
}

/** Qolgan vaqt: h:mm:ss yoki mm:ss */
export function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

/** Halqa foizi: Paytida javob berilgan ulush; Keyin ball foizi */
export function ringPct(r: BoardRow, stage: BoardStage): number {
  if (stage === 'after') return Math.round(r.result?.percent ?? 0)
  return r.total > 0 ? Math.min(100, Math.round((r.answered / r.total) * 100)) : 0
}

/** Sinf bo'limi sarlavhasida: o'rtacha bajarilish (Paytida) yoki o'rtacha foiz (Keyin) */
export function sectionAverage(rows: BoardRow[], stage: BoardStage): number | null {
  if (stage === 'after') {
    const done = rows.filter((r) => r.result)
    return done.length
      ? Math.round(done.reduce((s, r) => s + r.result!.percent, 0) / done.length)
      : null
  }
  if (stage === 'during') {
    return rows.length
      ? Math.round(rows.reduce((sum, r) => sum + ringPct(r, stage), 0) / rows.length)
      : null
  }
  return null
}

// ---- Tanlov va ommaviy amallar ----
/** Ko'rinmay qolgan tanlanganlar tanlovdan chiqariladi (ko'rinmaydiganga amal bajarilmasin) */
export function pruneSelection(
  selected: Iterable<string>,
  visibleKeys: Iterable<string>,
): string[] {
  const vis = new Set(visibleKeys)
  return [...selected].filter((k) => vis.has(k))
}

/** Ogohlantirish faqat yechayotganlarga */
export const warnTargets = (rows: BoardRow[]) => rows.filter((r) => r.phase === 'in_progress')

export const GRANT_MAX = 240

export interface GrantPlanItem {
  key: string
  name: string
  /** Yangi mutlaq qiymat (server extraMinutes ni mutlaq qabul qiladi) */
  extra: number
  fullTime: boolean
  skipped: false
}
export interface GrantSkip {
  key: string
  name: string
  skipped: true
  reason: 'limit'
  current: number
}
/** Ommaviy "+N daqiqa": har kimning HOZIRGI (yangi o'qilgan) qiymatiga qo'shiladi; 240 dan oshsa o'tkaziladi; fullTime saqlanadi */
export function grantPlan(
  rows: { key: string; fullName: string }[],
  fresh: ExamSessionParticipant[],
  minutes: number,
): (GrantPlanItem | GrantSkip)[] {
  const byKey = new Map(fresh.map((p) => [p.key, p]))
  return rows.map((r) => {
    const p = byKey.get(r.key)
    const current = p?.extraMinutes ?? 0
    const next = current + minutes
    if (!p || next > GRANT_MAX) {
      return { key: r.key, name: r.fullName, skipped: true, reason: 'limit', current }
    }
    return {
      key: r.key,
      name: r.fullName,
      extra: next,
      fullTime: p.fullTimeGranted,
      skipped: false,
    }
  })
}

// ---- Natijalar tahlili (Keyin) ----
/** Taqsimot: foiz bo'yicha 10 ta guruh (0-9, 10-19, ..., 90-100). Natijasizlar hisobga olinmaydi. */
export function distribution(rows: { result: { percent: number } | null }[], bins = 10): number[] {
  const out = Array.from({ length: bins }, () => 0)
  for (const r of rows) {
    if (!r.result) continue
    const i = Math.min(bins - 1, Math.max(0, Math.floor((r.result.percent / 100) * bins)))
    out[i]!++
  }
  return out
}

/** Fan bo'yicha o'rtacha foiz (ball yig'indisi / maksimal yig'indi), blockId bo'yicha */
export function subjectAverages(
  rows: { result: { blocks: { blockId: string; earned: number; max: number }[] } | null }[],
): Record<string, number> {
  const sum = new Map<string, { e: number; m: number }>()
  for (const r of rows) {
    for (const b of r.result?.blocks ?? []) {
      const cur = sum.get(b.blockId) ?? { e: 0, m: 0 }
      cur.e += b.earned
      cur.m += b.max
      sum.set(b.blockId, cur)
    }
  }
  const out: Record<string, number> = {}
  for (const [id, v] of sum) if (v.m > 0) out[id] = Math.round((v.e / v.m) * 100)
  return out
}

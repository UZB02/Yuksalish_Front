import type { ExamBlock, ExamSessionStatus } from '@/api/types'

/**
 * Imtihon bosqichlari va holat belgisi: DB da yangi holat YO'Q, mavjud ma'lumotdan (status, fanlar, ishtirokchilar)
 * hisoblanadi. Fan holati: yig'ilmoqda / o'qituvchi tugatdi / tasdiqlangan (ma'muriyat). O'qituvchisiz fan
 * ("auto") tasdiqni talab qilmaydi (backend qoidasi bilan bir xil).
 */
export type BlockState = 'collecting' | 'done' | 'approved' | 'auto'

export function blockState(b: Pick<ExamBlock, 'status' | 'readyBy' | 'contributors'>): BlockState {
  if (b.status === 'ready' && b.readyBy !== 'contributor') return 'approved'
  if (b.contributors.length === 0) return 'auto'
  return b.status === 'ready' ? 'done' : 'collecting'
}

export type FlowPill =
  | 'collecting'
  | 'awaiting_approval'
  | 'ready'
  | 'pending_approval'
  | 'scheduled'
  | 'running'
  | 'finished'
  | 'cancelled'

export const FLOW_PILL_TONE: Record<
  FlowPill,
  'neutral' | 'success' | 'danger' | 'warning' | 'primary' | 'info'
> = {
  collecting: 'warning',
  awaiting_approval: 'primary',
  ready: 'success',
  pending_approval: 'warning',
  scheduled: 'info',
  running: 'success',
  finished: 'neutral',
  cancelled: 'danger',
}

export const FLOW_STEPS = [
  'opened',
  'questions',
  'approval',
  'participants',
  'run',
  'results',
] as const
export type FlowStep = (typeof FLOW_STEPS)[number]

export interface FlowStage {
  key: FlowStep
  state: 'done' | 'current' | 'todo'
}

type FlowInput = {
  status: ExamSessionStatus
  participantsCount: number
  blocks?: Pick<
    ExamBlock,
    'status' | 'readyBy' | 'contributors' | 'count' | 'targetCount' | 'legacy'
  >[]
}

/** Fanlar jamlamasi (jadval pastki qatori va bosqichlar uchun) */
export function blocksSummary(blocks: FlowInput['blocks']) {
  const real = (blocks ?? []).filter((b) => !b.legacy)
  const states = real.map((b) => ({ b, state: blockState(b) }))
  return {
    total: real.length,
    approved: states.filter((x) => x.state === 'approved' || x.state === 'auto').length,
    done: states.filter((x) => x.state === 'done').length,
    collecting: states.filter((x) => x.state === 'collecting').length,
    /** Savollar bosqichi tugagan: har fan tugatilgan/tasdiqlangan (o'qituvchisiz fan: maqsadga yetgan) */
    questionsDone: states.every(
      (x) => x.state !== 'collecting' && (x.state !== 'auto' || x.b.count >= x.b.targetCount),
    ),
    allApproved: states.every((x) => x.state === 'approved' || x.state === 'auto'),
  }
}

/** Ro'yxat bosqichlari: tayyorlanmoqda / rejalashtirilgan (jumladan o'tkazilmoqda) / o'tgan */
export const LIST_STAGES = ['preparing', 'scheduled', 'past'] as const
export type ListStage = (typeof LIST_STAGES)[number]
export const listStageOf = (status: ExamSessionStatus): ListStage =>
  status === 'draft' || status === 'pending_approval'
    ? 'preparing'
    : status === 'scheduled' || status === 'open'
      ? 'scheduled'
      : 'past'

/**
 * Ro'yxatdagi holat belgisi (blokli imtihon uchun): qoralamada fanlar jamlamasidan, boshqa holatlarda statusdan.
 * Blokisiz imtihonda null (eski belgi ko'rsatiladi).
 */
export function listPill(s: {
  status: ExamSessionStatus
  blocksCount?: number
  blocksProgress?: { total: number; done: number; approved: number }
}): FlowPill | null {
  if (!s.blocksCount || !s.blocksProgress || s.blocksProgress.total === 0) return null
  const p = s.blocksProgress
  switch (s.status) {
    case 'draft':
      return p.done < p.total ? 'collecting' : p.approved < p.total ? 'awaiting_approval' : 'ready'
    case 'pending_approval':
      return 'pending_approval'
    case 'scheduled':
      return 'scheduled'
    case 'open':
      return 'running'
    case 'closed':
      return 'finished'
    default:
      return 'cancelled'
  }
}

export function examFlow(s: FlowInput): { pill: FlowPill; stages: FlowStage[] } {
  const sum = blocksSummary(s.blocks)
  const draft = s.status === 'draft'
  let pill: FlowPill
  let done: boolean[]
  if (s.status === 'cancelled') {
    pill = 'cancelled'
    done = [true, false, false, false, false, false]
  } else if (s.status === 'closed') {
    pill = 'finished'
    done = [true, true, true, true, true, false]
  } else if (s.status === 'open' || s.status === 'scheduled') {
    pill = s.status === 'open' ? 'running' : 'scheduled'
    done = [true, true, true, true, false, false]
  } else if (s.status === 'pending_approval') {
    pill = 'pending_approval'
    done = [true, true, false, true, false, false]
  } else {
    pill = !sum.questionsDone ? 'collecting' : !sum.allApproved ? 'awaiting_approval' : 'ready'
    done = [true, sum.questionsDone, sum.allApproved, s.participantsCount > 0, false, false]
  }
  void draft
  const first = s.status === 'cancelled' ? -1 : done.findIndex((d) => !d)
  const stages = FLOW_STEPS.map((key, i) => ({
    key,
    state: done[i] ? ('done' as const) : i === first ? ('current' as const) : ('todo' as const),
  }))
  return { pill, stages }
}

/** Fan bo'yicha taraqqiyot chizig'i rangi: <50% ogohlantirish, 50-99% asosiy, 100% muvaffaqiyat */
export function progressTone(count: number, target: number): 'warning' | 'primary' | 'success' {
  if (target <= 0 || count >= target) return 'success'
  return count / target < 0.5 ? 'warning' : 'primary'
}

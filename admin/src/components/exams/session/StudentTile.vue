<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { fmtNum, ringPct, type BoardRow, type BoardStage } from '@/utils/examBoard'
import ProgressRing from './ProgressRing.vue'

/**
 * O'quvchi katagi (balandligi 48 px): Oldin - bosh harflar + kod holati; Paytida - belgi (checkbox) + halqa (javob
 * ulushi) + holat; Keyin - halqada ball foizi + "O'tdi/O'tmadi". Bosilsa o'ng panel (drawer) ochiladi.
 */
const props = defineProps<{
  row: BoardRow
  stage: BoardStage
  selectable: boolean
  selected: boolean
  active: boolean
}>()
const emit = defineEmits<{ open: [key: string]; toggle: [key: string] }>()
const { t } = useI18n()

const initials = computed(() =>
  props.row.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join(''),
)

const C_DANGER = 'rgb(var(--danger))'
const C_WARNING = 'rgb(var(--warning))'
const C_SUCCESS = 'rgb(var(--success))'
const C_BORDER = 'rgb(var(--border))'
const C_PRIMARY = 'rgb(var(--primary-600))'

/** Katak holati: tavsif matni, matn rangi, halqa rangi va chegara belgisi */
const view = computed(() => {
  const r = props.row
  if (props.stage === 'before') {
    const ready = r.p.hasCode || r.p.hasPin
    return {
      text: ready ? t('examBoard.tile.codeReady') : t('examBoard.tile.codeMissing'),
      tone: ready ? 'text-fg-muted' : 'text-warning',
      ring: C_PRIMARY,
      border: '',
    }
  }
  if (props.stage === 'after') {
    const res = r.result
    const ok = res?.passed
    const verdict =
      ok === true
        ? t('examBoard.tile.passed')
        : ok === false
          ? t('examBoard.tile.failed')
          : r.phase === 'terminated'
            ? t('examSessions.live.statuses.terminated')
            : ''
    // Natija bor: "29,4 / 38 · O'tdi"; yo'q: urinishdan (topshirgan/topshirmagan) yoki noma'lum "—"
    const text = res
      ? [`${fmtNum(res.earned)} / ${fmtNum(res.max)}`, verdict].filter(Boolean).join(' · ')
      : r.submitted === true
        ? t('examSessions.live.statuses.submitted')
        : r.submitted === false
          ? r.phase === 'terminated'
            ? t('examSessions.live.statuses.terminated')
            : t('examBoard.tile.notSubmitted')
          : '—'
    return {
      text,
      tone: ok === true ? 'text-success' : ok === false ? 'text-danger' : 'text-fg-muted',
      ring: !res ? C_BORDER : ok === false ? C_DANGER : ok === true ? C_SUCCESS : C_PRIMARY,
      border: '',
    }
  }
  if (r.phase === 'terminated') {
    return {
      text: t('examSessions.live.statuses.terminated'),
      tone: 'text-danger',
      ring: C_DANGER,
      border: '',
    }
  }
  if (r.phase === 'submitted' || r.phase === 'auto_submitted') {
    return {
      text: t(`examSessions.live.statuses.${r.phase}`),
      tone: 'text-success',
      ring: C_SUCCESS,
      border: '',
    }
  }
  if (r.phase === 'not_started') {
    return {
      text: t('examSessions.live.statuses.not_started'),
      tone: 'text-fg-muted',
      ring: C_BORDER,
      border: '',
    }
  }
  if (r.stale) {
    return {
      text: t('examBoard.tile.noContact'),
      tone: 'text-danger',
      ring: C_DANGER,
      border: 'danger',
    }
  }
  if (r.leaving) {
    return {
      text: t('examBoard.tile.leaves', { n: r.leaves }),
      tone: 'text-warning',
      ring: C_WARNING,
      border: 'warning',
    }
  }
  return {
    text: t(`examSessions.live.statuses.${r.phase === 'joined' ? 'joined' : 'in_progress'}`),
    tone: 'text-primary-700',
    ring: C_PRIMARY,
    border: '',
  }
})

const ringLabel = computed(() => {
  const r = props.row
  if (props.stage === 'after') return r.result ? String(Math.round(r.result.percent)) : '—'
  if (r.phase === 'not_started') return '—'
  return `${ringPct(r, props.stage)}%`
})
/** Shaxsiy vaqt faqat umumiydan farq qilsa kichik belgi (qolgan vaqt drawerda) */
const extra = computed(() => {
  const p = props.row.p
  if (props.stage === 'after') return null
  if (p.fullTimeGranted) return t('examBoard.tile.fullTime')
  return p.extraMinutes ? t('examBoard.tile.extra', { n: p.extraMinutes }) : null
})
const boxClass = computed(() => {
  if (props.selected || props.active) return 'border-primary-600 bg-primary-50'
  if (props.row.flashing) return 'border-danger bg-danger-soft ring-2 ring-danger/40'
  if (view.value.border === 'danger') return 'border-danger bg-danger-soft'
  if (view.value.border === 'warning') return 'border-warning bg-warning-soft'
  return 'border-border bg-surface'
})
</script>

<template>
  <div
    class="flex h-12 min-w-0 items-center gap-2 rounded-lg border px-2"
    :class="boxClass"
    data-testid="student-tile"
    :data-key="row.key"
    :data-phase="row.phase"
    :data-problem="row.problem ? '1' : '0'"
    :data-flash="row.flashing ? '1' : '0'"
  >
    <input
      v-if="selectable"
      type="checkbox"
      class="h-[18px] w-[18px] shrink-0 accent-primary-600"
      :checked="selected"
      :aria-label="t('examBoard.section.selectOne', { name: row.fullName })"
      data-testid="tile-check"
      @change="emit('toggle', row.key)"
    />
    <span
      v-if="stage === 'before'"
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700"
      aria-hidden="true"
      >{{ initials }}</span
    >
    <ProgressRing v-else :pct="ringPct(row, stage)" :color="view.ring" :label="ringLabel" />
    <button
      type="button"
      class="min-w-0 flex-1 text-left"
      :title="row.fullName"
      :aria-label="t('examBoard.tile.open', { name: row.fullName })"
      data-testid="tile-open"
      @click="emit('open', row.key)"
    >
      <span
        class="block truncate text-[13px] font-medium leading-5 text-fg hover:underline"
        data-testid="tile-name"
        >{{ row.fullName }}</span
      >
      <span class="flex min-w-0 items-center gap-1.5 text-[11px] leading-4">
        <span class="truncate" :class="view.tone" data-testid="tile-sub">
          {{ view.text }}
        </span>
        <span
          v-if="extra"
          class="shrink-0 rounded-full bg-primary-100 px-1.5 text-[10px] font-medium text-primary-700"
          data-testid="tile-extra"
          >{{ extra }}</span
        >
      </span>
    </button>
  </div>
</template>

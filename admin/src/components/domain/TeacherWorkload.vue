<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Teacher } from '@/api/types'
import { useAnchoredPanel } from '@/composables/useAnchoredPanel'
import {
  buildWorkload,
  splitChips,
  workloadChips,
  type WorkloadChip,
} from '@/utils/teacherWorkload'

const props = withDefaults(defineProps<{ teacher: Teacher; max?: number }>(), { max: 2 })
const { t } = useI18n()

const workload = computed(() => buildWorkload(props.teacher))
const chips = computed(() => workloadChips(workload.value))
const split = computed(() => splitChips(chips.value, props.max))

const names = (c: WorkloadChip) => c.classes.map((x) => x.name).join(', ')

function label(c: WorkloadChip): string {
  if (c.kind === 'subject') return t('teachers.chipSubject', { name: c.name, n: c.count })
  if (c.kind === 'homeroom') {
    return c.classes.length === 1
      ? t('teachers.chipHomeroomOne', { name: c.classes[0]!.name })
      : t('teachers.chipHomeroomMany', { n: c.classes.length })
  }
  return t('teachers.chipNoSubject', { n: c.classes.length })
}
const tooltip = (c: WorkloadChip) => `${label(c)}: ${names(c)}`
const tone = (c: WorkloadChip) =>
  c.kind === 'subject'
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
    : c.kind === 'homeroom'
      ? 'bg-success-soft text-success'
      : 'bg-surface-muted text-fg-muted'

function sectionTitle(c: WorkloadChip): string {
  if (c.kind === 'subject') return `${c.name} · ${t('teachers.classesCount', { n: c.count })}`
  return c.kind === 'homeroom' ? t('teachers.homeroomClasses') : t('teachers.noSubjectClasses')
}

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelId = useId()
const { open, style, toggle } = useAnchoredPanel(trigger, panel, { align: 'start' })
</script>

<template>
  <div class="min-w-0" data-testid="workload">
    <span v-if="chips.length === 0" class="text-sm text-fg-muted">
      {{ t('teachers.unassigned') }}
    </span>
    <div v-else class="flex min-w-0 flex-wrap items-center gap-1">
      <span
        v-for="c in split.visible"
        :key="c.key"
        class="inline-flex min-w-0 max-w-[11rem] items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="tone(c)"
        :title="tooltip(c)"
        data-testid="workload-chip"
      >
        <span class="truncate">{{ label(c) }}</span>
      </span>
      <button
        v-if="split.hidden > 0"
        ref="trigger"
        type="button"
        class="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-controls="open ? panelId : undefined"
        :aria-label="t('teachers.showFullWorkload', { n: split.hidden })"
        data-testid="workload-more"
        @click="toggle"
      >
        {{ t('teachers.moreChips', { n: split.hidden }) }}
      </button>
      <span class="ml-1 whitespace-nowrap text-xs text-fg-muted" data-testid="workload-total">
        {{ t('teachers.classesCount', { n: workload.classesTotal }) }}
      </span>
    </div>

    <Teleport to="body">
      <div
        v-if="open"
        :id="panelId"
        ref="panel"
        role="dialog"
        :aria-label="t('teachers.workloadTitle')"
        class="fixed z-[100] max-h-80 w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border bg-surface p-3 shadow-lg"
        :style="style"
        data-testid="workload-popover"
      >
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {{ t('teachers.workloadTitle') }}
        </p>
        <ul class="space-y-2.5">
          <li v-for="c in chips" :key="c.key">
            <p class="text-sm font-medium text-fg">{{ sectionTitle(c) }}</p>
            <div class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="k in c.classes"
                :key="k.id"
                class="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs text-fg"
              >
                {{ k.name }}
              </span>
            </div>
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

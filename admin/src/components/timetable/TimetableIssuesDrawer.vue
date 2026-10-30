<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import {
  CircleCheck,
  CircleX,
  ExternalLink,
  Locate,
  Pencil,
  TriangleAlert,
  X,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useBodyLock } from '@/composables/useBodyLock'
import { countIssues, type TimetableIssue } from '@/utils/timetableIssues'

/**
 * "Muammolar" paneli (VS Code Problems kabi): o'ngdan chiquvchi panel, mobilda pastdan varaq.
 * Filtr tablari, xato/ogohlantirish guruhlari va har bir muammo uchun amallar.
 */
const props = defineProps<{
  open: boolean
  issues: TimetableIssue[]
  /** Mobil: orqa fon va body scroll bloki bilan modal varaq */
  mobile?: boolean
  /** Katakni tahrirlash mumkinmi (qoralama/tuzatish rejimi) */
  canEdit?: boolean
}>()
const emit = defineEmits<{
  close: []
  jump: [issue: TimetableIssue]
  edit: [issue: TimetableIssue]
}>()
const { t } = useI18n()

type Filter = 'all' | 'error' | 'warning'
const filter = ref<Filter>('all')
const titleId = useId()
const panel = ref<HTMLElement | null>(null)
const bodyLock = useBodyLock()
let previouslyFocused: HTMLElement | null = null

const counts = computed(() => countIssues(props.issues))
const shown = computed(() =>
  filter.value === 'all' ? props.issues : props.issues.filter((i) => i.severity === filter.value),
)
const groups = computed(() =>
  (['error', 'warning'] as const)
    .map((sev) => ({ sev, items: shown.value.filter((i) => i.severity === sev) }))
    .filter((g) => g.items.length),
)
const tabs = computed(() => [
  { key: 'all' as const, label: t('timetable.issues.tabAll'), n: counts.value.total },
  { key: 'error' as const, label: t('timetable.issues.tabErrors'), n: counts.value.error },
  { key: 'warning' as const, label: t('timetable.issues.tabWarnings'), n: counts.value.warning },
])

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

watch(
  () => props.open,
  async (isOpen) => {
    bodyLock.set(isOpen && !!props.mobile)
    if (isOpen) {
      filter.value = 'all'
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      panel.value?.focus()
    } else {
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true },
)
watch(
  () => props.mobile,
  (m) => bodyLock.set(props.open && !!m),
)
// Hozirgi filtr bo'sh qolsa (masalan xato tuzatildi) "Hammasi"ga qaytamiz
watch(counts, (c) => {
  if (filter.value !== 'all' && c[filter.value] === 0) filter.value = 'all'
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !props.mobile || !panel.value) return
  const nodes = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (!nodes.length) return
  const first = nodes[0]!
  const last = nodes[nodes.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 flex items-end justify-end"
        :class="mobile ? 'bg-slate-950/50' : 'pointer-events-none'"
        data-testid="issues-drawer-root"
        @mousedown.self="mobile && emit('close')"
        @keydown="onKeydown"
      >
        <aside
          ref="panel"
          role="dialog"
          :aria-modal="mobile ? 'true' : 'false'"
          :aria-labelledby="titleId"
          tabindex="-1"
          class="pointer-events-auto flex w-full flex-col border-border bg-surface shadow-xl outline-none max-md:max-h-[85vh] max-md:rounded-t-2xl max-md:border-t md:h-full md:max-w-md md:border-l supports-[height:100dvh]:max-md:max-h-[85dvh]"
          data-testid="issues-drawer"
        >
          <header class="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-4">
            <div class="min-w-0">
              <h2 :id="titleId" class="text-base font-semibold text-fg">
                {{ t('timetable.issues.panelTitle') }}
              </h2>
              <p class="mt-0.5 text-xs text-fg-muted">{{ t('timetable.issues.panelHint') }}</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
              :aria-label="t('common.close')"
              data-testid="issues-close"
              @click="emit('close')"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div
            class="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 pb-2"
            role="tablist"
          >
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              role="tab"
              :aria-selected="filter === tab.key"
              class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              :class="
                filter === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              "
              :data-testid="`issues-tab-${tab.key}`"
              @click="filter = tab.key"
            >
              {{ tab.label }} <span class="opacity-80">({{ tab.n }})</span>
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            <div
              v-if="!groups.length"
              class="flex flex-col items-center gap-2 py-10 text-center text-sm text-fg-muted"
              data-testid="issues-empty"
            >
              <CircleCheck class="h-8 w-8 text-success" aria-hidden="true" />
              {{ t(counts.total ? 'timetable.issues.emptyFiltered' : 'timetable.issues.empty') }}
            </div>
            <section
              v-for="g in groups"
              :key="g.sev"
              class="mb-4 last:mb-0"
              :data-testid="`issues-group-${g.sev}`"
            >
              <h3
                class="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide"
                :class="g.sev === 'error' ? 'text-danger' : 'text-warning'"
              >
                <CircleX v-if="g.sev === 'error'" class="h-4 w-4" aria-hidden="true" />
                <TriangleAlert v-else class="h-4 w-4" aria-hidden="true" />
                {{
                  t(
                    g.sev === 'error'
                      ? 'timetable.issues.groupErrors'
                      : 'timetable.issues.groupWarnings',
                  )
                }}
                ({{ g.items.length }})
              </h3>
              <ul class="space-y-2">
                <li
                  v-for="i in g.items"
                  :key="i.key"
                  class="relative overflow-hidden rounded-xl border border-border bg-surface py-3 pl-4 pr-3"
                  :data-testid="`issue-${i.weekday}-${i.lessonNo}`"
                  :data-severity="i.severity"
                >
                  <span
                    class="absolute inset-y-0 left-0 w-[3px]"
                    :class="i.severity === 'error' ? 'bg-danger' : 'bg-warning'"
                    aria-hidden="true"
                  />
                  <div class="flex items-start gap-2">
                    <CircleX
                      v-if="i.severity === 'error'"
                      class="mt-0.5 h-4 w-4 shrink-0 text-danger"
                      aria-hidden="true"
                    />
                    <TriangleAlert
                      v-else
                      class="mt-0.5 h-4 w-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold text-fg">
                        <span class="sr-only"
                          >{{ t(`timetable.issues.severity.${i.severity}`) }}:
                        </span>
                        {{ i.title }}
                      </p>
                      <p class="mt-0.5 text-sm text-fg-muted">{{ i.text }}</p>
                      <span
                        class="mt-2 inline-block max-w-full truncate rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-fg"
                      >
                        {{ i.className ? `${i.className} · ` : '' }}{{ i.cellLabel }}
                      </span>
                      <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        <button
                          type="button"
                          class="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
                          data-testid="issue-jump"
                          @click="emit('jump', i)"
                        >
                          <Locate class="h-3.5 w-3.5" aria-hidden="true" />
                          {{ t('timetable.issues.goToCell') }}
                        </button>
                        <button
                          v-if="canEdit"
                          type="button"
                          class="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
                          data-testid="issue-edit"
                          @click="emit('edit', i)"
                        >
                          <Pencil class="h-3.5 w-3.5" aria-hidden="true" />
                          {{ t('timetable.issues.edit') }}
                        </button>
                        <RouterLink
                          v-if="i.otherClass"
                          :to="{ name: 'class-timetable', params: { id: i.otherClass.id } }"
                          class="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
                          data-testid="issue-open-class"
                        >
                          <ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
                          {{ t('timetable.issues.openClass', { name: i.otherClass.name }) }}
                        </RouterLink>
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            </section>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

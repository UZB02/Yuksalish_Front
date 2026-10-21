<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Search } from 'lucide-vue-next'
import { behaviorTypesApi } from '@/api/behaviorTypes.api'
import type { BehaviorType } from '@/api/types'
import BulkPanel from '@/components/scoring/BulkPanel.vue'
import ScoreRow from '@/components/scoring/ScoreRow.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useScoringSheet } from '@/composables/useScoringSheet'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { dateBounds, pruneSelection, shiftDate, todayTashkent } from '@/utils/scoring'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()

const classId = computed(() => String(route.params.id))
const sheet = useScoringSheet(() => classId.value)
const types = ref<BehaviorType[]>([])
const search = ref('')
const onlyUnscored = ref(false)
const today = ref(todayTashkent())

const bounds = computed(() => dateBounds(today.value, sheet.settings.value.backdateDays))
const canPrev = computed(() => sheet.date.value > bounds.value.min)
const canNext = computed(() => sheet.date.value < bounds.value.max)

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sheet.rows.value.filter((r) => {
    if (onlyUnscored.value && r.scoreId && !sheet.isDirty(r)) return false
    return (
      q === '' ||
      r.fullName.toLowerCase().includes(q) ||
      (r.studentCode ?? '').toLowerCase().includes(q)
    )
  })
})
const visibleIds = computed(() => visible.value.filter((r) => r.editable).map((r) => r.studentId))
// Tanlov faqat ko'rinadigan qatorlar bilan cheklanadi: "faqat baholanmaganlar" filtri bilan
// ommaviy qo'llab saqlagach, baholangan qatorlar yashirinadi va tanlovdan chiqadi.
watch(visibleIds, (ids) => pruneSelection(sheet.selected, ids))
const allSelected = computed(
  () => visibleIds.value.length > 0 && visibleIds.value.every((id) => sheet.selected.has(id)),
)
const progressPct = computed(() =>
  sheet.total.value ? Math.round((sheet.scoredCount.value / sheet.total.value) * 100) : 0,
)

async function loadTypes() {
  try {
    types.value = (await behaviorTypesApi.list({ isActive: true })).items.sort(
      (a, b) => a.order - b.order,
    )
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

async function changeDate(next: string) {
  if (next === sheet.date.value) return
  if (next < bounds.value.min || next > bounds.value.max) return
  if (sheet.hasUnsaved.value) {
    const ok = await confirm({
      title: t('scoring.unsaved.title'),
      message: t('scoring.unsaved.dateText'),
      confirmText: t('scoring.unsaved.discard'),
      variant: 'danger',
    })
    if (!ok) return
  }
  sheet.date.value = next
  await sheet.load()
}

function onDateInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (v) void changeDate(v)
}

async function save() {
  try {
    const res = await sheet.save()
    if (!res) return
    const failed = res.failed.length
    if (failed > 0)
      toast.error(t('scoring.savedPartial', { ok: res.created + res.updated, failed }))
    else toast.success(t('scoring.saved', { n: res.created + res.updated }))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

function focusNext(index: number) {
  const next = document.querySelector<HTMLInputElement>(`[data-score-input="${index + 1}"]`)
  if (next) {
    next.focus()
    next.select()
    next.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } else {
    ;(document.activeElement as HTMLElement | null)?.blur()
  }
}

function onBulk(change: Parameters<typeof sheet.applyToSelected>[0]) {
  sheet.applyToSelected(change)
  toast.info(t('scoring.bulk.applied', { n: sheet.selected.size }))
}

// Saqlanmagan o'zgarishlar bilan chiqishda ogohlantirish.
onBeforeRouteLeave(async () => {
  if (!sheet.hasUnsaved.value) return true
  return confirm({
    title: t('scoring.unsaved.title'),
    message: t('scoring.unsaved.leaveText'),
    confirmText: t('scoring.unsaved.leave'),
    variant: 'danger',
  })
})
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (sheet.hasUnsaved.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void loadTypes()
  void sheet.load()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
watch(classId, async () => {
  await nextTick()
  void sheet.load()
})
</script>

<template>
  <RouterLink
    :to="{ name: 'class-detail', params: { id: classId } }"
    class="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
  >
    <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('scoring.backToClass') }}
  </RouterLink>

  <header class="mb-4 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-fg sm:text-2xl">
        {{ t('scoring.title')
        }}<span v-if="sheet.className.value">: {{ sheet.className.value }}</span>
      </h1>
      <div class="flex items-center gap-1">
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="!canPrev"
          :aria-label="t('scoring.prevDay')"
          @click="changeDate(shiftDate(sheet.date.value, -1))"
        >
          <ChevronLeft class="h-4 w-4" />
        </BaseButton>
        <input
          type="date"
          :value="sheet.date.value"
          :min="bounds.min"
          :max="bounds.max"
          :aria-label="t('scoring.date')"
          class="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-fg focus:border-primary-500"
          @change="onDateInput"
        />
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="!canNext"
          :aria-label="t('scoring.nextDay')"
          @click="changeDate(shiftDate(sheet.date.value, 1))"
        >
          <ChevronRight class="h-4 w-4" />
        </BaseButton>
      </div>
    </div>

    <div v-if="!sheet.loading.value || sheet.rows.value.length" class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <span class="text-fg">
          {{ t('scoring.progress', { done: sheet.scoredCount.value, total: sheet.total.value }) }}
        </span>
        <span class="text-fg-muted">{{ progressPct }}%</span>
      </div>
      <div
        class="h-2 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        :aria-valuenow="progressPct"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="t('scoring.progressLabel')"
      >
        <div
          class="h-full rounded-full bg-success transition-all"
          :style="{ width: `${progressPct}%` }"
        />
      </div>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
          aria-hidden="true"
        />
        <input
          v-model="search"
          type="search"
          :aria-label="t('common.search')"
          :placeholder="t('students.searchPlaceholder')"
          class="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg focus:border-primary-500"
        />
      </div>
      <BaseCheckbox v-model="onlyUnscored" :label="t('scoring.onlyUnscored')" />
      <BaseCheckbox
        :model-value="allSelected"
        :disabled="visibleIds.length === 0"
        :label="t('scoring.selectAll')"
        @update:model-value="sheet.selectAll(visibleIds, $event)"
      />
    </div>
  </header>

  <div v-if="sheet.loading.value && sheet.rows.value.length === 0" class="space-y-3">
    <Skeleton v-for="n in 4" :key="n" class="h-40 w-full" />
  </div>

  <div v-else-if="sheet.loadError.value" class="card">
    <EmptyState
      :title="t('errors.loadFailed')"
      :description="errorMessage(sheet.loadError.value, t)"
    >
      <BaseButton variant="secondary" @click="sheet.load()">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else-if="sheet.rows.value.length === 0" class="card">
    <EmptyState
      :icon="ClipboardCheck"
      :title="t('scoring.emptyTitle')"
      :description="t('scoring.emptyText')"
    />
  </div>

  <template v-else>
    <BulkPanel
      v-if="sheet.selected.size > 0"
      class="mb-3"
      :count="sheet.selected.size"
      :settings="sheet.settings.value"
      :types="types"
      @apply="onBulk"
      @clear="sheet.selected.clear()"
    />

    <p v-if="visible.length === 0" class="py-8 text-center text-sm text-fg-muted">
      {{ t('scoring.noMatches') }}
    </p>
    <ul class="space-y-3 pb-28">
      <ScoreRow
        v-for="(row, i) in visible"
        :key="row.studentId"
        :row="row"
        :index="i"
        :status="sheet.statusOf(row)"
        :errors="sheet.errorsOf(row)"
        :settings="sheet.settings.value"
        :types="types"
        :selected="sheet.selected.has(row.studentId)"
        :show-errors="sheet.isDirty(row) || !!row.serverError"
        @patch="sheet.patch"
        @select="sheet.toggleSelect"
        @next="focusNext"
      />
    </ul>

    <div
      class="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:left-64"
    >
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <p
          class="text-sm"
          :class="sheet.invalidDirty.value.length ? 'text-danger' : 'text-fg-muted'"
        >
          <template v-if="sheet.invalidDirty.value.length">
            {{ t('scoring.invalidRows', { n: sheet.invalidDirty.value.length }) }}
          </template>
          <template v-else-if="sheet.hasUnsaved.value">{{ t('scoring.unsavedHint') }}</template>
        </p>
        <div class="flex gap-2">
          <BaseButton
            v-if="sheet.hasUnsaved.value"
            variant="secondary"
            :disabled="sheet.saving.value"
            @click="sheet.discard()"
          >
            {{ t('scoring.discard') }}
          </BaseButton>
          <BaseButton :disabled="!sheet.canSave.value" :loading="sheet.saving.value" @click="save">
            {{ t('scoring.save', { n: sheet.changedCount.value }) }}
          </BaseButton>
        </div>
      </div>
    </div>
  </template>
</template>

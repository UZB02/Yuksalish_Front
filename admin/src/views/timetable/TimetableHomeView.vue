<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Ban, ChevronLeft, ChevronRight, Search, TriangleAlert } from 'lucide-vue-next'
import { isApiError } from '@/api/errors'
import {
  timetableApi,
  type ActivatePayload,
  type ActivationPreview,
  type TimetableDay,
  type TimetableOverview,
} from '@/api/timetable.api'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import ActivateModal from '@/components/timetable/ActivateModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TimetableExportMenu from '@/components/timetable/TimetableExportMenu.vue'
import type { DropdownItem } from '@/components/ui/DropdownMenu.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { usePermission } from '@/composables/usePermission'
import { useTimetableExport } from '@/composables/useTimetableExport'
import { useToast } from '@/composables/useToast'
import type { ExportFormat } from '@/api/types'
import { PERMISSIONS } from '@/constants/permissions'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { addDaysIso, rowCountFor } from '@/utils/timetable'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { can, isSuperadmin } = usePermission()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()

const canManage = computed(() => isSuperadmin() || can(PERMISSIONS.TIMETABLE_MANAGE))

// Butun maktab jadvalini yuklab olish (timetable.view yoki manage)
const canExport = computed(() => canManage.value || can(PERMISSIONS.TIMETABLE_VIEW))
const exporter = useTimetableExport()
const exportItems = computed<DropdownItem[]>(() => [
  { key: 'classes:xlsx', label: t('timetable.exportClassesExcel') },
  { key: 'classes:pdf', label: t('timetable.exportClassesPdf') },
  { key: 'teachers:xlsx', label: t('timetable.exportTeachersExcel'), separator: true },
  { key: 'teachers:pdf', label: t('timetable.exportTeachersPdf') },
])
const exportSchool = (key: string) => {
  const [kind, format] = key.split(':') as ['classes' | 'teachers', ExportFormat]
  return exporter.run(() => timetableApi.exportSchool(kind, format))
}

type Tab = 'classes' | 'day' | 'teachers'
const TABS: Tab[] = ['classes', 'day', 'teachers']
const tab = computed<Tab>(() => {
  const q = String(route.query.tab ?? '')
  return (TABS as string[]).includes(q) ? (q as Tab) : 'classes'
})
function setTab(next: Tab) {
  void router.replace({ query: { ...route.query, tab: next === 'classes' ? undefined : next } })
}

const error = ref('')

// ---------- Sinflar ----------
const overview = ref<TimetableOverview | null>(null)
const loadingOverview = ref(false)
const selected = ref<string[]>([])

async function loadOverview() {
  loadingOverview.value = true
  error.value = ''
  try {
    overview.value = await timetableApi.overview()
    selected.value = []
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loadingOverview.value = false
  }
}
const draftRows = computed(() => (overview.value?.classes ?? []).filter((c) => c.draft))
const selectedDrafts = computed(() =>
  draftRows.value.filter((c) => selected.value.includes(c.classId)).map((c) => c.draft!.id),
)
const allSelected = computed(
  () => draftRows.value.length > 0 && selected.value.length === draftRows.value.length,
)
function toggle(classId: string, on: boolean) {
  selected.value = on
    ? [...new Set([...selected.value, classId])]
    : selected.value.filter((i) => i !== classId)
}
function toggleAll(on: boolean) {
  selected.value = on ? draftRows.value.map((c) => c.classId) : []
}
const range = (v: { validFrom: string; validTo: string | null }) =>
  `${formatDate(v.validFrom)} – ${v.validTo ? formatDate(v.validTo) : '…'}`

const bulkOpen = ref(false)
const bulkBusy = ref(false)
async function bulkWarnings(from: string): Promise<ActivationPreview> {
  const r = await timetableApi.bulkPreview({ versionIds: selectedDrafts.value, validFrom: from })
  return { warnings: r.warnings, willReplace: r.willReplace ?? [] }
}
async function bulkActivate(payload: ActivatePayload) {
  bulkBusy.value = true
  try {
    const r = await timetableApi.activateBulk({ ...payload, versionIds: selectedDrafts.value })
    bulkOpen.value = false
    toast.success(t('timetable.bulkDone', { n: r.activated.length }))
    await loadOverview()
  } catch (e) {
    toast.error(isApiError(e) && e.status === 409 ? e.message : errorMessage(e, t))
  } finally {
    bulkBusy.value = false
  }
}
const tomorrow = computed(() =>
  addDaysIso(overview.value?.today ?? new Date().toISOString().slice(0, 10), 1),
)

// ---------- Kun bo'yicha ----------
const day = ref<TimetableDay | null>(null)
const dayDate = ref('')
const loadingDay = ref(false)
async function loadDay() {
  loadingDay.value = true
  error.value = ''
  try {
    day.value = await timetableApi.day(dayDate.value || undefined)
    dayDate.value = day.value.date
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loadingDay.value = false
  }
}
function moveDay(n: number) {
  if (!dayDate.value) return
  dayDate.value = addDaysIso(dayDate.value, n)
  void loadDay()
}
const dayRows = computed(() => {
  if (!day.value) return []
  const used = Math.max(0, ...day.value.classes.flatMap((c) => c.lessons.map((l) => l.lessonNo)))
  return Array.from(
    { length: rowCountFor(day.value.settings.lessonsPerDay, used) },
    (_, i) => i + 1,
  )
})
const lessonAt = (lessons: TimetableDay['classes'][number]['lessons'], n: number) =>
  lessons.filter((l) => l.lessonNo === n)

// ---------- O'qituvchilar ----------
const teachers = ref<{ id: string; fullName: string }[]>([])
const loadingTeachers = ref(false)
const search = ref('')
const shownTeachers = computed(() => {
  const q = search.value.trim().toLowerCase()
  return teachers.value.filter((x) => !q || x.fullName.toLowerCase().includes(q))
})
async function loadTeachers() {
  loadingTeachers.value = true
  error.value = ''
  try {
    teachers.value = (await timetableApi.options()).teachers
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loadingTeachers.value = false
  }
}

function loadTab() {
  if (needsSchool.value) return
  if (tab.value === 'classes') void loadOverview()
  else if (tab.value === 'day') void loadDay()
  else void loadTeachers()
}
onMounted(loadTab)
watch([tab, () => schoolCtx.schoolId], loadTab)
</script>

<template>
  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <PageHeader :title="t('timetable.title')" :description="t('timetable.description')">
      <template #actions>
        <TimetableExportMenu
          v-if="canExport"
          :items="exportItems"
          :busy="exporter.busy.value"
          @select="exportSchool"
        />
        <BaseButton
          v-if="tab === 'classes' && canManage"
          :disabled="!selectedDrafts.length"
          data-testid="bulk-open"
          @click="bulkOpen = true"
        >
          {{ t('timetable.bulkActivate', { n: selectedDrafts.length }) }}
        </BaseButton>
      </template>
    </PageHeader>

    <div class="mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
      <button
        v-for="k in TABS"
        :key="k"
        type="button"
        role="tab"
        :aria-selected="tab === k"
        class="-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors"
        :class="
          tab === k
            ? 'border-primary-600 text-primary-700'
            : 'border-transparent text-fg-muted hover:text-fg'
        "
        :data-testid="`tab-${k}`"
        @click="setTab(k)"
      >
        {{ t(`timetable.tabs.${k}`) }}
      </button>
    </div>

    <div v-if="error" class="card">
      <EmptyState :title="t('timetable.loadFailed')" :description="error">
        <BaseButton variant="secondary" @click="loadTab">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>

    <!-- Sinflar -->
    <template v-else-if="tab === 'classes'">
      <div v-if="loadingOverview && !overview" class="space-y-2">
        <Skeleton v-for="i in 6" :key="i" class="h-12 w-full" />
      </div>
      <EmptyState
        v-else-if="!overview?.classes.length"
        :title="t('timetable.noClasses')"
        :description="t('timetable.noClassesText')"
      />
      <div v-else class="overflow-x-auto rounded-xl border border-border bg-surface">
        <table class="w-full min-w-[720px] text-sm" data-testid="overview-table">
          <thead class="bg-surface-muted text-left text-xs text-fg-muted">
            <tr>
              <th v-if="canManage" class="w-10 px-3 py-2">
                <BaseCheckbox
                  :model-value="allSelected"
                  :disabled="!draftRows.length"
                  :aria-label="t('timetable.selectAll')"
                  data-testid="select-all"
                  @update:model-value="toggleAll"
                />
              </th>
              <th class="px-3 py-2">{{ t('timetable.class') }}</th>
              <th class="px-3 py-2">{{ t('timetable.phase.current') }}</th>
              <th class="px-3 py-2">{{ t('timetable.phase.future') }}</th>
              <th class="px-3 py-2">{{ t('timetable.phase.draft') }}</th>
              <th class="px-3 py-2">{{ t('timetable.warningsTitle') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in overview.classes"
              :key="c.classId"
              class="border-t border-border"
              :data-testid="`row-${c.classId}`"
            >
              <td v-if="canManage" class="px-3 py-2">
                <BaseCheckbox
                  v-if="c.draft"
                  :model-value="selected.includes(c.classId)"
                  :aria-label="c.name"
                  :data-testid="`select-${c.classId}`"
                  @update:model-value="(on) => toggle(c.classId, on)"
                />
              </td>
              <td class="px-3 py-2 font-medium">
                <RouterLink
                  :to="{ name: 'class-timetable', params: { id: c.classId } }"
                  class="text-primary-700 hover:underline"
                >
                  {{ c.name }}
                </RouterLink>
              </td>
              <td class="px-3 py-2">
                <BaseBadge v-if="c.current" tone="success">{{ range(c.current) }}</BaseBadge>
                <BaseBadge v-else tone="neutral">{{ t('timetable.none') }}</BaseBadge>
              </td>
              <td class="px-3 py-2">
                <BaseBadge v-if="c.upcoming" tone="info">{{ range(c.upcoming) }}</BaseBadge>
                <span v-else class="text-fg-muted">—</span>
              </td>
              <td class="px-3 py-2">
                <BaseBadge v-if="c.draft" tone="warning">
                  {{ formatDate(c.draft.validFrom) }}
                </BaseBadge>
                <span v-else class="text-fg-muted">—</span>
              </td>
              <td class="px-3 py-2">
                <span v-if="c.errorsCount" class="inline-flex items-center gap-1 text-danger">
                  <Ban class="h-4 w-4" /> {{ c.errorsCount }}
                </span>
                <span
                  v-if="c.warningsCount - c.errorsCount > 0"
                  class="ml-2 inline-flex items-center gap-1 text-warning"
                >
                  <TriangleAlert class="h-4 w-4" /> {{ c.warningsCount - c.errorsCount }}
                </span>
                <span v-if="!c.warningsCount" class="text-fg-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Kun bo'yicha -->
    <template v-else-if="tab === 'day'">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <BaseButton
          variant="secondary"
          size="sm"
          :aria-label="t('timetable.prevDay')"
          @click="moveDay(-1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </BaseButton>
        <BaseInput
          v-model="dayDate"
          type="date"
          :aria-label="t('timetable.date')"
          class="w-44"
          data-testid="day-date"
          @change="loadDay"
        />
        <BaseButton
          variant="secondary"
          size="sm"
          :aria-label="t('timetable.nextDay')"
          @click="moveDay(1)"
        >
          <ChevronRight class="h-4 w-4" />
        </BaseButton>
        <span v-if="day" class="text-sm text-fg-muted">
          {{ t(`journal.weekdayLong.${day.weekday}`) }}
        </span>
      </div>
      <div v-if="loadingDay && !day" class="space-y-2">
        <Skeleton v-for="i in 6" :key="i" class="h-12 w-full" />
      </div>
      <EmptyState
        v-else-if="day && !day.working"
        :title="t('timetable.notWorkingDay')"
        :description="t('timetable.notWorkingDayText')"
      />
      <div v-else-if="day" class="overflow-x-auto rounded-xl border border-border bg-surface">
        <table class="w-full min-w-[720px] table-fixed text-sm" data-testid="day-table">
          <thead class="bg-surface-muted text-left text-xs text-fg-muted">
            <tr>
              <th class="w-24 px-3 py-2">{{ t('timetable.class') }}</th>
              <th v-for="n in dayRows" :key="n" class="border-l border-border px-3 py-2">
                {{ n }}-{{ t('timetable.lessonSuffix') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in day.classes" :key="c.classId" class="border-t border-border">
              <th class="px-3 py-2 text-left font-medium">
                <RouterLink
                  :to="{ name: 'class-timetable', params: { id: c.classId } }"
                  class="text-primary-700 hover:underline"
                >
                  {{ c.name }}
                </RouterLink>
              </th>
              <td
                v-for="n in dayRows"
                :key="n"
                class="border-l border-border px-3 py-2 align-top"
                :data-testid="`day-cell-${c.classId}-${n}`"
              >
                <div v-for="(l, i) in lessonAt(c.lessons, n)" :key="i" class="min-w-0">
                  <div class="truncate font-medium text-fg">{{ l.subject.name }}</div>
                  <div class="truncate text-xs text-fg-muted">{{ l.teacher.fullName }}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- O'qituvchilar -->
    <template v-else>
      <BaseInput
        v-model="search"
        :icon="Search"
        :placeholder="t('common.searchPlaceholder')"
        :aria-label="t('common.search')"
        class="mb-3 max-w-sm"
        data-testid="teacher-search"
      />
      <div v-if="loadingTeachers && !teachers.length" class="space-y-2">
        <Skeleton v-for="i in 6" :key="i" class="h-12 w-full" />
      </div>
      <EmptyState v-else-if="!shownTeachers.length" :title="t('common.noResults')" />
      <ul
        v-else
        class="divide-y divide-border rounded-xl border border-border bg-surface"
        data-testid="teacher-list"
      >
        <li v-for="x in shownTeachers" :key="x.id">
          <RouterLink
            :to="{ name: 'teacher-timetable', params: { id: x.id } }"
            class="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-muted"
          >
            <span class="font-medium text-fg">{{ x.fullName }}</span>
            <ChevronRight class="h-4 w-4 text-fg-muted" aria-hidden="true" />
          </RouterLink>
        </li>
      </ul>
    </template>

    <ActivateModal
      :open="bulkOpen"
      :title="t('timetable.bulkTitle')"
      :default-from="tomorrow"
      :today="overview?.today ?? ''"
      :bulk-count="selectedDrafts.length"
      :busy="bulkBusy"
      :load-warnings="bulkWarnings"
      @close="bulkOpen = false"
      @submit="bulkActivate"
    />
  </template>
</template>

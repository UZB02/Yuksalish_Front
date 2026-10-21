<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, ClipboardCheck, Search } from 'lucide-vue-next'
import { classesApi } from '@/api/classes.api'
import { gradesApi } from '@/api/grades.api'
import { subjectsApi } from '@/api/subjects.api'
import type { GradeAssignment, GradeAssignments, SchoolClass, Subject } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import StickySaveBar from '@/components/ui/StickySaveBar.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useGradeSheet } from '@/composables/useGradeSheet'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { dateBounds, shiftDate, todayTashkent } from '@/utils/scoring'
import GradeRow from './GradeRow.vue'

const emit = defineEmits<{ 'dirty-change': [dirty: boolean] }>()

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()

const loadingInit = ref(true)
const initError = ref('')
const info = ref<GradeAssignments>({ mode: 'assigned', assignments: [] })
const allClasses = ref<SchoolClass[]>([])
const allSubjects = ref<Subject[]>([])

const classId = ref('')
const subjectId = ref('')
const selectKey = ref(0)
const search = ref('')
const onlyUngraded = ref(false)
const today = ref(todayTashkent())

const sheet = useGradeSheet(
  () => classId.value,
  () => subjectId.value,
)

const isAdminMode = computed(() => info.value.mode === 'all')

// ---- Tanlagichlar ----
const classOptions = computed(() => {
  if (isAdminMode.value) {
    return allClasses.value.map((c) => ({ value: c.id, label: c.name }))
  }
  const seen = new Map<string, GradeAssignment>()
  for (const a of info.value.assignments) if (!seen.has(a.classId)) seen.set(a.classId, a)
  return [...seen.values()].map((a) => ({ value: a.classId, label: a.className }))
})
const subjectOptions = computed(() => {
  if (isAdminMode.value) return allSubjects.value.map((s) => ({ value: s.id, label: s.name }))
  return info.value.assignments
    .filter((a) => a.classId === classId.value)
    .map((a) => ({ value: a.subjectId, label: a.subjectName }))
})

const bounds = computed(() => dateBounds(today.value, sheet.backdateDays.value))
const canPrev = computed(() => sheet.date.value > bounds.value.min)
const canNext = computed(() => sheet.date.value < bounds.value.max)
const ready = computed(() => !!classId.value && !!subjectId.value)

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sheet.rows.value.filter((r) => {
    if (onlyUngraded.value && r.gradeId && !sheet.isDirty(r)) return false
    return (
      q === '' ||
      r.fullName.toLowerCase().includes(q) ||
      (r.studentCode ?? '').toLowerCase().includes(q)
    )
  })
})
const progressPct = computed(() =>
  sheet.total.value ? Math.round((sheet.gradedCount.value / sheet.total.value) * 100) : 0,
)

async function init() {
  loadingInit.value = true
  initError.value = ''
  try {
    info.value = await gradesApi.assignments()
    if (info.value.mode === 'all') {
      const [cls, subs] = await Promise.all([
        classesApi.list({ limit: 100 }),
        subjectsApi.list({ isActive: true }),
      ])
      allClasses.value = cls.items
      allSubjects.value = subs.items
    }
    // Sinf sahifasidan ?classId= bilan kelinganda shu sinf oldindan tanlanadi
    const wanted = typeof route.query.classId === 'string' ? route.query.classId : ''
    if (wanted && classOptions.value.some((o) => o.value === wanted)) {
      classId.value = wanted
    } else if (info.value.mode !== 'all' && classOptions.value.length === 1) {
      classId.value = classOptions.value[0]!.value
    }
    if (classId.value && subjectOptions.value.length === 1) {
      subjectId.value = subjectOptions.value[0]!.value
    }
  } catch (e) {
    initError.value = errorMessage(e, t)
  } finally {
    loadingInit.value = false
  }
}

/** Saqlanmagan o'zgarish bo'lsa tasdiq so'raydi; false - bekor qilindi. */
async function confirmDiscard(text: string): Promise<boolean> {
  if (!sheet.hasUnsaved.value) return true
  return confirm({
    title: t('scoring.unsaved.title'),
    message: text,
    confirmText: t('scoring.unsaved.discard'),
    variant: 'danger',
  })
}

async function pickClass(v: string) {
  if (v === classId.value) return
  if (!(await confirmDiscard(t('grading.unsavedChange')))) {
    selectKey.value++
    return
  }
  classId.value = v
  const subs = subjectOptions.value
  if (!isAdminMode.value) {
    subjectId.value = subs.length === 1 ? subs[0]!.value : ''
  } else if (subjectId.value && !subs.some((s) => s.value === subjectId.value)) {
    subjectId.value = ''
  }
}

async function pickSubject(v: string) {
  if (v === subjectId.value) return
  if (!(await confirmDiscard(t('grading.unsavedChange')))) {
    selectKey.value++
    return
  }
  subjectId.value = v
}

async function changeDate(next: string) {
  if (next === sheet.date.value) return
  if (next < bounds.value.min || next > bounds.value.max) return
  if (!(await confirmDiscard(t('scoring.unsaved.dateText')))) return
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
    else toast.success(t('grading.saved', { n: res.created + res.updated }))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

watch([classId, subjectId], () => {
  search.value = ''
  void sheet.load()
})
watch(
  () => sheet.hasUnsaved.value,
  (v) => emit('dirty-change', v),
)

const beforeUnload = (e: BeforeUnloadEvent) => {
  if (sheet.hasUnsaved.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void init()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

defineExpose({ hasUnsaved: sheet.hasUnsaved })
</script>

<template>
  <div v-if="loadingInit" class="space-y-3">
    <Skeleton class="h-20 w-full" />
    <Skeleton class="h-40 w-full" />
  </div>

  <div v-else-if="initError" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="initError">
      <BaseButton variant="secondary" @click="init">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else-if="!isAdminMode && info.assignments.length === 0" class="card">
    <EmptyState
      :icon="ClipboardCheck"
      :title="t('grading.noAssignmentsTitle')"
      :description="t('grading.noAssignmentsText')"
    />
  </div>

  <template v-else>
    <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
      <BaseSelect
        :key="`c${selectKey}`"
        :model-value="classId"
        :label="t('students.class')"
        :placeholder="t('grading.pickClass')"
        :options="classOptions"
        @update:model-value="pickClass"
      />
      <BaseSelect
        :key="`s${selectKey}`"
        :model-value="subjectId"
        :label="t('grading.subject')"
        :placeholder="t('grading.pickSubject')"
        :options="subjectOptions"
        :disabled="!classId"
        @update:model-value="pickSubject"
      />
      <div>
        <span class="mb-1.5 block text-sm font-medium text-fg">{{ t('scoring.date') }}</span>
        <div class="flex items-center gap-1">
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="!canPrev || !ready"
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
            :disabled="!ready"
            :aria-label="t('scoring.date')"
            class="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-sm text-fg focus:border-primary-500 disabled:opacity-60"
            @change="onDateInput"
          />
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="!canNext || !ready"
            :aria-label="t('scoring.nextDay')"
            @click="changeDate(shiftDate(sheet.date.value, 1))"
          >
            <ChevronRight class="h-4 w-4" />
          </BaseButton>
        </div>
      </div>
    </div>

    <div v-if="!ready" class="card">
      <EmptyState
        :icon="ClipboardCheck"
        :title="t('grading.pickTitle')"
        :description="t('grading.pickText')"
      />
    </div>

    <template v-else>
      <div v-if="!sheet.loading.value || sheet.rows.value.length" class="mb-3 space-y-1">
        <div class="flex items-center justify-between text-sm">
          <span class="text-fg">
            {{ t('grading.progress', { done: sheet.gradedCount.value, total: sheet.total.value }) }}
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

      <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
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
        <BaseCheckbox v-model="onlyUngraded" :label="t('grading.onlyUngraded')" />
      </div>

      <div v-if="sheet.loading.value && sheet.rows.value.length === 0" class="space-y-3">
        <Skeleton v-for="n in 4" :key="n" class="h-28 w-full" />
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
        <p v-if="visible.length === 0" class="py-8 text-center text-sm text-fg-muted">
          {{ t('scoring.noMatches') }}
        </p>
        <ul class="space-y-3 pb-28">
          <GradeRow
            v-for="row in visible"
            :key="row.studentId"
            :row="row"
            :status="sheet.statusOf(row)"
            :errors="sheet.errorsOf(row)"
            :show-errors="sheet.isDirty(row) || !!row.serverError"
            @patch="sheet.patch"
          />
        </ul>

        <StickySaveBar
          :message="
            sheet.invalidDirty.value.length
              ? t('scoring.invalidRows', { n: sheet.invalidDirty.value.length })
              : sheet.hasUnsaved.value
                ? t('scoring.unsavedHint')
                : ''
          "
          :danger="sheet.invalidDirty.value.length > 0"
          :show-discard="sheet.hasUnsaved.value"
          :saving="sheet.saving.value"
          :can-save="sheet.canSave.value"
          :count="sheet.changedCount.value"
          :save-label="t('scoring.save', { n: sheet.changedCount.value })"
          @discard="sheet.discard()"
          @save="save"
        />
      </template>
    </template>
  </template>
</template>

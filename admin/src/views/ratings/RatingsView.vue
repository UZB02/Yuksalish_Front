<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw, Search, Trophy } from 'lucide-vue-next'
import { ratingsApi } from '@/api/ratings.api'
import type {
  ClassRatingItem,
  RatingConfig,
  RatingPeriod,
  SchoolRatingItem,
  StudentRatingItem,
} from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import ClassRatingTable from '@/components/ratings/ClassRatingTable.vue'
import PeriodBadge from '@/components/ratings/PeriodBadge.vue'
import SchoolRatingTable from '@/components/ratings/SchoolRatingTable.vue'
import StudentRatingTable from '@/components/ratings/StudentRatingTable.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useDebounce } from '@/composables/useDebounce'
import { useClassLookup } from '@/composables/useLookups'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { usePagination } from '@/composables/usePagination'
import { useRatingsFilters } from '@/composables/useRatingsFilters'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'

type Tab = 'students' | 'classes' | 'schools'

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const schoolCtx = useSchoolContextStore()
const needsSchool = useNeedsSchool()
const filters = useRatingsFilters()
const classes = useClassLookup()

const tab = ref<Tab>('students')
const tabs = computed<{ key: Tab; label: string }[]>(() => [
  { key: 'students', label: t('ratings.tabs.students') },
  { key: 'classes', label: t('ratings.tabs.classes') },
  ...(auth.isSuperadmin ? [{ key: 'schools' as Tab, label: t('ratings.tabs.schools') }] : []),
])
const canRecalc = computed(
  () => auth.isSuperadmin || auth.hasPermission(PERMISSIONS.REPORTS_EXPORT),
)

const config = ref<RatingConfig | null>(null)
const period = ref<RatingPeriod | null>(null)
const calculatedAt = ref<string | null>(null)
const recalculating = ref(false)

const debouncedSearch = useDebounce(filters.search)

const students = usePagination<StudentRatingItem>(async ({ page, limit }) => {
  const res = await ratingsApi.students(filters.studentParams(page, limit, debouncedSearch.value))
  period.value = res.period
  calculatedAt.value = res.calculatedAt
  return res
})

const classItems = ref<ClassRatingItem[]>([])
const classesLoading = ref(false)
const classesError = ref('')
const schoolItems = ref<SchoolRatingItem[]>([])
const schoolsLoading = ref(false)
const schoolsError = ref('')

const schoolScoped = computed(() => tab.value !== 'schools')
const blocked = computed(() => schoolScoped.value && needsSchool.value)

async function loadClasses() {
  classesLoading.value = true
  classesError.value = ''
  try {
    const res = await ratingsApi.classes(filters.classParams())
    classItems.value = res.items
    period.value = res.period
    calculatedAt.value = res.calculatedAt
  } catch (e) {
    classesError.value = errorMessage(e, t)
  } finally {
    classesLoading.value = false
  }
}

async function loadSchools() {
  schoolsLoading.value = true
  schoolsError.value = ''
  try {
    schoolItems.value = await ratingsApi.schools()
  } catch (e) {
    schoolsError.value = errorMessage(e, t)
  } finally {
    schoolsLoading.value = false
  }
}

async function loadConfig() {
  if (needsSchool.value) return
  try {
    config.value = await ratingsApi.config()
    period.value ??= config.value.period
    calculatedAt.value ??= config.value.calculatedAt
  } catch {
    // Davr nishoni ixtiyoriy: ro'yxat javobidan ham olinadi.
  }
}

async function loadTab() {
  if (filters.customIncomplete.value) return
  if (tab.value === 'schools') return loadSchools()
  if (needsSchool.value) return
  if (tab.value === 'students') return students.reset()
  return loadClasses()
}

async function recalc() {
  recalculating.value = true
  try {
    await ratingsApi.recalculate()
    toast.success(t('ratings.recalculated'))
    await loadTab()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    recalculating.value = false
  }
}

function openClass(id: string) {
  filters.focusClass(id)
  tab.value = 'students'
}

const gradeOptions = Array.from({ length: 11 }, (_, i) => ({
  value: String(i + 1),
  label: t('classes.gradeLabel', { n: i + 1 }),
}))
const classOptions = computed(() =>
  classes.items.value.map((c) => ({ value: c.id, label: c.name })),
)
const modeOptions = computed(() => [
  { value: 'current', label: t('ratings.period.current') },
  { value: 'custom', label: t('ratings.period.custom') },
])

onMounted(() => {
  void loadConfig()
  if (!needsSchool.value) void classes.load()
  void loadTab()
})
watch(tab, loadTab)
watch(
  [
    debouncedSearch,
    filters.classId,
    filters.grade,
    filters.includeIneligible,
    filters.mode,
    filters.from,
    filters.to,
  ],
  loadTab,
)
watch(
  () => schoolCtx.schoolId,
  () => {
    period.value = null
    calculatedAt.value = null
    void loadConfig()
    void classes.load()
    void loadTab()
  },
)
</script>

<template>
  <PageHeader :title="t('ratings.title')" :description="t('ratings.description')">
    <template v-if="canRecalc" #actions>
      <BaseButton variant="secondary" :loading="recalculating" :disabled="blocked" @click="recalc">
        <RefreshCw class="h-4 w-4" /> {{ t('ratings.recalculate') }}
      </BaseButton>
    </template>
  </PageHeader>

  <div
    role="tablist"
    :aria-label="t('ratings.title')"
    class="mb-4 flex gap-1 overflow-x-auto border-b border-border"
  >
    <button
      v-for="x in tabs"
      :key="x.key"
      type="button"
      role="tab"
      :aria-selected="tab === x.key"
      class="whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
      :class="
        tab === x.key
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-fg-muted hover:text-fg'
      "
      @click="tab = x.key"
    >
      {{ x.label }}
    </button>
  </div>

  <NeedsSchool v-if="blocked" />
  <div v-else class="card">
    <div class="space-y-3 border-b border-border p-4">
      <PeriodBadge :period="period" :calculated-at="calculatedAt" />

      <div v-if="schoolScoped" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BaseSelect
          v-model="filters.mode.value"
          :label="t('ratings.periodLabel')"
          :options="modeOptions"
        />
        <template v-if="filters.mode.value === 'custom'">
          <BaseInput
            v-model="filters.from.value"
            type="date"
            :label="t('scores.from')"
            :max="filters.to.value || undefined"
          />
          <BaseInput
            v-model="filters.to.value"
            type="date"
            :label="t('scores.to')"
            :min="filters.from.value || undefined"
          />
        </template>
        <BaseSelect
          v-model="filters.grade.value"
          :label="t('classes.grade')"
          :placeholder="t('classes.allGrades')"
          :options="gradeOptions"
        />
        <BaseSelect
          v-if="tab === 'students'"
          v-model="filters.classId.value"
          :label="t('students.class')"
          :placeholder="t('students.allClasses')"
          :options="classOptions"
        />
        <BaseInput
          v-if="tab === 'students'"
          v-model="filters.search.value"
          type="search"
          :icon="Search"
          :label="t('common.search')"
          :placeholder="t('students.searchPlaceholder')"
        />
      </div>
      <p v-if="filters.customIncomplete.value" class="text-xs text-warning" role="status">
        {{ t('ratings.customHint') }}
      </p>
      <BaseCheckbox
        v-if="tab === 'students'"
        v-model="filters.includeIneligible.value"
        :label="t('ratings.includeIneligible')"
      />
    </div>

    <!-- O'quvchilar -->
    <template v-if="tab === 'students'">
      <div v-if="students.error.value" class="p-4">
        <EmptyState
          :title="t('errors.loadFailed')"
          :description="errorMessage(students.error.value, t)"
        >
          <BaseButton variant="secondary" @click="students.load()">{{
            t('common.retry')
          }}</BaseButton>
        </EmptyState>
      </div>
      <template v-else>
        <StudentRatingTable
          v-if="students.loading.value || students.items.value.length > 0"
          :items="students.items.value"
          :loading="students.loading.value"
          :min-days="config?.settings.minScoresCount"
        />
        <EmptyState
          v-else
          :icon="Trophy"
          :title="t('ratings.emptyTitle')"
          :description="t('ratings.emptyText')"
        />
        <BasePagination
          v-if="students.total.value > 0"
          :page="students.page.value"
          :total-pages="students.totalPages.value"
          :total="students.total.value"
          :limit="students.limit.value"
          @change="students.setPage"
        />
      </template>
    </template>

    <!-- Sinflar -->
    <template v-else-if="tab === 'classes'">
      <div v-if="classesError" class="p-4">
        <EmptyState :title="t('errors.loadFailed')" :description="classesError">
          <BaseButton variant="secondary" @click="loadClasses">{{ t('common.retry') }}</BaseButton>
        </EmptyState>
      </div>
      <ClassRatingTable
        v-else-if="classesLoading || classItems.length > 0"
        :items="classItems"
        :loading="classesLoading"
        @open="openClass"
      />
      <EmptyState
        v-else
        :icon="Trophy"
        :title="t('ratings.emptyTitle')"
        :description="t('ratings.emptyText')"
      />
    </template>

    <!-- Maktablar -->
    <template v-else>
      <div v-if="schoolsError" class="p-4">
        <EmptyState :title="t('errors.loadFailed')" :description="schoolsError">
          <BaseButton variant="secondary" @click="loadSchools">{{ t('common.retry') }}</BaseButton>
        </EmptyState>
      </div>
      <SchoolRatingTable
        v-else-if="schoolsLoading || schoolItems.length > 0"
        :items="schoolItems"
        :loading="schoolsLoading"
      />
      <EmptyState
        v-else
        :icon="Trophy"
        :title="t('ratings.emptyTitle')"
        :description="t('ratings.emptyText')"
      />
    </template>
  </div>
</template>

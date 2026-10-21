<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { History, Lock, Pencil, Trash2 } from 'lucide-vue-next'
import { behaviorTypesApi } from '@/api/behaviorTypes.api'
import { scoresApi } from '@/api/scores.api'
import type { BehaviorType, Score } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useClassLookup } from '@/composables/useLookups'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { usePagination } from '@/composables/usePagination'
import { useEffectiveScoring } from '@/composables/useScoringSettings'
import { useToast } from '@/composables/useToast'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { shiftDate, todayTashkent, withAlpha } from '@/utils/scoring'
import MyGradesTable from './MyGradesTable.vue'
import ScoreEditModal from './ScoreEditModal.vue'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()

// /my-scores (o'qituvchi) va /scores (admin: barcha o'qituvchilar baholari tarixi)
const isHistory = computed(() => route.name === 'scores-history')

// Ikki bo'lim: xulq baholari (0-100) va fan baholari (2-5)
const auth = useAuthStore()
const tab = ref<'conduct' | 'subjects'>('conduct')
const canGrades = computed(() =>
  [
    PERMISSIONS.GRADES_CREATE,
    PERMISSIONS.GRADES_EDIT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
  ].some((p) => auth.hasPermission(p)),
)

const today = todayTashkent()
const from = ref(shiftDate(today, -30))
const to = ref(today)
const classFilter = ref('')
const behaviorFilter = ref('')

const classes = useClassLookup()
const behaviorTypes = ref<BehaviorType[]>([])
const effective = useEffectiveScoring()

const list = usePagination<Score>(({ page, limit }) =>
  scoresApi.list({
    page,
    limit,
    from: from.value || undefined,
    to: to.value || undefined,
    classId: classFilter.value || undefined,
    behaviorTypeId: behaviorFilter.value || undefined,
  }),
)

const editing = ref<Score | null>(null)
// Tahrirda faqat faol turlar; bahoning hozirgi (nofaol bo'lishi mumkin) turi ham saqlanadi.
const editTypes = computed(() =>
  behaviorTypes.value.filter((b) => b.isActive || b.id === editing.value?.behaviorTypeId),
)

const columns = computed<TableColumn[]>(() => [
  { key: 'date', label: t('scoring.date') },
  { key: 'student', label: t('scores.student') },
  { key: 'class', label: t('students.class'), class: 'hidden sm:table-cell' },
  { key: 'value', label: t('scoring.score') },
  { key: 'behavior', label: t('scoring.behaviorType'), class: 'hidden md:table-cell' },
  ...(isHistory.value
    ? [{ key: 'teacher', label: t('scores.teacher'), class: 'hidden lg:table-cell' }]
    : []),
  { key: 'comment', label: t('scoring.comment'), class: 'hidden lg:table-cell' },
  { key: 'actions', label: t('common.actions'), align: 'right' as const },
])

const classOptions = computed(() =>
  classes.items.value.map((c) => ({ value: c.id, label: c.name })),
)
const typeOptions = computed(() => behaviorTypes.value.map((b) => ({ value: b.id, label: b.name })))

async function init() {
  if (needsSchool.value) return
  void classes.load()
  void effective.load()
  behaviorTypesApi
    .list()
    .then((r) => (behaviorTypes.value = r.items))
    .catch(() => undefined)
  await list.reset()
}
onMounted(init)
watch(() => schoolCtx.schoolId, init)
watch([from, to, classFilter, behaviorFilter], () => {
  if (!needsSchool.value) void list.reset()
})

async function remove(s: Score) {
  const ok = await confirm({
    title: t('scores.deleteTitle'),
    message: t('scores.deleteText', { name: s.student.fullName, date: formatDate(s.date) }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await scoresApi.remove(s.id)
    toast.success(t('scores.deleted'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <PageHeader
    :title="isHistory ? t('scores.historyTitle') : t('scores.myTitle')"
    :description="isHistory ? t('scores.historyDescription') : t('scores.myDescription')"
  />

  <div
    v-if="canGrades"
    role="tablist"
    :aria-label="t('scores.tabsLabel')"
    class="mb-4 inline-flex rounded-lg border border-border bg-surface p-1"
  >
    <button
      v-for="x in ['conduct', 'subjects'] as const"
      :key="x"
      type="button"
      role="tab"
      :aria-selected="tab === x"
      class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
      :class="tab === x ? 'bg-primary-600 text-white' : 'text-fg-muted hover:bg-surface-muted'"
      :data-tab="x"
      @click="tab = x"
    >
      {{ t(x === 'conduct' ? 'scores.tabConduct' : 'scores.tabSubjects') }}
    </button>
  </div>

  <NeedsSchool v-if="needsSchool" />
  <MyGradesTable v-else-if="tab === 'subjects' && canGrades" :is-history="isHistory" />
  <div v-else class="card">
    <div class="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
      <BaseInput v-model="from" type="date" :label="t('scores.from')" :max="to || undefined" />
      <BaseInput v-model="to" type="date" :label="t('scores.to')" :min="from || undefined" />
      <BaseSelect
        v-model="classFilter"
        :label="t('students.class')"
        :placeholder="t('students.allClasses')"
        :options="classOptions"
      />
      <BaseSelect
        v-model="behaviorFilter"
        :label="t('scoring.behaviorType')"
        :placeholder="t('scores.allBehaviors')"
        :options="typeOptions"
      />
    </div>

    <div v-if="list.error.value" class="p-4">
      <EmptyState :title="t('errors.loadFailed')" :description="errorMessage(list.error.value, t)">
        <BaseButton variant="secondary" @click="list.load()">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <template v-else>
      <BaseTable
        v-if="list.loading.value || list.items.value.length > 0"
        :columns="columns"
        :rows="list.items.value"
        :loading="list.loading.value"
        :caption="t('scores.myTitle')"
      >
        <template #cell-date="{ row }">{{ formatDate(row.date) }}</template>
        <template #cell-student="{ row }">
          <RouterLink
            :to="{ name: 'student-profile', params: { id: row.studentId } }"
            class="font-medium text-primary-700 hover:underline"
          >
            {{ row.student.fullName }}
          </RouterLink>
        </template>
        <template #cell-class="{ row }">{{ row.class.name }}</template>
        <template #cell-value="{ row }">
          <span class="text-base font-semibold text-fg">{{ row.value }}</span>
        </template>
        <template #cell-behavior="{ row }">
          <span
            v-if="row.behaviorType"
            class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            :style="{
              borderColor: row.behaviorType.color,
              backgroundColor: withAlpha(row.behaviorType.color, 0.15),
            }"
          >
            {{ row.behaviorType.name }}
          </span>
          <span v-else class="text-fg-muted">-</span>
        </template>
        <template #cell-teacher="{ row }">{{ row.teacher.fullName }}</template>
        <template #cell-comment="{ row }">
          <span class="line-clamp-2 max-w-xs text-fg-muted" :title="row.comment ?? ''">
            {{ row.comment || '-' }}
          </span>
        </template>
        <template #cell-actions="{ row }">
          <div v-if="row.editable" class="flex justify-end gap-1">
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="`${t('common.edit')}: ${row.student.fullName}`"
              :title="t('common.edit')"
              @click="editing = row"
            >
              <Pencil class="h-4 w-4" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="`${t('common.delete')}: ${row.student.fullName}`"
              :title="t('common.delete')"
              @click="remove(row)"
            >
              <Trash2 class="h-4 w-4 text-danger" />
            </BaseButton>
          </div>
          <span
            v-else
            class="inline-flex items-center gap-1 text-xs text-fg-muted"
            :title="
              t('scores.notEditableHint', { hours: effective.settings.value.editWindowHours })
            "
          >
            <Lock class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('scores.notEditable') }}
          </span>
        </template>
      </BaseTable>
      <EmptyState
        v-else
        :icon="History"
        :title="t('scores.emptyTitle')"
        :description="t('scores.emptyText')"
      />
      <BasePagination
        v-if="list.total.value > 0"
        :page="list.page.value"
        :total-pages="list.totalPages.value"
        :total="list.total.value"
        :limit="list.limit.value"
        @change="list.setPage"
      />
    </template>
  </div>

  <ScoreEditModal
    :open="!!editing"
    :score="editing"
    :types="editTypes"
    :settings="effective.settings.value"
    @close="editing = null"
    @saved="list.load()"
  />
</template>

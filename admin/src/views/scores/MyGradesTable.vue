<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { History, Lock, Pencil, Trash2 } from 'lucide-vue-next'
import { gradesApi } from '@/api/grades.api'
import { subjectsApi } from '@/api/subjects.api'
import type { Subject, SubjectGrade } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useClassLookup } from '@/composables/useLookups'
import { usePagination } from '@/composables/usePagination'
import { useEffectiveScoring } from '@/composables/useScoringSettings'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { gradeTone } from '@/utils/grades'
import { shiftDate, todayTashkent } from '@/utils/scoring'
import GradeEditModal from './GradeEditModal.vue'

// Fan baholari tarixi: o'qituvchi - o'z baholari; admin - maktabdagi barcha fan baholari.
// Tahrirlash/o'chirish: o'z bahosi tahrir oynasi (soat) ichida yoki grades.edit ruxsati bilan.
const props = defineProps<{ isHistory: boolean }>()

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const today = todayTashkent()
const from = ref(shiftDate(today, -30))
const to = ref(today)
const classFilter = ref('')
const subjectFilter = ref('')

const classes = useClassLookup()
const subjects = ref<Subject[]>([])
const effective = useEffectiveScoring()

const list = usePagination<SubjectGrade>(({ page, limit }) =>
  gradesApi.list({
    page,
    limit,
    from: from.value || undefined,
    to: to.value || undefined,
    classId: classFilter.value || undefined,
    subjectId: subjectFilter.value || undefined,
  }),
)
const editing = ref<SubjectGrade | null>(null)

const columns = computed<TableColumn[]>(() => [
  { key: 'date', label: t('scoring.date') },
  { key: 'student', label: t('scores.student') },
  { key: 'class', label: t('students.class'), class: 'hidden sm:table-cell' },
  { key: 'subject', label: t('grading.subject') },
  { key: 'value', label: t('grading.grade') },
  ...(props.isHistory
    ? [{ key: 'teacher', label: t('scores.teacher'), class: 'hidden lg:table-cell' }]
    : []),
  { key: 'comment', label: t('scoring.comment'), class: 'hidden lg:table-cell' },
  { key: 'actions', label: t('common.actions'), align: 'right' as const },
])
const classOptions = computed(() =>
  classes.items.value.map((c) => ({ value: c.id, label: c.name })),
)
const subjectOptions = computed(() => subjects.value.map((s) => ({ value: s.id, label: s.name })))

onMounted(() => {
  void classes.load()
  void effective.load()
  subjectsApi
    .list()
    .then((r) => (subjects.value = r.items))
    .catch(() => undefined)
  void list.reset()
})
watch([from, to, classFilter, subjectFilter], () => void list.reset())

/** "05.10.2026" yoki darsga bog'langan bo'lsa "05.10.2026, 3-dars" */
const lessonDate = (g: SubjectGrade) =>
  g.lessonNo > 0
    ? `${formatDate(g.date)}, ${t('grading.lesson.n', { n: g.lessonNo })}`
    : formatDate(g.date)

async function remove(g: SubjectGrade) {
  const ok = await confirm({
    title: t('grades.deleteTitle'),
    message: t('grades.deleteText', {
      name: g.student.fullName,
      subject: g.subject.name,
      date: lessonDate(g),
    }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await gradesApi.remove(g.id)
    toast.success(t('grades.deleted'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <div class="card" data-testid="my-grades">
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
        v-model="subjectFilter"
        :label="t('grading.subject')"
        :placeholder="t('grades.allSubjects')"
        :options="subjectOptions"
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
        :caption="t('grades.title')"
      >
        <template #cell-date="{ row }">
          {{ formatDate(row.date) }}
          <span
            v-if="row.lessonNo > 0"
            class="ml-1 text-xs text-fg-muted"
            data-testid="lesson-label"
            >{{ t('grading.lesson.n', { n: row.lessonNo }) }}</span
          >
        </template>
        <template #cell-student="{ row }">
          <RouterLink
            :to="{ name: 'student-profile', params: { id: row.studentId } }"
            class="font-medium text-primary-700 hover:underline"
          >
            {{ row.student.fullName }}
          </RouterLink>
        </template>
        <template #cell-class="{ row }">{{ row.class.name }}</template>
        <template #cell-subject="{ row }">{{ row.subject.name }}</template>
        <template #cell-value="{ row }">
          <BaseBadge :tone="gradeTone(row.value)">
            <span class="text-sm font-semibold">{{ row.value }}</span>
          </BaseBadge>
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
        :title="t('grades.emptyTitle')"
        :description="t('grades.emptyText')"
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

  <GradeEditModal :open="!!editing" :grade="editing" @close="editing = null" @saved="list.load()" />
</template>

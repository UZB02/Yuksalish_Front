<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { History, Lock, Pencil, Trash2 } from 'lucide-vue-next'
import { attendanceApi } from '@/api/attendance.api'
import type { AttendanceRecord, AttendanceSettings, AttendanceStatus } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useConfirm } from '@/composables/useConfirm'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { textOn } from '@/utils/attendance'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import AttendanceEditModal from './AttendanceEditModal.vue'

const props = defineProps<{
  classId: string
  from: string
  to: string
  statuses: AttendanceStatus[]
  settings: AttendanceSettings
}>()
const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const statusFilter = ref('')
const lessonFilter = ref('')

const list = usePagination<AttendanceRecord>(({ page, limit }) =>
  attendanceApi.list({
    page,
    limit,
    classId: props.classId || undefined,
    from: props.from || undefined,
    to: props.to || undefined,
    statusId: statusFilter.value || undefined,
    lessonNo: lessonFilter.value ? Number(lessonFilter.value) : undefined,
  }),
)
const editing = ref<AttendanceRecord | null>(null)

const columns = computed<TableColumn[]>(() => [
  { key: 'date', label: t('scoring.date') },
  { key: 'student', label: t('scores.student') },
  { key: 'status', label: t('attendance.status') },
  { key: 'lesson', label: t('attendance.lesson'), class: 'hidden sm:table-cell' },
  { key: 'markedBy', label: t('attendance.markedBy'), class: 'hidden lg:table-cell' },
  { key: 'note', label: t('attendance.note'), class: 'hidden md:table-cell' },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])
const statusOptions = computed(() => props.statuses.map((s) => ({ value: s.id, label: s.name })))

onMounted(() => void list.reset())
watch(
  () => [props.classId, props.from, props.to, statusFilter.value, lessonFilter.value],
  () => void list.reset(),
)

async function remove(r: AttendanceRecord) {
  const ok = await confirm({
    title: t('attendance.deleteTitle'),
    message: t('attendance.deleteText', { name: r.student.fullName, date: formatDate(r.date) }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await attendanceApi.remove(r.id)
    toast.success(t('attendance.deleted'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <div>
    <div class="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
      <BaseSelect
        v-model="statusFilter"
        :label="t('attendance.status')"
        :placeholder="t('attendance.allStatuses')"
        :options="statusOptions"
      />
      <BaseInput
        v-model="lessonFilter"
        type="number"
        inputmode="numeric"
        min="1"
        :label="t('attendance.lesson')"
        :placeholder="t('attendance.allLessons')"
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
        :caption="t('attendance.records')"
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
        <template #cell-status="{ row }">
          <span
            class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold"
            :style="{ backgroundColor: row.status.color, color: textOn(row.status.color) }"
            :title="row.status.name"
            data-testid="record-status"
          >
            {{ row.status.shortName }}
          </span>
          <span v-if="row.minutesLate" class="ml-1 text-xs text-fg-muted">
            {{ row.minutesLate }} {{ t('attendance.minutesUnit') }}
          </span>
        </template>
        <template #cell-lesson="{ row }">{{ row.lessonNo || '-' }}</template>
        <template #cell-markedBy="{ row }">{{ row.markedBy.fullName }}</template>
        <template #cell-note="{ row }">
          <span class="line-clamp-2 max-w-xs text-fg-muted" :title="row.note ?? ''">
            {{ row.note || '-' }}
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
            :title="t('attendance.notEditableHint', { hours: settings.editWindowHours })"
          >
            <Lock class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('scores.notEditable') }}
          </span>
        </template>
      </BaseTable>
      <EmptyState
        v-else
        :icon="History"
        :title="t('attendance.recordsEmptyTitle')"
        :description="t('attendance.recordsEmptyText')"
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

    <AttendanceEditModal
      :open="!!editing"
      :record="editing"
      :statuses="statuses"
      :settings="settings"
      @close="editing = null"
      @saved="list.load()"
    />
  </div>
</template>

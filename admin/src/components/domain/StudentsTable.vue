<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRightLeft, Pencil, Trash2 } from 'lucide-vue-next'
import type { Student, StudentStatus } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import { formatDate } from '@/utils/format'

const props = defineProps<{
  rows: Student[]
  loading?: boolean
  /** "Sinf" ustunini ko'rsatish (umumiy sahifada) */
  showClass?: boolean
  /** Tahrirlash/o'tkazish/o'chirish tugmalari (students.manage) */
  canManage?: boolean
}>()
const emit = defineEmits<{ edit: [Student]; transfer: [Student]; remove: [Student] }>()
const { t } = useI18n()

const columns = computed<TableColumn[]>(() => {
  const cols: TableColumn[] = [
    { key: 'fullName', label: t('common.fullName') },
    ...(props.showClass ? [{ key: 'class', label: t('students.class') }] : []),
    { key: 'studentCode', label: t('students.code'), class: 'hidden md:table-cell' },
    { key: 'birthDate', label: t('students.birthDate'), class: 'hidden lg:table-cell' },
    { key: 'status', label: t('common.status'), class: 'hidden sm:table-cell' },
  ]
  if (props.canManage) cols.push({ key: 'actions', label: t('common.actions'), align: 'right' })
  return cols
})

const statusTone: Record<StudentStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  transferred: 'warning',
  graduated: 'neutral',
}
</script>

<template>
  <BaseTable :columns="columns" :rows="rows" :loading="loading" :caption="t('students.title')">
    <template #cell-fullName="{ row }">
      <RouterLink
        :to="{ name: 'student-profile', params: { id: row.id } }"
        class="font-medium text-fg hover:text-primary-700 hover:underline"
      >
        {{ row.fullName }}
      </RouterLink>
      <p v-if="row.parentPhone" class="text-xs text-fg-muted">{{ row.parentPhone }}</p>
    </template>
    <template #cell-class="{ row }">
      <RouterLink
        :to="{ name: 'class-detail', params: { id: row.classId } }"
        class="text-primary-700 hover:underline"
      >
        {{ row.class.name }}
      </RouterLink>
    </template>
    <template #cell-studentCode="{ row }">{{ row.studentCode || '-' }}</template>
    <template #cell-birthDate="{ row }">{{ formatDate(row.birthDate) || '-' }}</template>
    <template #cell-status="{ row }">
      <BaseBadge :tone="statusTone[row.status]">{{
        t(`students.statuses.${row.status}`)
      }}</BaseBadge>
    </template>
    <template #cell-actions="{ row }">
      <div class="flex justify-end gap-1">
        <BaseButton
          size="sm"
          variant="ghost"
          :aria-label="`${t('common.edit')}: ${row.fullName}`"
          :title="t('common.edit')"
          @click="emit('edit', row)"
        >
          <Pencil class="h-4 w-4" />
        </BaseButton>
        <BaseButton
          size="sm"
          variant="ghost"
          :aria-label="`${t('students.transfer')}: ${row.fullName}`"
          :title="t('students.transfer')"
          @click="emit('transfer', row)"
        >
          <ArrowRightLeft class="h-4 w-4" />
        </BaseButton>
        <BaseButton
          size="sm"
          variant="ghost"
          :aria-label="`${t('common.delete')}: ${row.fullName}`"
          :title="t('common.delete')"
          @click="emit('remove', row)"
        >
          <Trash2 class="h-4 w-4 text-danger" />
        </BaseButton>
      </div>
    </template>
  </BaseTable>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarRange, Pencil, Plus, Trash2, CheckCircle2 } from 'lucide-vue-next'
import { academicYearsApi } from '@/api/academicYears.api'
import { isApiError } from '@/api/errors'
import type { AcademicYear } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import AcademicYearFormModal from './AcademicYearFormModal.vue'

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const schoolCtx = useSchoolContextStore()
const needsSchool = useNeedsSchool()

const list = usePagination<AcademicYear>(({ page, limit }) =>
  academicYearsApi.list({ page, limit }),
)

const formOpen = ref(false)
const editing = ref<AcademicYear | null>(null)

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('academicYears.name') },
  { key: 'range', label: t('academicYears.range'), class: 'hidden sm:table-cell' },
  { key: 'periods', label: t('academicYears.periods'), class: 'hidden md:table-cell' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const load = () => {
  if (!needsSchool.value) void list.reset()
}
onMounted(load)
watch(() => schoolCtx.schoolId, load)

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(y: AcademicYear) {
  editing.value = y
  formOpen.value = true
}

async function activate(y: AcademicYear) {
  const ok = await confirm({
    title: t('academicYears.activateTitle'),
    message: t('academicYears.activateText', { name: y.name }),
    confirmText: t('common.activate'),
  })
  if (!ok) return
  try {
    await academicYearsApi.activate(y.id)
    toast.success(t('academicYears.activated'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

async function remove(y: AcademicYear) {
  const ok = await confirm({
    title: t('academicYears.deleteTitle'),
    message: t('academicYears.deleteText', { name: y.name }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await academicYearsApi.remove(y.id)
    toast.success(t('academicYears.deleted'))
    await list.load()
  } catch (e) {
    // 409: yilda sinflar bor
    toast.error(
      isApiError(e) && e.code === 'CONFLICT' ? t('academicYears.hasClasses') : errorMessage(e, t),
    )
  }
}
</script>

<template>
  <PageHeader :title="t('academicYears.title')" :description="t('academicYears.description')">
    <template #actions>
      <BaseButton :disabled="needsSchool" @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('academicYears.add') }}
      </BaseButton>
    </template>
  </PageHeader>

  <NeedsSchool v-if="needsSchool" />
  <div v-else class="card">
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
        :caption="t('academicYears.title')"
      >
        <template #cell-name="{ row }">
          <span class="font-medium text-fg">{{ row.name }}</span>
        </template>
        <template #cell-range="{ row }">
          {{ formatDate(row.startDate) }} - {{ formatDate(row.endDate) }}
        </template>
        <template #cell-periods="{ row }">{{ row.periods.length }}</template>
        <template #cell-isActive="{ row }">
          <BaseBadge :tone="row.isActive ? 'success' : 'neutral'">
            {{ row.isActive ? t('common.active') : t('common.inactive') }}
          </BaseBadge>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
            <BaseButton
              v-if="!row.isActive"
              size="sm"
              variant="ghost"
              :aria-label="`${t('common.activate')}: ${row.name}`"
              :title="t('common.activate')"
              @click="activate(row)"
            >
              <CheckCircle2 class="h-4 w-4 text-success" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="`${t('common.edit')}: ${row.name}`"
              :title="t('common.edit')"
              @click="openEdit(row)"
            >
              <Pencil class="h-4 w-4" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="`${t('common.delete')}: ${row.name}`"
              :title="t('common.delete')"
              @click="remove(row)"
            >
              <Trash2 class="h-4 w-4 text-danger" />
            </BaseButton>
          </div>
        </template>
      </BaseTable>
      <EmptyState
        v-else
        :icon="CalendarRange"
        :title="t('academicYears.emptyTitle')"
        :description="t('academicYears.emptyText')"
      >
        <BaseButton @click="openCreate">{{ t('academicYears.add') }}</BaseButton>
      </EmptyState>
    </template>
  </div>

  <AcademicYearFormModal
    :open="formOpen"
    :year="editing"
    @close="formOpen = false"
    @saved="list.load()"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { CalendarCheck, Pencil, Plus, Power, Star } from 'lucide-vue-next'
import { attendanceStatusesApi } from '@/api/attendanceStatuses.api'
import type { AttendanceStatus } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { textOn } from '@/utils/attendance'
import AttendanceStatusFormModal from './AttendanceStatusFormModal.vue'

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const schoolCtx = useSchoolContextStore()
const { schools, schoolId } = storeToRefs(schoolCtx)

const scope = ref<'all' | 'global' | 'school'>('all')
const list = usePagination<AttendanceStatus>(({ page, limit }) =>
  attendanceStatusesApi.list({ scope: scope.value }).then((r) => ({
    items: [...r.items].sort((a, b) => a.order - b.order),
    meta: { ...r.meta, page, limit },
  })),
)

const formOpen = ref(false)
const editing = ref<AttendanceStatus | null>(null)

const scopeOptions = computed(() => [
  { value: 'all', label: t('behaviorTypes.scopes.all') },
  { value: 'global', label: t('behaviorTypes.scopes.global') },
  { value: 'school', label: t('behaviorTypes.scopes.school') },
])
const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('attendanceStatuses.name') },
  { key: 'category', label: t('attendanceStatuses.category'), class: 'hidden sm:table-cell' },
  { key: 'scope', label: t('behaviorTypes.scope'), class: 'hidden lg:table-cell' },
  { key: 'order', label: t('behaviorTypes.order'), class: 'hidden md:table-cell' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const schoolName = (id: string | null) =>
  id === null ? t('behaviorTypes.global') : (schools.value.find((s) => s.id === id)?.name ?? '-')

onMounted(async () => {
  void list.reset()
  if (!schoolCtx.loaded) await schoolCtx.loadSchools().catch(() => undefined)
})
watch([scope, schoolId], () => list.reset())

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(s: AttendanceStatus) {
  editing.value = s
  formOpen.value = true
}

async function toggle(s: AttendanceStatus) {
  const next = !s.isActive
  const ok = await confirm({
    title: t(next ? 'attendanceStatuses.activateTitle' : 'attendanceStatuses.deactivateTitle'),
    message: t(next ? 'attendanceStatuses.activateText' : 'attendanceStatuses.deactivateText', {
      name: s.name,
    }),
    confirmText: t(next ? 'common.activate' : 'common.deactivate'),
    variant: next ? 'primary' : 'danger',
  })
  if (!ok) return
  try {
    await (next ? attendanceStatusesApi.activate(s.id) : attendanceStatusesApi.deactivate(s.id))
    toast.success(t(next ? 'attendanceStatuses.activated' : 'attendanceStatuses.deactivated'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <PageHeader
    :title="t('attendanceStatuses.title')"
    :description="t('attendanceStatuses.description')"
  >
    <template #actions>
      <BaseButton @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('attendanceStatuses.add') }}
      </BaseButton>
    </template>
  </PageHeader>

  <div class="card">
    <div class="border-b border-border p-4 sm:max-w-xs">
      <BaseSelect v-model="scope" :aria-label="t('behaviorTypes.scope')" :options="scopeOptions" />
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
        :caption="t('attendanceStatuses.title')"
      >
        <template #cell-name="{ row }">
          <span class="inline-flex items-center gap-2 font-medium text-fg">
            <span
              class="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg px-1.5 text-xs font-bold"
              :style="{ backgroundColor: row.color, color: textOn(row.color) }"
              data-testid="status-swatch"
            >
              {{ row.shortName }}
            </span>
            {{ row.name }}
            <Star
              v-if="row.isDefault"
              class="h-4 w-4 text-warning"
              :aria-label="t('attendanceStatuses.default')"
              role="img"
            />
          </span>
        </template>
        <template #cell-category="{ row }">
          <BaseBadge
            :tone="
              row.category === 'present'
                ? 'success'
                : row.category === 'late'
                  ? 'warning'
                  : row.category === 'absent_excused'
                    ? 'primary'
                    : 'danger'
            "
          >
            {{ t(`attendance.categories.${row.category}`) }}
          </BaseBadge>
        </template>
        <template #cell-scope="{ row }">{{ schoolName(row.schoolId) }}</template>
        <template #cell-order="{ row }">{{ row.order }}</template>
        <template #cell-isActive="{ row }">
          <BaseBadge :tone="row.isActive ? 'success' : 'neutral'">
            {{ row.isActive ? t('common.active') : t('common.inactive') }}
          </BaseBadge>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
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
              :aria-label="`${row.isActive ? t('common.deactivate') : t('common.activate')}: ${row.name}`"
              :title="row.isActive ? t('common.deactivate') : t('common.activate')"
              @click="toggle(row)"
            >
              <Power class="h-4 w-4" :class="row.isActive ? 'text-danger' : 'text-success'" />
            </BaseButton>
          </div>
        </template>
      </BaseTable>
      <EmptyState
        v-else
        :icon="CalendarCheck"
        :title="t('attendanceStatuses.emptyTitle')"
        :description="t('attendanceStatuses.emptyText')"
      >
        <BaseButton @click="openCreate">{{ t('attendanceStatuses.add') }}</BaseButton>
      </EmptyState>
    </template>
  </div>

  <AttendanceStatusFormModal
    :open="formOpen"
    :item="editing"
    :schools="schools"
    :default-school-id="schoolId ?? ''"
    @close="formOpen = false"
    @saved="list.load()"
  />
</template>

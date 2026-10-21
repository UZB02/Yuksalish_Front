<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  KeyRound,
  Pencil,
  Plus,
  Power,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-vue-next'
import { schoolAdminsApi } from '@/api/schoolAdmins.api'
import type { SchoolAdmin } from '@/api/types'
import PermissionsModal from '@/components/domain/PermissionsModal.vue'
import ResetPasswordModal from '@/components/domain/ResetPasswordModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useDebounce } from '@/composables/useDebounce'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'
import SchoolAdminFormModal from './SchoolAdminFormModal.vue'

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const schoolCtx = useSchoolContextStore()
const { schools } = storeToRefs(schoolCtx)

const search = ref('')
const schoolFilter = ref('')
const debouncedSearch = useDebounce(search)

const list = usePagination<SchoolAdmin>(({ page, limit }) =>
  schoolAdminsApi.list({
    page,
    limit,
    search: debouncedSearch.value.trim(),
    schoolId: schoolFilter.value || undefined,
  }),
)

const formOpen = ref(false)
const editing = ref<SchoolAdmin | null>(null)
const permTarget = ref<SchoolAdmin | null>(null)
const resetTarget = ref<SchoolAdmin | null>(null)

const schoolName = (id: string | null) => schools.value.find((s) => s.id === id)?.name ?? '-'

const columns = computed<TableColumn[]>(() => [
  { key: 'fullName', label: t('common.fullName') },
  { key: 'schoolId', label: t('schoolAdmins.school'), class: 'hidden md:table-cell' },
  { key: 'lastLoginAt', label: t('common.lastLogin'), class: 'hidden lg:table-cell' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const schoolOptions = computed(() => schools.value.map((s) => ({ value: s.id, label: s.name })))

onMounted(async () => {
  void list.load()
  if (!schoolCtx.loaded) {
    try {
      await schoolCtx.loadSchools()
    } catch (e) {
      toast.error(errorMessage(e, t))
    }
  }
})
watch([debouncedSearch, schoolFilter], () => list.reset())

const submitPermissions = (perms: string[]) =>
  schoolAdminsApi.setPermissions(permTarget.value!.id, perms)
const submitReset = (pw: string) => schoolAdminsApi.resetPassword(resetTarget.value!.id, pw)

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(a: SchoolAdmin) {
  editing.value = a
  formOpen.value = true
}

async function toggleActive(a: SchoolAdmin) {
  const next = !a.isActive
  const ok = await confirm({
    title: t(next ? 'schoolAdmins.activateTitle' : 'schoolAdmins.deactivateTitle'),
    message: t(next ? 'schoolAdmins.activateText' : 'schoolAdmins.deactivateText', {
      name: a.fullName,
    }),
    confirmText: t(next ? 'common.activate' : 'common.deactivate'),
    variant: next ? 'primary' : 'danger',
  })
  if (!ok) return
  try {
    await schoolAdminsApi.update(a.id, { isActive: next })
    toast.success(t(next ? 'schoolAdmins.activated' : 'schoolAdmins.deactivated'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <PageHeader :title="t('schoolAdmins.title')" :description="t('schoolAdmins.description')">
    <template #actions>
      <BaseButton @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('schoolAdmins.add') }}
      </BaseButton>
    </template>
  </PageHeader>

  <div class="card">
    <div class="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
      <BaseInput
        v-model="search"
        type="search"
        class="flex-1"
        :icon="Search"
        :aria-label="t('common.search')"
        :placeholder="t('schoolAdmins.searchPlaceholder')"
      />
      <BaseSelect
        v-model="schoolFilter"
        class="sm:w-56"
        :aria-label="t('schoolAdmins.school')"
        :placeholder="t('schoolAdmins.allSchools')"
        :options="schoolOptions"
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
        :caption="t('schoolAdmins.title')"
      >
        <template #cell-fullName="{ row }">
          <p class="font-medium text-fg">{{ row.fullName }}</p>
          <p class="text-xs text-fg-muted">{{ row.username }}</p>
        </template>
        <template #cell-schoolId="{ row }">{{ schoolName(row.schoolId) }}</template>
        <template #cell-lastLoginAt="{ row }">
          {{ formatDateTime(row.lastLoginAt) || t('common.never') }}
        </template>
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
              :aria-label="`${t('common.edit')}: ${row.fullName}`"
              :title="t('common.edit')"
              @click="openEdit(row)"
            >
              <Pencil class="h-4 w-4" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="`${t('permissions.title')}: ${row.fullName}`"
              :title="t('permissions.title')"
              @click="permTarget = row"
            >
              <SlidersHorizontal class="h-4 w-4" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="`${t('resetPassword.title')}: ${row.fullName}`"
              :title="t('resetPassword.title')"
              @click="resetTarget = row"
            >
              <KeyRound class="h-4 w-4" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="`${row.isActive ? t('common.deactivate') : t('common.activate')}: ${row.fullName}`"
              :title="row.isActive ? t('common.deactivate') : t('common.activate')"
              @click="toggleActive(row)"
            >
              <Power class="h-4 w-4" :class="row.isActive ? 'text-danger' : 'text-success'" />
            </BaseButton>
          </div>
        </template>
      </BaseTable>
      <EmptyState
        v-else
        :icon="ShieldCheck"
        :title="t('schoolAdmins.emptyTitle')"
        :description="t('schoolAdmins.emptyText')"
      >
        <BaseButton @click="openCreate">{{ t('schoolAdmins.add') }}</BaseButton>
      </EmptyState>
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

  <SchoolAdminFormModal
    :open="formOpen"
    :admin="editing"
    :schools="schools"
    :default-school-id="schoolFilter || schoolCtx.schoolId || undefined"
    @close="formOpen = false"
    @saved="list.load()"
  />
  <PermissionsModal
    :open="!!permTarget"
    :target-name="permTarget?.fullName ?? ''"
    role="school_admin"
    :initial="permTarget?.permissions ?? []"
    :submit="submitPermissions"
    @close="permTarget = null"
    @saved="list.load()"
  />
  <ResetPasswordModal
    :open="!!resetTarget"
    :target-name="resetTarget?.fullName ?? ''"
    :submit="submitReset"
    @close="resetTarget = null"
  />
</template>

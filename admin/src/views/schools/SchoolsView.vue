<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Plus, Power, School as SchoolIcon, Search } from 'lucide-vue-next'
import { ratingsApi } from '@/api/ratings.api'
import { schoolsApi } from '@/api/schools.api'
import PublicLink from '@/components/settings/PublicLink.vue'
import type { School } from '@/api/types'
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
import SchoolFormModal from './SchoolFormModal.vue'

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const schoolCtx = useSchoolContextStore()

const search = ref('')
const status = ref<'all' | 'active' | 'inactive'>('all')
const debouncedSearch = useDebounce(search)

const list = usePagination<School>(({ page, limit }) =>
  schoolsApi.list({
    page,
    limit,
    search: debouncedSearch.value.trim(),
    isActive: status.value === 'all' ? undefined : status.value === 'active',
  }),
)

const modalOpen = ref(false)
const editing = ref<School | null>(null)

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('schools.name') },
  { key: 'address', label: t('schools.address'), class: 'hidden md:table-cell' },
  { key: 'phone', label: t('schools.phone'), class: 'hidden lg:table-cell' },
  { key: 'publicUrl', label: t('settingsPublic.link.column'), class: 'hidden lg:table-cell' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const statusOptions = computed(() => [
  { value: 'all', label: t('common.all') },
  { value: 'active', label: t('common.active') },
  { value: 'inactive', label: t('common.inactive') },
])

const publicEnabled = ref<Map<string, boolean>>(new Map())

onMounted(() => {
  void list.load()
  // Ochiq reyting holati (yoqilgan/o'chirilgan) maktablar reytingi javobidan olinadi.
  ratingsApi
    .schools()
    .then((items) => (publicEnabled.value = new Map(items.map((s) => [s.schoolId, s.enabled]))))
    .catch(() => undefined)
})
watch([debouncedSearch, status], () => list.reset())

function openCreate() {
  editing.value = null
  modalOpen.value = true
}
function openEdit(school: School) {
  editing.value = school
  modalOpen.value = true
}

async function onSaved() {
  await list.load()
  // Switcher ro'yxati yangilansin.
  schoolCtx.loadSchools().catch(() => undefined)
}

async function toggleActive(school: School) {
  const next = !school.isActive
  const ok = await confirm({
    title: t(next ? 'schools.activateTitle' : 'schools.deactivateTitle'),
    message: t(next ? 'schools.activateText' : 'schools.deactivateText', { name: school.name }),
    confirmText: t(next ? 'common.activate' : 'common.deactivate'),
    variant: next ? 'primary' : 'danger',
  })
  if (!ok) return
  try {
    await schoolsApi.update(school.id, { isActive: next })
    toast.success(t(next ? 'schools.activated' : 'schools.deactivated'))
    await onSaved()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <PageHeader :title="t('schools.title')" :description="t('schools.description')">
    <template #actions>
      <BaseButton @click="openCreate"><Plus class="h-4 w-4" /> {{ t('schools.add') }}</BaseButton>
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
        :placeholder="t('schools.searchPlaceholder')"
      />
      <BaseSelect
        v-model="status"
        class="sm:w-48"
        :aria-label="t('common.status')"
        :options="statusOptions"
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
        :caption="t('schools.title')"
      >
        <template #cell-name="{ row }">
          <p class="font-medium text-fg">{{ row.name }}</p>
          <p class="text-xs text-fg-muted">/{{ row.slug }}</p>
        </template>
        <template #cell-address="{ row }">{{ row.address || '-' }}</template>
        <template #cell-phone="{ row }">{{ row.phone || '-' }}</template>
        <template #cell-publicUrl="{ row }">
          <PublicLink :slug="row.slug" :enabled="publicEnabled.get(row.id)" compact />
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
              @click="toggleActive(row)"
            >
              <Power class="h-4 w-4" :class="row.isActive ? 'text-danger' : 'text-success'" />
            </BaseButton>
          </div>
        </template>
      </BaseTable>
      <EmptyState
        v-else
        :icon="SchoolIcon"
        :title="t('schools.emptyTitle')"
        :description="t('schools.emptyText')"
      >
        <BaseButton @click="openCreate">{{ t('schools.add') }}</BaseButton>
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

  <SchoolFormModal
    :open="modalOpen"
    :school="editing"
    @close="modalOpen = false"
    @saved="onSaved"
  />
</template>

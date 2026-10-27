<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GraduationCap, Pencil, Plus, School as SchoolIcon, Search } from 'lucide-vue-next'
import { teachersApi } from '@/api/teachers.api'
import type { Teacher } from '@/api/types'
import LastLogin from '@/components/domain/LastLogin.vue'
import TeacherActionsMenu from '@/components/domain/TeacherActionsMenu.vue'
import TeacherWorkload from '@/components/domain/TeacherWorkload.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useDebounce } from '@/composables/useDebounce'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { usePagination } from '@/composables/usePagination'
import { useTeacherActions } from '@/composables/useTeacherActions'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import TeacherActionModals from './TeacherActionModals.vue'

const { t } = useI18n()
const schoolCtx = useSchoolContextStore()

const search = ref('')
const status = ref<'all' | 'active' | 'inactive'>('all')
const debouncedSearch = useDebounce(search)

// Superadmin maktab tanlamaguncha ro'yxat so'ralmaydi (X-School-Id majburiy).
const needsSchool = useNeedsSchool()

const list = usePagination<Teacher>(({ page, limit }) =>
  teachersApi.list({
    page,
    limit,
    search: debouncedSearch.value.trim(),
    isActive: status.value === 'all' ? undefined : status.value === 'active',
  }),
)

const actions = useTeacherActions(() => list.load())

const columns = computed<TableColumn[]>(() => [
  { key: 'teacher', label: t('teachers.teacher'), class: 'w-[30%]' },
  { key: 'workload', label: t('teachers.workload') },
  { key: 'lastLoginAt', label: t('common.lastLogin'), class: 'hidden w-36 lg:table-cell' },
  { key: 'isActive', label: t('common.status'), class: 'w-24' },
  { key: 'actions', label: t('common.actions'), align: 'right', class: 'w-24' },
])

const statusOptions = computed(() => [
  { value: 'all', label: t('common.all') },
  { value: 'active', label: t('common.active') },
  { value: 'inactive', label: t('common.inactive') },
])

const subline = (tc: Teacher) => [tc.username, tc.phone].filter(Boolean).join(' · ')

function loadIfReady() {
  if (!needsSchool.value) void list.reset()
}

onMounted(loadIfReady)
watch([debouncedSearch, status, () => schoolCtx.schoolId], loadIfReady)
</script>

<template>
  <PageHeader :title="t('teachers.title')" :description="t('teachers.description')">
    <template #actions>
      <BaseButton :disabled="needsSchool" @click="actions.openCreate()">
        <Plus class="h-4 w-4" /> {{ t('teachers.add') }}
      </BaseButton>
    </template>
  </PageHeader>

  <div class="card">
    <EmptyState
      v-if="needsSchool"
      :icon="SchoolIcon"
      :title="t('schoolSwitcher.selectFirst')"
      :description="t('schoolSwitcher.selectFirstText')"
    />
    <template v-else>
      <div class="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
        <BaseInput
          v-model="search"
          type="search"
          class="flex-1"
          :icon="Search"
          :aria-label="t('common.search')"
          :placeholder="t('teachers.searchPlaceholder')"
        />
        <BaseSelect
          v-model="status"
          class="sm:w-48"
          :aria-label="t('common.status')"
          :options="statusOptions"
        />
      </div>

      <div v-if="list.error.value" class="p-4">
        <EmptyState
          :title="t('errors.loadFailed')"
          :description="errorMessage(list.error.value, t)"
        >
          <BaseButton variant="secondary" @click="list.load()">{{ t('common.retry') }}</BaseButton>
        </EmptyState>
      </div>
      <template v-else>
        <template v-if="list.loading.value || list.items.value.length > 0">
          <div class="hidden md:block" data-testid="teachers-table">
            <BaseTable
              fixed
              :columns="columns"
              :rows="list.items.value"
              :loading="list.loading.value"
              :caption="t('teachers.list')"
            >
              <template #cell-teacher="{ row }">
                <div class="flex min-w-0 items-center gap-3">
                  <RouterLink
                    :to="{ name: 'teacher-detail', params: { id: row.id } }"
                    class="shrink-0 rounded-full"
                    tabindex="-1"
                    aria-hidden="true"
                  >
                    <AvatarImage :name="row.fullName" :src="row.photo" size="md" alt="" />
                  </RouterLink>
                  <div class="min-w-0">
                    <RouterLink
                      :to="{ name: 'teacher-detail', params: { id: row.id } }"
                      class="block truncate font-medium text-fg hover:text-primary-700 hover:underline"
                      :title="row.fullName"
                      :aria-label="t('teachers.openDetail', { name: row.fullName })"
                      data-testid="teacher-link"
                    >
                      {{ row.fullName }}
                    </RouterLink>
                    <p class="truncate text-xs text-fg-muted" :title="subline(row)">
                      {{ subline(row) }}
                    </p>
                  </div>
                </div>
              </template>
              <template #cell-workload="{ row }">
                <TeacherWorkload :teacher="row" :max="2" />
              </template>
              <template #cell-lastLoginAt="{ row }">
                <LastLogin :value="row.lastLoginAt" />
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
                    data-testid="teacher-edit"
                    @click="actions.openEdit(row)"
                  >
                    <Pencil class="h-4 w-4" />
                  </BaseButton>
                  <TeacherActionsMenu
                    :teacher="row"
                    @classes="actions.openClasses"
                    @permissions="actions.openPermissions"
                    @reset="actions.openReset"
                    @toggle="actions.toggleActive"
                  />
                </div>
              </template>
              <template #skeleton-teacher>
                <div class="flex items-center gap-3">
                  <Skeleton class="h-9 w-9 shrink-0 !rounded-full" />
                  <div class="flex-1 space-y-1.5">
                    <Skeleton class="h-4 w-3/4" />
                    <Skeleton class="h-3 w-1/2" />
                  </div>
                </div>
              </template>
              <template #skeleton-workload>
                <div class="flex gap-1.5">
                  <Skeleton class="h-5 w-24 !rounded-full" />
                  <Skeleton class="h-5 w-16 !rounded-full" />
                </div>
              </template>
              <template #skeleton-isActive>
                <Skeleton class="h-5 w-14 !rounded-full" />
              </template>
              <template #skeleton-actions>
                <Skeleton class="ml-auto h-8 w-16" />
              </template>
            </BaseTable>
          </div>

          <ul class="divide-y divide-border md:hidden" data-testid="teachers-cards">
            <template v-if="list.loading.value && list.items.value.length === 0">
              <li v-for="n in 4" :key="`sk-${n}`" class="flex items-center gap-3 p-4">
                <Skeleton class="h-10 w-10 shrink-0 !rounded-full" />
                <div class="flex-1 space-y-2">
                  <Skeleton class="h-4 w-2/3" />
                  <Skeleton class="h-3 w-1/2" />
                  <Skeleton class="h-5 w-3/4 !rounded-full" />
                </div>
              </li>
            </template>
            <template v-else>
              <li
                v-for="row in list.items.value"
                :key="row.id"
                class="space-y-2.5 p-4"
                :class="list.loading.value ? 'opacity-60' : ''"
                data-testid="teacher-card"
              >
                <div class="flex items-center gap-2">
                  <AvatarImage :name="row.fullName" :src="row.photo" size="lg" alt="" />
                  <div class="min-w-0 flex-1">
                    <RouterLink
                      :to="{ name: 'teacher-detail', params: { id: row.id } }"
                      class="block truncate font-medium text-fg hover:text-primary-700"
                      :title="row.fullName"
                    >
                      {{ row.fullName }}
                    </RouterLink>
                    <p class="truncate text-xs text-fg-muted">{{ subline(row) }}</p>
                  </div>
                  <BaseButton
                    size="sm"
                    variant="ghost"
                    :aria-label="`${t('common.edit')}: ${row.fullName}`"
                    :title="t('common.edit')"
                    @click="actions.openEdit(row)"
                  >
                    <Pencil class="h-4 w-4" />
                  </BaseButton>
                  <TeacherActionsMenu
                    :teacher="row"
                    @classes="actions.openClasses"
                    @permissions="actions.openPermissions"
                    @reset="actions.openReset"
                    @toggle="actions.toggleActive"
                  />
                </div>
                <TeacherWorkload :teacher="row" :max="2" />
                <div class="flex items-center justify-between gap-2">
                  <BaseBadge :tone="row.isActive ? 'success' : 'neutral'">
                    {{ row.isActive ? t('common.active') : t('common.inactive') }}
                  </BaseBadge>
                  <LastLogin :value="row.lastLoginAt" />
                </div>
              </li>
            </template>
          </ul>
        </template>
        <EmptyState
          v-else
          :icon="GraduationCap"
          :title="t('teachers.emptyTitle')"
          :description="t('teachers.emptyText')"
        >
          <BaseButton @click="actions.openCreate()">{{ t('teachers.add') }}</BaseButton>
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
    </template>
  </div>

  <TeacherActionModals :actions="actions" />
</template>

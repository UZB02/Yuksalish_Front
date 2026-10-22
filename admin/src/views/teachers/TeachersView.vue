<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  GraduationCap,
  KeyRound,
  Layers,
  Pencil,
  Plus,
  Power,
  School as SchoolIcon,
  Search,
  SlidersHorizontal,
} from 'lucide-vue-next'
import { teachersApi } from '@/api/teachers.api'
import type { Teacher } from '@/api/types'
import PermissionsModal from '@/components/domain/PermissionsModal.vue'
import ResetPasswordModal from '@/components/domain/ResetPasswordModal.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
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
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'
import { useClassLookup } from '@/composables/useLookups'
import TeacherClassesModal from './TeacherClassesModal.vue'
import TeacherFormModal from './TeacherFormModal.vue'

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const schoolCtx = useSchoolContextStore()

const search = ref('')
const status = ref<'all' | 'active' | 'inactive'>('all')
const debouncedSearch = useDebounce(search)

// Superadmin maktab tanlamaguncha ro'yxat so'ralmaydi (X-School-Id majburiy).
const needsSchool = computed(() => auth.isSuperadmin && !schoolCtx.schoolId)

// Maktab admini o'zida mavjud ruxsatlarnigina bera oladi; superadmin - cheklovsiz.
const allowedPermissions = computed(() =>
  auth.user?.role === 'school_admin' ? auth.user.permissions : null,
)

const list = usePagination<Teacher>(({ page, limit }) =>
  teachersApi.list({
    page,
    limit,
    search: debouncedSearch.value.trim(),
    isActive: status.value === 'all' ? undefined : status.value === 'active',
  }),
)

const classLookup = useClassLookup()
const classesTarget = ref<Teacher | null>(null)

async function openClasses(tc: Teacher) {
  classesTarget.value = tc
  if (classLookup.items.value.length === 0) await classLookup.load()
}

const formOpen = ref(false)
const editing = ref<Teacher | null>(null)
const permTarget = ref<Teacher | null>(null)
const resetTarget = ref<Teacher | null>(null)

const columns = computed<TableColumn[]>(() => [
  { key: 'fullName', label: t('common.fullName') },
  { key: 'phone', label: t('common.phone'), class: 'hidden md:table-cell' },
  { key: 'classes', label: t('teachers.classes'), class: 'hidden lg:table-cell' },
  { key: 'subjects', label: t('teachers.subjects'), class: 'hidden xl:table-cell' },
  { key: 'lastLoginAt', label: t('common.lastLogin'), class: 'hidden lg:table-cell' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const statusOptions = computed(() => [
  { value: 'all', label: t('common.all') },
  { value: 'active', label: t('common.active') },
  { value: 'inactive', label: t('common.inactive') },
])

function loadIfReady() {
  if (!needsSchool.value) void list.reset()
}

onMounted(loadIfReady)
watch([debouncedSearch, status, () => schoolCtx.schoolId], loadIfReady)

const submitPermissions = (perms: string[]) =>
  teachersApi.setPermissions(permTarget.value!.id, perms)
const submitReset = (pw: string) => teachersApi.resetPassword(resetTarget.value!.id, pw)

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(tc: Teacher) {
  editing.value = tc
  formOpen.value = true
}

async function toggleActive(tc: Teacher) {
  const next = !tc.isActive
  const ok = await confirm({
    title: t(next ? 'teachers.activateTitle' : 'teachers.deactivateTitle'),
    message: t(next ? 'teachers.activateText' : 'teachers.deactivateText', { name: tc.fullName }),
    confirmText: t(next ? 'common.activate' : 'common.deactivate'),
    variant: next ? 'primary' : 'danger',
  })
  if (!ok) return
  try {
    await teachersApi.update(tc.id, { isActive: next })
    toast.success(t(next ? 'teachers.activated' : 'teachers.deactivated'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <PageHeader :title="t('teachers.title')" :description="t('teachers.description')">
    <template #actions>
      <BaseButton :disabled="needsSchool" @click="openCreate">
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
        <BaseTable
          v-if="list.loading.value || list.items.value.length > 0"
          :columns="columns"
          :rows="list.items.value"
          :loading="list.loading.value"
          :caption="t('teachers.title')"
        >
          <template #cell-fullName="{ row }">
            <div class="flex items-center gap-3">
              <AvatarImage :name="row.fullName" :src="row.photo" size="md" alt="" />
              <div class="min-w-0">
                <p class="font-medium text-fg">{{ row.fullName }}</p>
                <p class="text-xs text-fg-muted">{{ row.username }}</p>
              </div>
            </div>
          </template>
          <template #cell-phone="{ row }">{{ row.phone || '-' }}</template>
          <template #cell-classes="{ row }">
            <span v-if="!row.classes || row.classes.length === 0" class="text-fg-muted">-</span>
            <div v-else class="flex flex-wrap gap-1">
              <BaseBadge v-for="c in row.classes" :key="c.id" tone="primary">{{
                c.name
              }}</BaseBadge>
            </div>
          </template>
          <template #cell-subjects="{ row }">
            <div
              v-if="row.homeroomClasses?.length || row.subjectAssignments?.length"
              class="flex max-w-sm flex-wrap gap-1"
            >
              <BaseBadge v-for="c in row.homeroomClasses ?? []" :key="`h-${c.id}`" tone="success">
                {{ t('teachers.homeroomOf', { name: c.name }) }}
              </BaseBadge>
              <BaseBadge
                v-for="a in row.subjectAssignments ?? []"
                :key="`${a.classId}-${a.subjectId}`"
                tone="info"
              >
                {{ a.className }}: {{ a.subjectName }}
              </BaseBadge>
            </div>
            <span v-else class="text-fg-muted">-</span>
          </template>
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
                :aria-label="`${t('teachers.assignClasses')}: ${row.fullName}`"
                :title="t('teachers.assignClasses')"
                @click="openClasses(row)"
              >
                <Layers class="h-4 w-4" />
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
          :icon="GraduationCap"
          :title="t('teachers.emptyTitle')"
          :description="t('teachers.emptyText')"
        >
          <BaseButton @click="openCreate">{{ t('teachers.add') }}</BaseButton>
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

  <TeacherFormModal
    :open="formOpen"
    :teacher="editing"
    :allowed-permissions="allowedPermissions"
    @close="formOpen = false"
    @saved="list.load()"
  />
  <TeacherClassesModal
    :open="!!classesTarget"
    :teacher="classesTarget"
    :classes="classLookup.items.value"
    :loading="classLookup.loading.value"
    @close="classesTarget = null"
    @saved="list.load()"
  />
  <PermissionsModal
    :open="!!permTarget"
    :target-name="permTarget?.fullName ?? ''"
    role="teacher"
    :initial="permTarget?.permissions ?? []"
    :allowed="allowedPermissions"
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

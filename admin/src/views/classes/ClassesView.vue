<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Archive,
  ArchiveRestore,
  CalendarRange,
  Eye,
  Layers,
  Pencil,
  Plus,
  Search,
  UserPlus,
} from 'lucide-vue-next'
import { classesApi } from '@/api/classes.api'
import type { SchoolClass } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useConfirm } from '@/composables/useConfirm'
import { useDebounce } from '@/composables/useDebounce'
import { useAcademicYearLookup, useTeacherLookup } from '@/composables/useLookups'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import ClassTeachersModal from './ClassTeachersModal.vue'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const schoolCtx = useSchoolContextStore()
const needsSchool = useNeedsSchool()
// Faol o'quv yili yo'q bo'lsa sinf yaratib bo'lmaydi (so'rov bajarilib, yillar ro'yxati yuklangach aniqlanadi).
const noActiveYear = computed(
  () => years.loaded.value && !years.failed.value && !years.activeYear.value,
)
const canManage = computed(() => auth.hasPermission(PERMISSIONS.CLASSES_MANAGE))

const years = useAcademicYearLookup()
const teachers = useTeacherLookup()

const search = ref('')
const yearFilter = ref('')
const gradeFilter = ref('')
const archiveFilter = ref<'active' | 'archived'>('active')
const debouncedSearch = useDebounce(search)

const list = usePagination<SchoolClass>(({ page, limit }) =>
  classesApi.list({
    page,
    limit,
    search: debouncedSearch.value.trim(),
    academicYearId: yearFilter.value || undefined,
    grade: gradeFilter.value ? Number(gradeFilter.value) : undefined,
    isArchived: archiveFilter.value === 'archived',
  }),
)

const assigning = ref<SchoolClass | null>(null)

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('classes.name') },
  { key: 'homeroom', label: t('classes.homeroom'), class: 'hidden md:table-cell' },
  { key: 'teachers', label: t('classes.teachers'), class: 'hidden lg:table-cell' },
  { key: 'studentsCount', label: t('classes.students') },
  { key: 'isArchived', label: t('common.status'), class: 'hidden sm:table-cell' },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const yearOptions = computed(() => years.items.value.map((y) => ({ value: y.id, label: y.name })))
const gradeOptions = Array.from({ length: 11 }, (_, i) => ({
  value: String(i + 1),
  label: t('classes.gradeLabel', { n: i + 1 }),
}))
const archiveOptions = computed(() => [
  { value: 'active', label: t('classes.activeClasses') },
  { value: 'archived', label: t('classes.archived') },
])

async function init() {
  if (needsSchool.value) return
  void years.load()
  if (canManage.value) void teachers.load()
  await list.reset()
}
onMounted(init)
watch(() => schoolCtx.schoolId, init)
watch([debouncedSearch, yearFilter, gradeFilter, archiveFilter], () => {
  if (!needsSchool.value) void list.reset()
})

function openCreate() {
  void router.push({ name: 'class-create' })
}
function openEdit(c: SchoolClass) {
  void router.push({ name: 'class-edit', params: { id: c.id } })
}

async function toggleArchive(c: SchoolClass) {
  const archive = !c.isArchived
  const ok = await confirm({
    title: t(archive ? 'classes.archiveTitle' : 'classes.unarchiveTitle'),
    message: t(archive ? 'classes.archiveText' : 'classes.unarchiveText', { name: c.name }),
    confirmText: t(archive ? 'classes.archive' : 'classes.unarchive'),
    variant: archive ? 'danger' : 'primary',
  })
  if (!ok) return
  try {
    await (archive ? classesApi.archive(c.id) : classesApi.unarchive(c.id))
    toast.success(t(archive ? 'classes.archivedOk' : 'classes.unarchivedOk'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <PageHeader :title="t('classes.title')" :description="t('classes.description')">
    <template v-if="canManage" #actions>
      <BaseButton :disabled="needsSchool || noActiveYear" @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('classes.add') }}
      </BaseButton>
    </template>
  </PageHeader>

  <NeedsSchool v-if="needsSchool" />
  <div v-else-if="noActiveYear" class="card">
    <EmptyState
      :icon="CalendarRange"
      :title="t('classes.noActiveYearTitle')"
      :description="t('classes.noActiveYearText')"
    >
      <RouterLink v-if="canManage" :to="{ name: 'academic-years' }">
        <BaseButton>{{ t('classes.toYears') }}</BaseButton>
      </RouterLink>
    </EmptyState>
  </div>
  <div v-else class="card">
    <div class="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
      <BaseInput
        v-model="search"
        type="search"
        class="sm:col-span-2 lg:col-span-1"
        :icon="Search"
        :aria-label="t('common.search')"
        :placeholder="t('classes.searchPlaceholder')"
      />
      <BaseSelect
        v-model="yearFilter"
        :aria-label="t('classes.academicYear')"
        :placeholder="t('classes.activeYear')"
        :options="yearOptions"
      />
      <BaseSelect
        v-model="gradeFilter"
        :aria-label="t('classes.grade')"
        :placeholder="t('classes.allGrades')"
        :options="gradeOptions"
      />
      <BaseSelect
        v-model="archiveFilter"
        :aria-label="t('common.status')"
        :options="archiveOptions"
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
        :caption="t('classes.title')"
      >
        <template #cell-name="{ row }">
          <RouterLink
            :to="{ name: 'class-detail', params: { id: row.id } }"
            class="font-medium text-primary-700 hover:underline"
          >
            {{ row.name }}
          </RouterLink>
        </template>
        <template #cell-homeroom="{ row }">{{ row.homeroomTeacher?.fullName ?? '-' }}</template>
        <template #cell-teachers="{ row }">
          <span v-if="row.teachers.length === 0">-</span>
          <div v-else class="flex flex-wrap gap-1">
            <BaseBadge v-for="tc in row.teachers.slice(0, 3)" :key="tc.id">
              {{ tc.fullName }}
            </BaseBadge>
            <BaseBadge v-if="row.teachers.length > 3">+{{ row.teachers.length - 3 }}</BaseBadge>
          </div>
        </template>
        <template #cell-isArchived="{ row }">
          <BaseBadge :tone="row.isArchived ? 'warning' : 'success'">
            {{ row.isArchived ? t('classes.archived') : t('common.active') }}
          </BaseBadge>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
            <RouterLink
              :to="{ name: 'class-detail', params: { id: row.id } }"
              class="inline-flex h-8 items-center rounded-lg px-3 text-fg-muted hover:bg-surface-muted"
              :aria-label="`${t('common.view')}: ${row.name}`"
              :title="t('common.view')"
            >
              <Eye class="h-4 w-4" />
            </RouterLink>
            <template v-if="canManage">
              <BaseButton
                size="sm"
                variant="ghost"
                :aria-label="`${t('classes.assignTeachers')}: ${row.name}`"
                :title="t('classes.assignTeachers')"
                @click="assigning = row"
              >
                <UserPlus class="h-4 w-4" />
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
                :aria-label="`${row.isArchived ? t('classes.unarchive') : t('classes.archive')}: ${row.name}`"
                :title="row.isArchived ? t('classes.unarchive') : t('classes.archive')"
                @click="toggleArchive(row)"
              >
                <ArchiveRestore v-if="row.isArchived" class="h-4 w-4 text-success" />
                <Archive v-else class="h-4 w-4 text-warning" />
              </BaseButton>
            </template>
          </div>
        </template>
      </BaseTable>
      <EmptyState
        v-else
        :icon="Layers"
        :title="t('classes.emptyTitle')"
        :description="t('classes.emptyText')"
      >
        <BaseButton v-if="canManage" @click="openCreate">{{ t('classes.add') }}</BaseButton>
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

  <ClassTeachersModal
    v-if="canManage"
    :open="!!assigning"
    :school-class="assigning"
    :teachers="teachers.items.value"
    :loading="teachers.loading.value"
    @close="assigning = null"
    @saved="list.load()"
  />
</template>

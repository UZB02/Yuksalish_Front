<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, FileUp, Plus, Search, Users } from 'lucide-vue-next'
import { studentsApi } from '@/api/students.api'
import type { Student, StudentStatus } from '@/api/types'
import StudentsTable from '@/components/domain/StudentsTable.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useDebounce } from '@/composables/useDebounce'
import { useClassLookup } from '@/composables/useLookups'
import { usePagination } from '@/composables/usePagination'
import { useStudentActions } from '@/composables/useStudentActions'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import ImportWizardModal from './import/ImportWizardModal.vue'
import StudentFormModal from './StudentFormModal.vue'
import StudentTransferModal from './StudentTransferModal.vue'

const props = defineProps<{
  /** Berilsa - faqat shu sinf o'quvchilari (sinf sahifasi); aks holda sinf filtri ko'rsatiladi */
  classId?: string
  className?: string
}>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission(PERMISSIONS.STUDENTS_MANAGE))
const classes = useClassLookup()

const search = ref('')
const classFilter = ref('')
const statusFilter = ref<'' | StudentStatus>('')
const debouncedSearch = useDebounce(search)

const effectiveClassId = computed(() => props.classId || classFilter.value || undefined)

const list = usePagination<Student>(({ page, limit }) =>
  studentsApi.list({
    page,
    limit,
    search: debouncedSearch.value.trim(),
    classId: effectiveClassId.value,
    status: statusFilter.value || undefined,
  }),
)

const formOpen = ref(false)
const editing = ref<Student | null>(null)
const transferring = ref<Student | null>(null)
const importOpen = ref(false)

const actions = useStudentActions(async () => {
  await list.load()
  emit('changed')
})

const classOptions = computed(() =>
  classes.items.value.map((c) => ({ value: c.id, label: c.name })),
)
const statusOptions = computed(() =>
  (['active', 'transferred', 'graduated'] as StudentStatus[]).map((s) => ({
    value: s,
    label: t(`students.statuses.${s}`),
  })),
)

onMounted(() => {
  void classes.load()
  void list.reset()
})
watch([debouncedSearch, classFilter, statusFilter, () => props.classId], () => list.reset())

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(s: Student) {
  editing.value = s
  formOpen.value = true
}
async function refresh() {
  await list.load()
  emit('changed')
}
</script>

<template>
  <div class="card">
    <div class="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
      <div
        class="grid flex-1 gap-3"
        :class="classId ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'"
      >
        <BaseInput
          v-model="search"
          type="search"
          :icon="Search"
          :aria-label="t('common.search')"
          :placeholder="t('students.searchPlaceholder')"
        />
        <BaseSelect
          v-if="!classId"
          v-model="classFilter"
          searchable
          :aria-label="t('students.class')"
          :placeholder="t('students.allClasses')"
          :options="classOptions"
        />
        <BaseSelect
          v-model="statusFilter"
          :aria-label="t('common.status')"
          :placeholder="t('students.allStatuses')"
          :options="statusOptions"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton variant="secondary" @click="actions.exportXlsx(effectiveClassId)">
          <Download class="h-4 w-4" /> {{ t('students.export') }}
        </BaseButton>
        <template v-if="canManage">
          <BaseButton variant="secondary" @click="importOpen = true">
            <FileUp class="h-4 w-4" /> {{ t('students.importExcel') }}
          </BaseButton>
          <BaseButton @click="openCreate">
            <Plus class="h-4 w-4" /> {{ t('students.add') }}
          </BaseButton>
        </template>
      </div>
    </div>

    <div v-if="list.error.value" class="p-4">
      <EmptyState :title="t('errors.loadFailed')" :description="errorMessage(list.error.value, t)">
        <BaseButton variant="secondary" @click="list.load()">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <template v-else>
      <StudentsTable
        v-if="list.loading.value || list.items.value.length > 0"
        :rows="list.items.value"
        :loading="list.loading.value"
        :show-class="!classId"
        :can-manage="canManage"
        @edit="openEdit"
        @transfer="transferring = $event"
        @remove="actions.remove"
      />
      <EmptyState
        v-else
        :icon="Users"
        :title="t('students.emptyTitle')"
        :description="t('students.emptyText')"
      >
        <BaseButton v-if="canManage" @click="openCreate">{{ t('students.add') }}</BaseButton>
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

  <template v-if="canManage">
    <StudentFormModal
      :open="formOpen"
      :student="editing"
      :classes="classes.items.value"
      :default-class-id="classId"
      @close="formOpen = false"
      @saved="refresh"
    />
    <StudentTransferModal
      :open="!!transferring"
      :student="transferring"
      :classes="classes.items.value"
      @close="transferring = null"
      @saved="refresh"
    />
    <ImportWizardModal
      :open="importOpen"
      :class-id="classId"
      :class-name="className"
      @close="importOpen = false"
      @imported="refresh"
    />
  </template>
</template>

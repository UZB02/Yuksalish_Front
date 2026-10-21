<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Lock, Pencil, Plus, Power, Shapes, Trash2 } from 'lucide-vue-next'
import { subjectsApi } from '@/api/subjects.api'
import type { Subject } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import SubjectFormModal from './SubjectFormModal.vue'

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const schoolCtx = useSchoolContextStore()
const { schools, schoolId } = storeToRefs(schoolCtx)

const isSuper = computed(() => auth.isSuperadmin)

const scope = ref<'all' | 'global' | 'school'>('all')
const list = usePagination<Subject>(({ page, limit }) =>
  subjectsApi.list({ scope: scope.value }).then((r) => ({
    // Ro'yxat kichik: tartib bo'yicha saralab, sahifalashsiz ko'rsatamiz.
    items: [...r.items].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'uz')),
    meta: { ...r.meta, page, limit },
  })),
)

const formOpen = ref(false)
const editing = ref<Subject | null>(null)

const scopeOptions = computed(() => [
  { value: 'all', label: t('subjects.scopes.all') },
  { value: 'global', label: t('subjects.scopes.global') },
  { value: 'school', label: t('subjects.scopes.school') },
])
const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('subjects.name') },
  { key: 'scope', label: t('subjects.scope'), class: 'hidden sm:table-cell' },
  { key: 'order', label: t('subjects.order'), class: 'hidden md:table-cell' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const schoolName = (id: string | null) => {
  if (id === null) return t('subjects.global')
  if (!isSuper.value) return t('subjects.ownSchool')
  return schools.value.find((s) => s.id === id)?.name ?? '-'
}

/** Superadmin hammasini; maktab admini faqat o'z maktabi fanlarini o'zgartiradi (global - faqat o'qish). */
const canEdit = (s: Subject) => isSuper.value || s.schoolId !== null

onMounted(async () => {
  void list.reset()
  if (isSuper.value && !schoolCtx.loaded) await schoolCtx.loadSchools().catch(() => undefined)
})
watch([scope, schoolId], () => list.reset())

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(s: Subject) {
  editing.value = s
  formOpen.value = true
}

async function toggle(s: Subject) {
  const next = !s.isActive
  const ok = await confirm({
    title: t(next ? 'subjects.activateTitle' : 'subjects.deactivateTitle'),
    message: t(next ? 'subjects.activateText' : 'subjects.deactivateText', { name: s.name }),
    confirmText: t(next ? 'common.activate' : 'common.deactivate'),
    variant: next ? 'primary' : 'danger',
  })
  if (!ok) return
  try {
    await (next ? subjectsApi.activate(s.id) : subjectsApi.deactivate(s.id))
    toast.success(t(next ? 'subjects.activated' : 'subjects.deactivated'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

async function remove(s: Subject) {
  const ok = await confirm({
    title: t('subjects.deleteTitle'),
    message: t('subjects.deleteText', { name: s.name }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await subjectsApi.remove(s.id)
    toast.success(t('subjects.deleted'))
    await list.load()
  } catch (e) {
    // Ishlatilgan fan (409): xabar nofaol qilishni taklif qiladi.
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <PageHeader :title="t('subjects.title')" :description="t('subjects.description')">
    <template #actions>
      <BaseButton @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('subjects.add') }}
      </BaseButton>
    </template>
  </PageHeader>

  <div class="card">
    <div class="border-b border-border p-4 sm:max-w-xs">
      <BaseSelect v-model="scope" :aria-label="t('subjects.scope')" :options="scopeOptions" />
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
        :caption="t('subjects.title')"
      >
        <template #cell-name="{ row }">
          <span class="font-medium text-fg">{{ row.name }}</span>
        </template>
        <template #cell-scope="{ row }">
          <BaseBadge :tone="row.schoolId === null ? 'info' : 'primary'">
            {{ schoolName(row.schoolId) }}
          </BaseBadge>
        </template>
        <template #cell-order="{ row }">{{ row.order }}</template>
        <template #cell-isActive="{ row }">
          <BaseBadge :tone="row.isActive ? 'success' : 'neutral'">
            {{ row.isActive ? t('common.active') : t('common.inactive') }}
          </BaseBadge>
        </template>
        <template #cell-actions="{ row }">
          <div v-if="canEdit(row)" class="flex justify-end gap-1">
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
          <span
            v-else
            class="inline-flex items-center gap-1 text-xs text-fg-muted"
            :title="t('subjects.globalReadOnly')"
          >
            <Lock class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('subjects.readOnly') }}
          </span>
        </template>
      </BaseTable>
      <EmptyState
        v-else
        :icon="Shapes"
        :title="t('subjects.emptyTitle')"
        :description="t('subjects.emptyText')"
      >
        <BaseButton @click="openCreate">{{ t('subjects.add') }}</BaseButton>
      </EmptyState>
    </template>
  </div>

  <SubjectFormModal
    :open="formOpen"
    :item="editing"
    :schools="schools"
    :can-pick-scope="isSuper"
    :default-school-id="schoolId ?? ''"
    @close="formOpen = false"
    @saved="list.load()"
  />
</template>

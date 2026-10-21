<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Palette, Pencil, Plus, Power } from 'lucide-vue-next'
import { behaviorTypesApi } from '@/api/behaviorTypes.api'
import type { BehaviorType } from '@/api/types'
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
import { kindTone } from '@/utils/scoring'
import BehaviorTypeFormModal from './BehaviorTypeFormModal.vue'

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const schoolCtx = useSchoolContextStore()
const { schools, schoolId } = storeToRefs(schoolCtx)

const scope = ref<'all' | 'global' | 'school'>('all')
const list = usePagination<BehaviorType>(({ page, limit }) =>
  behaviorTypesApi.list({ scope: scope.value }).then((r) => ({
    // Ro'yxat kichik (limit 100): tartib bo'yicha saralab, sahifalashsiz ko'rsatamiz.
    items: [...r.items].sort((a, b) => a.order - b.order),
    meta: { ...r.meta, page, limit },
  })),
)

const formOpen = ref(false)
const editing = ref<BehaviorType | null>(null)

const scopeOptions = computed(() => [
  { value: 'all', label: t('behaviorTypes.scopes.all') },
  { value: 'global', label: t('behaviorTypes.scopes.global') },
  { value: 'school', label: t('behaviorTypes.scopes.school') },
])
const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('behaviorTypes.name') },
  { key: 'kind', label: t('behaviorTypes.kind'), class: 'hidden sm:table-cell' },
  { key: 'range', label: t('behaviorTypes.range'), class: 'hidden md:table-cell' },
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
function openEdit(b: BehaviorType) {
  editing.value = b
  formOpen.value = true
}

async function toggle(b: BehaviorType) {
  const next = !b.isActive
  const ok = await confirm({
    title: t(next ? 'behaviorTypes.activateTitle' : 'behaviorTypes.deactivateTitle'),
    message: t(next ? 'behaviorTypes.activateText' : 'behaviorTypes.deactivateText', {
      name: b.name,
    }),
    confirmText: t(next ? 'common.activate' : 'common.deactivate'),
    variant: next ? 'primary' : 'danger',
  })
  if (!ok) return
  try {
    await (next ? behaviorTypesApi.activate(b.id) : behaviorTypesApi.deactivate(b.id))
    toast.success(t(next ? 'behaviorTypes.activated' : 'behaviorTypes.deactivated'))
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <PageHeader :title="t('behaviorTypes.title')" :description="t('behaviorTypes.description')">
    <template #actions>
      <BaseButton @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('behaviorTypes.add') }}
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
        :caption="t('behaviorTypes.title')"
      >
        <template #cell-name="{ row }">
          <span class="inline-flex items-center gap-2 font-medium text-fg">
            <span
              class="h-4 w-4 shrink-0 rounded-full border border-border"
              :style="{ backgroundColor: row.color }"
              aria-hidden="true"
            />
            {{ row.name }}
          </span>
        </template>
        <template #cell-kind="{ row }">
          <BaseBadge :tone="kindTone[row.kind]">{{ t(`scoring.kinds.${row.kind}`) }}</BaseBadge>
        </template>
        <template #cell-range="{ row }">
          <span v-if="row.minScore !== null || row.maxScore !== null">
            {{ row.minScore ?? '...' }} - {{ row.maxScore ?? '...' }}
          </span>
          <span v-else class="text-fg-muted">-</span>
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
        :icon="Palette"
        :title="t('behaviorTypes.emptyTitle')"
        :description="t('behaviorTypes.emptyText')"
      >
        <BaseButton @click="openCreate">{{ t('behaviorTypes.add') }}</BaseButton>
      </EmptyState>
    </template>
  </div>

  <BehaviorTypeFormModal
    :open="formOpen"
    :item="editing"
    :schools="schools"
    :default-school-id="schoolId ?? ''"
    @close="formOpen = false"
    @saved="list.load()"
  />
</template>

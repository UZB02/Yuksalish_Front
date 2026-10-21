<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ScrollText, Search } from 'lucide-vue-next'
import { auditApi } from '@/api/audit.api'
import { schoolsApi } from '@/api/schools.api'
import type { AuditFilters, AuditLogItem, School } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useAuditLog } from '@/composables/useAuditLog'
import { useDebounce } from '@/composables/useDebounce'
import { useAuthStore } from '@/stores/auth'
import {
  actionGroup,
  actionLabel,
  actionTone,
  entityLabel,
  groupActions,
  groupLabel,
  relativeTime,
} from '@/utils/audit'
import { errorMessage } from '@/utils/errors'
import { formatDateTimeTashkent } from '@/utils/format'
import { shiftDate, todayTashkent } from '@/utils/scoring'
import AuditDetailModal from './AuditDetailModal.vue'

const { t, te } = useI18n()
const auth = useAuthStore()
const log = useAuditLog()
const { state } = log

const filters = ref<AuditFilters>({ actions: [], entities: [], users: [] })
const schools = ref<School[]>([])
const selected = ref<AuditLogItem | null>(null)

// ---- Filtr tanlagichlari ----
const userOptions = computed(() =>
  filters.value.users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` })),
)
const groups = computed(() => groupActions(filters.value.actions))
const groupOptions = computed(() =>
  groups.value.map((g) => ({ value: g.group, label: groupLabel(g.group, t, te) })),
)
/** Tanlangan harakat guruhi: aniq action yoki `guruh.` prefiksidan */
const group = computed(() => (state.action ? actionGroup(state.action) : ''))
const actionOptions = computed(() =>
  (groups.value.find((g) => g.group === group.value)?.actions ?? filters.value.actions).map(
    (a) => ({ value: a, label: actionLabel(a, t, te) }),
  ),
)
const exactAction = computed(() => (state.action.endsWith('.') ? '' : state.action))
const entityOptions = computed(() =>
  filters.value.entities.map((e) => ({ value: e, label: entityLabel(e, t, te) })),
)
const schoolOptions = computed(() => schools.value.map((s) => ({ value: s.id, label: s.name })))

function setGroup(g: string) {
  state.action = g ? `${g}.` : ''
}

// ---- Davr tezkor tanlovlari ----
const today = todayTashkent()
const quick = [
  { key: 'today', days: 0 },
  { key: 'week', days: 6 },
  { key: 'month', days: 29 },
] as const
const quickActive = (days: number) => state.from === shiftDate(today, -days) && state.to === today
function setQuick(days: number) {
  state.from = shiftDate(today, -days)
  state.to = today
}

// ---- Qidiruv (kechiktirilgan) ----
const searchText = ref(state.search)
const debouncedSearch = useDebounce(searchText)
watch(debouncedSearch, (v) => (state.search = v.trim()))
watch(
  () => state.search,
  (v) => {
    if (v !== searchText.value.trim()) searchText.value = v
  },
)

const hasFilters = computed(
  () =>
    !!(
      state.from ||
      state.to ||
      state.userId ||
      state.action ||
      state.entity ||
      state.schoolId ||
      state.search
    ),
)

// ---- Jadval ----
interface Row extends AuditLogItem {
  id: string
}
const rows = computed<Row[]>(() => log.items.value.map((i) => ({ ...i })))
const columns = computed<TableColumn[]>(() => [
  { key: 'createdAt', label: t('audit.cols.time') },
  { key: 'user', label: t('audit.cols.user') },
  { key: 'action', label: t('audit.cols.action') },
  { key: 'entity', label: t('audit.cols.entity'), class: 'hidden md:table-cell' },
  { key: 'ip', label: 'IP', class: 'hidden lg:table-cell' },
])

function relative(iso: string): string {
  const r = relativeTime(iso)
  return r ? t(`audit.rel.${r.unit}`, { n: r.n }) : ''
}

onMounted(async () => {
  try {
    filters.value = await auditApi.filters()
  } catch {
    // Filtr ro'yxatlari ixtiyoriy: ro'yxat ishlayveradi
  }
  if (auth.isSuperadmin) {
    try {
      schools.value = (await schoolsApi.list({ limit: 100 })).items
    } catch {
      schools.value = []
    }
  }
})
</script>

<template>
  <PageHeader :title="t('audit.title')" :description="t('audit.description')" />

  <section class="card mb-4 space-y-3 p-4" :aria-label="t('audit.filters')">
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="q in quick"
        :key="q.key"
        type="button"
        class="rounded-full border px-3 py-1.5 text-sm transition-colors"
        :class="
          quickActive(q.days)
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-border bg-surface text-fg hover:bg-surface-muted'
        "
        @click="setQuick(q.days)"
      >
        {{ t(`audit.quick.${q.key}`) }}
      </button>
      <BaseButton v-if="hasFilters" size="sm" variant="ghost" @click="log.reset">
        {{ t('audit.reset') }}
      </BaseButton>
    </div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <BaseInput
        v-model="state.from"
        type="date"
        :label="t('scores.from')"
        :max="state.to || today"
      />
      <BaseInput
        v-model="state.to"
        type="date"
        :label="t('scores.to')"
        :min="state.from || undefined"
      />
      <BaseSelect
        v-model="state.userId"
        :label="t('audit.cols.user')"
        :placeholder="t('audit.allUsers')"
        :options="userOptions"
      />
      <BaseSelect
        v-if="auth.isSuperadmin"
        v-model="state.schoolId"
        :label="t('audit.cols.school')"
        :placeholder="t('audit.allSchools')"
        :options="schoolOptions"
      />
      <BaseSelect
        :model-value="group"
        :label="t('audit.actionGroup')"
        :placeholder="t('audit.allGroups')"
        :options="groupOptions"
        data-testid="filter-group"
        @update:model-value="setGroup"
      />
      <BaseSelect
        :model-value="exactAction"
        :label="t('audit.cols.action')"
        :placeholder="group ? t('audit.allInGroup') : t('audit.allActions')"
        :options="actionOptions"
        data-testid="filter-action"
        @update:model-value="state.action = $event || (group ? `${group}.` : '')"
      />
      <BaseSelect
        v-model="state.entity"
        :label="t('audit.cols.entity')"
        :placeholder="t('audit.allEntities')"
        :options="entityOptions"
      />
      <BaseInput
        v-model="searchText"
        type="search"
        :icon="Search"
        :label="t('common.search')"
        :placeholder="t('audit.searchPlaceholder')"
      />
    </div>
  </section>

  <div class="card">
    <div v-if="log.error.value" class="p-4">
      <EmptyState :title="t('errors.loadFailed')" :description="errorMessage(log.error.value, t)">
        <BaseButton variant="secondary" @click="log.load()">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <EmptyState
      v-else-if="!log.loading.value && rows.length === 0"
      :icon="ScrollText"
      :title="t('audit.emptyTitle')"
      :description="t('audit.emptyText')"
    />
    <BaseTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="log.loading.value"
      :caption="t('audit.title')"
    >
      <template #cell-createdAt="{ row }">
        <button
          type="button"
          class="text-left hover:text-primary-700"
          :title="formatDateTimeTashkent(row.createdAt)"
          data-testid="audit-open"
          @click="selected = row"
        >
          <span class="block font-medium text-fg">{{
            relative(row.createdAt) || formatDateTimeTashkent(row.createdAt)
          }}</span>
          <span class="block text-xs text-fg-muted">{{
            formatDateTimeTashkent(row.createdAt)
          }}</span>
        </button>
      </template>
      <template #cell-user="{ row }">
        <template v-if="row.user">
          <div class="font-medium text-fg">{{ row.user.fullName }}</div>
          <BaseBadge tone="neutral">{{ t(`roles.${row.user.role}`) }}</BaseBadge>
        </template>
        <span v-else class="text-fg-muted">{{ t('audit.system') }}</span>
      </template>
      <template #cell-action="{ row }">
        <BaseBadge :tone="actionTone(row.action)">{{ actionLabel(row.action, t, te) }}</BaseBadge>
      </template>
      <template #cell-entity="{ row }">
        {{ entityLabel(row.entity, t, te) }}
        <span v-if="row.school" class="block text-xs text-fg-muted">{{ row.school.name }}</span>
      </template>
      <template #cell-ip="{ row }">{{ row.ip ?? '-' }}</template>
    </BaseTable>

    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
      <label class="flex items-center gap-2 text-sm text-fg-muted">
        {{ t('audit.perPage') }}
        <select
          :value="state.limit"
          class="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-fg"
          data-testid="audit-limit"
          @change="state.limit = Number(($event.target as HTMLSelectElement).value)"
        >
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </label>
    </div>
    <BasePagination
      v-if="log.total.value > 0"
      :page="state.page"
      :total-pages="log.totalPages.value"
      :total="log.total.value"
      :limit="state.limit"
      @change="log.setPage"
    />
  </div>

  <AuditDetailModal :item="selected" @close="selected = null" />
</template>

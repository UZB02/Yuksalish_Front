<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  FileQuestion,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Sigma,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { ExamTopic, QuestionListItem, QuestionStatus, QuestionType } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useDebounce } from '@/composables/useDebounce'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { DIFFICULTIES, QUESTION_TYPES } from '@/utils/examQuestion'
import ExamBreadcrumb from '@/components/exams/ExamBreadcrumb.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())
const auth = useAuthStore()

/** 3-daraja: tanlangan MAVZU ichidagi savollar */
const topicId = computed(() => String(route.params.topicId))
const topic = ref<ExamTopic | null>(null)
const topicLoading = ref(true)
const topicForbidden = ref(false)

const filters = reactive({
  search: '',
  type: '' as '' | QuestionType,
  difficulty: '',
  status: '' as '' | QuestionStatus,
  mine: false,
  shared: false,
})
const debouncedSearch = useDebounce(
  computed(() => filters.search),
  350,
)

const list = usePagination<QuestionListItem>(
  ({ page, limit }) =>
    examsApi.listQuestions({
      page,
      limit,
      search: debouncedSearch.value || undefined,
      topicId: topicId.value,
      type: filters.type || undefined,
      difficulty: filters.difficulty ? Number(filters.difficulty) : undefined,
      status: filters.status || undefined,
      mine: filters.mine || undefined,
      shared: filters.shared || undefined,
    }),
  { limit: 20 },
)

const anyFilter = computed(
  () =>
    !!(
      filters.search ||
      filters.type ||
      filters.difficulty ||
      filters.status ||
      filters.mine ||
      filters.shared
    ),
)

const typeOptions = computed(() => [
  { value: '', label: t('exams.filters.allTypes') },
  ...QUESTION_TYPES.map((v) => ({ value: v, label: t(`exams.types.${v}`) })),
])
const difficultyOptions = computed(() => [
  { value: '', label: t('exams.filters.allDifficulties') },
  ...DIFFICULTIES.map((v) => ({ value: String(v), label: t(`exams.difficulty.${v}`) })),
])
const statusOptions = computed(() => [
  { value: '', label: t('exams.filters.allStatuses') },
  ...(['draft', 'active', 'archived'] as const).map((v) => ({
    value: v,
    label: t(`exams.status.${v}`),
  })),
])
const STATUS_TONE: Record<QuestionStatus, 'neutral' | 'success' | 'warning'> = {
  draft: 'warning',
  active: 'success',
  archived: 'neutral',
}
const DIFFICULTY_TONE = { 1: 'success', 2: 'info', 3: 'danger' } as const

// ---- Ommaviy tanlash va holat o'zgartirish ----
const selected = ref<Set<string>>(new Set())
/** "Barcha N ta savol" rejimi: tanlov serverda mavzu (+holat filtri) bo'yicha */
const allMode = ref(false)
const bulkBusy = ref(false)
const draftCount = ref(0)

const isAdministration = computed(
  () => auth.user?.role !== 'teacher' || auth.hasPermission('exams.manage'),
)
const editable = computed(() => list.items.value.filter((q) => q.canEdit))
const allPageSelected = computed(
  () => editable.value.length > 0 && editable.value.every((q) => selected.value.has(q.id)),
)
/** Qidiruv/tur/qiyinlik/muallif filtrlarini serverdagi ommaviy amal bilvosita qo'llay olmaydi */
const onlyStatusFilter = computed(
  () => !(filters.search || filters.type || filters.difficulty || filters.mine || filters.shared),
)
const canSelectAllFiltered = computed(
  () =>
    allPageSelected.value && list.total.value > list.items.value.length && onlyStatusFilter.value,
)
const selectedCount = computed(() => (allMode.value ? list.total.value : selected.value.size))

function clearSelection() {
  selected.value = new Set()
  allMode.value = false
}
function togglePage(on: boolean) {
  allMode.value = false
  selected.value = on ? new Set(editable.value.map((q) => q.id)) : new Set()
}
function toggleOne(id: string, on: boolean) {
  allMode.value = false
  const s = new Set(selected.value)
  if (on) s.add(id)
  else s.delete(id)
  selected.value = s
}
// Sahifa/filtr o'zgarsa tanlov tozalanadi
watch(
  () => list.items.value,
  () => clearSelection(),
)

async function loadDraftCount() {
  try {
    const r = await examsApi.listQuestions({
      topicId: topicId.value,
      status: 'draft',
      limit: 1,
      mine: isAdministration.value ? undefined : true,
    })
    draftCount.value = r.meta.total
  } catch {
    draftCount.value = 0
  }
}

async function runBulk(
  toStatus: 'active' | 'draft' | 'archived',
  scope: 'selection' | 'drafts' = 'selection',
) {
  if (toStatus === 'archived') {
    const ok = await confirm({
      title: t('exams.bulk.archiveTitle'),
      message: t('exams.bulk.archiveText', { n: selectedCount.value }),
      confirmText: t('exams.actions.archive'),
      variant: 'danger',
    })
    if (!ok) return
  } else if (scope === 'drafts') {
    const ok = await confirm({
      title: t('exams.bulk.activateAllTitle'),
      message: t('exams.bulk.activateAllText', { n: draftCount.value }),
      confirmText: t('exams.bulk.activate'),
    })
    if (!ok) return
  }
  const body =
    scope === 'drafts'
      ? { topicId: topicId.value, fromStatus: 'draft' as const, toStatus }
      : allMode.value
        ? { topicId: topicId.value, fromStatus: filters.status || undefined, toStatus }
        : { ids: [...selected.value], toStatus }
  bulkBusy.value = true
  try {
    const r = await examsApi.bulkStatus(body)
    const msg = t('exams.bulk.done', { updated: r.updated })
    if (r.skipped.length) {
      toast.error(
        `${msg} ${t('exams.bulk.skipped', { n: r.skipped.length })}: ${[...new Set(r.skipped.map((x) => x.reason))].slice(0, 3).join('; ')}`,
      )
    } else toast.success(msg)
    clearSelection()
    await Promise.all([list.load(), loadDraftCount()])
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    bulkBusy.value = false
  }
}

async function loadTopic() {
  topicLoading.value = true
  topicForbidden.value = false
  try {
    topic.value = await examsApi.getTopic(topicId.value)
  } catch {
    topic.value = null
    topicForbidden.value = true
  } finally {
    topicLoading.value = false
  }
}

async function reload() {
  if (needsSchool.value) return
  await loadTopic()
  if (topic.value) {
    await list.reset()
    void loadDraftCount()
  }
}

onMounted(reload)
// Superadmin maktabni almashtirsa mavzu boshqa maktabga tegishli bo'lib qoladi: bankka qaytamiz
watch(schoolId, () => void router.replace({ name: 'exam-questions' }))
watch(topicId, () => void reload())
watch(
  () => [
    debouncedSearch.value,
    filters.type,
    filters.difficulty,
    filters.status,
    filters.mine,
    filters.shared,
  ],
  () => {
    if (!needsSchool.value && topic.value) void list.reset()
  },
)

function resetFilters() {
  Object.assign(filters, {
    search: '',
    type: '',
    difficulty: '',
    status: '',
    mine: false,
    shared: false,
  })
}

const rowItems = (q: QuestionListItem): DropdownItem[] =>
  !q.canEdit
    ? // Ulashilgan savol: ko'rish va o'z qoralamangizga nusxa olish
      [
        { key: 'edit', label: t('exams.questions.view'), icon: Eye },
        { key: 'duplicate', label: t('exams.actions.duplicate'), icon: Copy },
      ]
    : [
        { key: 'edit', label: t('common.edit'), icon: Pencil },
        { key: 'duplicate', label: t('exams.actions.duplicate'), icon: Copy },
        q.status === 'archived'
          ? { key: 'restore', label: t('exams.actions.restore'), icon: ArchiveRestore }
          : { key: 'archive', label: t('exams.actions.archive'), icon: Archive },
        // Istalgan holatdagi savol yumshoq o'chiriladi (sessiyalar savol nusxasini saqlaydi)
        {
          key: 'delete',
          label: t('common.delete'),
          icon: Trash2,
          danger: true,
          separator: true,
        },
      ]

const open = (q: QuestionListItem) =>
  router.push({ name: 'exam-question-edit', params: { id: q.id } })

async function onAction(q: QuestionListItem, key: string) {
  try {
    if (key === 'edit') return await open(q)
    if (key === 'duplicate') {
      const copy = await examsApi.duplicateQuestion(q.id)
      toast.success(t('exams.toast.duplicated'))
      return await router.push({ name: 'exam-question-edit', params: { id: copy.id } })
    }
    if (key === 'archive') {
      const ok = await confirm({
        title: t('exams.archiveTitle'),
        message: t('exams.archiveText'),
        confirmText: t('exams.actions.archive'),
      })
      if (!ok) return
      await examsApi.archiveQuestion(q.id)
      toast.success(t('exams.toast.archived'))
    } else if (key === 'restore') {
      await examsApi.restoreQuestion(q.id)
      toast.success(t('exams.toast.restored'))
    } else if (key === 'delete') {
      const ok = await confirm({
        title: t('exams.deleteTitle'),
        message: t('exams.deleteText'),
        confirmText: t('common.delete'),
        variant: 'danger',
      })
      if (!ok) return
      await examsApi.removeQuestion(q.id)
      toast.success(t('exams.toast.deleted'))
    }
    await list.load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <NeedsSchool v-if="needsSchool" />

  <div v-else-if="topicLoading" aria-busy="true">
    <Skeleton class="mb-4 h-5 w-72" />
    <Skeleton class="h-40 w-full" />
  </div>

  <div v-else-if="topicForbidden || !topic" class="card" data-testid="topic-forbidden">
    <EmptyState
      :title="t('exams.topics.forbiddenTitle')"
      :description="t('exams.topics.topicForbiddenText')"
    >
      <RouterLink :to="{ name: 'exam-questions' }">
        <BaseButton>{{ t('exams.bank.title') }}</BaseButton>
      </RouterLink>
    </EmptyState>
  </div>

  <template v-else>
    <ExamBreadcrumb
      :items="[
        { label: t('exams.bank.title'), to: { name: 'exam-questions' } },
        {
          label: topic.subjectName ?? '',
          to: { name: 'exam-subject', params: { subjectId: topic.subjectId } },
        },
        { label: topic.name },
      ]"
    />
    <PageHeader
      :title="topic.name"
      :description="topic.description || t('exams.questions.description')"
    >
      <template #actions>
        <BaseButton
          v-if="draftCount > 0"
          variant="secondary"
          :loading="bulkBusy"
          data-testid="activate-all-drafts"
          @click="runBulk('active', 'drafts')"
        >
          {{ t('exams.bulk.activateAllDrafts', { n: draftCount }) }}
        </BaseButton>
        <RouterLink :to="{ name: 'exam-question-import', query: { topicId } }">
          <BaseButton variant="secondary" data-testid="import-questions"
            ><Upload class="h-4 w-4" aria-hidden="true" />
            {{ t('exams.import.button') }}</BaseButton
          >
        </RouterLink>
        <RouterLink :to="{ name: 'exam-question-create', query: { topicId } }">
          <BaseButton data-testid="add-question"
            ><Plus class="h-4 w-4" aria-hidden="true" /> {{ t('exams.questions.add') }}</BaseButton
          >
        </RouterLink>
      </template>
    </PageHeader>
    <div class="card" data-testid="questions-card">
      <!-- Filtrlar -->
      <div class="space-y-3 border-b border-border p-4" data-testid="question-filters">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div class="relative sm:col-span-2 lg:col-span-2">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
              aria-hidden="true"
            />
            <input
              v-model="filters.search"
              type="search"
              :placeholder="t('exams.filters.search')"
              :aria-label="t('exams.filters.search')"
              class="block h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              data-testid="filter-search"
            />
          </div>
          <BaseSelect
            v-model="filters.type"
            :options="typeOptions"
            :aria-label="t('exams.fields.type')"
            data-testid="filter-type"
          />
          <BaseSelect
            v-model="filters.difficulty"
            :options="difficultyOptions"
            :aria-label="t('exams.fields.difficulty')"
            data-testid="filter-difficulty"
          />
        </div>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div class="w-full sm:w-52">
            <BaseSelect
              v-model="filters.status"
              :options="statusOptions"
              :aria-label="t('exams.fields.status')"
              data-testid="filter-status"
            />
          </div>
          <BaseCheckbox v-model="filters.mine" :label="t('exams.filters.mine')" />
          <BaseCheckbox
            v-model="filters.shared"
            :label="t('exams.filters.shared')"
            data-testid="filter-shared"
          />
          <BaseButton v-if="anyFilter" variant="ghost" size="sm" @click="resetFilters">
            {{ t('exams.filters.reset') }}
          </BaseButton>
        </div>
      </div>

      <!-- Holatlar -->
      <div v-if="list.error.value" class="p-4">
        <EmptyState
          :title="t('errors.loadFailed')"
          :description="errorMessage(list.error.value, t)"
        >
          <BaseButton variant="secondary" @click="list.load()">{{ t('common.retry') }}</BaseButton>
        </EmptyState>
      </div>

      <div v-else-if="list.loading.value && list.items.value.length === 0" class="space-y-3 p-4">
        <Skeleton v-for="n in 5" :key="n" class="h-16 w-full" />
      </div>

      <EmptyState
        v-else-if="list.items.value.length === 0"
        :icon="FileQuestion"
        :title="anyFilter ? t('exams.questions.noMatchTitle') : t('exams.questions.emptyTitle')"
        :description="anyFilter ? t('exams.questions.noMatchText') : t('exams.questions.emptyText')"
      >
        <BaseButton v-if="anyFilter" variant="secondary" @click="resetFilters">
          {{ t('exams.filters.reset') }}
        </BaseButton>
        <RouterLink v-else :to="{ name: 'exam-question-create', query: { topicId } }">
          <BaseButton>{{ t('exams.questions.add') }}</BaseButton>
        </RouterLink>
      </EmptyState>

      <div
        v-else-if="editable.length > 0"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2.5"
        data-testid="bulk-bar"
      >
        <BaseCheckbox
          :model-value="allPageSelected"
          :label="t('exams.bulk.selectAll')"
          data-testid="select-page"
          @update:model-value="togglePage"
        />
        <template v-if="selectedCount > 0">
          <span class="text-sm text-fg-muted" data-testid="selected-count">
            {{ t('exams.bulk.selected', { n: selectedCount }) }}
          </span>
          <BaseButton
            size="sm"
            :loading="bulkBusy"
            data-testid="bulk-active"
            @click="runBulk('active')"
          >
            {{ t('exams.bulk.activate') }}
          </BaseButton>
          <BaseButton
            size="sm"
            variant="secondary"
            :loading="bulkBusy"
            data-testid="bulk-draft"
            @click="runBulk('draft')"
          >
            {{ t('exams.bulk.toDraft') }}
          </BaseButton>
          <BaseButton
            size="sm"
            variant="secondary"
            :loading="bulkBusy"
            data-testid="bulk-archive"
            @click="runBulk('archived')"
          >
            {{ t('exams.actions.archive') }}
          </BaseButton>
          <BaseButton size="sm" variant="ghost" @click="clearSelection">{{
            t('common.cancel')
          }}</BaseButton>
        </template>
        <BaseButton
          v-if="canSelectAllFiltered && !allMode"
          size="sm"
          variant="ghost"
          data-testid="select-all-filtered"
          @click="allMode = true"
        >
          {{ t('exams.bulk.selectAllN', { n: list.total.value }) }}
        </BaseButton>
      </div>

      <ul
        v-if="!list.error.value && list.items.value.length > 0"
        class="divide-y divide-border"
        :aria-busy="list.loading.value"
      >
        <li
          v-for="q in list.items.value"
          :key="q.id"
          class="flex items-start gap-3 p-4 transition-colors hover:bg-surface-muted/50"
          :class="list.loading.value ? 'opacity-60' : ''"
          data-testid="question-row"
        >
          <BaseCheckbox
            class="mt-0.5 shrink-0"
            :model-value="selected.has(q.id)"
            :disabled="!q.canEdit"
            :aria-label="t('exams.bulk.selectOne')"
            :data-testid="`select-${q.id}`"
            @update:model-value="toggleOne(q.id, $event)"
          />
          <button
            type="button"
            class="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
            @click="open(q)"
          >
            <p
              class="line-clamp-2 break-words text-sm font-medium text-fg"
              data-testid="row-preview"
            >
              {{ q.preview || t('exams.questions.noText') }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <BaseBadge :tone="STATUS_TONE[q.status]" data-testid="row-status">
                {{ t(`exams.status.${q.status}`) }}
              </BaseBadge>
              <BaseBadge tone="primary">{{ t(`exams.types.${q.type}`) }}</BaseBadge>
              <BaseBadge :tone="DIFFICULTY_TONE[q.difficulty]">
                {{ t(`exams.difficulty.${q.difficulty}`) }}
              </BaseBadge>
              <BaseBadge tone="neutral">{{ t('exams.points', { n: q.points }) }}</BaseBadge>
              <BaseBadge v-if="q.sharedWithMe" tone="info" data-testid="badge-shared-with-me">{{
                t('exams.sharing.badgeWithMe')
              }}</BaseBadge>
              <BaseBadge v-else-if="q.isShared" tone="info" data-testid="badge-shared">{{
                t('exams.sharing.badge')
              }}</BaseBadge>
              <Sigma
                v-if="q.hasMath"
                class="h-4 w-4 text-fg-muted"
                :aria-label="t('exams.questions.hasMath')"
              />
              <ImageIcon
                v-if="q.hasImage"
                class="h-4 w-4 text-fg-muted"
                :aria-label="t('exams.questions.hasImage')"
              />
            </div>
            <p class="mt-1.5 text-xs text-fg-muted">
              <span v-if="q.authorName">
                · {{ q.isMine ? t('exams.questions.you') : q.authorName }}</span
              >
              <span v-if="!q.canEdit"> · {{ t('exams.questions.readOnly') }}</span>
            </p>
          </button>
          <DropdownMenu
            :items="rowItems(q)"
            :label="t('exams.questions.moreActions')"
            @select="onAction(q, $event)"
          />
        </li>
      </ul>

      <BasePagination
        v-if="list.total.value > list.limit.value"
        :page="list.page.value"
        :total-pages="list.totalPages.value"
        :total="list.total.value"
        :limit="list.limit.value"
        @change="list.setPage"
      />
    </div>
  </template>
</template>

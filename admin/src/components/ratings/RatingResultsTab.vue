<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, CalendarCheck, Megaphone, Trophy } from 'lucide-vue-next'
import { ratingsApi } from '@/api/ratings.api'
import type { RatingResultDetail, RatingResultMeta } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { formatDate, formatDateTime } from '@/utils/format'
import { toClassItem, toStudentItem, winnersTitle } from '@/utils/ratingResults'
import ClassRatingTable from './ClassRatingTable.vue'
import StudentRatingTable from './StudentRatingTable.vue'

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const schoolCtx = useSchoolContextStore()

const LIMIT = 20
const items = ref<RatingResultMeta[]>([])
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
const loading = ref(false)
const error = ref('')

const detail = ref<RatingResultDetail | null>(null)
const detailLoading = ref(false)
const announcing = ref(false)

const studentRows = computed(() => (detail.value?.students ?? []).map(toStudentItem))
const classRows = computed(() => (detail.value?.classes ?? []).map(toClassItem))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await ratingsApi.results({ page: page.value, limit: LIMIT })
    items.value = res.items
    total.value = res.meta.total
    totalPages.value = res.meta.totalPages
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}

async function open(id: string) {
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await ratingsApi.result(id)
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    detailLoading.value = false
  }
}

function back() {
  detail.value = null
  detailLoading.value = false
}

async function announce() {
  if (!window.confirm(t('ratings.results.announceConfirm'))) return
  announcing.value = true
  try {
    await ratingsApi.announce()
    toast.success(t('ratings.results.announced'))
    page.value = 1
    await load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    announcing.value = false
  }
}

function setPage(p: number) {
  page.value = p
  void load()
}

onMounted(load)
watch(
  () => schoolCtx.schoolId,
  () => {
    detail.value = null
    page.value = 1
    void load()
  },
)
</script>

<template>
  <div data-testid="results-tab">
    <!-- Bitta arxiv -->
    <template v-if="detail || detailLoading">
      <div class="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <BaseButton variant="secondary" data-testid="results-back" @click="back">
          <ArrowLeft class="h-4 w-4" /> {{ t('ratings.results.back') }}
        </BaseButton>
        <template v-if="detail">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-fg" data-testid="results-detail-title">
              {{ winnersTitle(t, detail.periodType) }} — {{ detail.label }}
            </h2>
            <p class="text-xs text-fg-muted">
              {{
                t('ratings.results.frozenTo', {
                  from: formatDate(detail.from),
                  to: formatDate(detail.to),
                })
              }}
              · {{ t('ratings.results.announcedAt') }}: {{ formatDateTime(detail.announcedAt) }}
            </p>
          </div>
        </template>
      </div>
      <Skeleton v-if="detailLoading" class="m-4 h-40" />
      <template v-else-if="detail">
        <p v-if="auth.role === 'teacher'" class="px-4 pt-3 text-xs text-fg-muted">
          {{ t('ratings.results.teacherNote') }}
        </p>
        <h3 class="px-4 pb-1 pt-4 text-sm font-semibold text-fg">
          {{ t('ratings.results.studentsTitle') }}
        </h3>
        <StudentRatingTable v-if="studentRows.length" :items="studentRows" archive />
        <EmptyState
          v-else
          :icon="Trophy"
          :title="t('ratings.emptyTitle')"
          :description="t('ratings.emptyText')"
        />
        <h3 class="px-4 pb-1 pt-4 text-sm font-semibold text-fg">
          {{ t('ratings.results.classesTitle') }}
        </h3>
        <ClassRatingTable v-if="classRows.length" :items="classRows" archive />
      </template>
    </template>

    <!-- Ro'yxat -->
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <h2 class="text-base font-semibold text-fg">{{ t('ratings.results.title') }}</h2>
        <BaseButton
          v-if="auth.isSuperadmin"
          variant="secondary"
          :loading="announcing"
          data-testid="results-announce"
          @click="announce"
        >
          <Megaphone class="h-4 w-4" /> {{ t('ratings.results.announceNow') }}
        </BaseButton>
      </div>
      <Skeleton v-if="loading && items.length === 0" class="m-4 h-40" />
      <div v-else-if="error" class="p-4">
        <EmptyState :title="t('errors.loadFailed')" :description="error">
          <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
        </EmptyState>
      </div>
      <EmptyState
        v-else-if="items.length === 0"
        :icon="CalendarCheck"
        :title="t('ratings.results.empty')"
        :description="t('ratings.results.emptyText')"
      />
      <ul v-else class="divide-y divide-border" data-testid="results-list">
        <li v-for="r in items" :key="r.id">
          <button
            type="button"
            class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
            :data-testid="`result-${r.periodKey}`"
            @click="open(r.id)"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-fg">
                {{ winnersTitle(t, r.periodType) }} — {{ r.label }}
              </span>
              <span class="block text-xs text-fg-muted">
                {{
                  t('ratings.results.frozenTo', { from: formatDate(r.from), to: formatDate(r.to) })
                }}
                · {{ t('ratings.results.announcedAt') }}: {{ formatDateTime(r.announcedAt) }}
              </span>
            </span>
            <BaseBadge v-if="r.manual" tone="neutral">{{ t('ratings.results.manual') }}</BaseBadge>
            <span class="text-xs text-fg-muted">
              {{ t('ratings.results.students', { n: r.studentsCount }) }} ·
              {{ t('ratings.results.classes', { n: r.classesCount }) }}
            </span>
            <span class="text-sm font-medium text-primary-700">{{
              t('ratings.results.open')
            }}</span>
          </button>
        </li>
      </ul>
      <BasePagination
        v-if="total > LIMIT"
        :page="page"
        :total-pages="totalPages"
        :total="total"
        :limit="LIMIT"
        @change="setPage"
      />
    </template>
  </div>
</template>

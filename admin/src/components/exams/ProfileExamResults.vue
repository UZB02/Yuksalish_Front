<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClipboardCheck } from 'lucide-vue-next'
import type { ProfileExamResults } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import { fmtDateTime } from '@/utils/examSessions'

/**
 * Profil "Imtihonlar" bo'limi (o'quvchi va nomzod uchun bir xil): yakunlangan imtihonlar, fan bo'yicha ballar,
 * foiz va o'tdi/o'tmadi. `load` ma'lumot manbasini beradi (o'quvchi yoki nomzod endpointi).
 */
const props = defineProps<{ load: () => Promise<ProfileExamResults> }>()
const { t } = useI18n()
const auth = useAuthStore()

const data = ref<ProfileExamResults | null>(null)
const loading = ref(true)
const error = ref('')

async function run() {
  loading.value = true
  error.value = ''
  try {
    data.value = await props.load()
  } catch (e) {
    data.value = null
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(run)

/** Batafsil natija sahifasi: imtihon natijalarini ko'rish huquqi bor xodim uchun va imtihon o'chirilmagan bo'lsa */
const canDetail = computed(
  () =>
    auth.hasPermission(PERMISSIONS.EXAMS_MANAGE) || auth.hasPermission(PERMISSIONS.EXAMS_QUESTIONS),
)
const fmtNum = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
</script>

<template>
  <section class="card p-4 sm:p-5" data-testid="profile-exams">
    <header class="mb-3 flex items-center gap-3">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
      >
        <ClipboardCheck class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold text-fg">{{ t('profileExams.title') }}</h2>
      <span
        v-if="data && data.summary.count"
        class="ml-auto text-xs text-fg-muted"
        data-testid="exams-summary"
      >
        {{
          t('profileExams.summary', {
            n: data.summary.count,
            avg: fmtNum(data.summary.averagePercent ?? 0),
          })
        }}
      </span>
    </header>

    <div v-if="loading" class="space-y-2" aria-busy="true">
      <Skeleton class="h-14 w-full" />
      <Skeleton class="h-14 w-full" />
    </div>
    <p v-else-if="error" class="text-sm text-danger" role="alert" data-testid="exams-error">
      {{ error }}
    </p>
    <EmptyState
      v-else-if="!data || data.items.length === 0"
      :title="t('profileExams.emptyTitle')"
      :description="t('profileExams.emptyText')"
      data-testid="exams-empty"
    />
    <ul v-else class="space-y-3" data-testid="exams-list">
      <li
        v-for="(r, i) in data.items"
        :key="r.sessionId"
        class="rounded-lg border border-border p-3"
        :data-testid="`exam-result-${i}`"
      >
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p class="min-w-0 font-medium text-fg" data-testid="exam-title">{{ r.title }}</p>
          <BaseBadge
            v-if="r.passed !== null"
            :tone="r.passed ? 'success' : 'danger'"
            data-testid="exam-passed"
          >
            {{ r.passed ? t('profileExams.passed') : t('profileExams.failed') }}
          </BaseBadge>
          <BaseBadge v-if="r.examDeleted" tone="neutral">{{ t('profileExams.deleted') }}</BaseBadge>
          <BaseBadge v-if="r.terminated" tone="danger" data-testid="exam-terminated">
            {{ t('profileExams.terminated', { reason: r.terminated.reason }) }}
          </BaseBadge>
          <BaseBadge v-if="r.essayPending > 0" tone="warning">
            {{ t('profileExams.essayPending', { n: r.essayPending }) }}
          </BaseBadge>
          <span class="ml-auto text-sm font-semibold text-fg" data-testid="exam-total">
            {{ fmtNum(r.earned) }} / {{ fmtNum(r.max) }} · {{ fmtNum(r.percent) }}%
          </span>
        </div>
        <p class="mt-0.5 text-xs text-fg-muted">
          {{ fmtDateTime(r.heldAt) }}
          <template v-if="r.passPercent !== null">
            · {{ t('profileExams.passLine', { n: r.passPercent }) }}</template
          >
        </p>
        <ul
          v-if="r.blocks.length > 1"
          class="mt-2 grid gap-1 text-sm sm:grid-cols-2"
          data-testid="exam-blocks"
        >
          <li v-for="b in r.blocks" :key="b.id" class="flex items-center justify-between gap-2">
            <span class="truncate text-fg-muted">{{ b.subjectName ?? b.title }}</span>
            <span class="shrink-0 text-fg">
              {{ fmtNum(b.earned) }}/{{ fmtNum(b.max) }}
              <span class="text-xs text-fg-muted">({{ fmtNum(b.percent) }}%)</span>
            </span>
          </li>
        </ul>
        <RouterLink
          v-if="canDetail && !r.examDeleted"
          :to="{ name: 'exam-session-results', params: { id: r.sessionId } }"
          class="mt-2 inline-block text-sm font-medium text-primary-700 hover:underline"
          data-testid="exam-detail"
        >
          {{ t('profileExams.detail') }}
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import type { ExamResultDetail, ExamResultQuestion } from '@/api/types'
import BlocksView from '@/components/exams/BlocksView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

/**
 * Ishtirokchi natijasi: har savol bo'yicha javob, to'g'ri javob, ball. Esse: o'quvchi matni (oddiy matn, HTML emas),
 * tekshirish mezoni va baholash formasi (0..max, qadam 0.5, izoh). Saqlangach umumiy ball qayta hisoblanadi.
 */
const props = defineProps<{
  open: boolean
  sessionId: string
  participantKey: string | null
  canGrade: boolean
}>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const detail = ref<ExamResultDetail | null>(null)
const loading = ref(false)
const error = ref('')
const form = reactive<
  Record<string, { points: string; comment: string; error: string; busy: boolean }>
>({})

async function load() {
  if (!props.open || !props.participantKey) return
  loading.value = true
  error.value = ''
  try {
    detail.value = await examsApi.resultDetail(props.sessionId, props.participantKey)
    for (const q of detail.value.questions) {
      if (q.type === 'essay') {
        form[q.id] = {
          points: q.grade ? String(q.grade.points) : '',
          comment: q.grade?.comment ?? '',
          error: '',
          busy: false,
        }
      }
    }
  } catch (e) {
    detail.value = null
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
watch(() => [props.open, props.participantKey], load, { immediate: true })

const summary = computed(() => detail.value?.score ?? null)
/** Blok bo'yicha ballar (bir nechta blokli imtihonda) */
const blockRows = computed(() => {
  const d = detail.value
  if (!d?.blocks || d.blocks.length <= 1) return []
  return d.blocks.map((h) => {
    const sc = d.blockScores?.find((b) => b.blockId === h.id)
    return {
      id: h.id,
      title: h.title || h.subjectName || '',
      earned: sc?.earned ?? 0,
      max: sc?.max ?? 0,
    }
  })
})
/** Savol qaysi blokka tegishli (sarlavha faqat blok almashganda chiqadi) */
const blockTitleOf = (q: ExamResultQuestion, i: number) => {
  if (!blockRows.value.length) return ''
  const prev = i > 0 ? detail.value!.questions[i - 1]!.blockId : undefined
  if (i > 0 && prev === q.blockId) return ''
  return blockRows.value.find((b) => b.id === q.blockId)?.title ?? ''
}

/** Variant id lari -> o'qiladigan matn (faqat matn/formula bloklari) */
function optionText(q: ExamResultQuestion, id: string): string {
  const o = q.options.find((x) => x.id === id)
  const text = (o?.content ?? [])
    .map((b) => (b.type === 'text' ? b.text : b.type === 'math' ? b.tex : ''))
    .join(' ')
    .trim()
  return text || id
}
const givenText = (q: ExamResultQuestion): string => {
  const v = q.given
  if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) return ''
  if (q.type === 'single' || q.type === 'multi') {
    return (Array.isArray(v) ? v : [v]).map((id) => optionText(q, id)).join(', ')
  }
  return Array.isArray(v) ? v.join(', ') : v
}
const correctText = (q: ExamResultQuestion): string => {
  if (q.correct.optionIds) return q.correct.optionIds.map((id) => optionText(q, id)).join(', ')
  return (q.correct.texts ?? []).join(' / ')
}

async function save(q: ExamResultQuestion) {
  const f = form[q.id]
  if (!f || !props.participantKey) return
  f.error = ''
  const n = Number(f.points.replace(',', '.'))
  if (
    f.points.trim() === '' ||
    !Number.isFinite(n) ||
    n < 0 ||
    n > q.points ||
    Math.abs(n * 2 - Math.round(n * 2)) > 1e-9
  ) {
    f.error = t('examResults.detail.pointsRange', { max: q.points })
    return
  }
  f.busy = true
  try {
    await examsApi.gradeEssay(props.sessionId, props.participantKey, q.id, {
      points: n,
      comment: f.comment.trim(),
    })
    toast.success(t('examResults.detail.saved'))
    emit('changed')
    await load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    f.busy = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="detail?.participant.fullName ?? t('examResults.detail.title')"
    :description="detail?.participant.className ?? ''"
    size="xl"
    @close="emit('close')"
  >
    <p v-if="loading" class="text-sm text-fg-muted">{{ t('common.loading') }}</p>
    <p v-else-if="error" class="text-sm text-danger">{{ error }}</p>
    <p
      v-else-if="detail && detail.questions.length === 0"
      class="text-sm text-fg-muted"
      data-testid="detail-empty"
    >
      {{ t('examResults.detail.notStarted') }}
    </p>
    <div v-else-if="detail" class="space-y-4" data-testid="participant-detail">
      <div
        v-if="summary"
        class="flex flex-wrap items-center gap-3 rounded-lg bg-surface-muted p-3 text-sm"
      >
        <span class="font-semibold text-fg" data-testid="detail-score"
          >{{ summary.earned }} / {{ summary.max }}</span
        >
        <span v-if="detail.percent !== null && detail.percent !== undefined" class="text-fg-muted"
          >{{ detail.percent }}%</span
        >
        <BaseBadge v-if="summary.essayPending" tone="warning">
          {{ t('examResults.essayN', { n: summary.essayPending }) }}
        </BaseBadge>
      </div>
      <ul
        v-if="blockRows.length"
        class="flex flex-wrap gap-2 text-sm"
        data-testid="detail-block-scores"
      >
        <li
          v-for="b in blockRows"
          :key="b.id"
          class="rounded-lg border border-border px-3 py-1.5"
          :data-testid="`detail-block-score-${b.id}`"
        >
          <span class="text-fg-muted">{{ b.title }}:</span>
          <span class="ml-1 font-semibold text-fg">{{ b.earned }} / {{ b.max }}</span>
        </li>
      </ul>

      <template v-for="(q, qi) in detail.questions" :key="q.id">
        <h3
          v-if="blockTitleOf(q, qi)"
          class="pt-1 text-sm font-semibold text-fg"
          data-testid="detail-block-title"
        >
          {{ blockTitleOf(q, qi) }}
        </h3>
        <article
          class="space-y-2 rounded-lg border border-border p-3"
          :class="q.ok === true ? 'border-success' : q.ok === false ? 'border-danger' : ''"
          data-testid="detail-question"
        >
          <div class="flex justify-between text-xs text-fg-muted">
            <span>{{ t('examResults.detail.question', { n: q.index }) }}</span>
            <span>
              {{ q.got === null ? '' : `${q.got} / ` }}{{ q.points }}
              <BaseBadge v-if="q.type === 'essay' && !q.graded" tone="warning" class="ml-1">
                {{ t('examResults.detail.pending') }}
              </BaseBadge>
            </span>
          </div>
          <BlocksView :blocks="q.content" />

          <template v-if="q.type === 'essay'">
            <div>
              <p class="text-xs font-medium text-fg-muted">{{ t('examResults.detail.essay') }}</p>
              <!-- Oddiy matn: v-html yo'q -->
              <p
                class="whitespace-pre-wrap break-words rounded bg-surface-muted p-2 text-sm text-fg"
                data-testid="essay-text"
              >
                {{ givenText(q) || t('examResults.detail.noAnswer') }}
              </p>
            </div>
            <p v-if="q.correct.rubric" class="text-sm text-fg-muted" data-testid="essay-rubric">
              <b>{{ t('examResults.detail.rubric') }}:</b> {{ q.correct.rubric }}
            </p>
            <div
              v-if="canGrade && form[q.id]"
              class="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
              data-testid="grade-form"
            >
              <BaseInput
                v-model="form[q.id]!.points"
                type="number"
                step="0.5"
                min="0"
                :max="q.points"
                :label="t('examResults.detail.pointsInput', { max: q.points })"
                :error="form[q.id]!.error"
                data-testid="grade-points"
              />
              <BaseInput
                v-model="form[q.id]!.comment"
                :label="t('examResults.detail.comment')"
                :maxlength="1000"
                data-testid="grade-comment"
              />
              <BaseButton :loading="form[q.id]!.busy" data-testid="grade-save" @click="save(q)">
                {{ t('examResults.detail.save') }}
              </BaseButton>
            </div>
            <p v-if="q.grade?.by" class="text-xs text-fg-muted">
              {{ t('examResults.detail.gradedBy', { name: q.grade.by }) }}
            </p>
          </template>
          <template v-else>
            <p class="text-sm" data-testid="given">
              <b>{{ t('examResults.detail.given') }}:</b>
              {{ givenText(q) || t('examResults.detail.noAnswer') }}
            </p>
            <p class="text-sm text-success" data-testid="correct">
              <b>{{ t('examResults.detail.correct') }}:</b> {{ correctText(q) }}
            </p>
          </template>
        </article>
      </template>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{
        t('examResults.detail.close')
      }}</BaseButton>
    </template>
  </BaseModal>
</template>

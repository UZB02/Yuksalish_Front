<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { BlockQuestionList, ExamBlock, ExamSession, Question } from '@/api/types'
import BlocksView from '@/components/exams/BlocksView.vue'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { blockState } from '@/utils/examFlow'
import { errorMessage } from '@/utils/errors'

/**
 * Fan bo'yicha ko'rib chiqish: fan savollarining HAMMASI o'quvchi ko'rgandek va to'g'ri javoblari bilan.
 * Tuzuvchi (ma'muriyat) tahrirlaydi, olib tashlaydi, qo'shadi va "Tasdiqlash" bosadi: tasdiqlangan fan o'qituvchi
 * uchun yopiladi. Qoralama holatda "Tasdiqni bekor qilish" mumkin.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()

const sessionId = computed(() => String(route.params.id))
const blockId = computed(() => String(route.params.blockId))
const session = ref<ExamSession | null>(null)
const list = ref<BlockQuestionList | null>(null)
const questions = ref<Map<string, Question | null>>(new Map())
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const block = computed<ExamBlock | null>(
  () => session.value?.blocks?.find((b) => b.id === blockId.value && !b.legacy) ?? null,
)
const state = computed(() => (block.value ? blockState(block.value) : 'collecting'))
const draft = computed(() => session.value?.status === 'draft')
const editable = computed(() => draft.value && !!session.value?.canEdit)
const rows = computed(() => list.value?.questions ?? [])

/** To'liq savollarni (javob kaliti bilan) cheklangan parallellikda yuklaydi */
async function loadQuestions(ids: string[]) {
  const map = new Map<string, Question | null>()
  let next = 0
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]!
      try {
        map.set(id, await examsApi.getQuestion(id))
      } catch {
        map.set(id, null)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, ids.length) }, worker))
  questions.value = map
}

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    const [s, l] = await Promise.all([
      examsApi.getSession(sessionId.value),
      examsApi.composerBlockQuestions(sessionId.value, blockId.value),
    ])
    session.value = s
    list.value = l
    await loadQuestions(l.questions.filter((q) => !q.missing).map((q) => q.id))
  } catch (e) {
    session.value = null
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function reloadState() {
  const [s, l] = await Promise.all([
    examsApi.getSession(sessionId.value),
    examsApi.composerBlockQuestions(sessionId.value, blockId.value),
  ])
  session.value = s
  list.value = l
  await loadQuestions(l.questions.filter((q) => !q.missing).map((q) => q.id))
}

async function setApproved(approved: boolean) {
  if (!block.value) return
  if (approved && block.value.count < block.value.targetCount) {
    const ok = await confirm({
      title: t('examFlow.review.shortTitle'),
      message: t('examFlow.review.shortText', {
        n: block.value.count,
        target: block.value.targetCount,
      }),
      confirmText: t('examFlow.review.approve'),
    })
    if (!ok) return
  }
  busy.value = true
  try {
    await examsApi.setBlockReady(sessionId.value, blockId.value, approved)
    toast.success(t(approved ? 'examFlow.review.approvedToast' : 'examFlow.review.unapprovedToast'))
    await reloadState()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

async function removeQ(qid: string) {
  const ok = await confirm({
    title: t('examBlocks.myBlock.removeTitle'),
    message: t('examFlow.review.removeText'),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  busy.value = true
  try {
    await examsApi.composerRemoveBlockQuestion(sessionId.value, blockId.value, qid)
    await reloadState()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

const addQuestions = () =>
  void router.push({
    name: 'exam-my-block',
    params: { sessionId: sessionId.value, blockId: blockId.value },
  })
const edit = (qid: string) => void router.push({ name: 'exam-question-edit', params: { id: qid } })

const letter = (i: number) => String.fromCharCode(65 + i)
const isCorrect = (q: Question, optId: string) =>
  q.type === 'single' ? q.answer?.optionId === optId : (q.answer?.optionIds ?? []).includes(optId)
const stateTone = {
  collecting: 'warning',
  done: 'primary',
  approved: 'success',
  auto: 'neutral',
} as const
</script>

<template>
  <header class="mb-5 flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
    <RouterLink
      :to="{ name: 'exam-session', params: { id: sessionId } }"
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
      data-testid="review-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('examBlocks.myBlock.backToExam') }}
    </RouterLink>
    <div v-if="block && session" class="min-w-0">
      <h1 class="truncate text-xl font-semibold text-fg sm:text-2xl" data-testid="review-title">
        {{ t('examFlow.review.title', { subject: block.subjectName ?? block.title }) }}
      </h1>
      <p class="mt-0.5 text-sm text-fg-muted" data-testid="review-exam">{{ session.title }}</p>
    </div>
  </header>

  <NeedsSchool v-if="needsSchool" />
  <div v-else-if="loading" class="max-w-5xl space-y-3" aria-busy="true">
    <Skeleton class="h-20 w-full" />
    <Skeleton class="h-48 w-full" />
  </div>
  <div v-else-if="error || !session || !block" class="card max-w-5xl">
    <EmptyState :title="t('errors.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else class="max-w-5xl space-y-4">
    <div class="card flex flex-wrap items-center gap-x-5 gap-y-3 p-4 text-sm">
      <div>
        <p class="text-fg-muted">{{ t('examFlow.table.questions') }}</p>
        <p class="font-semibold text-fg" data-testid="review-progress">
          {{ block.count }}/{{ block.targetCount }}
        </p>
      </div>
      <div>
        <p class="text-fg-muted">{{ t('examFlow.table.teachers') }}</p>
        <p class="text-fg">
          {{
            block.contributors.map((c) => c.fullName).join(', ') || t('examBlocks.noContributors')
          }}
        </p>
      </div>
      <div>
        <p class="text-fg-muted">{{ t('examFlow.table.status') }}</p>
        <BaseBadge :tone="stateTone[state]" data-testid="review-state">
          {{ t(`examFlow.blockState.${state}`) }}
        </BaseBadge>
      </div>
      <div v-if="editable" class="ml-auto flex flex-wrap gap-2">
        <BaseButton variant="secondary" data-testid="review-add" @click="addQuestions">
          <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('examFlow.review.add') }}
        </BaseButton>
        <BaseButton
          v-if="state === 'approved'"
          variant="secondary"
          :loading="busy"
          data-testid="review-unapprove"
          @click="setApproved(false)"
        >
          {{ t('examFlow.review.unapprove') }}
        </BaseButton>
        <BaseButton v-else :loading="busy" data-testid="review-approve" @click="setApproved(true)">
          <Check class="h-4 w-4" aria-hidden="true" /> {{ t('examFlow.review.approve') }}
        </BaseButton>
      </div>
    </div>

    <p
      v-if="block.count < block.targetCount"
      class="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning"
      data-testid="review-short"
    >
      {{ t('examFlow.review.short', { n: block.count, target: block.targetCount }) }}
    </p>
    <p
      v-if="state === 'approved' && draft"
      class="rounded-lg bg-success-soft px-3 py-2 text-sm text-success"
      data-testid="review-locked-note"
    >
      {{ t('examFlow.review.lockedNote') }}
    </p>

    <p
      v-if="rows.length === 0"
      class="card p-6 text-center text-sm text-fg-muted"
      data-testid="review-empty"
    >
      {{ t('examBlocks.myBlock.empty') }}
    </p>

    <ol v-else class="space-y-3" data-testid="review-list">
      <li
        v-for="(r, i) in rows"
        :key="r.id"
        class="card space-y-3 p-4"
        :data-testid="`review-q-${i}`"
      >
        <template v-if="questions.get(r.id)">
          <div class="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <BaseBadge>{{ i + 1 }}</BaseBadge>
            <span>{{ t(`exams.types.${questions.get(r.id)!.type}`) }}</span>
            <span>· {{ t('exams.preview.points', { n: questions.get(r.id)!.points }) }}</span>
            <span>· {{ t(`exams.difficulty.${questions.get(r.id)!.difficulty}`) }}</span>
            <span v-if="r.source === 'contributor' && r.addedByName">· {{ r.addedByName }}</span>
            <span v-else-if="r.source === 'composer'"
              >· {{ t('examBlocks.myBlock.byComposer') }}</span
            >
            <span v-if="editable" class="ml-auto flex gap-1">
              <BaseButton
                size="sm"
                variant="ghost"
                :aria-label="t('common.edit')"
                :data-testid="`review-edit-${i}`"
                @click="edit(r.id)"
              >
                <Pencil class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
              <BaseButton
                size="sm"
                variant="ghost"
                :aria-label="t('examBlocks.removeQuestion')"
                :data-testid="`review-remove-${i}`"
                @click="removeQ(r.id)"
              >
                <Trash2 class="h-4 w-4 text-danger" aria-hidden="true" />
              </BaseButton>
            </span>
          </div>
          <BlocksView :blocks="questions.get(r.id)!.content" />
          <ul
            v-if="questions.get(r.id)!.type === 'single' || questions.get(r.id)!.type === 'multi'"
            class="space-y-1 text-sm"
          >
            <li
              v-for="(o, oi) in questions.get(r.id)!.options"
              :key="o.id"
              class="flex items-start gap-2 rounded-md px-2 py-1"
              :class="
                isCorrect(questions.get(r.id)!, o.id) ? 'bg-success-soft text-success' : 'text-fg'
              "
              :data-testid="`review-opt-${i}-${o.id}`"
              :data-correct="isCorrect(questions.get(r.id)!, o.id) ? 'true' : 'false'"
            >
              <span class="w-5 shrink-0 font-semibold">{{ letter(oi) }}</span>
              <BlocksView :blocks="o.content" inline class="min-w-0 flex-1" />
              <Check
                v-if="isCorrect(questions.get(r.id)!, o.id)"
                class="h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            </li>
          </ul>
          <p v-else-if="questions.get(r.id)!.type === 'short'" class="text-sm text-success">
            {{ t('exams.editor.shortTitle') }}:
            {{ (questions.get(r.id)!.answer?.acceptedAnswers ?? []).join(' · ') }}
          </p>
          <p v-else class="text-sm text-fg-muted">
            {{ questions.get(r.id)!.answer?.rubric || t('exams.editor.rubricTitle') }}
          </p>
        </template>
        <p v-else class="text-sm text-fg-muted">{{ t('examBlocks.myBlock.missing') }}</p>
      </li>
    </ol>

    <ul v-if="list && list.rules.length" class="card space-y-1 p-4 text-sm text-fg-muted">
      <li v-for="(rule, i) in list.rules" :key="i">
        {{ t('examBlocks.myBlock.rule', { topic: rule.topicName ?? '—', n: rule.count }) }}
      </li>
    </ul>
  </div>
</template>

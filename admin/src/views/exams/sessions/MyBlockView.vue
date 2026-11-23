<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Library,
  PenLine,
  Pencil,
  ScanText,
  Shuffle,
  Trash2,
  TypeOutline,
} from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { MyBlockDetail } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import PasteQuestions from '@/components/exams/PasteQuestions.vue'
import RandomPickModal from '@/components/exams/RandomPickModal.vue'

/** OCR: komponent ham, og'ir kutubxonalar ham faqat "Rasm / PDF" yorlig'i ochilganda yuklanadi */
const OcrQuestions = defineAsyncComponent(() => import('@/components/exams/OcrQuestions.vue'))
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useExamAssignmentsStore } from '@/stores/examAssignments'
import { errorMessage } from '@/utils/errors'
import { fmtDateTime } from '@/utils/examSessions'
import { ruleLabel } from '@/utils/examRules'
import { deadlineLeft, taskStatus } from '@/utils/examTasks'
import QuestionPickerModal from './QuestionPickerModal.vue'
import { useTopicOptions } from './useTopicOptions'

/**
 * "Menga biriktirilgan imtihon bloki": biriktirilgan o'qituvchi faqat O'Z blokini ko'radi (imtihon nomi, fan,
 * maqsad, muddat, hozirgi savollar). Savol qo'shish: bankdan tanlash, blok ichida yozish, Word/Excel import.
 * Muddat o'tgach, blok "tayyor" deb belgilangach yoki imtihon qoralamadan chiqqach faqat o'qish uchun.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const examAssignments = useExamAssignmentsStore()

const sessionId = computed(() => String(route.params.sessionId))
const blockId = computed(() => String(route.params.blockId))
const data = ref<MyBlockDetail | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const pickerOpen = ref(false)
const randomOpen = ref(false)
const { topics: allTopics, load: loadTopics } = useTopicOptions()
const topics = computed(() =>
  allTopics.value.filter((x) => x.subjectId === data.value?.block.subjectId),
)

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await examsApi.myBlock(sessionId.value, blockId.value)
    // Yon menyu nishoni va kartochka yangilansin (savol qo'shildi/olindi, tayyor belgisi o'zgardi)
    void examAssignments.refresh()
  } catch (e) {
    data.value = null
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const progressTone = computed(() =>
  data.value && data.value.block.count >= data.value.block.targetCount ? 'success' : 'warning',
)
const lockText = computed(() =>
  data.value?.block.lockReason ? t(`examTasks.locked.${data.value.block.lockReason}`) : '',
)

async function openPicker() {
  await loadTopics().catch(() => undefined)
  pickerOpen.value = true
}
async function openRandom() {
  await loadTopics().catch(() => undefined)
  randomOpen.value = true
}
// ---- Tasodifiy tanlash qoidalari: sonini o'zgartirish va olib tashlash ----
const editRule = ref<{ id: string; count: string } | null>(null)
async function saveRuleCount() {
  const e = editRule.value
  if (!e) return
  const n = Math.floor(Number(e.count))
  if (!Number.isFinite(n) || n < 1 || n > 200) {
    toast.error(t('errors.codes.VALIDATION_ERROR'))
    return
  }
  busy.value = true
  try {
    await examsApi.updateBlockRule(sessionId.value, blockId.value, e.id, n)
    toast.success(t('examBlocks.myBlock.ruleUpdated'))
    editRule.value = null
    await load()
  } catch (err) {
    toast.error(errorMessage(err, t))
  } finally {
    busy.value = false
  }
}
async function removeRule(ruleId: string) {
  const ok = await confirm({
    title: t('examBlocks.myBlock.ruleRemoveTitle'),
    message: t('examBlocks.myBlock.ruleRemoveText'),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  busy.value = true
  try {
    await examsApi.removeBlockRule(sessionId.value, blockId.value, ruleId)
    toast.success(t('examBlocks.myBlock.ruleRemoved'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err, t))
  } finally {
    busy.value = false
  }
}
async function onPicked(ids: string[]) {
  pickerOpen.value = false
  if (!ids.length) return
  busy.value = true
  try {
    const r = await examsApi.addToBlock(sessionId.value, blockId.value, ids)
    toast.success(t('examBlocks.myBlock.added', { n: r.added }))
    await load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}
async function removeQ(qid: string) {
  const ok = await confirm({
    title: t('examBlocks.myBlock.removeTitle'),
    message: t('examBlocks.myBlock.removeText'),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  busy.value = true
  try {
    await examsApi.removeFromBlock(sessionId.value, blockId.value, qid)
    await load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}
const isComposer = computed(() => data.value?.role === 'composer')
/** "Tayyor" belgisi: o'qituvchi muddatgacha qaytara oladi; tuzuvchi qo'ygan belgini faqat tuzuvchi qaytaradi */
const isReady = computed(() => data.value?.block.status === 'ready')
async function toggleReady() {
  if (!data.value) return
  busy.value = true
  try {
    await examsApi.markBlockReady(sessionId.value, blockId.value, !isReady.value)
    toast.success(
      t(
        isComposer.value
          ? isReady.value
            ? 'examBlocks.myBlock.composerUnapproved'
            : 'examBlocks.myBlock.composerApproved'
          : isReady.value
            ? 'examBlocks.myBlock.readyOff'
            : 'examBlocks.myBlock.readyOn',
      ),
    )
    await load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}
const query = () => ({ blockSession: sessionId.value, block: blockId.value })
const writeNew = () => void router.push({ name: 'exam-question-create', query: query() })
const importInto = (kind: 'word' | 'excel') =>
  void router.push({ name: 'exam-question-import', query: { ...query(), kind } })

type Tab = 'paste' | 'ocr' | 'word' | 'excel' | 'bank' | 'single'
const TABS: { key: Tab; icon: typeof FileText }[] = [
  { key: 'paste', icon: TypeOutline },
  { key: 'ocr', icon: ScanText },
  { key: 'word', icon: FileText },
  { key: 'excel', icon: FileSpreadsheet },
  { key: 'bank', icon: Library },
  { key: 'single', icon: PenLine },
]
const tab = ref<Tab>('paste')
const status = computed(() =>
  data.value
    ? taskStatus({ ...data.value.block, blockStatus: data.value.block.status })
    : 'collecting',
)
const leftText = computed(() => {
  const l = deadlineLeft(data.value?.exam.contribDeadline)
  if (l.kind === 'overdue') return t('examTasks.overdue')
  if (l.kind === 'soon') return t('examTasks.soon')
  if (l.kind === 'hours') return t('examTasks.hoursLeft', { n: l.n })
  if (l.kind === 'days') return t('examTasks.daysLeft', { n: l.n })
  return ''
})
const taskTopics = computed(() => topics.value.map((x) => ({ id: x.id, name: x.label })))
async function onPasted() {
  await load()
}
onMounted(() => void loadTopics().catch(() => undefined))
</script>

<template>
  <header class="mb-6 flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
    <RouterLink
      :to="
        isComposer ? { name: 'exam-session', params: { id: sessionId } } : { name: 'exam-tasks' }
      "
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
      data-testid="myblock-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      {{ isComposer ? t('examBlocks.myBlock.backToExam') : t('examTasks.backToTasks') }}
    </RouterLink>
    <div v-if="data" class="min-w-0">
      <h1 class="truncate text-xl font-semibold text-fg sm:text-2xl" data-testid="myblock-title">
        {{ t('examTasks.pageTitle', { subject: data.block.subjectName ?? data.block.title }) }}
      </h1>
      <p class="mt-0.5 text-sm text-fg-muted" data-testid="myblock-exam">{{ data.exam.title }}</p>
    </div>
  </header>

  <NeedsSchool v-if="needsSchool" />
  <div v-else-if="loading" class="max-w-5xl space-y-3" aria-busy="true">
    <Skeleton class="h-24 w-full" />
    <Skeleton class="h-48 w-full" />
  </div>
  <div v-else-if="error || !data" class="card max-w-5xl">
    <EmptyState :title="t('errors.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else class="max-w-5xl space-y-5">
    <div class="card grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-4" data-testid="myblock-info">
      <div>
        <p class="text-fg-muted">{{ t('examBlocks.subject') }}</p>
        <p class="text-fg">{{ data.block.subjectName }}</p>
      </div>
      <div>
        <p class="text-fg-muted">{{ t('examTasks.progress') }}</p>
        <p data-testid="myblock-progress">
          <BaseBadge :tone="progressTone">
            {{ data.block.count }}/{{ data.block.targetCount }}
          </BaseBadge>
        </p>
      </div>
      <div>
        <p class="text-fg-muted">{{ t('examBlocks.contribDeadline') }}</p>
        <p class="text-fg" data-testid="myblock-deadline">
          {{ data.exam.contribDeadline ? fmtDateTime(data.exam.contribDeadline) : '—' }}
          <span v-if="leftText" class="text-fg-muted" data-testid="myblock-left">
            ({{ leftText }})
          </span>
        </p>
      </div>
      <div>
        <p class="text-fg-muted">{{ t('examTasks.statusLabel') }}</p>
        <p data-testid="myblock-status">
          <BaseBadge
            :tone="
              status === 'collecting' ? 'warning' : status === 'readonly' ? 'neutral' : 'success'
            "
          >
            {{ t(`examTasks.status.${status}`) }}
          </BaseBadge>
        </p>
      </div>
    </div>

    <p
      v-if="data.block.locked"
      class="rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning"
      data-testid="myblock-locked"
    >
      {{ lockText }}
    </p>

    <div
      v-if="data.block.canMarkReady"
      class="flex flex-wrap items-center gap-3"
      data-testid="myblock-ready-box"
    >
      <BaseButton
        :variant="isReady ? 'secondary' : 'primary'"
        :loading="busy"
        data-testid="myblock-ready"
        @click="toggleReady"
      >
        {{
          isComposer
            ? isReady
              ? t('examBlocks.myBlock.composerUnapprove')
              : t('examBlocks.myBlock.composerApprove')
            : isReady
              ? t('examBlocks.myBlock.undoReady')
              : t('examBlocks.myBlock.markReady')
        }}
      </BaseButton>
      <BaseBadge v-if="isReady" tone="success" data-testid="myblock-ready-badge">
        {{ isComposer ? t('examFlow.blockState.approved') : t('examBlocks.ready') }}
      </BaseBadge>
    </div>
    <section v-if="!data.block.locked" class="card space-y-4 p-4" data-testid="myblock-actions">
      <div
        role="tablist"
        class="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-muted p-0.5"
        data-testid="myblock-tabs"
      >
        <button
          v-for="tb in TABS"
          :key="tb.key"
          type="button"
          role="tab"
          :aria-selected="tab === tb.key"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          :class="tab === tb.key ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'"
          :data-testid="`tab-${tb.key}`"
          @click="tab = tb.key"
        >
          <component :is="tb.icon" class="h-4 w-4" aria-hidden="true" />
          {{ t(`examTasks.tabs.${tb.key}`) }}
        </button>
      </div>

      <PasteQuestions
        v-if="tab === 'paste'"
        mode="block"
        :session-id="sessionId"
        :block-id="blockId"
        :topics="taskTopics"
        :exam-title="data.exam.title"
        @committed="onPasted"
      />
      <OcrQuestions
        v-else-if="tab === 'ocr'"
        mode="block"
        :session-id="sessionId"
        :block-id="blockId"
        :topics="taskTopics"
        :exam-title="data.exam.title"
        @committed="onPasted"
      />
      <div v-else class="space-y-3" :data-testid="`tab-panel-${tab}`">
        <p class="text-sm text-fg-muted">{{ t(`examTasks.tabHelp.${tab}`) }}</p>
        <BaseButton
          v-if="tab === 'word'"
          variant="secondary"
          data-testid="myblock-import-word"
          @click="importInto('word')"
        >
          <FileText class="h-4 w-4" aria-hidden="true" /> {{ t('examTasks.chooseWord') }}
        </BaseButton>
        <BaseButton
          v-else-if="tab === 'excel'"
          variant="secondary"
          data-testid="myblock-import-excel"
          @click="importInto('excel')"
        >
          <FileSpreadsheet class="h-4 w-4" aria-hidden="true" /> {{ t('examTasks.chooseExcel') }}
        </BaseButton>
        <BaseButton
          v-else-if="tab === 'bank'"
          variant="secondary"
          :loading="busy"
          data-testid="myblock-pick"
          @click="openPicker"
        >
          <Library class="h-4 w-4" aria-hidden="true" /> {{ t('examTasks.pickBank') }}
        </BaseButton>
        <BaseButton
          v-if="tab === 'bank'"
          variant="secondary"
          data-testid="myblock-random"
          @click="openRandom"
        >
          <Shuffle class="h-4 w-4" aria-hidden="true" /> {{ t('randomPick.open') }}
        </BaseButton>
        <BaseButton v-else variant="secondary" data-testid="myblock-write" @click="writeNew">
          <PenLine class="h-4 w-4" aria-hidden="true" /> {{ t('examTasks.writeOne') }}
        </BaseButton>
      </div>
    </section>

    <section class="card p-4" data-testid="myblock-questions">
      <h2 class="mb-3 text-sm font-semibold text-fg">
        {{ t('examTasks.questionsTitle', { n: data.questions.length }) }}
      </h2>
      <p v-if="data.questions.length === 0" class="text-sm text-fg-muted">
        {{ t('examBlocks.myBlock.empty') }}
      </p>
      <ul v-else class="divide-y divide-border text-sm">
        <li
          v-for="(q, i) in data.questions"
          :key="q.id"
          class="flex items-center gap-3 py-2"
          :data-testid="`myblock-q-${i}`"
        >
          <span class="w-6 text-fg-muted">{{ i + 1 }}</span>
          <span class="min-w-0 flex-1 truncate text-fg">
            {{ q.missing ? t('examBlocks.myBlock.missing') : q.preview || '—' }}
          </span>
          <span v-if="q.type" class="text-xs text-fg-muted">{{ t(`exams.types.${q.type}`) }}</span>
          <span class="hidden text-xs text-fg-muted sm:inline">
            {{ q.source === 'composer' ? t('examBlocks.myBlock.byComposer') : q.addedByName }}
          </span>
          <BaseButton
            v-if="q.canRemove"
            variant="ghost"
            size="sm"
            :aria-label="t('examBlocks.removeQuestion')"
            :data-testid="`myblock-remove-${i}`"
            @click="removeQ(q.id)"
          >
            <Trash2 class="h-4 w-4" aria-hidden="true" />
          </BaseButton>
        </li>
      </ul>
      <ul
        v-if="data.rules.length"
        class="mt-3 space-y-2 border-t border-border pt-3 text-sm text-fg-muted"
        data-testid="myblock-rules"
      >
        <li
          v-for="(r, i) in data.rules"
          :key="r.ruleId ?? `w${i}`"
          class="flex flex-wrap items-center gap-2"
          :data-testid="`myblock-rule-${i}`"
        >
          <span class="min-w-0 flex-1 break-words text-fg" data-testid="rule-text">
            {{ ruleLabel(t, r) }}
          </span>
          <span v-if="r.poolSize !== undefined" class="text-xs" data-testid="rule-pool">
            {{ t('examBlocks.myBlock.randomRulePool', { n: r.poolSize }) }}
          </span>
          <template v-if="r.ruleId && r.canRemove">
            <template v-if="editRule?.id === r.ruleId">
              <input
                v-model="editRule.count"
                type="number"
                min="1"
                max="200"
                class="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-fg"
                :aria-label="t('examBlocks.myBlock.ruleCount')"
                data-testid="rule-count-input"
              />
              <BaseButton
                size="sm"
                :loading="busy"
                data-testid="rule-count-save"
                @click="saveRuleCount"
              >
                {{ t('examBlocks.myBlock.ruleSave') }}
              </BaseButton>
            </template>
            <BaseButton
              v-else
              variant="ghost"
              size="sm"
              :aria-label="t('examBlocks.myBlock.ruleEdit')"
              data-testid="rule-edit"
              @click="editRule = { id: r.ruleId, count: String(r.count) }"
            >
              <Pencil class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="sm"
              :aria-label="t('examBlocks.removeQuestion')"
              data-testid="rule-remove"
              @click="removeRule(r.ruleId)"
            >
              <Trash2 class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
          </template>
          <p
            v-if="r.poolSize !== undefined && r.poolSize < r.count"
            class="w-full text-xs text-warning"
            data-testid="rule-warning"
          >
            {{ t('examBlocks.myBlock.ruleNotEnough', { n: r.count, have: r.poolSize }) }}
          </p>
        </li>
      </ul>
    </section>

    <RandomPickModal
      :open="randomOpen"
      :session-id="sessionId"
      :block-id="blockId"
      :topics="taskTopics"
      @close="randomOpen = false"
      @changed="load"
    />
    <QuestionPickerModal
      :open="pickerOpen"
      :topics="topics"
      :selected="[]"
      @close="pickerOpen = false"
      @confirm="onPicked"
    />
  </div>
</template>

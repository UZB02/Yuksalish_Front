<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, FileUp, PenLine, Plus, Trash2 } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { MyBlockDetail } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { fmtDateTime } from '@/utils/examSessions'
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

const sessionId = computed(() => String(route.params.sessionId))
const blockId = computed(() => String(route.params.blockId))
const data = ref<MyBlockDetail | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const pickerOpen = ref(false)
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
  data.value?.block.lockReason ? t(`examBlocks.myBlock.lock.${data.value.block.lockReason}`) : '',
)

async function openPicker() {
  await loadTopics().catch(() => undefined)
  pickerOpen.value = true
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
const query = () => ({ blockSession: sessionId.value, block: blockId.value })
const writeNew = () => void router.push({ name: 'exam-question-create', query: query() })
const importInto = () => void router.push({ name: 'exam-question-import', query: query() })
</script>

<template>
  <header class="mb-6 flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
    <RouterLink
      :to="{ name: 'exam-sessions' }"
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('examBlocks.myBlock.back') }}
    </RouterLink>
    <div v-if="data" class="min-w-0">
      <h1 class="truncate text-xl font-semibold text-fg sm:text-2xl" data-testid="myblock-title">
        {{ data.block.subjectName ?? data.block.title }}
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
    <div class="card grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-3">
      <div>
        <p class="text-fg-muted">{{ t('examBlocks.subject') }}</p>
        <p class="text-fg">{{ data.block.subjectName }}</p>
      </div>
      <div>
        <p class="text-fg-muted">{{ t('examBlocks.myBlock.progress') }}</p>
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

    <div v-else class="flex flex-wrap gap-2" data-testid="myblock-actions">
      <BaseButton
        variant="secondary"
        :loading="busy"
        data-testid="myblock-pick"
        @click="openPicker"
      >
        <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('examBlocks.myBlock.pick') }}
      </BaseButton>
      <BaseButton variant="secondary" data-testid="myblock-write" @click="writeNew">
        <PenLine class="h-4 w-4" aria-hidden="true" /> {{ t('examBlocks.myBlock.write') }}
      </BaseButton>
      <BaseButton variant="secondary" data-testid="myblock-import" @click="importInto">
        <FileUp class="h-4 w-4" aria-hidden="true" /> {{ t('examBlocks.myBlock.import') }}
      </BaseButton>
    </div>

    <section class="card p-4" data-testid="myblock-questions">
      <h2 class="mb-3 text-sm font-semibold text-fg">
        {{ t('examBlocks.myBlock.questions', { n: data.questions.length }) }}
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
        class="mt-3 space-y-1 border-t border-border pt-3 text-sm text-fg-muted"
      >
        <li v-for="(r, i) in data.rules" :key="i">
          {{ t('examBlocks.myBlock.rule', { topic: r.topicName ?? '—', n: r.count }) }}
        </li>
      </ul>
    </section>

    <QuestionPickerModal
      :open="pickerOpen"
      :topics="topics"
      :selected="[]"
      @close="pickerOpen = false"
      @confirm="onPicked"
    />
  </div>
</template>

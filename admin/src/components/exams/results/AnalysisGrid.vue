<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExamAnalysis, ExamAnalysisQuestion } from '@/api/types'
import BlocksView from '@/components/exams/BlocksView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { subjectColor } from './resultsModel'

/** Savollar tahlili: kartalar to'ri (md:2, xl:3), blok bo'yicha chip filtri, to'g'ri javob foizi rangi (70+/40+/past) */
const props = defineProps<{ analysis: ExamAnalysis }>()
const emit = defineEmits<{ gradeEssays: [] }>()
const { t } = useI18n()

const heads = computed(() =>
  (props.analysis.blocks ?? []).map((h, i) => ({
    id: h.id,
    title: h.title || h.subjectName || '',
    color: subjectColor(i),
  })),
)
const multi = computed(() => heads.value.length > 1)
const block = ref('')
watch(
  () => props.analysis,
  () => (block.value = ''),
)
const shown = computed(() =>
  props.analysis.questions.filter((q) => !block.value || q.blockId === block.value),
)
const head = (q: ExamAnalysisQuestion) => heads.value.find((h) => h.id === q.blockId)

const tone = (p: number) => (p >= 70 ? 'bg-success' : p >= 40 ? 'bg-warning' : 'bg-danger')
const flagTone = (f: string) =>
  f === 'too_easy' ? 'info' : f === 'too_hard' ? 'danger' : 'warning'
const letter = (i: number) => String.fromCharCode(65 + (i % 26))
const optText = (o: ExamAnalysisQuestion['options'][number]) =>
  o.content
    .map((b) => (b.type === 'text' ? b.text : b.type === 'math' ? b.tex : ''))
    .join(' ')
    .trim() || o.id
</script>

<template>
  <div data-testid="analysis-grid">
    <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-fg-muted">
      <span>{{ t('examResults.qa.caption', { n: analysis.submittedAttempts }) }}</span>
      <span class="inline-flex items-center gap-1"
        ><i class="h-2 w-2 rounded-full bg-success" />70%+</span
      >
      <span class="inline-flex items-center gap-1"
        ><i class="h-2 w-2 rounded-full bg-warning" />40–69%</span
      >
      <span class="inline-flex items-center gap-1"
        ><i class="h-2 w-2 rounded-full bg-danger" />{{ t('examResults.qa.low') }}</span
      >
      <div
        v-if="multi"
        class="flex flex-wrap gap-1 sm:ml-auto"
        role="group"
        :aria-label="t('examResults.qa.blocks')"
      >
        <button
          type="button"
          class="h-8 rounded-full border px-3 text-xs"
          :class="
            !block
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-border text-fg-muted hover:text-fg'
          "
          :aria-pressed="!block"
          data-testid="qa-chip-all"
          @click="block = ''"
        >
          {{ t('examResults.qa.all') }}
        </button>
        <button
          v-for="h in heads"
          :key="h.id"
          type="button"
          class="h-8 rounded-full border px-3 text-xs"
          :class="
            block === h.id
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-border text-fg-muted hover:text-fg'
          "
          :aria-pressed="block === h.id"
          :data-testid="`qa-chip-${h.id}`"
          @click="block = h.id"
        >
          {{ h.title }}
        </button>
      </div>
    </div>
    <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="q in shown"
        :key="q.id"
        class="card min-w-0 p-3"
        data-testid="analysis-question"
      >
        <div class="mb-2 flex flex-wrap items-center gap-1.5">
          <b class="text-sm">{{ t('examResults.detail.question', { n: q.index }) }}</b>
          <span
            v-if="multi && head(q)"
            class="text-xs"
            :style="{ color: head(q)!.color }"
            data-testid="analysis-block-title"
            >{{ head(q)!.title }}</span
          >
          <span class="flex-1" />
          <BaseBadge v-for="f in q.flags" :key="f" :tone="flagTone(f)" data-testid="q-flag">{{
            t(`examResults.analysis.flags.${f}`)
          }}</BaseBadge>
        </div>
        <div class="mb-2 max-h-16 overflow-hidden text-sm text-fg">
          <BlocksView :blocks="q.content" />
        </div>
        <template v-if="q.type === 'essay'">
          <p class="text-sm" data-testid="q-essay">
            {{ t('examResults.qa.essay') }}
            <template v-if="q.averagePoints !== null">
              · {{ t('examResults.analysis.averagePoints') }}
              <b>{{ q.averagePoints }} / {{ q.points }}</b>
            </template>
          </p>
          <button
            type="button"
            class="mt-2 inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-surface-muted"
            data-testid="qa-grade"
            @click="emit('gradeEssays')"
          >
            {{ t('examResults.qa.toGrading') }}
          </button>
        </template>
        <template v-else>
          <div class="mb-1 flex items-center gap-2">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                class="h-full rounded-full"
                :class="tone(q.correctPercent ?? 0)"
                :style="{ width: Math.min(100, q.correctPercent ?? 0) + '%' }"
              />
            </div>
            <b
              v-if="q.correctPercent !== null"
              class="w-10 text-right text-sm tabular-nums"
              data-testid="q-correct"
              :aria-label="`${t('examResults.analysis.correctPercent')}: ${q.correctPercent}%`"
              >{{ q.correctPercent }}%</b
            >
          </div>
          <p class="mb-2 text-xs text-fg-muted">
            {{ t('examResults.analysis.shown') }}: {{ q.shown }}
            <template v-if="q.averagePoints !== null">
              · {{ t('examResults.analysis.averagePoints') }}: {{ q.averagePoints }} /
              {{ q.points }}
            </template>
          </p>
          <ul v-if="q.options.length" class="space-y-1">
            <li
              v-for="(o, i) in q.options"
              :key="o.id"
              class="flex items-center gap-2 text-xs"
              :title="optText(o)"
              data-testid="q-option"
            >
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded font-semibold"
                :class="o.correct ? 'bg-success text-white' : 'bg-surface-muted text-fg-muted'"
                aria-hidden="true"
                >{{ letter(i) }}</span
              >
              <span class="sr-only">{{ optText(o) }}</span>
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  class="h-full rounded-full"
                  :class="o.correct ? 'bg-success' : 'bg-fg-muted/40'"
                  :style="{ width: Math.min(100, o.percent) + '%' }"
                />
              </div>
              <span class="w-16 text-right tabular-nums text-fg-muted"
                >{{ o.chosen }} ({{ o.percent }}%)</span
              >
            </li>
          </ul>
        </template>
      </article>
    </div>
  </div>
</template>

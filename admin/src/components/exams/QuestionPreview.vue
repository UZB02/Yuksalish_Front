<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { QuestionBlock, QuestionType } from '@/api/types'
import BlocksView from './BlocksView.vue'

/**
 * Savolni o'quvchi ko'rgandek ko'rsatadi. MUHIM: bu komponent javob kalitini umuman qabul qilmaydi
 * (props da `answer`/`correct` yo'q), shuning uchun to'g'ri javob ko'rinib qolishi mumkin emas.
 */
export interface PreviewQuestion {
  type: QuestionType
  content: QuestionBlock[]
  options: { id: string; content: QuestionBlock[] }[]
  points: number
}

const props = defineProps<{ question: PreviewQuestion }>()
const { t } = useI18n()

// Faqat ko'rinish uchun mahalliy tanlov (hech qayerga saqlanmaydi)
const picked = reactive<{ single: string; multi: string[]; text: string }>({
  single: '',
  multi: [],
  text: '',
})
watch(
  () => props.question.type,
  () => {
    picked.single = ''
    picked.multi = []
    picked.text = ''
  },
)
function toggle(id: string) {
  picked.multi = picked.multi.includes(id)
    ? picked.multi.filter((x) => x !== id)
    : [...picked.multi, id]
}
const letter = (i: number) => String.fromCharCode(65 + i)
</script>

<template>
  <article
    class="space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5"
    data-testid="question-preview"
  >
    <header class="flex items-center justify-between gap-2 text-xs text-fg-muted">
      <span>{{ t(`exams.types.${question.type}`) }}</span>
      <span>{{ t('exams.preview.points', { n: question.points }) }}</span>
    </header>

    <BlocksView v-if="question.content.length" :blocks="question.content" />
    <p v-else class="text-sm text-fg-muted">{{ t('exams.preview.empty') }}</p>

    <div v-if="question.type === 'single' || question.type === 'multi'" class="space-y-2">
      <p v-if="question.type === 'multi'" class="text-xs text-fg-muted">
        {{ t('exams.preview.multiHint') }}
      </p>
      <label
        v-for="(o, i) in question.options"
        :key="o.id"
        class="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors"
        :class="
          (question.type === 'single' ? picked.single === o.id : picked.multi.includes(o.id))
            ? 'border-primary-600 bg-primary-50'
            : 'border-border hover:bg-surface-muted'
        "
        data-testid="preview-option"
      >
        <input
          v-if="question.type === 'single'"
          type="radio"
          name="preview-option"
          class="mt-1 h-4 w-4 accent-primary-600"
          :checked="picked.single === o.id"
          @change="picked.single = o.id"
        />
        <input
          v-else
          type="checkbox"
          class="mt-1 h-4 w-4 accent-primary-600"
          :checked="picked.multi.includes(o.id)"
          @change="toggle(o.id)"
        />
        <span class="mt-0.5 text-sm font-semibold text-fg-muted">{{ letter(i) }}</span>
        <span class="min-w-0 flex-1"><BlocksView :blocks="o.content" inline /></span>
      </label>
    </div>

    <input
      v-else-if="question.type === 'short'"
      v-model="picked.text"
      type="text"
      :placeholder="t('exams.preview.shortPlaceholder')"
      :aria-label="t('exams.preview.shortPlaceholder')"
      class="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
      data-testid="preview-short"
    />

    <textarea
      v-else
      v-model="picked.text"
      rows="6"
      :placeholder="t('exams.preview.essayPlaceholder')"
      :aria-label="t('exams.preview.essayPlaceholder')"
      class="block w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
      data-testid="preview-essay"
    />
  </article>
</template>

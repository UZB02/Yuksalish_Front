<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import { QUESTION_LIMITS, addAcceptedAnswer } from '@/utils/examQuestion'

/** Qisqa javob: qabul qilinadigan to'g'ri javoblar (chip). Katta-kichik harf va probellar e'tiborga olinmaydi. */
const props = defineProps<{ modelValue: string[]; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const { t } = useI18n()
const draft = ref('')

function commit() {
  const next = addAcceptedAnswer(props.modelValue, draft.value)
  if (next !== props.modelValue) emit('update:modelValue', next)
  draft.value = ''
}
const remove = (i: number) =>
  emit(
    'update:modelValue',
    props.modelValue.filter((_, idx) => idx !== i),
  )
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ';') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Backspace' && !draft.value && props.modelValue.length) {
    remove(props.modelValue.length - 1)
  }
}
</script>

<template>
  <div data-testid="accepted-answers">
    <ul v-if="modelValue.length" class="mb-2 flex flex-wrap gap-1.5">
      <li
        v-for="(a, i) in modelValue"
        :key="`${i}-${a}`"
        class="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-sm text-primary-700"
        data-testid="accepted-chip"
      >
        <span class="break-all">{{ a }}</span>
        <button
          type="button"
          class="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary-600/20"
          :aria-label="t('exams.short.remove', { value: a })"
          @click="remove(i)"
        >
          <X class="h-3 w-3" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <div class="flex gap-2">
      <input
        v-model="draft"
        type="text"
        :maxlength="QUESTION_LIMITS.acceptedAnswerChars"
        :placeholder="t('exams.short.placeholder')"
        :aria-label="t('exams.short.label')"
        :disabled="modelValue.length >= QUESTION_LIMITS.acceptedAnswers"
        class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 disabled:opacity-60"
        data-testid="accepted-input"
        @keydown="onKey"
        @blur="commit"
      />
      <button
        type="button"
        class="shrink-0 rounded-lg border border-border px-3 text-sm text-fg hover:bg-surface-muted disabled:opacity-50"
        :disabled="!draft.trim()"
        data-testid="accepted-add"
        @click="commit"
      >
        {{ t('exams.short.add') }}
      </button>
    </div>
    <p class="mt-1.5 text-xs text-fg-muted">
      {{ t('exams.short.hint', { n: QUESTION_LIMITS.acceptedAnswers }) }}
    </p>
    <p v-if="error" class="mt-1 text-xs text-danger" role="alert" data-testid="answer-error">
      {{ error }}
    </p>
  </div>
</template>

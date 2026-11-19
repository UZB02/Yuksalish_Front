<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, ImagePlus, Plus, Sigma, Trash2, Type } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { QuestionBlock } from '@/api/types'
import { useToast } from '@/composables/useToast'
import {
  QUESTION_LIMITS,
  addBlock,
  emptyBlock,
  moveBlock,
  removeBlock,
  updateBlock,
} from '@/utils/examQuestion'
import { errorMessage } from '@/utils/errors'
import ExamImage from './ExamImage.vue'
import MathView from './MathView.vue'

const props = withDefaults(
  defineProps<{
    modelValue: QuestionBlock[]
    max?: number
    /** Variant ichidagi ixcham ko'rinish */
    compact?: boolean
    error?: string
    label?: string
  }>(),
  { max: QUESTION_LIMITS.blocks },
)
const emit = defineEmits<{ 'update:modelValue': [value: QuestionBlock[]] }>()

const { t } = useI18n()
const toast = useToast()
const uploading = ref<number | null>(null)
const MAX_BYTES = 5 * 1024 * 1024

const set = (next: QuestionBlock[]) => emit('update:modelValue', next)
const menuOpen = ref(false)
const add = (type: QuestionBlock['type']) => {
  set(addBlock(props.modelValue, emptyBlock(type), props.max))
  menuOpen.value = false
}

const typeLabel = (b: QuestionBlock) => t(`exams.blocks.${b.type}`)

async function onFile(index: number, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toast.error(t('exams.image.badType'))
    return
  }
  if (file.size > MAX_BYTES) {
    toast.error(t('exams.image.tooBig'))
    return
  }
  uploading.value = index
  try {
    const asset = await examsApi.uploadAsset(file)
    set(updateBlock(props.modelValue, index, { assetId: asset.id }))
  } catch (err) {
    toast.error(errorMessage(err, t))
  } finally {
    uploading.value = null
  }
}
</script>

<template>
  <div :class="compact ? 'flex items-start gap-1.5' : 'space-y-3'" data-testid="block-editor">
    <p v-if="label" class="text-sm font-medium text-fg">{{ label }}</p>

    <div :class="compact ? 'min-w-0 flex-1 space-y-2' : 'space-y-3'">
      <div
        v-for="(b, i) in modelValue"
        :key="i"
        class="rounded-lg border border-border bg-surface"
        :class="compact ? 'p-2' : 'p-3'"
        data-testid="block-item"
      >
        <div
          v-if="!compact || modelValue.length > 1 || b.type !== 'text'"
          class="mb-2 flex items-center justify-between gap-2"
        >
          <span class="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {{ typeLabel(b) }}
          </span>
          <div class="flex items-center gap-0.5">
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg disabled:opacity-40"
              :disabled="i === 0"
              :aria-label="t('exams.blocks.up')"
              data-testid="block-up"
              @click="set(moveBlock(modelValue, i, -1))"
            >
              <ArrowUp class="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg disabled:opacity-40"
              :disabled="i === modelValue.length - 1"
              :aria-label="t('exams.blocks.down')"
              data-testid="block-down"
              @click="set(moveBlock(modelValue, i, 1))"
            >
              <ArrowDown class="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-danger hover:bg-danger-soft"
              :aria-label="t('exams.blocks.remove')"
              data-testid="block-remove"
              @click="set(removeBlock(modelValue, i))"
            >
              <Trash2 class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <textarea
          v-if="b.type === 'text'"
          :value="b.text"
          :rows="compact ? 1 : 3"
          :maxlength="QUESTION_LIMITS.textChars"
          :placeholder="t('exams.blocks.textPlaceholder')"
          :aria-label="t('exams.blocks.text')"
          class="block w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          data-testid="block-text"
          @input="
            set(updateBlock(modelValue, i, { text: ($event.target as HTMLTextAreaElement).value }))
          "
        />

        <div v-else-if="b.type === 'math'" class="space-y-2">
          <input
            :value="b.tex"
            type="text"
            spellcheck="false"
            autocomplete="off"
            :maxlength="QUESTION_LIMITS.texChars"
            :placeholder="t('exams.blocks.mathPlaceholder')"
            :aria-label="t('exams.blocks.math')"
            class="block w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            data-testid="block-math"
            @input="
              set(updateBlock(modelValue, i, { tex: ($event.target as HTMLInputElement).value }))
            "
          />
          <div
            class="min-h-10 rounded-lg bg-surface-muted px-3 py-2"
            :aria-label="t('exams.blocks.mathPreview')"
            data-testid="block-math-preview"
          >
            <MathView v-if="b.tex.trim()" :tex="b.tex" />
            <span v-else class="text-xs text-fg-muted">{{ t('exams.blocks.mathEmpty') }}</span>
          </div>
        </div>

        <div v-else class="space-y-2">
          <ExamImage v-if="b.assetId" :asset-id="b.assetId" />
          <label
            class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-fg hover:bg-surface-muted"
            :class="uploading === i ? 'pointer-events-none opacity-60' : ''"
          >
            <ImagePlus class="h-4 w-4" aria-hidden="true" />
            {{
              uploading === i
                ? t('exams.image.uploading')
                : b.assetId
                  ? t('exams.image.replace')
                  : t('exams.image.choose')
            }}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              data-testid="block-file"
              @change="onFile(i, $event)"
            />
          </label>
          <p class="text-xs text-fg-muted">{{ t('exams.image.hint') }}</p>
        </div>
      </div>
    </div>

    <div class="relative inline-block" data-testid="add-menu-wrap">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-fg-muted hover:border-primary-600 hover:text-primary-700 disabled:opacity-50"
        :disabled="modelValue.length >= max"
        :aria-expanded="menuOpen"
        :aria-label="t('exams.blocks.add')"
        data-testid="add-menu"
        @click="menuOpen = !menuOpen"
      >
        <Plus class="h-3.5 w-3.5" aria-hidden="true" />
        <template v-if="!compact">{{ t('exams.blocks.addShort') }}</template>
      </button>
      <div
        v-if="menuOpen"
        class="absolute left-0 z-10 mt-1 flex min-w-36 flex-col rounded-lg border border-border bg-surface p-1 shadow-lg"
        role="menu"
        :aria-label="t('exams.blocks.add')"
      >
        <button
          type="button"
          role="menuitem"
          class="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-fg hover:bg-surface-muted"
          data-testid="add-text"
          @click="add('text')"
        >
          <Type class="h-4 w-4" aria-hidden="true" /> {{ t('exams.blocks.addText') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-fg hover:bg-surface-muted"
          data-testid="add-math"
          @click="add('math')"
        >
          <Sigma class="h-4 w-4" aria-hidden="true" /> {{ t('exams.blocks.addMath') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-fg hover:bg-surface-muted"
          data-testid="add-image"
          @click="add('image')"
        >
          <ImagePlus class="h-4 w-4" aria-hidden="true" /> {{ t('exams.blocks.addImage') }}
        </button>
      </div>
    </div>
    <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>
  </div>
</template>

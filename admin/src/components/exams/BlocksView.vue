<script setup lang="ts">
import type { QuestionBlock } from '@/api/types'
import ExamImage from './ExamImage.vue'
import MathView from './MathView.vue'

/**
 * Blok-kontentni xavfsiz ko'rsatish: matn faqat interpolatsiya ({{ }}), formula KaTeX, rasm blob.
 * HTML hech qachon talqin qilinmaydi.
 */
defineProps<{ blocks: QuestionBlock[]; inline?: boolean }>()
</script>

<template>
  <div class="space-y-2" :class="inline ? 'text-sm' : 'text-base'">
    <template v-for="(b, i) in blocks" :key="i">
      <p v-if="b.type === 'text'" class="whitespace-pre-wrap break-words text-fg">{{ b.text }}</p>
      <MathView v-else-if="b.type === 'math'" :tex="b.tex" :display="!inline" />
      <ExamImage v-else-if="b.type === 'image'" :asset-id="b.assetId" />
    </template>
  </div>
</template>

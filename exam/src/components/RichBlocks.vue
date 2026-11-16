<script setup lang="ts">
import type { Block } from '../lib/types'
import AssetImage from './AssetImage.vue'
import KatexSpan from './KatexSpan.vue'

/** Kontent bloklari: matn (oddiy matn, HTML emas), formula, rasm. v-html ishlatilmaydi. */
defineProps<{ blocks: Block[]; inline?: boolean }>()
</script>

<template>
  <div :class="inline ? 'inline' : 'space-y-2'">
    <template v-for="(b, i) in blocks" :key="i">
      <p v-if="b.type === 'text'" class="whitespace-pre-wrap break-words">{{ b.text }}</p>
      <div v-else-if="b.type === 'math'" class="overflow-x-auto py-1">
        <KatexSpan :tex="b.tex" display />
      </div>
      <AssetImage v-else :asset-id="b.assetId" />
    </template>
  </div>
</template>

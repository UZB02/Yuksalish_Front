<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../inject'
import type { FileBlockView } from '../lib/types'

/**
 * Qog'oz yetkazish: o'quvchi qog'ozida bosilgan variantni tanlaydi. Tasdiqdan keyin server qulflaydi (o'quvchi
 * o'zgartira olmaydi; xato bo'lsa nazoratchi/tuzuvchi tuzatadi). Tanlanmaguncha blok savollari ko'rinmaydi.
 */
const props = defineProps<{ block: FileBlockView; title: string }>()
const store = useStore()
const picked = ref<string | null>(null)
const confirming = ref(false)

async function confirmPick() {
  if (!picked.value) return
  confirming.value = false
  await store.chooseVariant(props.block.blockId, picked.value)
}
</script>

<template>
  <section class="card space-y-4" data-testid="variant-picker">
    <div>
      <h2 class="text-xl font-bold">Qog‘ozingizdagi variantni tanlang</h2>
      <p v-if="title" class="text-fg-soft" data-testid="variant-picker-title">{{ title }}</p>
      <p class="mt-1 text-sm text-fg-soft">
        Test qog‘ozda berilgan. Qog‘ozingizning tepasida yozilgan variant harfini tanlang. Tanlovni
        tasdiqlagandan keyin o‘zgartirib bo‘lmaydi.
      </p>
    </div>
    <div class="flex flex-wrap gap-3" role="radiogroup" aria-label="Variant">
      <button
        v-for="v in block.variants"
        :key="v"
        type="button"
        role="radio"
        :aria-checked="picked === v"
        class="flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl font-extrabold"
        :class="picked === v ? 'border-brand bg-brand text-brand-fg' : 'border-line bg-surface'"
        :data-testid="`variant-${v}`"
        @click="picked = v"
      >
        {{ v }}
      </button>
    </div>
    <button
      class="btn-primary w-full sm:w-auto"
      type="button"
      :disabled="!picked || store.state.busy"
      data-testid="variant-continue"
      @click="confirming = true"
    >
      Davom etish
    </button>

    <div
      v-if="confirming"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      data-testid="variant-dialog"
    >
      <div class="card w-full max-w-md space-y-4">
        <h3 class="text-xl font-bold">“{{ picked }}” variantini tasdiqlaysizmi?</h3>
        <p class="text-sm text-fg-soft">
          Qog‘ozingizdagi variant aynan shumi? Tasdiqlagandan keyin o‘zgartirib bo‘lmaydi. Xato
          bo‘lsa nazoratchiga murojaat qiling.
        </p>
        <div class="flex gap-2">
          <button
            class="btn-ghost flex-1"
            type="button"
            data-testid="variant-back"
            @click="confirming = false"
          >
            Qaytish
          </button>
          <button
            class="btn-primary flex-1"
            type="button"
            data-testid="variant-confirm"
            @click="confirmPick"
          >
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

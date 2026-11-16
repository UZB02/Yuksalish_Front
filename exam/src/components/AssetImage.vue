<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useStore } from '../inject'

/** Rasm token bilan yuklanadi (<img src> Authorization yubora olmaydi); blob URL xotirada keshlanadi */
const props = defineProps<{ assetId: string }>()
const store = useStore()
const src = ref('')
const failed = ref(false)

const cache = new Map<string, Promise<string>>()

async function load() {
  failed.value = false
  try {
    let p = cache.get(props.assetId)
    if (!p) {
      p = store.fetchAsset(props.assetId).then((b) => URL.createObjectURL(b))
      cache.set(props.assetId, p)
      p.catch(() => cache.delete(props.assetId))
    }
    src.value = await p
  } catch {
    failed.value = true
  }
}
onMounted(load)
onBeforeUnmount(() => {
  /* blob URL keshda qoladi (savollar orasida yurishda qayta yuklamaslik uchun) */
})
</script>

<template>
  <img
    v-if="src"
    :src="src"
    alt="Savol rasmi"
    class="my-2 max-h-80 max-w-full rounded-lg border border-line object-contain"
    draggable="false"
  />
  <button v-else-if="failed" class="btn-ghost my-2" type="button" @click="load">
    Rasm yuklanmadi. Qayta urinish
  </button>
  <div v-else class="my-2 h-24 animate-pulse rounded-lg bg-muted" />
</template>

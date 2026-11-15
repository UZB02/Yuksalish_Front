<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImageOff } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import Skeleton from '@/components/ui/Skeleton.vue'

/** Savol rasmi: autentifikatsiyali so'rov bilan olinadi (blob), <img src> to'g'ridan-to'g'ri emas */
const props = defineProps<{ assetId: string }>()
const { t } = useI18n()

const url = ref('')
const failed = ref(false)
const loading = ref(false)
let seq = 0

function revoke() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}

async function load() {
  const my = ++seq
  revoke()
  failed.value = false
  if (!props.assetId) return
  loading.value = true
  try {
    const blob = await examsApi.fetchAssetBlob(props.assetId)
    if (my !== seq) return
    url.value = URL.createObjectURL(blob)
  } catch {
    if (my === seq) failed.value = true
  } finally {
    if (my === seq) loading.value = false
  }
}

watch(() => props.assetId, load, { immediate: true })
onBeforeUnmount(() => {
  seq++
  revoke()
})
</script>

<template>
  <Skeleton v-if="loading" class="h-32 w-full max-w-sm" />
  <div
    v-else-if="failed"
    class="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-fg-muted"
    data-testid="exam-image-error"
  >
    <ImageOff class="h-4 w-4" aria-hidden="true" /> {{ t('exams.image.failed') }}
  </div>
  <img
    v-else-if="url"
    :src="url"
    :alt="t('exams.image.alt')"
    class="max-h-80 max-w-full rounded-lg border border-border object-contain"
    loading="lazy"
    data-testid="exam-image"
  />
</template>

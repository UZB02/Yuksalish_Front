<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { initials } from '@/utils/format'
import { resolvePhotoUrl } from '@/utils/photo'

const props = withDefaults(
  defineProps<{
    /** To'liq ism: rasm bo'lmasa bosh harflar, alt matni uchun */
    name: string
    /** Backend `photo` havolasi (yoki to'liq URL); yo'q bo'lsa bosh harflar */
    src?: string | null
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Berilmasa ism ishlatiladi; ro'yxat qatorlarida ism yonida bo'lsa '' (dekorativ) bering */
    alt?: string
  }>(),
  { size: 'md', src: null, alt: undefined },
)

const SIZES = {
  sm: { box: 'h-7 w-7 text-[10px]', px: 28 },
  md: { box: 'h-9 w-9 text-xs', px: 36 },
  lg: { box: 'h-11 w-11 text-sm', px: 44 },
  xl: { box: 'h-20 w-20 text-xl', px: 80 },
} as const

const url = computed(() => resolvePhotoUrl(props.src))
const failed = ref(false)
watch(url, () => (failed.value = false))
const px = computed(() => SIZES[props.size].px)
</script>

<template>
  <span
    class="inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-100 font-semibold text-primary-700"
    :class="SIZES[size].box"
    data-testid="avatar"
  >
    <!-- Qat'iy o'lcham: layout siljimaydi; lazy: uzun ro'yxatlarda ko'rinmaganlari yuklanmaydi -->
    <img
      v-if="url && !failed"
      :src="url"
      :alt="alt ?? name"
      :width="px"
      :height="px"
      loading="lazy"
      decoding="async"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <span v-else aria-hidden="true">{{ initials(name) }}</span>
  </span>
</template>

<script setup lang="ts">
import { DEFAULT_BRAND_MARK } from '@/constants/brand'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useEventListener } from '@vueuse/core'
import { WifiOff } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const retrying = ref(false)

function target() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  // Faqat ichki yo'llarga (open redirect'dan himoya)
  return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
}

async function retry() {
  if (retrying.value) return
  retrying.value = true
  try {
    await auth.retryInit()
    if (!auth.networkError) await router.replace(target())
  } finally {
    retrying.value = false
  }
}

// Internet qaytganda o'zi qayta uriniladi
useEventListener(window, 'online', () => void retry())
onMounted(() => {
  if (!auth.networkError) void router.replace(target())
})
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center gap-2 px-4">
    <img :src="DEFAULT_BRAND_MARK" alt="" class="h-14 w-14 object-contain" />
    <EmptyState
      :icon="WifiOff"
      :title="t('pwa.offline.title')"
      :description="t('pwa.offline.text')"
    >
      <BaseButton :loading="retrying" @click="retry">{{ t('pwa.offline.retry') }}</BaseButton>
    </EmptyState>
  </div>
</template>

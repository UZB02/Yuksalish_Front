<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import QRCode from 'qrcode'
import { useI18n } from 'vue-i18n'
import { telegramApi } from '@/api/telegram.api'
import type { TelegramLinkInfo } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import Spinner from '@/components/ui/Spinner.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; linked: [] }>()

const { t } = useI18n()
const toast = useToast()

const link = ref<TelegramLinkInfo | null>(null)
const qr = ref('')
const loading = ref(false)
const now = ref(Date.now())

const remainingMs = computed(() =>
  link.value ? Math.max(0, new Date(link.value.expiresAt).getTime() - now.value) : 0,
)
const expired = computed(() => !!link.value && remainingMs.value <= 0)
const countdown = computed(() => {
  const s = Math.ceil(remainingMs.value / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

let tick: ReturnType<typeof setInterval> | null = null
let poll: ReturnType<typeof setInterval> | null = null
let polling = false

function stop() {
  if (tick) clearInterval(tick)
  if (poll) clearInterval(poll)
  tick = poll = null
}

async function checkLinked() {
  if (polling) return
  polling = true
  try {
    const me = await telegramApi.me()
    if (me.linked && props.open) {
      stop()
      toast.success(t('telegram.card.linkedToast'))
      emit('linked')
    }
  } catch {
    // vaqtinchalik tarmoq xatosi: keyingi so'rovda qayta uriniladi
  } finally {
    polling = false
  }
}

async function makeQr(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

async function createLink() {
  loading.value = true
  try {
    const info = await telegramApi.createLink()
    qr.value = await makeQr(info.url)
    link.value = info
    now.value = Date.now()
  } catch (e) {
    toast.error(errorMessage(e, t))
    emit('close')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    stop()
    if (!isOpen) {
      link.value = null
      qr.value = ''
      return
    }
    tick = setInterval(() => (now.value = Date.now()), 1000)
    poll = setInterval(checkLinked, 3000)
    void createLink()
  },
  { immediate: true },
)
onBeforeUnmount(stop)
</script>

<template>
  <BaseModal :open="open" :title="t('telegram.modal.title')" size="sm" @close="emit('close')">
    <div class="flex flex-col items-center gap-4 text-center" data-testid="telegram-link-modal">
      <Spinner v-if="loading && !link" />
      <template v-else-if="link">
        <p class="text-sm text-fg-muted">{{ t('telegram.modal.hint') }}</p>
        <a
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 text-base font-semibold text-white transition-colors hover:bg-primary-700 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          :aria-disabled="expired"
          data-testid="telegram-open"
        >
          <ExternalLink class="h-5 w-5" />
          {{ t('telegram.modal.open') }}
        </a>
        <div class="rounded-xl bg-white p-2" :class="expired ? 'opacity-30' : ''">
          <img
            v-if="qr"
            :src="qr"
            :alt="t('telegram.modal.qrAlt')"
            class="h-48 w-48"
            data-testid="telegram-qr"
          />
        </div>
        <p v-if="!expired" class="text-sm text-fg-muted" data-testid="telegram-countdown">
          {{ t('telegram.modal.expiresIn', { time: countdown }) }}
        </p>
        <div v-else class="space-y-2" data-testid="telegram-expired">
          <p class="text-sm text-danger">{{ t('telegram.modal.expired') }}</p>
          <BaseButton :loading="loading" data-testid="telegram-renew" @click="createLink">
            {{ t('telegram.modal.renew') }}
          </BaseButton>
        </div>
        <p v-if="!expired" class="flex items-center gap-2 text-xs text-fg-muted">
          <Spinner class="h-3 w-3" /> {{ t('telegram.modal.waiting') }}
        </p>
      </template>
    </div>
  </BaseModal>
</template>

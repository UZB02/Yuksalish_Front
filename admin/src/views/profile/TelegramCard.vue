<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { telegramApi } from '@/api/telegram.api'
import type { TelegramMe } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'
import TelegramLinkModal from './TelegramLinkModal.vue'

const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()

const me = ref<TelegramMe | null>(null)
const loading = ref(true)
const modalOpen = ref(false)
const unlinking = ref(false)

async function load() {
  try {
    me.value = await telegramApi.me()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function onLinked() {
  modalOpen.value = false
  await load()
}

async function unlink() {
  const ok = await confirm({
    title: t('telegram.card.unlinkTitle'),
    message: t('telegram.card.unlinkMessage'),
    confirmText: t('telegram.card.unlink'),
    variant: 'danger',
  })
  if (!ok) return
  unlinking.value = true
  try {
    me.value = await telegramApi.unlink()
    toast.success(t('telegram.card.unlinkDone'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    unlinking.value = false
  }
}
</script>

<template>
  <section class="card p-6" :aria-label="t('telegram.title')" data-testid="telegram-card">
    <h2 class="mb-4 text-base font-semibold text-fg">{{ t('telegram.title') }}</h2>
    <Skeleton v-if="loading" class="h-10 w-full" />
    <template v-else-if="me">
      <div v-if="!me.available" class="space-y-2 text-sm text-fg-muted" data-testid="telegram-na">
        <p>{{ t('telegram.card.unavailable') }}</p>
        <RouterLink
          v-if="auth.isSuperadmin"
          :to="{ name: 'settings', query: { tab: 'telegram' } }"
          class="font-medium text-primary-700 hover:underline"
          data-testid="telegram-settings-link"
        >
          {{ t('telegram.card.goSettings') }}
        </RouterLink>
      </div>
      <div
        v-else-if="me.linked"
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="telegram-linked"
      >
        <p class="break-words text-sm text-fg">
          <template v-if="me.username">
            {{ t('telegram.card.linked', { username: `@${me.username}` }) }}
          </template>
          <template v-else>{{ t('telegram.card.linkedNoName') }}</template>
          <template v-if="me.linkedAt"> · {{ formatDateTime(me.linkedAt) }}</template>
        </p>
        <BaseButton
          variant="secondary"
          :loading="unlinking"
          data-testid="telegram-unlink"
          @click="unlink"
        >
          {{ t('telegram.card.unlink') }}
        </BaseButton>
      </div>
      <div v-else class="space-y-3">
        <p class="text-sm text-fg-muted">{{ t('telegram.card.description') }}</p>
        <BaseButton class="w-full sm:w-auto" data-testid="telegram-link" @click="modalOpen = true">
          {{ t('telegram.card.link') }}
        </BaseButton>
      </div>
    </template>
    <TelegramLinkModal :open="modalOpen" @close="modalOpen = false" @linked="onLinked" />
  </section>
</template>

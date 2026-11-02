<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { telegramApi } from '@/api/telegram.api'
import type { TelegramConfig } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import SettingRow from './SettingRow.vue'

const { t, tm, rt } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const config = ref<TelegramConfig | null>(null)
const loading = ref(true)
const token = ref('')
const tokenError = ref('')
const saving = ref(false)
const toggling = ref(false)
const deleting = ref(false)

const statusTone = computed(() => {
  const s = config.value?.status
  return s === 'running' ? 'success' : s === 'error' ? 'danger' : 'neutral'
})
const statusLabel = computed(() => {
  if (!config.value?.configured) return t('telegram.settings.notConfigured')
  return t(`telegram.settings.${config.value.status}`)
})
const placeholder = computed(() =>
  config.value?.tokenLast4 ? `••••••${config.value.tokenLast4}` : '123456789:AA...',
)
const guide = computed(() =>
  (tm('telegram.settings.guide') as unknown[]).map((m) => rt(m as never)),
)

async function load() {
  try {
    config.value = await telegramApi.getConfig()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function save() {
  tokenError.value = ''
  const value = token.value.trim()
  if (!value) {
    tokenError.value = t('telegram.settings.tokenRequired')
    return
  }
  saving.value = true
  try {
    config.value = await telegramApi.updateConfig({ token: value })
    token.value = ''
    toast.success(t('telegram.settings.connected', { username: `@${config.value.botUsername}` }))
  } catch (e) {
    const setErrors = (m: Record<string, string>) => (tokenError.value = m.token ?? '')
    if (!applyServerErrors(e, setErrors, ['token'])) toast.error(errorMessage(e, t))
  } finally {
    saving.value = false
  }
}

async function toggle(enabled: boolean) {
  toggling.value = true
  try {
    config.value = await telegramApi.updateConfig({ enabled })
    toast.success(t(enabled ? 'telegram.settings.enabledOn' : 'telegram.settings.enabledOff'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    toggling.value = false
  }
}

async function remove() {
  const ok = await confirm({
    title: t('telegram.settings.deleteTitle'),
    message: t('telegram.settings.deleteMessage'),
    confirmText: t('telegram.settings.delete'),
    variant: 'danger',
  })
  if (!ok) return
  deleting.value = true
  try {
    config.value = await telegramApi.deleteConfig()
    token.value = ''
    tokenError.value = ''
    toast.success(t('telegram.settings.deleted'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div data-testid="telegram-connection">
    <div v-if="loading" class="divide-y divide-border" aria-busy="true">
      <div v-for="n in 2" :key="n" class="flex items-center justify-between gap-6 py-4">
        <Skeleton class="h-4 w-1/3" />
        <Skeleton class="h-9 w-48" />
      </div>
    </div>
    <div v-else-if="config" class="divide-y divide-border">
      <div
        class="flex flex-wrap items-start justify-between gap-3 py-3.5"
        data-testid="telegram-status"
      >
        <div class="min-w-0 space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-medium text-fg">{{ t('telegram.settings.status') }}</h3>
            <BaseBadge :tone="statusTone" data-testid="telegram-status-badge">
              {{ statusLabel }}
            </BaseBadge>
            <a
              v-if="config.botUsername"
              :href="`https://t.me/${config.botUsername}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm font-medium text-primary-700 hover:underline"
              data-testid="telegram-bot-link"
            >
              @{{ config.botUsername }}
            </a>
          </div>
          <p
            v-if="config.status === 'error' && config.lastError"
            class="break-words rounded-lg bg-danger-soft p-3 text-sm text-danger"
            data-testid="telegram-last-error"
          >
            {{ config.lastError }}
          </p>
          <p
            v-if="config.source === 'env'"
            class="text-xs text-fg-muted"
            data-testid="telegram-env"
          >
            {{ t('telegram.settings.sourceEnv') }}
          </p>
        </div>
        <BaseSwitch
          v-if="config.configured"
          class="sm:justify-end"
          :model-value="config.enabled"
          :label="t('telegram.settings.enabled')"
          :disabled="toggling"
          data-testid="telegram-enabled"
          @update:model-value="toggle"
        />
      </div>

      <form novalidate @submit.prevent="save">
        <SettingRow
          :label="t('telegram.settings.tokenLabel')"
          :hint="t('telegram.settings.tokenHint')"
        >
          <BaseInput
            v-model="token"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :aria-label="t('telegram.settings.tokenLabel')"
            :placeholder="placeholder"
            :error="tokenError"
            data-testid="telegram-token"
          />
          <div class="mt-2 flex flex-wrap gap-2 sm:justify-end">
            <BaseButton
              v-if="config.configured && config.source === 'db'"
              type="button"
              variant="danger"
              :loading="deleting"
              data-testid="telegram-delete"
              @click="remove"
            >
              {{ t('telegram.settings.delete') }}
            </BaseButton>
            <BaseButton type="submit" :loading="saving" data-testid="telegram-save">
              {{ t('telegram.settings.saveVerify') }}
            </BaseButton>
          </div>
        </SettingRow>
      </form>

      <details class="group py-3.5" data-testid="telegram-guide">
        <summary
          class="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-fg"
        >
          {{ t('telegram.settings.guideTitle') }}
          <ChevronDown class="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <ol class="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-fg-muted">
          <li v-for="(step, i) in guide" :key="i">{{ step }}</li>
        </ol>
      </details>
    </div>
  </div>
</template>

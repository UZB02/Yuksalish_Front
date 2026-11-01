<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { telegramApi } from '@/api/telegram.api'
import type { TelegramMe, TelegramMessageSettings } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { applyChanges } from '@/utils/scopeSettings'
import { formatTelegramSetting } from '@/utils/telegramFormat'
import {
  DEFAULT_TELEGRAM_FORM,
  TELEGRAM_KEYS,
  validateTelegramSettings,
  type TelegramKey,
} from '@/utils/telegramForm'
import SettingsScopeEditor from './SettingsScopeEditor.vue'
import TelegramBotConnection from './TelegramBotConnection.vue'
import TelegramFields from './TelegramFields.vue'

const { t } = useI18n()
const auth = useAuthStore()
// Davomat sozlamalari bilan bir xil ruxsat: maktab admini faqat o'z maktabi, superadmin - global + maktab
const ownSchool = computed(() => !auth.isSuperadmin)

// Maktab admini bot tokenini ko'rmaydi: faqat bot ulanganmi (agar server aytsa)
const me = ref<TelegramMe | null>(null)
onMounted(async () => {
  if (auth.isSuperadmin) return
  try {
    me.value = await telegramApi.me()
  } catch {
    me.value = null
  }
})
const showStatus = computed(() => !auth.isSuperadmin && !!me.value?.available)
</script>

<template>
  <div class="max-w-3xl space-y-6" data-testid="telegram-tab">
    <section v-if="auth.isSuperadmin" class="space-y-3">
      <h2 class="text-base font-semibold text-fg">{{ t('settingsTelegram.connectionTitle') }}</h2>
      <div class="max-w-2xl">
        <TelegramBotConnection />
      </div>
    </section>
    <section
      v-else-if="showStatus"
      class="card flex flex-wrap items-center gap-2 p-4"
      data-testid="telegram-readonly-status"
    >
      <h2 class="text-sm font-semibold text-fg">{{ t('settingsTelegram.connectionTitle') }}</h2>
      <BaseBadge tone="success">{{ t('settingsTelegram.botConnected') }}</BaseBadge>
      <a
        v-if="me?.botUsername"
        :href="`https://t.me/${me.botUsername}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm font-medium text-primary-700 hover:underline"
      >
        @{{ me.botUsername }}
      </a>
    </section>

    <section class="space-y-3" data-testid="telegram-messages">
      <div>
        <h2 class="text-base font-semibold text-fg">{{ t('settingsTelegram.messagesTitle') }}</h2>
        <p class="mt-1 text-sm text-fg-muted">{{ t('settingsTelegram.messagesText') }}</p>
      </div>
      <SettingsScopeEditor
        kind="telegram"
        :keys="TELEGRAM_KEYS"
        :defaults="DEFAULT_TELEGRAM_FORM"
        :own-school="ownSchool"
        label-prefix="settingsTelegram.fields"
        :validate="(v: TelegramMessageSettings) => validateTelegramSettings(v, t)"
        :format="(k: TelegramKey, v: TelegramMessageSettings) => formatTelegramSetting(t, k, v[k])"
      >
        <template #fields="{ values, errors, flags, globalValues, set, toggleFlag }">
          <TelegramFields
            :model-value="values"
            :errors="errors"
            :flags="flags"
            :global-values="globalValues"
            @update:model-value="applyChanges(values, $event, TELEGRAM_KEYS, set)"
            @toggle-flag="toggleFlag"
          />
        </template>
      </SettingsScopeEditor>
    </section>
  </div>
</template>

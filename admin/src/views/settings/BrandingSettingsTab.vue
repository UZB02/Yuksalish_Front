<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { brandingApi } from '@/api/branding.api'
import BaseInput from '@/components/ui/BaseInput.vue'
import LogoUploader from '@/components/ui/LogoUploader.vue'
import { useDirtySource } from '@/composables/useDirtyRegistry'
import { useToast } from '@/composables/useToast'
import { useBrandingStore } from '@/stores/branding'
import { errorMessage } from '@/utils/errors'
import { resolvePhotoUrl } from '@/utils/photo'
import SettingRow from './SettingRow.vue'
import SettingsCard from './SettingsCard.vue'
import SettingsSaveBar from './SettingsSaveBar.vue'

const { t } = useI18n()
const toast = useToast()
const branding = useBrandingStore()

const appName = ref(branding.data?.appName ?? '')
const shortName = ref(branding.data?.shortName ?? '')
const saving = ref(false)
const errors = ref<{ appName?: string; shortName?: string }>({})

const icons = computed(() => branding.data?.icons ?? null)

// Saqlanmagan o'zgarish: kiritilgan nomlar serverdagi (store) qiymatdan farq qiladimi
const dirty = computed(
  () =>
    appName.value.trim() !== (branding.data?.appName ?? '') ||
    shortName.value.trim() !== (branding.data?.shortName ?? ''),
)
useDirtySource(() => dirty.value)
function discard() {
  appName.value = branding.data?.appName ?? ''
  shortName.value = branding.data?.shortName ?? ''
  errors.value = {}
}

function validate() {
  const e: typeof errors.value = {}
  const a = appName.value.trim()
  const s = shortName.value.trim()
  if (!a || a.length > 60) e.appName = t('branding.errors.appName')
  if (!s || s.length > 20) e.shortName = t('branding.errors.shortName')
  errors.value = e
  return !e.appName && !e.shortName
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    branding.set(
      await brandingApi.update({
        appName: appName.value.trim(),
        shortName: shortName.value.trim(),
      }),
    )
    toast.success(t('branding.saved'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    saving.value = false
  }
}

async function upload(file: File) {
  branding.set(await brandingApi.uploadLogo(file))
}
async function remove() {
  branding.set(await brandingApi.deleteLogo())
}
</script>

<template>
  <div class="space-y-4 pb-24" data-testid="branding-tab">
    <form novalidate @submit.prevent="save">
      <SettingsCard>
        <div class="divide-y divide-border">
          <SettingRow :label="t('branding.appName')">
            <BaseInput
              v-model="appName"
              :aria-label="t('branding.appName')"
              :error="errors.appName"
              maxlength="60"
              data-testid="branding-app-name"
            />
          </SettingRow>
          <SettingRow :label="t('branding.shortName')" :hint="t('branding.shortNameHint')">
            <BaseInput
              v-model="shortName"
              :aria-label="t('branding.shortName')"
              :error="errors.shortName"
              maxlength="20"
              data-testid="branding-short-name"
            />
          </SettingRow>
        </div>
      </SettingsCard>
      <!-- Enter bilan yuborish uchun (ko'rinmas) -->
      <button type="submit" class="sr-only" tabindex="-1" aria-hidden="true" />
    </form>

    <SettingsCard :title="t('branding.logo')">
      <div class="py-4">
        <LogoUploader
          :src="branding.data?.logoUrl"
          :upload="upload"
          :remove="remove"
          :name="appName"
        />
      </div>
    </SettingsCard>

    <SettingsCard
      v-if="icons"
      :title="t('branding.iconPreview')"
      data-testid="branding-icon-preview"
    >
      <div class="flex flex-wrap items-end gap-6 py-4">
        <figure class="text-center">
          <img
            :src="resolvePhotoUrl(icons.icon192) ?? ''"
            alt=""
            class="h-16 w-16 rounded-2xl border border-border bg-white object-contain"
          />
          <figcaption class="mt-1 text-xs text-fg-muted">
            {{ t('branding.previewIcon') }}
          </figcaption>
        </figure>
        <figure class="text-center">
          <img
            :src="resolvePhotoUrl(icons.maskable512) ?? ''"
            alt=""
            class="h-16 w-16 rounded-full border border-border object-cover"
          />
          <figcaption class="mt-1 text-xs text-fg-muted">
            {{ t('branding.previewMaskable') }}
          </figcaption>
        </figure>
      </div>
    </SettingsCard>

    <p class="rounded-lg bg-surface-muted p-3 text-sm text-fg-muted">{{ t('branding.note') }}</p>

    <SettingsSaveBar
      :dirty="dirty"
      :saving="saving"
      :can-save="true"
      @discard="discard"
      @save="save"
    />
  </div>
</template>

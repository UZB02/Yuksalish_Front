<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { brandingApi } from '@/api/branding.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import LogoUploader from '@/components/ui/LogoUploader.vue'
import { useToast } from '@/composables/useToast'
import { useBrandingStore } from '@/stores/branding'
import { errorMessage } from '@/utils/errors'
import { resolvePhotoUrl } from '@/utils/photo'

const { t } = useI18n()
const toast = useToast()
const branding = useBrandingStore()

const appName = ref(branding.data?.appName ?? '')
const shortName = ref(branding.data?.shortName ?? '')
const saving = ref(false)
const errors = ref<{ appName?: string; shortName?: string }>({})

const icons = computed(() => branding.data?.icons ?? null)

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
  <div class="max-w-2xl space-y-6" data-testid="branding-tab">
    <form class="space-y-4" novalidate @submit.prevent="save">
      <BaseInput
        v-model="appName"
        :label="t('branding.appName')"
        :error="errors.appName"
        maxlength="60"
        data-testid="branding-app-name"
      />
      <BaseInput
        v-model="shortName"
        :label="t('branding.shortName')"
        :hint="t('branding.shortNameHint')"
        :error="errors.shortName"
        maxlength="20"
        data-testid="branding-short-name"
      />
      <BaseButton type="submit" :loading="saving" data-testid="branding-save">
        {{ t('common.save') }}
      </BaseButton>
    </form>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('branding.logo') }}</h3>
      <LogoUploader
        :src="branding.data?.logoUrl"
        :upload="upload"
        :remove="remove"
        :name="appName"
      />
    </section>

    <section v-if="icons" data-testid="branding-icon-preview">
      <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('branding.iconPreview') }}</h3>
      <div class="flex flex-wrap items-end gap-6">
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
    </section>

    <p class="rounded-lg bg-surface-muted p-3 text-sm text-fg-muted">{{ t('branding.note') }}</p>
  </div>
</template>

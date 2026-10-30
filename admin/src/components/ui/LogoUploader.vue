<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImagePlus, Trash2 } from 'lucide-vue-next'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { resolvePhotoUrl } from '@/utils/photo'
import { validateLogoFile } from '@/utils/logo'
import BaseButton from './BaseButton.vue'

/**
 * Logo yuklash: tugma yoki sudrab tashlash; tanlangach darhol serverga yuboriladi.
 * Server asosiy manba: tur (SVG yo'q), hajm (2 MB) va o'lcham (>=128px) ni qayta tekshiradi.
 */
const props = withDefaults(
  defineProps<{
    /** Hozirgi logo havolasi (backend DTO `logoUrl`) */
    src?: string | null
    upload: (file: File) => Promise<void>
    remove: () => Promise<void>
    canEdit?: boolean
    /** O'chirish tasdiqlash matni uchun nom */
    name?: string
  }>(),
  { src: null, canEdit: true, name: '' },
)

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref('')
const dragging = ref(false)
const url = computed(() => resolvePhotoUrl(props.src))

async function send(file: File) {
  const bad = validateLogoFile(file)
  if (bad) {
    error.value = t(`logo.errors.${bad}`)
    return
  }
  error.value = ''
  busy.value = true
  try {
    await props.upload(file)
    toast.success(t('logo.uploaded'))
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    busy.value = false
  }
}

function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (file) void send(file)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (!props.canEdit || busy.value) return
  const file = e.dataTransfer?.files?.[0]
  if (file) void send(file)
}

async function onRemove() {
  const ok = await confirm({
    title: t('logo.removeTitle'),
    message: t('logo.removeText', { name: props.name }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  busy.value = true
  error.value = ''
  try {
    await props.remove()
    toast.success(t('logo.removed'))
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div data-testid="logo-uploader">
    <div
      class="flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-4 transition-colors"
      :class="dragging ? 'border-primary-500 bg-primary-50' : 'border-border'"
      data-testid="logo-dropzone"
      @dragover.prevent="dragging = canEdit"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div
        class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted"
      >
        <img
          v-if="url"
          :src="url"
          :alt="t('logo.alt')"
          class="max-h-full max-w-full object-contain"
          data-testid="logo-preview"
        />
        <ImagePlus v-else class="h-6 w-6 text-fg-muted" aria-hidden="true" />
      </div>
      <div v-if="canEdit" class="min-w-0">
        <div class="flex flex-wrap gap-2">
          <BaseButton
            size="sm"
            variant="secondary"
            :disabled="busy"
            data-testid="logo-choose"
            @click="input?.click()"
          >
            <ImagePlus class="h-4 w-4" aria-hidden="true" />
            {{ url ? t('logo.replace') : t('logo.upload') }}
          </BaseButton>
          <BaseButton
            v-if="url"
            size="sm"
            variant="ghost"
            :disabled="busy"
            data-testid="logo-remove"
            @click="onRemove"
          >
            <Trash2 class="h-4 w-4 text-danger" aria-hidden="true" />
            <span class="text-danger">{{ t('logo.remove') }}</span>
          </BaseButton>
        </div>
        <p class="mt-1.5 text-xs text-fg-muted">{{ t('logo.hint') }}</p>
        <p v-if="error" class="mt-1 text-xs text-danger" role="alert" data-testid="logo-error">
          {{ error }}
        </p>
        <input
          ref="input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="sr-only"
          tabindex="-1"
          data-testid="logo-input"
          @change="onPick"
        />
      </div>
    </div>
  </div>
</template>

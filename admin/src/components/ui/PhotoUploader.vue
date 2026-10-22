<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Camera, Trash2 } from 'lucide-vue-next'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { downscaleImage, validatePhotoFile } from '@/utils/photo'
import AvatarImage from './AvatarImage.vue'
import BaseButton from './BaseButton.vue'

/**
 * Rasm yuklash/almashtirish/o'chirish.
 * - `upload` va `remove` berilsa: tanlangan fayl darhol serverga yuboriladi (tahrirlash rejimi).
 * - Berilmasa (yangi yozuv, hali id yo'q): fayl tanlanadi, ko'rinish (preview) ko'rsatiladi va
 *   `pick`/`clear` hodisalari chiqadi; yuklashni ota komponent yozuv yaratilgach bajaradi.
 * Server asosiy manba: tur/hajm/metadata ni qayta tekshiradi va qayta kodlaydi.
 */
const props = withDefaults(
  defineProps<{
    /** Egasining to'liq ismi (bosh harflar, alt, tasdiq matni) */
    name: string
    /** Hozirgi rasm havolasi (backend `photo`) */
    photo?: string | null
    /** false bo'lsa faqat avatar ko'rsatiladi */
    canEdit?: boolean
    upload?: (file: File) => Promise<void>
    remove?: () => Promise<void>
  }>(),
  { photo: null, canEdit: true, upload: undefined, remove: undefined },
)
const emit = defineEmits<{ pick: [file: File]; clear: [] }>()

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref('')
const preview = ref<string | null>(null)
const immediate = computed(() => !!props.upload)

function setPreview(file: File | null) {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = file ? URL.createObjectURL(file) : null
}
onBeforeUnmount(() => setPreview(null))

// Ko'rsatiladigan rasm: tanlangan (preview) yoki serverdagi
const shown = computed(() => preview.value ?? props.photo)
const hasPhoto = computed(() => !!shown.value)

function choose() {
  error.value = ''
  input.value?.click()
}

async function onFile(e: Event) {
  const el = e.target as HTMLInputElement
  const picked = el.files?.[0]
  el.value = '' // bir xil faylni qayta tanlash mumkin bo'lsin
  if (!picked) return
  const bad = validatePhotoFile(picked)
  if (bad) {
    error.value = t(`photo.errors.${bad}`)
    return
  }
  error.value = ''
  const file = await downscaleImage(picked)
  if (validatePhotoFile(file)) {
    error.value = t('photo.errors.size')
    return
  }
  setPreview(file)
  if (!props.upload) {
    emit('pick', file)
    return
  }
  busy.value = true
  try {
    await props.upload(file)
    toast.success(t('photo.uploaded'))
  } catch (err) {
    error.value = errorMessage(err, t)
  } finally {
    setPreview(null) // muvaffaqiyatda `photo` propi yangilanadi, xatoda eski holatga qaytadi
    busy.value = false
  }
}

async function onRemove() {
  if (!immediate.value) {
    setPreview(null)
    emit('clear')
    return
  }
  const ok = await confirm({
    title: t('photo.removeTitle'),
    message: t('photo.removeText', { name: props.name }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok || !props.remove) return
  busy.value = true
  error.value = ''
  try {
    await props.remove()
    toast.success(t('photo.removed'))
  } catch (err) {
    error.value = errorMessage(err, t)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-4" data-testid="photo-uploader">
    <div class="relative shrink-0">
      <AvatarImage :name="name" :src="shown" size="xl" :alt="t('photo.alt', { name })" />
      <span
        v-if="busy"
        class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40"
        role="status"
        :aria-label="t('common.loading')"
        data-testid="photo-busy"
      >
        <span
          class="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"
        />
      </span>
    </div>
    <div v-if="canEdit" class="min-w-0">
      <div class="flex flex-wrap gap-2">
        <BaseButton size="sm" variant="secondary" :disabled="busy" @click="choose">
          <Camera class="h-4 w-4" aria-hidden="true" />
          {{ hasPhoto ? t('photo.replace') : t('photo.upload') }}
        </BaseButton>
        <BaseButton
          v-if="hasPhoto"
          size="sm"
          variant="ghost"
          :disabled="busy"
          data-testid="photo-remove"
          @click="onRemove"
        >
          <Trash2 class="h-4 w-4 text-danger" aria-hidden="true" />
          <span class="text-danger">{{ t('photo.remove') }}</span>
        </BaseButton>
      </div>
      <p class="mt-1.5 text-xs text-fg-muted">
        {{ !immediate && preview ? t('photo.pending') : t('photo.hint') }}
      </p>
      <p v-if="error" class="mt-1 text-xs text-danger" role="alert" data-testid="photo-error">
        {{ error }}
      </p>
      <input
        ref="input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="sr-only"
        tabindex="-1"
        data-testid="photo-input"
        @change="onFile"
      />
    </div>
  </div>
</template>

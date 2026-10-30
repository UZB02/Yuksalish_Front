<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { schoolsApi } from '@/api/schools.api'
import type { School } from '@/api/types'
import LogoUploader from '@/components/ui/LogoUploader.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'

/** Maktab admini o'z maktabi logosini boshqaradi */
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const school = ref<School | null>(null)

onMounted(async () => {
  const id = auth.user?.schoolId
  if (!id) return
  try {
    school.value = await schoolsApi.get(id)
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
})

async function upload(file: File) {
  if (school.value) school.value = await schoolsApi.uploadLogo(school.value.id, file)
}
async function remove() {
  if (school.value) school.value = await schoolsApi.deleteLogo(school.value.id)
}
</script>

<template>
  <div class="max-w-2xl space-y-3" data-testid="school-logo-tab">
    <p class="text-sm text-fg-muted">{{ t('schoolLogo.description') }}</p>
    <LogoUploader
      v-if="school"
      :src="school.logoUrl"
      :upload="upload"
      :remove="remove"
      :name="school.name"
    />
  </div>
</template>

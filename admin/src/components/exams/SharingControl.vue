<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import type { QuestionSharing, ShareTeacher, SharingMode } from '@/api/types'

/**
 * Savolni hamkasblarga ulashish (faqat muallif yoki ma'muriyat). Ulashilgan o'qituvchilar savolni
 * javob kaliti bilan to'liq ko'radi va nusxa ola oladi, lekin tahrirlay olmaydi.
 */
const props = defineProps<{ modelValue: QuestionSharing; subjectId: string; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: QuestionSharing] }>()

const { t } = useI18n()
const MODES: SharingMode[] = ['private', 'subject', 'users']
const teachers = ref<ShareTeacher[]>([])
const loading = ref(false)
const failed = ref(false)
const query = ref('')

async function loadTeachers() {
  if (props.modelValue.mode !== 'users') return
  loading.value = true
  failed.value = false
  try {
    teachers.value = await examsApi.teachers(props.subjectId || undefined)
  } catch {
    teachers.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(loadTeachers)
watch(() => [props.modelValue.mode, props.subjectId], loadTeachers)

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? teachers.value.filter((x) => x.fullName.toLowerCase().includes(q)) : teachers.value
})
const selected = computed(() => new Set(props.modelValue.userIds))

function setMode(mode: SharingMode) {
  emit('update:modelValue', { mode, userIds: mode === 'users' ? props.modelValue.userIds : [] })
}
function toggle(id: string) {
  const next = new Set(props.modelValue.userIds)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  emit('update:modelValue', { mode: 'users', userIds: [...next] })
}
</script>

<template>
  <div data-testid="sharing-control">
    <div role="radiogroup" :aria-label="t('exams.sharing.title')" class="flex flex-wrap gap-1.5">
      <button
        v-for="m in MODES"
        :key="m"
        type="button"
        role="radio"
        :aria-checked="modelValue.mode === m"
        class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
        :class="
          modelValue.mode === m
            ? 'border-primary-600 bg-primary-50 text-primary-700'
            : 'border-border text-fg-muted hover:bg-surface-muted'
        "
        data-testid="sharing-mode"
        @click="setMode(m)"
      >
        {{ t(`exams.sharing.modes.${m}`) }}
      </button>
    </div>
    <p class="mt-1.5 text-xs text-fg-muted">{{ t(`exams.sharing.hints.${modelValue.mode}`) }}</p>

    <div v-if="modelValue.mode === 'users'" class="mt-3 space-y-2" data-testid="sharing-teachers">
      <input
        v-model="query"
        type="search"
        :placeholder="t('exams.sharing.search')"
        :aria-label="t('exams.sharing.search')"
        class="block h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
      />
      <p v-if="loading" class="text-xs text-fg-muted">{{ t('common.loading') }}</p>
      <p v-else-if="failed" class="text-xs text-danger">{{ t('errors.loadFailed') }}</p>
      <p v-else-if="shown.length === 0" class="text-xs text-fg-muted">
        {{ t('exams.sharing.noTeachers') }}
      </p>
      <ul
        v-else
        class="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border"
      >
        <li v-for="x in shown" :key="x.id">
          <label
            class="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-muted"
          >
            <input
              type="checkbox"
              class="h-4 w-4 accent-primary-600"
              :checked="selected.has(x.id)"
              data-testid="sharing-teacher"
              @change="toggle(x.id)"
            />
            <span class="min-w-0 flex-1 truncate text-fg">{{ x.fullName }}</span>
            <span v-if="x.teachesSubject" class="shrink-0 text-xs text-primary-700">
              {{ t('exams.sharing.teachesSubject') }}
            </span>
          </label>
        </li>
      </ul>
      <p class="text-xs text-fg-muted">
        {{ t('exams.sharing.selected', { n: modelValue.userIds.length }) }}
      </p>
    </div>
    <p v-if="error" class="mt-1 text-xs text-danger" role="alert" data-testid="sharing-error">
      {{ error }}
    </p>
  </div>
</template>

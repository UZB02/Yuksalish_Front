<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { timetableApi, type FreeTeacher } from '@/api/timetable.api'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import Skeleton from '@/components/ui/Skeleton.vue'

/**
 * Dars uchun o'qituvchi tanlash: server bo'shlarni tepaga qo'yib beradi.
 * Band o'qituvchilar belgilanadi va tanlab bo'lmaydi.
 */
const props = defineProps<{
  modelValue: string
  date: string
  lessonNo: number | null
  subjectId?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
const { t } = useI18n()

const items = ref<FreeTeacher[]>([])
const loading = ref(false)
const failed = ref(false)
let seq = 0

async function load() {
  if (!props.date || !props.lessonNo) {
    items.value = []
    return
  }
  const my = ++seq
  loading.value = true
  failed.value = false
  try {
    const res = await timetableApi.freeTeachers(props.date, props.lessonNo, props.subjectId)
    if (my !== seq) return
    items.value = res.items
    const sel = res.items.find((x) => x.id === props.modelValue)
    if (sel && !sel.free) emit('update:modelValue', '')
  } catch {
    if (my !== seq) return
    items.value = []
    failed.value = true
  } finally {
    if (my === seq) loading.value = false
  }
}

watch(() => [props.date, props.lessonNo, props.subjectId], load, { immediate: true })
</script>

<template>
  <div data-testid="teacher-picker">
    <p v-if="!date || !lessonNo" class="text-sm text-fg-muted">
      {{ t('substitutions.picker.needLesson') }}
    </p>
    <div v-else-if="loading" class="space-y-2">
      <Skeleton v-for="n in 3" :key="n" class="h-12 w-full" />
    </div>
    <p v-else-if="failed" class="text-sm text-danger" data-testid="picker-failed">
      {{ t('substitutions.picker.failed') }}
    </p>
    <p v-else-if="items.length === 0" class="text-sm text-fg-muted">
      {{ t('substitutions.picker.empty') }}
    </p>
    <ul v-else class="space-y-1.5" role="radiogroup" :aria-label="t('substitutions.picker.title')">
      <li v-for="x in items" :key="x.id">
        <button
          type="button"
          role="radio"
          :aria-checked="modelValue === x.id"
          :disabled="!x.free"
          class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :class="
            modelValue === x.id
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
              : 'border-border hover:bg-surface-muted'
          "
          :data-testid="`teacher-${x.id}`"
          @click="emit('update:modelValue', x.id)"
        >
          <span class="min-w-0 flex-1 truncate font-medium text-fg">{{ x.fullName }}</span>
          <span class="flex flex-wrap items-center gap-1.5">
            <BaseBadge v-if="x.teachesSubject" tone="primary">
              {{ t('substitutions.picker.teachesSubject') }}
            </BaseBadge>
            <BaseBadge :tone="x.free ? 'success' : 'danger'">
              {{ t(x.free ? 'substitutions.picker.free' : 'substitutions.picker.busy') }}
            </BaseBadge>
            <span class="text-xs text-fg-muted">
              {{ t('substitutions.picker.lessonsThatDay', { n: x.lessonsThatDay }) }}
            </span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { studentsApi } from '@/api/students.api'
import type { Student } from '@/api/types'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useDebounce } from '@/composables/useDebounce'

const props = defineProps<{
  classId: string
  studentId: string
  classOptions: { value: string; label: string }[]
}>()
const emit = defineEmits<{
  'update:classId': [value: string]
  'update:studentId': [value: string]
}>()
const { t } = useI18n()

const search = ref('')
const debounced = useDebounce(search)
const students = ref<Student[]>([])
const loading = ref(false)
let requestId = 0

async function load() {
  const current = ++requestId
  loading.value = true
  try {
    const res = await studentsApi.list({
      classId: props.classId || undefined,
      search: debounced.value.trim() || undefined,
      limit: 100,
    })
    if (current === requestId) students.value = res.items
  } catch {
    if (current === requestId) students.value = []
  } finally {
    if (current === requestId) loading.value = false
  }
}

const options = computed(() =>
  students.value.map((s) => ({
    value: s.id,
    label: props.classId ? s.fullName : `${s.fullName} (${s.class.name})`,
  })),
)

function onClass(v: string) {
  emit('update:classId', v)
  // Tanlangan o'quvchi yangi sinfga tegishli bo'lmasligi mumkin
  emit('update:studentId', '')
}

onMounted(load)
watch([() => props.classId, debounced], load)
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="student-picker">
    <BaseSelect
      :model-value="classId"
      :label="t('students.class')"
      searchable
      :placeholder="t('students.allClasses')"
      :options="classOptions"
      @update:model-value="onClass"
    />
    <BaseInput
      v-model="search"
      type="search"
      :icon="Search"
      :label="t('common.search')"
      :placeholder="t('students.searchPlaceholder')"
    />
    <BaseSelect
      :model-value="studentId"
      :label="t('reports.student')"
      searchable
      :placeholder="loading ? t('common.loading') : t('reports.pickStudentOption')"
      :options="options"
      @update:model-value="emit('update:studentId', $event)"
    />
  </div>
</template>

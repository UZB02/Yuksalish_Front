<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertCircle, NotebookText } from 'lucide-vue-next'
import {
  journalApi,
  type JournalGridData,
  type JournalOptions,
  type JournalQuery,
} from '@/api/journal.api'
import type { ExportFormat } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import JournalDayList from '@/components/journal/JournalDayList.vue'
import JournalFilters from '@/components/journal/JournalFilters.vue'
import JournalGrid from '@/components/journal/JournalGrid.vue'
import JournalLegend from '@/components/journal/JournalLegend.vue'
import { isDate, monthRange, rangeError } from '@/components/journal/journal.utils'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage, exportErrorMessage } from '@/utils/errors'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()

// ---------- Moslashuvchan rejim: < md (768px) da "kun bo'yicha" ro'yxat ----------
const mobile = ref(false)
let mql: MediaQueryList | null = null
const onMql = (e: MediaQueryListEvent) => (mobile.value = e.matches)
onMounted(() => {
  if (typeof window.matchMedia !== 'function') return
  mql = window.matchMedia('(max-width: 767px)')
  mobile.value = mql.matches
  mql.addEventListener?.('change', onMql)
})
onBeforeUnmount(() => mql?.removeEventListener?.('change', onMql))

// ---------- Filtrlar ----------
const options = ref<JournalOptions | null>(null)
const optionsLoading = ref(false)
const optionsError = ref('')
const classId = ref('')
const subjectId = ref('')
const from = ref('')
const to = ref('')

const today = computed(() => options.value?.today ?? '')
const periodError = computed(() =>
  from.value && to.value ? rangeError(from.value, to.value) : null,
)
const validDates = computed(() => isDate(from.value) && isDate(to.value))
const query = computed<JournalQuery | null>(() =>
  classId.value && subjectId.value && validDates.value && !periodError.value
    ? { classId: classId.value, subjectId: subjectId.value, from: from.value, to: to.value }
    : null,
)

function subjectsOf(cid: string) {
  return options.value?.classes.find((c) => c.id === cid)?.subjects ?? []
}

function applyQuery() {
  const o = options.value
  if (!o) return
  const q = route.query
  const qc = typeof q.classId === 'string' ? q.classId : ''
  classId.value = o.classes.some((c) => c.id === qc) ? qc : ''
  const qs = typeof q.subjectId === 'string' ? q.subjectId : ''
  subjectId.value = classId.value && subjectsOf(classId.value).some((s) => s.id === qs) ? qs : ''
  if (isDate(q.from) && isDate(q.to)) {
    from.value = q.from
    to.value = q.to
  } else {
    const r = monthRange(o.today, 0)
    from.value = r.from
    to.value = r.to
  }
}

async function loadOptions() {
  optionsLoading.value = true
  optionsError.value = ''
  try {
    options.value = await journalApi.options()
    applyQuery()
  } catch (e) {
    optionsError.value = errorMessage(e, t)
  } finally {
    optionsLoading.value = false
  }
}

function onClass(id: string) {
  classId.value = id
  const subs = subjectsOf(id)
  if (!subs.some((s) => s.id === subjectId.value)) {
    // O'qituvchining sinfida bitta fan bo'lsa, uni darrov tanlaymiz
    subjectId.value = subs.length === 1 ? subs[0]!.id : ''
  }
}
function onRange(f: string, tt: string) {
  from.value = f
  to.value = tt
}

// URL bilan sinxronlash (ulashiladigan havola)
watch([classId, subjectId, from, to], () => {
  if (!options.value) return
  const next: Record<string, string> = {}
  if (classId.value) next.classId = classId.value
  if (subjectId.value) next.subjectId = subjectId.value
  if (isDate(from.value)) next.from = from.value
  if (isDate(to.value)) next.to = to.value
  void router.replace({ query: next })
})

// ---------- Ma'lumot ----------
const data = ref<JournalGridData | null>(null)
const loading = ref(false)
const error = ref('')
let seq = 0

async function load() {
  const q = query.value
  const id = ++seq
  if (!q) {
    data.value = null
    loading.value = false
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await journalApi.subject(q)
    if (id !== seq) return
    data.value = res
  } catch (e) {
    if (id !== seq) return
    data.value = null
    error.value = errorMessage(e, t)
  } finally {
    if (id === seq) loading.value = false
  }
}
watch(query, () => void load(), { deep: true })

// ---------- Eksport ----------
const busy = ref<ExportFormat | null>(null)
async function doExport(format: ExportFormat) {
  const q = query.value
  if (!q || busy.value) return
  busy.value = format
  try {
    const name = await journalApi.export(format, q)
    toast.success(t('journal.downloaded', { name }))
  } catch (e) {
    toast.error(exportErrorMessage(e, t))
  } finally {
    busy.value = null
  }
}

onMounted(() => {
  if (!needsSchool.value) void loadOptions()
})
watch(
  () => [needsSchool.value, schoolCtx.schoolId] as const,
  () => {
    seq++
    options.value = null
    data.value = null
    classId.value = ''
    subjectId.value = ''
    if (!needsSchool.value) void loadOptions()
  },
)
</script>

<template>
  <!-- Ixcham sarlavha: nom va tanlangan sinf/fan/o'qituvchi bitta qatorda -->
  <header class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
    <h1 class="text-lg font-semibold text-fg sm:text-xl">{{ t('journal.title') }}</h1>
    <p
      v-if="data && !loading && !error"
      class="min-w-0 truncate text-sm text-fg-muted"
      data-testid="journal-info"
    >
      <b class="text-fg">{{ data.class.name }}</b> · {{ data.subject.name }}
      <template v-if="data.teacher">
        · {{ t('journal.teacher') }}: {{ data.teacher.fullName }}</template
      >
    </p>
  </header>

  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <div v-if="optionsLoading && !options" class="space-y-3" data-testid="options-loading">
      <Skeleton class="h-28 w-full" />
    </div>
    <div v-else-if="optionsError" class="card" data-testid="options-error">
      <EmptyState :icon="AlertCircle" :title="t('journal.error.title')" :description="optionsError">
        <BaseButton variant="secondary" @click="loadOptions">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <template v-else-if="options">
      <JournalFilters
        :options="options"
        :class-id="classId"
        :subject-id="subjectId"
        :from="from"
        :to="to"
        :error="periodError"
        :can-export="true"
        :busy="busy"
        @update:class-id="onClass"
        @update:subject-id="subjectId = $event"
        @range="onRange"
        @export="doExport"
      />

      <div v-if="!options.classes.length" class="card">
        <EmptyState
          :icon="NotebookText"
          :title="t('journal.empty.noClasses')"
          :description="t('journal.empty.noClassesText')"
        />
      </div>
      <div v-else-if="!classId || !subjectId" class="card" data-testid="empty-select">
        <EmptyState
          :icon="NotebookText"
          :title="t('journal.empty.selectTitle')"
          :description="t('journal.empty.selectText')"
        />
      </div>
      <div v-else-if="!query" class="card" data-testid="empty-range">
        <EmptyState :icon="NotebookText" :title="t('journal.empty.rangeTitle')" />
      </div>
      <div v-else-if="loading" class="space-y-2" data-testid="grid-loading">
        <Skeleton v-for="i in 8" :key="i" class="h-9 w-full" />
      </div>
      <div v-else-if="error" class="card" data-testid="grid-error">
        <EmptyState :icon="AlertCircle" :title="t('journal.error.title')" :description="error">
          <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
        </EmptyState>
      </div>
      <template v-else-if="data">
        <div v-if="!data.students.length" class="card" data-testid="empty-students">
          <EmptyState :icon="NotebookText" :title="t('journal.empty.noStudents')" />
        </div>
        <div v-else-if="!data.columns.length" class="card" data-testid="empty-days">
          <EmptyState :icon="NotebookText" :title="t('journal.empty.noDays')" />
        </div>
        <template v-else>
          <JournalDayList v-if="mobile" :data="data" :today="today" />
          <JournalGrid v-else :data="data" :today="today" />
          <div class="mt-3"><JournalLegend /></div>
        </template>
      </template>
    </template>
  </template>
</template>

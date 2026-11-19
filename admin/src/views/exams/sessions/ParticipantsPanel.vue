<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import type { ExamCandidate, ExamClassOption, ExamSession, ExamSessionMeta } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

/**
 * Ishtirokchi qo'shish: sinflar (faol o'quvchilar), alohida o'quvchilar, mehmon (ma'muriyat), nomzod
 * (ma'muriyat, kirish imtihoni). Server takrorlarni o'tkazib yuboradi.
 */
const props = defineProps<{ session: ExamSession; meta: ExamSessionMeta | null }>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const classes = ref<ExamClassOption[]>([])
const candidates = ref<ExamCandidate[]>([])
const busy = ref(false)
const guestName = ref('')
const guestOrigin = ref('')
const guestError = ref('')
const picking = ref<string | null>(null)
const students = ref<{ id: string; fullName: string }[]>([])
const pickedStudents = ref<Set<string>>(new Set())
const pickedCandidates = ref<Set<string>>(new Set())

const isAdmin = computed(() => props.meta?.isAdministration ?? false)
const isAdmission = computed(() => props.session.type === 'admission')

async function load() {
  try {
    classes.value = (await examsApi.classOptions(props.session.subjectId ?? undefined)).filter(
      (c) => isAdmin.value || props.session.classes.some((x) => x.id === c.id),
    )
    if (isAdmin.value && isAdmission.value) {
      candidates.value = (await examsApi.listCandidates({ limit: 100 })).items
    }
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
onMounted(load)
watch(() => [props.session.id, props.meta?.isAdministration], load)

async function add(body: Parameters<typeof examsApi.addParticipants>[1]) {
  busy.value = true
  try {
    const r = await examsApi.addParticipants(props.session.id, body)
    toast.success(t('examSessions.participants.added', { added: r.added, skipped: r.skipped }))
    emit('changed')
    return true
  } catch (e) {
    toast.error(errorMessage(e, t))
    return false
  } finally {
    busy.value = false
  }
}

const addClass = (c: ExamClassOption) => add({ classIds: [c.id] })

async function openPick(c: ExamClassOption) {
  if (picking.value === c.id) {
    picking.value = null
    return
  }
  try {
    students.value = await examsApi.classStudents(c.id)
    pickedStudents.value = new Set()
    picking.value = c.id
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
function togglePick(id: string, on: boolean) {
  const s = new Set(pickedStudents.value)
  if (on) s.add(id)
  else s.delete(id)
  pickedStudents.value = s
}
async function addPicked() {
  if (!pickedStudents.value.size) return
  if (await add({ studentIds: [...pickedStudents.value] })) picking.value = null
}

async function addGuest() {
  guestError.value = ''
  if (guestName.value.trim().length < 2 || !guestOrigin.value.trim()) {
    guestError.value = t('examSessions.participants.guestRequired')
    return
  }
  if (
    await add({ guests: [{ fullName: guestName.value.trim(), origin: guestOrigin.value.trim() }] })
  ) {
    guestName.value = ''
    guestOrigin.value = ''
  }
}

/** Yangi nomzodni shu yerning o'zida yaratib, imtihonga qo'shadi (ism majburiy, "qayerdan/izoh" ixtiyoriy) */
const candName = ref('')
const candNote = ref('')
const candError = ref('')
async function createAndAddCandidate() {
  candError.value = ''
  if (candName.value.trim().length < 2) {
    candError.value = t('examCandidates.errors.name')
    return
  }
  busy.value = true
  try {
    const c = await examsApi.createCandidate({
      fullName: candName.value.trim(),
      birthDate: null,
      targetGrade: null,
      parentPhone: null,
      notes: candNote.value.trim(),
    })
    candidates.value = [c, ...candidates.value]
    candName.value = ''
    candNote.value = ''
    await add({ candidateIds: [c.id] })
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

function toggleCandidate(id: string, on: boolean) {
  const s = new Set(pickedCandidates.value)
  if (on) s.add(id)
  else s.delete(id)
  pickedCandidates.value = s
}
async function addCandidates() {
  if (!pickedCandidates.value.size) return
  if (await add({ candidateIds: [...pickedCandidates.value] })) pickedCandidates.value = new Set()
}
</script>

<template>
  <div class="space-y-6" data-testid="participants-panel">
    <section>
      <h3 class="mb-2 text-sm font-semibold text-fg">
        {{ t('examSessions.participants.classes') }}
      </h3>
      <p v-if="classes.length === 0" class="text-sm text-fg-muted" data-testid="no-classes">
        {{ t('examSessions.participants.noClasses') }}
      </p>
      <ul v-else class="divide-y divide-border rounded-lg border border-border">
        <li v-for="c in classes" :key="c.id" class="p-3" :data-testid="`class-${c.id}`">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-fg">{{ c.name }}</span>
            <span class="text-xs text-fg-muted">{{
              t('examSessions.participants.studentsN', { n: c.studentsCount })
            }}</span>
            <div class="ml-auto flex gap-2">
              <BaseButton
                variant="secondary"
                size="sm"
                :data-testid="`pick-class-${c.id}`"
                @click="openPick(c)"
              >
                {{ t('examSessions.participants.pickStudents') }}
              </BaseButton>
              <BaseButton
                size="sm"
                :loading="busy"
                :data-testid="`add-class-${c.id}`"
                @click="addClass(c)"
              >
                {{ t('examSessions.participants.addAll') }}
              </BaseButton>
            </div>
          </div>
          <div v-if="picking === c.id" class="mt-3 space-y-2" data-testid="students-pick">
            <ul class="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
              <li v-for="s in students" :key="s.id">
                <BaseCheckbox
                  :model-value="pickedStudents.has(s.id)"
                  :label="s.fullName"
                  @update:model-value="togglePick(s.id, $event)"
                />
              </li>
            </ul>
            <BaseButton size="sm" :loading="busy" data-testid="add-picked" @click="addPicked">
              {{ t('examSessions.participants.addSelected', { n: pickedStudents.size }) }}
            </BaseButton>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="isAdmin">
      <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('examSessions.participants.guest') }}</h3>
      <form
        class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        novalidate
        @submit.prevent="addGuest"
      >
        <BaseInput
          v-model="guestName"
          :label="t('examSessions.participants.guestName')"
          :maxlength="100"
          data-testid="guest-name"
        />
        <BaseInput
          v-model="guestOrigin"
          :label="t('examSessions.participants.guestOrigin')"
          :maxlength="150"
          data-testid="guest-origin"
        />
        <BaseButton type="submit" variant="secondary" :loading="busy" data-testid="guest-add">
          {{ t('examSessions.participants.addGuest') }}
        </BaseButton>
      </form>
      <p v-if="guestError" class="mt-1 text-sm text-danger" data-testid="guest-error">
        {{ guestError }}
      </p>
    </section>

    <section v-if="isAdmin && isAdmission">
      <h3 class="mb-2 text-sm font-semibold text-fg">
        {{ t('examSessions.participants.candidates') }}
      </h3>
      <form
        class="mb-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        novalidate
        data-testid="candidate-quick"
        @submit.prevent="createAndAddCandidate"
      >
        <BaseInput
          v-model="candName"
          :label="t('examSessions.participants.newCandidateName')"
          :maxlength="100"
          data-testid="cand-quick-name"
        />
        <BaseInput
          v-model="candNote"
          :label="t('examSessions.participants.newCandidateNote')"
          :maxlength="500"
          data-testid="cand-quick-note"
        />
        <BaseButton type="submit" variant="secondary" :loading="busy" data-testid="cand-quick-add">
          {{ t('examSessions.participants.addNewCandidate') }}
        </BaseButton>
      </form>
      <p v-if="candError" class="mb-2 text-sm text-danger" data-testid="cand-quick-error">
        {{ candError }}
      </p>
      <p v-if="candidates.length === 0" class="text-sm text-fg-muted">
        {{ t('examSessions.participants.noCandidates') }}
      </p>
      <template v-else>
        <ul
          class="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2"
          data-testid="candidates-pick"
        >
          <li v-for="c in candidates" :key="c.id">
            <BaseCheckbox
              :model-value="pickedCandidates.has(c.id)"
              :label="c.fullName"
              :data-testid="`cand-${c.id}`"
              @update:model-value="toggleCandidate(c.id, $event)"
            />
          </li>
        </ul>
        <BaseButton
          class="mt-2"
          size="sm"
          variant="secondary"
          :loading="busy"
          data-testid="add-candidates"
          @click="addCandidates"
        >
          {{ t('examSessions.participants.addSelected', { n: pickedCandidates.size }) }}
        </BaseButton>
      </template>
      <RouterLink
        :to="{ name: 'exam-candidates' }"
        class="mt-3 inline-block text-sm font-medium text-primary-700 hover:underline"
        data-testid="manage-candidates"
      >
        {{ t('examSessions.participants.manageCandidates') }}
      </RouterLink>
    </section>
  </div>
</template>

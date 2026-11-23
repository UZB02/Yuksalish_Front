<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, FileUp, Plus, Trash2 } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { FileKeyItem, FileTestFileInfo, FileTestView } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import FilePreview from './FilePreview.vue'

/**
 * "Fayl + kalit" blokini tahrirlash (o'qituvchi yoki tuzuvchi): variantlar (A-D), har birida PDF yoki tartiblangan
 * rasmlar va javob kaliti. Fayl va kalit yonma-yon ko'rinadi. Kalitni tez kiritish: "1-C 2-A 3-25 4-B,D" matni yoki jadval.
 */
const props = defineProps<{ sessionId: string; blockId: string }>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

interface EditVariant {
  letter: 'A' | 'B' | 'C' | 'D'
  kind: 'pdf' | 'image'
  files: FileTestFileInfo[]
  key: FileKeyItem[]
}
const LETTERS = ['A', 'B', 'C', 'D'] as const
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const MAX_ITEMS = 200

const view = ref<FileTestView | null>(null)
const vars = ref<EditVariant[]>([])
const active = ref<EditVariant['letter']>('A')
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const uploading = ref(false)
const dirty = ref(false)
const pasteText = ref('')
const pasteMsg = ref<{ errors: string[]; warnings: string[] } | null>(null)
const defaults = ref({ options: 4, points: 1 })
const fileInput = ref<HTMLInputElement | null>(null)

const locked = computed(() => !view.value || view.value.locked)
const current = computed(() => vars.value.find((v) => v.letter === active.value) ?? null)
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function adopt(v: FileTestView) {
  view.value = v
  vars.value = clone(v.variants) as EditVariant[]
  if (!vars.value.some((x) => x.letter === active.value))
    active.value = vars.value[0]?.letter ?? 'A'
  dirty.value = false
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    adopt(await examsApi.fileTest(props.sessionId, props.blockId))
  } catch (e) {
    loadError.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const touch = () => {
  dirty.value = true
}

// ---------- Variantlar ----------
const freeLetters = computed(() => LETTERS.filter((l) => !vars.value.some((v) => v.letter === l)))
function addVariant() {
  const letter = freeLetters.value[0]
  if (!letter) return
  const fresh: EditVariant = { letter, kind: 'pdf', files: [], key: [] }
  vars.value = [...vars.value, fresh].sort((a, b) => a.letter.localeCompare(b.letter))
  active.value = letter
  touch()
}
async function removeVariant(letter: EditVariant['letter']) {
  const ok = await confirm({
    title: t('fileTest.removeVariantTitle', { v: letter }),
    message: t('fileTest.removeVariantText'),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  vars.value = vars.value.filter((v) => v.letter !== letter)
  active.value = vars.value[0]?.letter ?? 'A'
  touch()
}

// ---------- Fayllar ----------
function setKind(kind: 'pdf' | 'image') {
  const v = current.value
  if (!v || v.kind === kind) return
  v.kind = kind
  v.files = []
  touch()
}
async function onFiles(e: Event) {
  const v = current.value
  const input = e.target as HTMLInputElement
  const list = Array.from(input.files ?? [])
  input.value = ''
  if (!v || !list.length) return
  if (v.kind === 'pdf' && list.length > 1) {
    toast.error(t('fileTest.onePdf'))
    return
  }
  uploading.value = true
  try {
    const added: FileTestFileInfo[] = []
    for (const f of list)
      added.push((await examsApi.uploadTestFile(props.sessionId, props.blockId, f)).file)
    const kinds = new Set(added.map((a) => a.kind))
    if (v.kind === 'pdf') v.files = added.slice(0, 1)
    else v.files = [...v.files, ...added]
    if (kinds.size === 1 && !kinds.has(v.kind)) {
      // Foydalanuvchi rasm rejimida PDF (yoki aksincha) tanladi: rejim fayl turiga moslanadi
      v.kind = [...kinds][0]!
      v.files = added
    }
    touch()
  } catch (err) {
    toast.error(errorMessage(err, t))
  } finally {
    uploading.value = false
  }
}
function moveFile(i: number, d: -1 | 1) {
  const v = current.value
  if (!v) return
  const j = i + d
  if (j < 0 || j >= v.files.length) return
  const a = [...v.files]
  ;[a[i], a[j]] = [a[j]!, a[i]!]
  v.files = a
  touch()
}
function removeFile(i: number) {
  const v = current.value
  if (!v) return
  v.files = v.files.filter((_, k) => k !== i)
  touch()
}
const sizeText = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

// ---------- Kalit ----------
const letters = (n: number | undefined) => OPTION_LETTERS.slice(0, n ?? 4)
function renumber(v: EditVariant) {
  v.key = v.key.map((k, i) => ({ ...k, no: i + 1 }))
}
function setCount(n: number) {
  const v = current.value
  if (!v) return
  const target = Math.min(MAX_ITEMS, Math.max(0, Math.floor(n) || 0))
  if (target < v.key.length) v.key = v.key.slice(0, target)
  while (v.key.length < target) {
    v.key.push({
      no: v.key.length + 1,
      type: 'choice',
      options: defaults.value.options,
      correct: [],
      points: defaults.value.points,
    })
  }
  touch()
}
function setType(k: FileKeyItem, type: 'choice' | 'short') {
  if (k.type === type) return
  k.type = type
  if (type === 'short') {
    delete k.options
    delete k.correct
    k.accepted = []
  } else {
    delete k.accepted
    k.options = defaults.value.options
    k.correct = []
  }
  touch()
}
function toggleCorrect(k: FileKeyItem, l: string) {
  const cur = new Set(k.correct ?? [])
  if (cur.has(l)) cur.delete(l)
  else cur.add(l)
  k.correct = OPTION_LETTERS.filter((x) => cur.has(x))
  touch()
}
function setOptions(k: FileKeyItem, n: number) {
  k.options = n
  k.correct = (k.correct ?? []).filter((c) => OPTION_LETTERS.indexOf(c as never) < n)
  touch()
}
const acceptedText = (k: FileKeyItem) => (k.accepted ?? []).join(' | ')
function setAccepted(k: FileKeyItem, v: string) {
  k.accepted = v
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)
  touch()
}
function setPoints(k: FileKeyItem, v: string) {
  const n = Number(String(v).replace(',', '.'))
  k.points = Number.isFinite(n) ? n : 1
  touch()
}
function removeRow(i: number) {
  const v = current.value
  if (!v) return
  v.key.splice(i, 1)
  renumber(v)
  touch()
}
function addRow() {
  setCount((current.value?.key.length ?? 0) + 1)
}
const incomplete = (k: FileKeyItem) =>
  k.type === 'choice' ? !(k.correct && k.correct.length) : !(k.accepted && k.accepted.length)

async function applyPaste() {
  const v = current.value
  if (!v || !pasteText.value.trim()) return
  try {
    const r = await examsApi.parseFileKey(props.sessionId, props.blockId, {
      text: pasteText.value,
      options: defaults.value.options,
      points: defaults.value.points,
    })
    pasteMsg.value = { errors: r.errors, warnings: r.warnings }
    if (r.errors.length || !r.items.length) return
    if (v.key.length) {
      const ok = await confirm({
        title: t('fileTest.replaceKeyTitle'),
        message: t('fileTest.replaceKeyText', { n: r.items.length }),
        confirmText: t('fileTest.replaceKey'),
      })
      if (!ok) return
    }
    v.key = r.items
    renumber(v)
    pasteText.value = ''
    touch()
  } catch (e) {
    pasteMsg.value = { errors: [errorMessage(e, t)], warnings: [] }
  }
}

// ---------- Variantlar o'rtasidagi moslik va saqlash ----------
const pointsOf = (v: EditVariant) =>
  Math.round(v.key.reduce((n, k) => n + (Number(k.points) || 0), 0) * 1000) / 1000
const mismatch = computed(() => {
  const [f, ...rest] = vars.value
  if (!f) return ''
  for (const v of rest) {
    if (v.key.length !== f.key.length) {
      return t('fileTest.mismatchCount', {
        a: f.letter,
        na: f.key.length,
        b: v.letter,
        nb: v.key.length,
      })
    }
    if (Math.abs(pointsOf(v) - pointsOf(f)) > 1e-6) {
      return t('fileTest.mismatchPoints', {
        a: f.letter,
        pa: pointsOf(f),
        b: v.letter,
        pb: pointsOf(v),
      })
    }
  }
  return ''
})

async function save() {
  saving.value = true
  try {
    const saved = await examsApi.saveFileTest(props.sessionId, props.blockId, {
      variants: vars.value.map((v) => ({
        letter: v.letter,
        kind: v.kind,
        files: v.files.map((f) => f.id),
        key: v.key,
      })),
    })
    adopt(saved)
    toast.success(t('fileTest.saved'))
    emit('changed')
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    saving.value = false
  }
}
defineExpose({ save, dirty })
</script>

<template>
  <div class="space-y-4" data-testid="filetest-editor">
    <p v-if="loading" class="text-sm text-fg-muted">{{ t('common.loading') }}</p>
    <div v-else-if="loadError" class="card space-y-2 p-4">
      <p class="text-sm text-danger">{{ loadError }}</p>
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </div>
    <template v-else-if="view">
      <p class="text-sm text-fg-muted">{{ t('fileTest.help') }}</p>

      <div class="flex flex-wrap items-center gap-2" role="tablist" data-testid="variant-tabs">
        <button
          v-for="v in vars"
          :key="v.letter"
          type="button"
          role="tab"
          :aria-selected="active === v.letter"
          class="rounded-lg border px-4 py-1.5 text-sm font-semibold"
          :class="
            active === v.letter
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-border bg-surface text-fg hover:bg-surface-muted'
          "
          :data-testid="`variant-tab-${v.letter}`"
          @click="active = v.letter"
        >
          {{ t('fileTest.variant', { v: v.letter }) }}
          <span class="ml-1 text-xs font-normal opacity-80">({{ v.key.length }})</span>
        </button>
        <BaseButton
          v-if="!locked && freeLetters.length"
          variant="secondary"
          size="sm"
          data-testid="variant-add"
          @click="addVariant"
        >
          <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('fileTest.addVariant') }}
        </BaseButton>
      </div>

      <p
        v-if="mismatch"
        class="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning"
        data-testid="filetest-mismatch"
      >
        {{ mismatch }}
      </p>

      <p
        v-if="!current"
        class="card p-6 text-center text-sm text-fg-muted"
        data-testid="filetest-empty"
      >
        {{ t('fileTest.noVariants') }}
      </p>

      <div
        v-else
        class="grid gap-4 lg:grid-cols-2"
        :data-testid="`variant-panel-${current.letter}`"
      >
        <!-- Fayl -->
        <section class="card space-y-3 p-4">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-semibold text-fg">{{ t('fileTest.fileTitle') }}</h3>
            <div v-if="!locked" class="ml-auto flex gap-1" role="radiogroup">
              <button
                v-for="k in ['pdf', 'image'] as const"
                :key="k"
                type="button"
                role="radio"
                :aria-checked="current.kind === k"
                class="rounded-md border px-3 py-1 text-xs font-medium"
                :class="
                  current.kind === k
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-border text-fg'
                "
                :data-testid="`file-kind-${k}`"
                @click="setKind(k)"
              >
                {{ t(`fileTest.kind.${k}`) }}
              </button>
            </div>
          </div>
          <div v-if="!locked" class="space-y-2">
            <input
              ref="fileInput"
              type="file"
              class="sr-only"
              :accept="current.kind === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png'"
              :multiple="current.kind === 'image'"
              data-testid="file-input"
              @change="onFiles"
            />
            <BaseButton
              variant="secondary"
              :loading="uploading"
              data-testid="file-pick"
              @click="fileInput?.click()"
            >
              <FileUp class="h-4 w-4" aria-hidden="true" />
              {{ current.kind === 'pdf' ? t('fileTest.pickPdf') : t('fileTest.pickImages') }}
            </BaseButton>
            <p class="text-xs text-fg-muted">{{ t('fileTest.fileHint') }}</p>
          </div>
          <ul v-if="current.files.length" class="space-y-1 text-sm" data-testid="file-list">
            <li
              v-for="(f, i) in current.files"
              :key="f.id"
              class="flex items-center gap-2 rounded border border-border px-2 py-1"
              :data-testid="`file-item-${i}`"
            >
              <span class="w-5 text-fg-muted">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1 truncate">
                {{ f.kind === 'pdf' ? t('fileTest.kind.pdf') : t('fileTest.kind.image') }}
                · {{ sizeText(f.size)
                }}<template v-if="f.kind === 'pdf' && f.pages">
                  · {{ t('fileTest.pagesCount', { n: f.pages }) }}</template
                >
              </span>
              <template v-if="!locked">
                <BaseButton
                  v-if="current.kind === 'image'"
                  variant="ghost"
                  size="sm"
                  :disabled="i === 0"
                  :aria-label="t('fileTest.up')"
                  :data-testid="`file-up-${i}`"
                  @click="moveFile(i, -1)"
                >
                  <ArrowUp class="h-4 w-4" aria-hidden="true" />
                </BaseButton>
                <BaseButton
                  v-if="current.kind === 'image'"
                  variant="ghost"
                  size="sm"
                  :disabled="i === current.files.length - 1"
                  :aria-label="t('fileTest.down')"
                  :data-testid="`file-down-${i}`"
                  @click="moveFile(i, 1)"
                >
                  <ArrowDown class="h-4 w-4" aria-hidden="true" />
                </BaseButton>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  :aria-label="t('fileTest.removeFile')"
                  :data-testid="`file-remove-${i}`"
                  @click="removeFile(i)"
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                </BaseButton>
              </template>
            </li>
          </ul>
          <FilePreview
            :session-id="sessionId"
            :block-id="blockId"
            :kind="current.kind"
            :files="current.files"
          />
        </section>

        <!-- Kalit -->
        <section class="card space-y-3 p-4">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-semibold text-fg">{{ t('fileTest.keyTitle') }}</h3>
            <span class="text-xs text-fg-muted" data-testid="key-summary">
              {{ t('fileTest.keySummary', { n: current.key.length, p: pointsOf(current) }) }}
            </span>
            <BaseButton
              v-if="!locked"
              variant="ghost"
              size="sm"
              class="ml-auto"
              data-testid="variant-remove"
              @click="removeVariant(current.letter)"
            >
              <Trash2 class="h-4 w-4" aria-hidden="true" /> {{ t('fileTest.removeVariant') }}
            </BaseButton>
          </div>

          <div v-if="!locked" class="space-y-2 rounded-lg border border-border p-3">
            <p class="text-xs font-medium text-fg">{{ t('fileTest.quick') }}</p>
            <textarea
              v-model="pasteText"
              rows="3"
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-fg"
              placeholder="1-C 2-A 3-25 4-B,D 5-12|12.5"
              data-testid="key-paste-text"
            />
            <div class="flex flex-wrap items-center gap-3 text-xs text-fg-muted">
              <label class="flex items-center gap-1">
                {{ t('fileTest.defOptions') }}
                <select
                  v-model.number="defaults.options"
                  class="rounded border border-border bg-surface px-1 py-0.5 text-fg"
                  data-testid="key-def-options"
                >
                  <option v-for="n in [2, 3, 4, 5, 6]" :key="n" :value="n">{{ n }}</option>
                </select>
              </label>
              <label class="flex items-center gap-1">
                {{ t('fileTest.defPoints') }}
                <input
                  v-model.number="defaults.points"
                  type="number"
                  min="0.1"
                  step="0.1"
                  class="w-16 rounded border border-border bg-surface px-1 py-0.5 text-fg"
                  data-testid="key-def-points"
                />
              </label>
              <BaseButton size="sm" data-testid="key-paste-apply" @click="applyPaste">
                {{ t('fileTest.apply') }}
              </BaseButton>
              <label class="ml-auto flex items-center gap-1">
                {{ t('fileTest.count') }}
                <input
                  :value="current.key.length"
                  type="number"
                  min="0"
                  :max="MAX_ITEMS"
                  class="w-16 rounded border border-border bg-surface px-1 py-0.5 text-fg"
                  data-testid="key-count"
                  @change="setCount(Number(($event.target as HTMLInputElement).value))"
                />
              </label>
            </div>
            <ul
              v-if="pasteMsg?.errors.length"
              class="list-disc space-y-0.5 pl-5 text-xs text-danger"
              data-testid="key-paste-errors"
            >
              <li v-for="(e, i) in pasteMsg.errors" :key="i">{{ e }}</li>
            </ul>
            <ul
              v-if="pasteMsg?.warnings.length"
              class="list-disc space-y-0.5 pl-5 text-xs text-warning"
              data-testid="key-paste-warnings"
            >
              <li v-for="(e, i) in pasteMsg.warnings" :key="i">{{ e }}</li>
            </ul>
          </div>

          <div class="max-h-[60vh] overflow-auto" data-testid="key-grid">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-surface text-xs text-fg-muted">
                <tr>
                  <th class="w-8 px-1 py-1 text-left">№</th>
                  <th class="px-1 py-1 text-left">{{ t('fileTest.type') }}</th>
                  <th class="px-1 py-1 text-left">{{ t('fileTest.answer') }}</th>
                  <th class="w-16 px-1 py-1 text-left">{{ t('fileTest.points') }}</th>
                  <th class="w-8" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(k, i) in current.key"
                  :key="k.no"
                  class="border-t border-border align-top"
                  :class="incomplete(k) ? 'bg-warning-soft' : ''"
                  :data-testid="`key-row-${k.no}`"
                >
                  <td class="px-1 py-1.5 font-semibold tabular-nums">{{ k.no }}</td>
                  <td class="px-1 py-1">
                    <select
                      :value="k.type"
                      :disabled="locked"
                      class="rounded border border-border bg-surface px-1 py-1 text-fg"
                      :data-testid="`key-type-${k.no}`"
                      @change="setType(k, ($event.target as HTMLSelectElement).value as never)"
                    >
                      <option value="choice">{{ t('fileTest.choice') }}</option>
                      <option value="short">{{ t('fileTest.short') }}</option>
                    </select>
                  </td>
                  <td class="px-1 py-1">
                    <div v-if="k.type === 'choice'" class="flex flex-wrap items-center gap-1">
                      <button
                        v-for="l in letters(k.options)"
                        :key="l"
                        type="button"
                        :disabled="locked"
                        class="h-7 w-7 rounded-md border text-xs font-bold"
                        :class="
                          k.correct?.includes(l)
                            ? 'border-success bg-success text-white'
                            : 'border-border bg-surface text-fg'
                        "
                        :aria-pressed="!!k.correct?.includes(l)"
                        :data-testid="`key-opt-${k.no}-${l}`"
                        @click="toggleCorrect(k, l)"
                      >
                        {{ l }}
                      </button>
                      <select
                        :value="k.options ?? 4"
                        :disabled="locked"
                        class="ml-1 rounded border border-border bg-surface px-1 py-0.5 text-xs text-fg-muted"
                        :aria-label="t('fileTest.optionsCount')"
                        :data-testid="`key-options-${k.no}`"
                        @change="setOptions(k, Number(($event.target as HTMLSelectElement).value))"
                      >
                        <option v-for="n in [2, 3, 4, 5, 6]" :key="n" :value="n">{{ n }}</option>
                      </select>
                    </div>
                    <input
                      v-else
                      :value="acceptedText(k)"
                      :disabled="locked"
                      class="w-full rounded border border-border bg-surface px-2 py-1 text-fg"
                      :placeholder="t('fileTest.acceptedPlaceholder')"
                      :data-testid="`key-short-${k.no}`"
                      @change="setAccepted(k, ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <td class="px-1 py-1">
                    <input
                      :value="k.points"
                      :disabled="locked"
                      type="text"
                      inputmode="decimal"
                      class="w-16 rounded border border-border bg-surface px-1 py-1 text-fg"
                      :data-testid="`key-points-${k.no}`"
                      @change="setPoints(k, ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <td class="px-1 py-1">
                    <BaseButton
                      v-if="!locked"
                      variant="ghost"
                      size="sm"
                      :aria-label="t('fileTest.removeRow')"
                      :data-testid="`key-remove-${k.no}`"
                      @click="removeRow(i)"
                    >
                      <Trash2 class="h-4 w-4" aria-hidden="true" />
                    </BaseButton>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!current.key.length" class="py-6 text-center text-sm text-fg-muted">
              {{ t('fileTest.keyEmpty') }}
            </p>
          </div>
          <BaseButton
            v-if="!locked"
            variant="secondary"
            size="sm"
            data-testid="key-add"
            @click="addRow"
          >
            <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('fileTest.addRow') }}
          </BaseButton>
        </section>
      </div>

      <div v-if="!locked" class="flex flex-wrap items-center gap-3" data-testid="filetest-savebar">
        <BaseButton :loading="saving" :disabled="!dirty" data-testid="filetest-save" @click="save">
          {{ t('fileTest.save') }}
        </BaseButton>
        <span v-if="dirty" class="text-sm text-warning" data-testid="filetest-dirty">
          {{ t('fileTest.unsaved') }}
        </span>
      </div>
    </template>
  </div>
</template>

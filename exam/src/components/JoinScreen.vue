<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../inject'
import Icon from './Icon.vue'
import ScreenShell from './ScreenShell.vue'
import { CODE_LENGTH, formatCodeInput, isWellFormedCode, normalizeCode } from '../lib/code'

const STEPS = [
  { icon: 'lock', text: 'Imtihon kodini o‘qituvchidan oling' },
  { icon: 'ok', text: 'Ismingizni tekshiring' },
  { icon: 'clock', text: 'Vaqt tugagach javoblar avtomatik topshiriladi' },
] as const

const store = useStore()
const code = ref('')
const local = ref('')
/** Eski usul (kod + PIN): faqat kerak bo'lganda ochiladi */
const legacy = ref(false)
const oldCode = ref('')
const pin = ref('')

/** Yozilganda XXX-XXX-XXX ko'rinishiga keltiriladi; kirill/kichik harf/bo'shliq normallashadi */
function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  code.value = formatCodeInput(el.value)
  el.value = code.value
}

async function submit() {
  local.value = ''
  store.state.error = ''
  const n = normalizeCode(code.value)
  if (!isWellFormedCode(n)) {
    local.value =
      n.length === CODE_LENGTH
        ? 'Kodda 0, O, 1, I, L harflari bo‘lmaydi: kartochkani qayta tekshiring'
        : `Kod ${CODE_LENGTH} ta belgidan iborat (masalan, 7K4-92M-QXA)`
    return
  }
  await store.joinCode(n)
}

async function submitLegacy() {
  local.value = ''
  if (!/^\d{6}$/.test(oldCode.value.trim())) {
    local.value = 'Imtihon kodi 6 ta raqamdan iborat'
    return
  }
  if (pin.value.trim().length < 4) {
    local.value = 'PIN ni kiriting'
    return
  }
  await store.join(oldCode.value, pin.value.toUpperCase())
}
</script>

<template>
  <ScreenShell data-testid="join">
    <template #side>
      <h1 class="text-3xl font-extrabold leading-tight lg:text-4xl">Onlayn imtihon</h1>
      <p class="text-fg-soft">Uch oddiy qadamda imtihonni boshlang.</p>
      <ol class="space-y-4">
        <li v-for="(st, k) in STEPS" :key="st.text" class="flex items-center gap-4">
          <span
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg"
          >
            <Icon :name="st.icon" size="h-6 w-6" />
          </span>
          <span class="text-lg"
            ><span class="sr-only">{{ k + 1 }}-qadam: </span>{{ st.text }}</span
          >
        </li>
      </ol>
    </template>

    <form
      v-if="!legacy"
      class="space-y-5"
      novalidate
      data-testid="join-form"
      @submit.prevent="submit"
    >
      <h2 class="text-2xl font-bold">Imtihonga kirish</h2>
      <label class="block">
        <span class="mb-2 block text-lg font-medium">Kartochkadagi shaxsiy kodingiz</span>
        <input
          :value="code"
          class="input h-14 text-center text-xl font-semibold uppercase tracking-[0.25em]"
          autocomplete="off"
          autocapitalize="characters"
          autocorrect="off"
          spellcheck="false"
          inputmode="text"
          maxlength="14"
          placeholder="XXX-XXX-XXX"
          aria-label="Shaxsiy kod"
          data-testid="code-input"
          @input="onInput"
        />
      </label>
      <p
        v-if="local || store.state.error"
        class="font-medium text-bad"
        role="alert"
        data-testid="join-error"
      >
        {{ local || store.state.error }}
      </p>
      <button
        type="submit"
        class="btn-primary h-14 w-full text-lg"
        :disabled="store.state.busy"
        data-testid="code-submit"
      >
        {{ store.state.busy ? 'Tekshirilmoqda...' : 'Kirish' }}
      </button>
    </form>

    <form
      v-else
      class="space-y-5"
      novalidate
      data-testid="legacy-form"
      @submit.prevent="submitLegacy"
    >
      <h2 class="text-2xl font-bold">Imtihon kodi va PIN</h2>
      <p class="text-fg-soft">Imtihon kodi va PIN ni qog‘ozdagi kartochkadan kiriting.</p>
      <label class="block">
        <span class="mb-1 block font-medium">Imtihon kodi</span>
        <input
          v-model="oldCode"
          class="input h-14 text-center text-xl tracking-[0.25em]"
          inputmode="numeric"
          autocomplete="off"
          maxlength="6"
          placeholder="000000"
          data-testid="join-code"
        />
      </label>
      <label class="block">
        <span class="mb-1 block font-medium">PIN</span>
        <input
          v-model="pin"
          class="input h-14 text-center text-xl uppercase tracking-[0.25em]"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="12"
          placeholder="ABC123"
          data-testid="join-pin"
        />
      </label>
      <p
        v-if="local || store.state.error"
        class="font-medium text-bad"
        role="alert"
        data-testid="join-error"
      >
        {{ local || store.state.error }}
      </p>
      <button
        type="submit"
        class="btn-primary h-14 w-full text-lg"
        :disabled="store.state.busy"
        data-testid="join-submit"
      >
        {{ store.state.busy ? 'Tekshirilmoqda...' : 'Kirish' }}
      </button>
    </form>

    <button
      type="button"
      class="block min-h-11 w-full text-center text-sm text-fg-soft underline"
      data-testid="toggle-legacy"
      @click="((legacy = !legacy), (local = ''), (store.state.error = ''))"
    >
      {{ legacy ? 'Shaxsiy kod bilan kirish' : 'Imtihon kodi va PIN bilan kirish' }}
    </button>
  </ScreenShell>
</template>

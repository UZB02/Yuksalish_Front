<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../inject'

const store = useStore()
const code = ref('')
const pin = ref('')
const local = ref('')

async function submit() {
  local.value = ''
  if (!/^\d{6}$/.test(code.value.trim())) {
    local.value = 'Imtihon kodi 6 ta raqamdan iborat'
    return
  }
  if (pin.value.trim().length < 4) {
    local.value = 'PIN ni kiriting'
    return
  }
  await store.join(code.value, pin.value.toUpperCase())
}
</script>

<template>
  <form class="card space-y-5" novalidate data-testid="join" @submit.prevent="submit">
    <h1 class="text-2xl font-bold">Imtihonga kirish</h1>
    <p class="text-fg-soft">Imtihon kodi va PIN ni qog‘ozdagi kartochkadan kiriting.</p>
    <label class="block">
      <span class="mb-1 block font-medium">Imtihon kodi</span>
      <input
        v-model="code"
        class="input text-center tracking-widest"
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
        class="input text-center uppercase tracking-widest"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="12"
        placeholder="ABC123"
        data-testid="join-pin"
      />
    </label>
    <p v-if="local || store.state.error" class="font-medium text-bad" data-testid="join-error">
      {{ local || store.state.error }}
    </p>
    <button
      type="submit"
      class="btn-primary w-full"
      :disabled="store.state.busy"
      data-testid="join-submit"
    >
      {{ store.state.busy ? 'Tekshirilmoqda...' : 'Kirish' }}
    </button>
  </form>
</template>

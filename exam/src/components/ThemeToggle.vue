<script setup lang="ts">
import { ref } from 'vue'

const dark = ref(document.documentElement.classList.contains('dark'))
function toggle() {
  dark.value = !dark.value
  document.documentElement.classList.toggle('dark', dark.value)
  try {
    localStorage.setItem('exam.theme', dark.value ? 'dark' : 'light')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <button
    type="button"
    class="min-h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg-soft"
    :aria-label="dark ? 'Yorug‘ mavzu' : 'Qorong‘i mavzu'"
    data-testid="theme-toggle"
    @click="toggle"
  >
    {{ dark ? 'Yorug‘' : 'Qorong‘i' }}
  </button>
</template>

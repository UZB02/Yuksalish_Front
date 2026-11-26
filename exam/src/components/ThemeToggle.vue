<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

defineProps<{ testid?: string }>()
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
    class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-fg"
    :aria-label="dark ? 'Yorug‘ mavzu' : 'Qorong‘i mavzu'"
    :data-testid="testid ?? 'theme-toggle'"
    @click="toggle"
  >
    <Icon :name="dark ? 'sun' : 'moon'" />
  </button>
</template>

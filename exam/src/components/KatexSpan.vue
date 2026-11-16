<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import katex from 'katex'

/** Formula: KaTeX DOM ga o'zi yozadi (v-html YO'Q), trust: false, xatoda matn ko'rinadi */
const props = defineProps<{ tex: string; display?: boolean }>()
const el = ref<HTMLElement | null>(null)

function render() {
  if (!el.value) return
  try {
    katex.render(props.tex, el.value, {
      throwOnError: false,
      trust: false,
      displayMode: props.display ?? false,
      strict: 'ignore',
      maxSize: 20,
      maxExpand: 500,
    })
  } catch {
    el.value.textContent = props.tex
  }
}
onMounted(render)
watch(() => props.tex, render)
</script>

<template>
  <span ref="el" class="katex-host" />
</template>

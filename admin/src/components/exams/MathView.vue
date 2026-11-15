<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import 'katex/dist/katex.min.css'

/**
 * TeX formulani KaTeX bilan ko'rsatadi. Xavfsizlik:
 *  - `trust: false` (\href, \url, \includegraphics va h.k. ishlamaydi);
 *  - `throwOnError: false` (xato formula qizil matn bo'lib chiqadi);
 *  - natija `katex.render(tex, element)` orqali DOM tugunlari sifatida quriladi, foydalanuvchi satri
 *    hech qachon HTML sifatida talqin qilinmaydi (v-html / innerHTML ishlatilmaydi).
 */
const props = withDefaults(defineProps<{ tex: string; display?: boolean }>(), { display: true })

const el = ref<HTMLElement | null>(null)
let seq = 0

async function render() {
  const my = ++seq
  const target = el.value
  if (!target) return
  if (!props.tex.trim()) {
    target.textContent = ''
    return
  }
  // KaTeX faqat shu komponent kerak bo'lganda yuklanadi (alohida chunk)
  const katex = (await import('katex')).default
  if (my !== seq || !el.value) return
  try {
    katex.render(props.tex, el.value, {
      trust: false,
      throwOnError: false,
      displayMode: props.display,
      strict: 'ignore',
      maxExpand: 500,
      maxSize: 30,
      output: 'htmlAndMathml',
    })
  } catch {
    el.value.textContent = props.tex
  }
}

onMounted(render)
watch(() => [props.tex, props.display], render)
</script>

<template>
  <span ref="el" class="math-view block max-w-full overflow-x-auto" data-testid="math-view" />
</template>

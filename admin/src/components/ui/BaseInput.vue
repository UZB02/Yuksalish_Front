<script setup lang="ts">
import { computed, ref, useAttrs, useId, type Component } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null
    label?: string
    type?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    icon?: Component
  }>(),
  { modelValue: '', type: 'text' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})
const id = useId()
const showPassword = ref(false)
const isPassword = computed(() => props.type === 'password')
const inputType = computed(() => (isPassword.value && showPassword.value ? 'text' : props.type))
const describedBy = computed(() =>
  props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined,
)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div :class="$attrs.class" :style="$attrs.style as string">
    <label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-fg">
      {{ label }}<span v-if="required" class="ml-0.5 text-danger" aria-hidden="true">*</span>
    </label>
    <div class="relative">
      <component
        :is="icon"
        v-if="icon"
        class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
        aria-hidden="true"
      />
      <input
        v-bind="inputAttrs"
        :id="id"
        :type="inputType"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :required="required"
        :aria-invalid="!!error"
        :aria-describedby="describedBy"
        class="h-10 w-full rounded-lg border bg-surface px-3 text-sm text-fg placeholder:text-fg-muted/70 transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
        :class="[
          error ? 'border-danger' : 'border-border',
          isPassword ? 'pr-10' : '',
          icon ? 'pl-9' : '',
        ]"
        @input="onInput"
      />
      <button
        v-if="isPassword"
        type="button"
        class="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-fg-muted hover:text-fg"
        :aria-label="showPassword ? t('common.hidePassword') : t('common.showPassword')"
        :aria-pressed="showPassword"
        @click="showPassword = !showPassword"
      >
        <EyeOff v-if="showPassword" class="h-4 w-4" />
        <Eye v-else class="h-4 w-4" />
      </button>
    </div>
    <p v-if="error" :id="`${id}-error`" class="mt-1 text-xs text-danger" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1 text-xs text-fg-muted">{{ hint }}</p>
  </div>
</template>

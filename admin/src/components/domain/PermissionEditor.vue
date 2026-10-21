<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PermissionMeta } from '@/api/types'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import Skeleton from '@/components/ui/Skeleton.vue'

const props = defineProps<{
  modelValue: string[]
  permissions: PermissionMeta[]
  /** Ushbu rol uchun mos ruxsatlar ko'rsatiladi */
  role: 'school_admin' | 'teacher'
  /** Belgilash mumkin bo'lgan ruxsatlar; null/undefined = hammasi (yuqoriga ko'tarilmaydi qoidasi) */
  allowed?: string[] | null
  loading?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const { t } = useI18n()

const groups = computed(() => {
  const map = new Map<string, PermissionMeta[]>()
  for (const p of props.permissions) {
    if (p.roles.length > 0 && !p.roles.includes(props.role)) continue
    const list = map.get(p.group) ?? []
    list.push(p)
    map.set(p.group, list)
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }))
})

const isAllowed = (key: string) => !props.allowed || props.allowed.includes(key)
const isChecked = (key: string) => props.modelValue.includes(key)

function toggle(key: string, value: boolean) {
  const next = new Set(props.modelValue)
  if (value) next.add(key)
  else next.delete(key)
  emit('update:modelValue', [...next])
}

function groupState(items: PermissionMeta[]) {
  const selectable = items.filter((i) => isAllowed(i.key))
  const checked = selectable.filter((i) => isChecked(i.key)).length
  return {
    selectable,
    all: selectable.length > 0 && checked === selectable.length,
    some: checked > 0 && checked < selectable.length,
  }
}

function toggleGroup(items: PermissionMeta[], value: boolean) {
  const next = new Set(props.modelValue)
  for (const i of groupState(items).selectable) {
    if (value) next.add(i.key)
    else next.delete(i.key)
  }
  emit('update:modelValue', [...next])
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
    </div>
    <p v-else-if="groups.length === 0" class="text-sm text-fg-muted">
      {{ t('permissions.empty') }}
    </p>
    <fieldset
      v-for="g in groups"
      v-else
      :key="g.group"
      class="rounded-xl border border-border p-3"
      :disabled="disabled"
    >
      <legend class="sr-only">{{ g.group }}</legend>
      <div class="mb-2 flex items-center justify-between gap-2">
        <BaseCheckbox
          :model-value="groupState(g.items).all"
          :indeterminate="groupState(g.items).some"
          :disabled="disabled || groupState(g.items).selectable.length === 0"
          :label="g.group"
          class="font-semibold"
          @update:model-value="toggleGroup(g.items, $event)"
        />
      </div>
      <div class="grid gap-2 pl-7 sm:grid-cols-2">
        <BaseCheckbox
          v-for="p in g.items"
          :key="p.key"
          :model-value="isChecked(p.key)"
          :disabled="disabled || !isAllowed(p.key)"
          :label="p.label"
          :description="!isAllowed(p.key) ? t('permissions.notAvailable') : undefined"
          @update:model-value="toggle(p.key, $event)"
        />
      </div>
    </fieldset>
  </div>
</template>

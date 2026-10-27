<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KeyRound, Layers, Power, SlidersHorizontal } from 'lucide-vue-next'
import type { Teacher } from '@/api/types'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'

const props = defineProps<{ teacher: Teacher }>()
const emit = defineEmits<{
  classes: [teacher: Teacher]
  permissions: [teacher: Teacher]
  reset: [teacher: Teacher]
  toggle: [teacher: Teacher]
}>()

const { t } = useI18n()

const items = computed<DropdownItem[]>(() => [
  { key: 'classes', label: t('teachers.assignClasses'), icon: Layers },
  { key: 'permissions', label: t('permissions.title'), icon: SlidersHorizontal },
  { key: 'reset', label: t('resetPassword.title'), icon: KeyRound },
  {
    key: 'toggle',
    label: props.teacher.isActive ? t('common.deactivate') : t('common.activate'),
    icon: Power,
    danger: props.teacher.isActive,
    separator: true,
  },
])

function onSelect(key: string) {
  if (key === 'classes') emit('classes', props.teacher)
  else if (key === 'permissions') emit('permissions', props.teacher)
  else if (key === 'reset') emit('reset', props.teacher)
  else if (key === 'toggle') emit('toggle', props.teacher)
}
</script>

<template>
  <DropdownMenu
    :items="items"
    :label="t('teachers.moreActions', { name: teacher.fullName })"
    @select="onSelect"
  />
</template>

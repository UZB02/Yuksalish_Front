<script setup lang="ts">
import PermissionsModal from '@/components/domain/PermissionsModal.vue'
import ResetPasswordModal from '@/components/domain/ResetPasswordModal.vue'
import type { TeacherActions } from '@/composables/useTeacherActions'
import TeacherClassesModal from './TeacherClassesModal.vue'
import TeacherFormModal from './TeacherFormModal.vue'

defineProps<{ actions: TeacherActions }>()
</script>

<template>
  <TeacherFormModal
    :open="actions.formOpen"
    :teacher="actions.editing"
    :allowed-permissions="actions.allowedPermissions"
    @close="actions.closeAll()"
    @saved="actions.reload()"
  />
  <TeacherClassesModal
    :open="!!actions.classesTarget"
    :teacher="actions.classesTarget"
    :classes="actions.classLookup.items"
    :loading="actions.classLookup.loading"
    @close="actions.closeAll()"
    @saved="actions.reload()"
  />
  <PermissionsModal
    :open="!!actions.permTarget"
    :target-name="actions.permTarget?.fullName ?? ''"
    role="teacher"
    :initial="actions.permTarget?.permissions ?? []"
    :allowed="actions.allowedPermissions"
    :submit="actions.submitPermissions"
    @close="actions.closeAll()"
    @saved="actions.reload()"
  />
  <ResetPasswordModal
    :open="!!actions.resetTarget"
    :target-name="actions.resetTarget?.fullName ?? ''"
    :submit="actions.submitReset"
    @close="actions.closeAll()"
  />
</template>

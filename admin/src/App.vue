<script setup lang="ts">
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import UpdatePrompt from '@/components/pwa/UpdatePrompt.vue'
import InstallModal from '@/components/pwa/InstallModal.vue'
</script>

<template>
  <RouterView />
  <ConfirmDialog />
  <ToastContainer />
  <UpdatePrompt />
  <InstallModal />
</template>

<script setup lang="ts">
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
</script>

<template>
  <RouterView />
  <ConfirmDialog />
  <ToastContainer />
</template>

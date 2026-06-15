<script setup lang="ts">
import { useHead } from '#imports'

import { useLocale } from './app/composables/useLocale'

const { locale } = useLocale()

useHead(() => ({
  htmlAttrs: {
    lang: locale.value,
  },
}))
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
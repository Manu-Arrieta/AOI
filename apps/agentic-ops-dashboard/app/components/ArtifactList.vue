<script setup lang="ts">
import type { ArtifactRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'

defineProps<{
  artifacts: ArtifactRecord[]
  selectedPath: string | null
}>()

const { messages } = useLocale()

const emit = defineEmits<{
  select: [artifactPath: string]
}>()
</script>

<template>
  <UCard class="artifact-panel" variant="soft" :ui="{ header: 'p-0 sm:p-0', body: 'px-0 pt-4 pb-0 sm:px-0 sm:pt-4 sm:pb-0' }">
    <template #header>
      <header class="mini-header">
        <h3>{{ messages.artifactsPanel.title }}</h3>
        <UBadge color="neutral" variant="outline">{{ artifacts.length }}</UBadge>
      </header>
    </template>

    <div v-if="!artifacts.length" class="panel-empty panel-empty-tight">
      {{ messages.artifactsPanel.empty }}
    </div>

    <ul v-else class="artifact-list">
      <li v-for="artifact in artifacts" :key="artifact.path">
        <button
          :class="['artifact-item', { 'artifact-item-selected': artifact.path === selectedPath }]"
          type="button"
          @click="emit('select', artifact.path)"
        >
          <span class="artifact-item-copy">
            <strong>{{ artifact.name }}</strong>
            <small>{{ artifact.path }}</small>
          </span>
          <UBadge color="neutral" variant="outline">{{ artifact.kind }}</UBadge>
        </button>
      </li>
    </ul>
  </UCard>
</template>
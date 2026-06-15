<script setup lang="ts">
import type { ArtifactRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'

defineProps<{
  artifact: ArtifactRecord | null
}>()

const { messages } = useLocale()
</script>

<template>
  <UCard class="artifact-panel artifact-viewer" variant="soft" :ui="{ header: 'p-0 sm:p-0', body: 'px-0 pt-4 pb-0 sm:px-0 sm:pt-4 sm:pb-0' }">
    <template #header>
      <header class="mini-header">
        <h3>{{ messages.artifactsPanel.preview }}</h3>
        <div class="artifact-viewer-actions">
          <UButton
            v-if="artifact"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-info"
            :title="artifact.path"
            :aria-label="`${messages.artifactsPanel.pathInfo}: ${artifact.path}`"
          />
          <UBadge color="neutral" variant="outline">{{ artifact?.extension ?? messages.artifactsPanel.noExtension }}</UBadge>
        </div>
      </header>
    </template>

    <UAlert
      v-if="!artifact"
      color="neutral"
      icon="i-lucide-scan-search"
      variant="soft"
      :description="messages.artifactsPanel.inspectPrompt"
    />

    <UAlert
      v-else-if="artifact.kind === 'directory'"
      color="neutral"
      icon="i-lucide-folder"
      variant="soft"
      :description="messages.artifactsPanel.directoryPreview"
    />

    <UAlert
      v-else-if="!artifact.preview"
      color="neutral"
      icon="i-lucide-file-warning"
      variant="soft"
      :description="messages.artifactsPanel.missingPreview"
    />

    <div v-else class="artifact-preview">
      <pre>{{ artifact.preview }}</pre>
    </div>
  </UCard>
</template>
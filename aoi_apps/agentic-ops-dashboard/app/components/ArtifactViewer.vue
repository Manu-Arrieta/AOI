<script setup lang="ts">
import type { ArtifactRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'

defineProps<{ artifact: ArtifactRecord | null }>()

const { messages } = useLocale()
</script>

<template>
  <div class="artifact-panel artifact-viewer">
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
        <UBadge color="neutral" variant="outline" size="sm">
          {{ artifact?.extension ?? messages.artifactsPanel.noExtension }}
        </UBadge>
      </div>
    </header>

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
  </div>
</template>
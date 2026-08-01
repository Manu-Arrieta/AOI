<script setup lang="ts">
import type { ArtifactRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'

defineProps<{
  artifacts: ArtifactRecord[]
  selectedPath: string | null
}>()

const { messages } = useLocale()

const emit = defineEmits<{ select: [artifactPath: string] }>()

function kindIcon(kind: string) {
  return kind === 'directory' ? 'i-lucide-folder' : 'i-lucide-file-text'
}
</script>

<template>
  <div class="artifact-panel">
    <header class="mini-header">
      <h3>{{ messages.artifactsPanel.title }}</h3>
      <UBadge color="neutral" variant="outline" size="sm">{{ artifacts.length }}</UBadge>
    </header>

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
            <UIcon :name="kindIcon(artifact.kind)" style="color: var(--muted); flex-shrink: 0;" />
            <strong>{{ artifact.name }}</strong>
            <small>{{ artifact.path }}</small>
          </span>
          <UBadge color="neutral" variant="outline" size="sm">{{ artifact.kind }}</UBadge>
        </button>
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import type { ArtifactRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'
import { resolveArtifactSddMeta } from '../utils/sdd-artifacts'

const props = defineProps<{ artifact: ArtifactRecord | null }>()

const { messages } = useLocale()
const copied = ref(false)
const viewMode = ref<'rendered' | 'raw'>('rendered')

const sddMeta = computed(() => (props.artifact ? resolveArtifactSddMeta(props.artifact.name) : null))

const isMarkdown = computed(() => {
  const ext = props.artifact?.extension?.toLowerCase()
  const name = props.artifact?.name?.toLowerCase()
  return ext === '.md' || ext === '.markdown' || (name ? name.endsWith('.md') : false)
})

watch(
  () => props.artifact?.path,
  () => {
    viewMode.value = isMarkdown.value ? 'rendered' : 'raw'
  },
  { immediate: true },
)

const renderedHtml = computed(() => {
  if (!props.artifact?.preview || !isMarkdown.value) return ''
  try {
    return marked.parse(props.artifact.preview, { gfm: true, breaks: true }) as string
  } catch (error) {
    return `<div class="p-4 text-red-500 font-mono text-xs">Error rendering markdown: ${String(error)}</div>`
  }
})

function copyContent() {
  if (!props.artifact?.preview) return
  navigator.clipboard.writeText(props.artifact.preview)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <UCard variant="outline" class="h-full flex flex-col" :ui="{ body: 'flex-1 p-0 sm:p-0 overflow-hidden flex flex-col' }">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon :name="isMarkdown && viewMode === 'rendered' ? 'i-lucide-book-open-check' : 'i-lucide-code-xml'" class="w-4 h-4 text-primary" />
          <h3 class="font-semibold text-sm text-neutral-900 dark:text-white">
            {{ messages.artifactsPanel.preview }}
          </h3>
          <UBadge
            v-if="sddMeta?.gate"
            :color="sddMeta.gateBadgeColor ?? 'warning'"
            variant="subtle"
            size="xs"
            class="font-mono hidden sm:inline-flex"
          >
            <UIcon :name="sddMeta.icon" class="mr-1 w-3 h-3" />
            {{ sddMeta.gate }}
          </UBadge>
        </div>

        <div class="flex items-center gap-2">
          <!-- View mode toggle for Markdown documents -->
          <div v-if="isMarkdown && artifact?.preview" class="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700">
            <UButton
              size="xs"
              :color="viewMode === 'rendered' ? 'primary' : 'neutral'"
              :variant="viewMode === 'rendered' ? 'solid' : 'ghost'"
              icon="i-lucide-file-text"
              class="rounded-md transition-all font-medium text-xs"
              @click="viewMode = 'rendered'"
            >
              {{ messages.artifactsPanel.documentView }}
            </UButton>
            <UButton
              size="xs"
              :color="viewMode === 'raw' ? 'primary' : 'neutral'"
              :variant="viewMode === 'raw' ? 'solid' : 'ghost'"
              icon="i-lucide-code"
              class="rounded-md transition-all font-medium text-xs"
              @click="viewMode = 'raw'"
            >
              {{ messages.artifactsPanel.sourceView }}
            </UButton>
          </div>

          <UButton
            v-if="artifact?.preview"
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            @click="copyContent"
          >
            {{ copied ? 'Copied' : 'Copy' }}
          </UButton>
          <UButton
            v-if="artifact"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-info"
            :title="artifact.path"
            :aria-label="`${messages.artifactsPanel.pathInfo}: ${artifact.path}`"
          />
          <UBadge
            v-if="isMarkdown && artifact?.preview"
            :color="viewMode === 'rendered' ? 'primary' : 'neutral'"
            variant="subtle"
            size="xs"
            class="font-mono hidden md:inline-flex"
          >
            {{ viewMode === 'rendered' ? messages.artifactsPanel.renderedBadge : messages.artifactsPanel.rawBadge }}
          </UBadge>
          <UBadge color="neutral" variant="outline" size="xs" class="font-mono">
            {{ artifact?.extension ?? messages.artifactsPanel.noExtension }}
          </UBadge>
        </div>
      </div>
    </template>

    <div class="p-4 flex-1 flex flex-col min-h-[300px]">
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
      <!-- Interpreted Markdown Document View -->
      <div
        v-else-if="isMarkdown && viewMode === 'rendered'"
        class="artifact-rendered-body p-6 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 overflow-auto max-h-[480px] flex-1 border border-neutral-200 dark:border-neutral-800 shadow-sm"
        v-html="renderedHtml"
      />
      <!-- Raw Source View -->
      <div
        v-else
        class="p-4 rounded-xl bg-neutral-900 text-neutral-200 dark:bg-neutral-950 font-mono text-xs overflow-auto max-h-[480px] flex-1 border border-neutral-800 shadow-sm"
      >
        <pre class="whitespace-pre font-mono leading-relaxed">{{ artifact.preview }}</pre>
      </div>
    </div>
  </UCard>
</template>
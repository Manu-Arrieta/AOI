<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui'
import { computed } from 'vue'

import type { ResourceTreeNode } from '~/shared/types'

import { useLocale } from '../composables/useLocale'
import {
  flattenResources,
  isProtectedResourceDirectory,
  toExplorerTreeItems,
  type FolderTreeItem,
} from '~/utils/resource-tree'

const props = defineProps<{
  resources: ResourceTreeNode[]
  busy: boolean
}>()

const emit = defineEmits<{
  create: [path: string]
  move: [path: string]
  delete: [path: string]
}>()

const { messages } = useLocale()

// ── Summary counts ────────────────────────────────────────────────────────────
const flattenedResources = computed(() => flattenResources(props.resources))
const directoryCount = computed(() => flattenedResources.value.filter((n) => n.kind === 'directory').length)
const fileCount = computed(() => flattenedResources.value.filter((n) => n.kind === 'file').length)
const protectedDirectoryCount = computed(
  () => flattenedResources.value.filter((n) => n.kind === 'directory' && isProtectedResourceDirectory(n.path)).length,
)

// ── Explorer tree ─────────────────────────────────────────────────────────────
const explorerTreeItems = computed(() => toExplorerTreeItems(props.resources))

// ── Node helpers ──────────────────────────────────────────────────────────────
function getNodeStateLabel(item: FolderTreeItem) {
  if (item.kind === 'file') return messages.value.resources.readOnly
  if (item.path === '.resources') return messages.value.resources.root
  if (isProtectedResourceDirectory(item.path)) return messages.value.resources.protected
  return messages.value.resources.managed
}

function getNodeBadgeVariant(item: FolderTreeItem) {
  return item.kind === 'file' ? 'outline' : 'soft'
}

function getDirectoryActions(item: FolderTreeItem): ContextMenuItem[][] {
  const primaryActions: ContextMenuItem[] = [
    {
      label: item.path === '.resources' ? messages.value.resources.newFolder : messages.value.resources.child,
      icon: 'i-lucide-folder-plus',
      disabled: props.busy,
      onSelect: () => emit('create', item.path),
    },
  ]

  if (item.path !== '.resources') {
    primaryActions.push({
      label: messages.value.resources.move,
      icon: 'i-lucide-arrow-right-left',
      disabled: props.busy,
      onSelect: () => emit('move', item.path),
    })
  }

  const groupedActions: ContextMenuItem[][] = [primaryActions]

  if (item.path !== '.resources' && !isProtectedResourceDirectory(item.path)) {
    groupedActions.push([{
      label: messages.value.resources.delete,
      icon: 'i-lucide-trash-2',
      color: 'error',
      disabled: props.busy,
      onSelect: () => emit('delete', item.path),
    }])
  }

  return groupedActions
}
</script>

<template>
  <UCard variant="outline" class="backdrop-blur-md">
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p class="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
            {{ messages.resources.eyebrow }}
          </p>
          <h2 class="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {{ messages.resources.title }}
          </h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {{ messages.resources.copy }}
          </p>
        </div>

        <UButton
          color="primary"
          icon="i-lucide-folder-plus"
          variant="solid"
          size="sm"
          :disabled="busy"
          @click="emit('create', '.resources')"
        >
          {{ messages.resources.newFolder }}
        </UButton>
      </div>

      <!-- Resource Summary Strip -->
      <div class="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
        <UBadge color="neutral" variant="soft" size="xs">
          {{ messages.resources.totalNodes }} · {{ flattenedResources.length }}
        </UBadge>
        <UBadge color="neutral" variant="outline" size="xs">
          {{ messages.resources.folders }} · {{ directoryCount }}
        </UBadge>
        <UBadge color="neutral" variant="outline" size="xs">
          {{ messages.resources.files }} · {{ fileCount }}
        </UBadge>
        <UBadge color="neutral" variant="outline" size="xs">
          {{ messages.resources.protected }} · {{ protectedDirectoryCount }}
        </UBadge>
        <div class="ml-auto">
          <UBadge :color="busy ? 'warning' : 'success'" variant="subtle" size="xs">
            <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="busy ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'" />
            {{ busy ? messages.resources.busy : messages.resources.ready }}
          </UBadge>
        </div>
      </div>
    </template>

    <div v-if="!flattenedResources.length" class="py-12 text-center text-neutral-400 font-mono text-xs">
      {{ messages.resources.empty }}
    </div>

    <div v-else class="p-2 sm:p-3 bg-neutral-50 dark:bg-neutral-950/40 rounded-xl border border-neutral-200 dark:border-neutral-800/80">
      <UTree
        :items="explorerTreeItems"
        class="text-xs font-mono"
      >
        <!-- Directory node — wrapped in UContextMenu for right-click actions -->
        <template #item="{ item, handleToggle }">
          <UContextMenu
            v-if="item.kind === 'directory'"
            :items="getDirectoryActions(item as FolderTreeItem)"
          >
            <div
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors"
              @click="handleToggle"
            >
              <UIcon :name="item.icon" class="w-4 h-4 text-primary shrink-0" />
              <strong class="text-neutral-900 dark:text-neutral-100 font-semibold">{{ item.label }}</strong>
              <UBadge color="neutral" :variant="getNodeBadgeVariant(item as FolderTreeItem)" size="xs" class="ml-1">
                {{ getNodeStateLabel(item as FolderTreeItem) }}
              </UBadge>
              <small class="text-neutral-400 dark:text-neutral-500 ml-auto truncate max-w-[200px]">{{ item.path }}</small>
            </div>
          </UContextMenu>

          <!-- File node — no context menu, no toggle -->
          <div
            v-else
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40 transition-colors"
          >
            <UIcon :name="item.icon" class="w-4 h-4 text-neutral-400 shrink-0" />
            <span class="text-neutral-700 dark:text-neutral-300">{{ item.label }}</span>
            <UBadge color="neutral" variant="outline" size="xs" class="ml-1">
              {{ getNodeStateLabel(item as FolderTreeItem) }}
            </UBadge>
            <small class="text-neutral-400 dark:text-neutral-500 ml-auto truncate max-w-[200px]">{{ item.path }}</small>
          </div>
        </template>
      </UTree>
    </div>
  </UCard>
</template>
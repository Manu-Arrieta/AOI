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

// ── Summary counts (still used for the overview strip) ────────────────────────
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
  <div class="surface-panel resource-panel-shell">
    <header class="panel-header">
      <div>
        <p class="eyebrow">{{ messages.resources.eyebrow }}</p>
        <h2>{{ messages.resources.title }}</h2>
      </div>
      <UButton
        color="neutral"
        icon="i-lucide-folder-plus"
        variant="outline"
        size="sm"
        :disabled="busy"
        @click="emit('create', '.resources')"
      >
        {{ messages.resources.newFolder }}
      </UButton>
    </header>

    <p class="resource-copy">{{ messages.resources.copy }}</p>

    <section class="resource-overview">
      <div class="resource-summary-strip">
        <UBadge color="neutral" variant="soft">
          {{ messages.resources.totalNodes }} · {{ flattenedResources.length }}
        </UBadge>
        <UBadge color="neutral" variant="outline">
          {{ messages.resources.folders }} · {{ directoryCount }}
        </UBadge>
        <UBadge color="neutral" variant="outline">
          {{ messages.resources.files }} · {{ fileCount }}
        </UBadge>
        <UBadge color="neutral" variant="outline">
          {{ messages.resources.protected }} · {{ protectedDirectoryCount }}
        </UBadge>
      </div>
    </section>

    <section class="resource-workspace">
      <UDashboardToolbar class="resource-toolbar">
        <template #left>
          <div class="resource-toolbar-copy">
            <p>{{ messages.resources.operationsEyebrow }}</p>
            <strong>{{ messages.resources.operationsTitle }}</strong>
          </div>
        </template>
        <template #right>
          <UBadge color="neutral" variant="outline">
            {{ busy ? messages.resources.busy : messages.resources.ready }}
          </UBadge>
        </template>
      </UDashboardToolbar>

      <div v-if="!flattenedResources.length" class="panel-empty">
        {{ messages.resources.empty }}
      </div>

      <UTree
        v-else
        :items="explorerTreeItems"
        class="re-explorer-tree"
      >
        <!-- Directory node — wrapped in UContextMenu for right-click actions -->
        <template #item="{ item, handleToggle }">
          <UContextMenu
            v-if="item.kind === 'directory'"
            :items="getDirectoryActions(item as FolderTreeItem)"
          >
            <div
              class="re-tree-node re-tree-node--dir"
              @click="handleToggle"
            >
              <div class="re-tree-node-leading">
                <UIcon :name="item.icon" class="re-tree-icon" />
                <UBadge color="neutral" :variant="getNodeBadgeVariant(item as FolderTreeItem)" size="sm">
                  {{ getNodeStateLabel(item as FolderTreeItem) }}
                </UBadge>
              </div>
              <div class="re-tree-node-copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.path }}</small>
              </div>
            </div>
          </UContextMenu>

          <!-- File node — no context menu, no toggle -->
          <div
            v-else
            class="re-tree-node re-tree-node--file"
          >
            <div class="re-tree-node-leading">
              <UIcon :name="item.icon" class="re-tree-icon re-tree-icon--file" />
              <UBadge color="neutral" variant="outline" size="sm">
                {{ getNodeStateLabel(item as FolderTreeItem) }}
              </UBadge>
            </div>
            <div class="re-tree-node-copy">
              <strong>{{ item.label }}</strong>
              <small>{{ item.path }}</small>
            </div>
          </div>
        </template>
      </UTree>
    </section>
  </div>
</template>
<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui'
import { computed } from 'vue'

import type { ResourceTreeNode } from '~/shared/types'

import { useLocale } from '../composables/useLocale'
import { flattenResources, isProtectedResourceDirectory } from '~/utils/resource-tree'

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

const flattenedResources = computed(() => flattenResources(props.resources))
const directoryCount = computed(() => flattenedResources.value.filter((n) => n.kind === 'directory').length)
const fileCount = computed(() => flattenedResources.value.filter((n) => n.kind === 'file').length)
const protectedDirectoryCount = computed(
  () => flattenedResources.value.filter((n) => n.kind === 'directory' && isProtectedResourceDirectory(n.path)).length,
)

function getNodeStateLabel(node: ResourceTreeNode) {
  if (node.kind === 'file') return messages.value.resources.readOnly
  if (node.path === '.resources') return messages.value.resources.root
  if (isProtectedResourceDirectory(node.path)) return messages.value.resources.protected
  return messages.value.resources.managed
}

function getNodeIcon(node: ResourceTreeNode) {
  if (node.kind === 'file') return 'i-lucide-file-text'
  if (node.path === '.resources') return 'i-lucide-database'
  if (isProtectedResourceDirectory(node.path)) return 'i-lucide-lock'
  return 'i-lucide-folder'
}

function getDirectoryActions(node: ResourceTreeNode): ContextMenuItem[][] {
  const primaryActions: ContextMenuItem[] = [
    {
      label: node.path === '.resources' ? messages.value.resources.newFolder : messages.value.resources.child,
      icon: 'i-lucide-folder-plus',
      disabled: props.busy,
      onSelect: () => emit('create', node.path),
    },
  ]

  if (node.path !== '.resources') {
    primaryActions.push({
      label: messages.value.resources.move,
      icon: 'i-lucide-arrow-right-left',
      disabled: props.busy,
      onSelect: () => emit('move', node.path),
    })
  }

  const groupedActions: ContextMenuItem[][] = [primaryActions]

  if (node.path !== '.resources' && !isProtectedResourceDirectory(node.path)) {
    groupedActions.push([{
      label: messages.value.resources.delete,
      icon: 'i-lucide-trash-2',
      color: 'error',
      disabled: props.busy,
      onSelect: () => emit('delete', node.path),
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

      <ul v-else class="resource-listing">
        <li v-for="node in flattenedResources" :key="node.path">
          <UContextMenu v-if="node.kind === 'directory'" :items="getDirectoryActions(node)">
            <div class="resource-row resource-row-context">
              <div class="resource-node" :style="{ paddingInlineStart: `${node.depth * 1.1 + 0.25}rem` }">
                <div class="resource-node-badges">
                  <UIcon :name="getNodeIcon(node)" class="resource-node-icon" />
                  <UBadge color="neutral" variant="soft" size="sm">{{ getNodeStateLabel(node) }}</UBadge>
                </div>
                <div class="resource-node-copy">
                  <strong>{{ node.name }}</strong>
                  <small>{{ node.path }}</small>
                </div>
              </div>

              <div class="resource-actions">
                <UButton
                  color="neutral"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-folder-plus"
                  :disabled="busy"
                  @click.stop="emit('create', node.path)"
                >
                  {{ node.path === '.resources' ? messages.resources.newFolder : messages.resources.child }}
                </UButton>
                <UButton
                  v-if="node.path !== '.resources'"
                  color="neutral"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-arrow-right-left"
                  :disabled="busy"
                  @click.stop="emit('move', node.path)"
                >
                  {{ messages.resources.move }}
                </UButton>
                <UButton
                  v-if="node.path !== '.resources' && !isProtectedResourceDirectory(node.path)"
                  color="error"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :disabled="busy"
                  @click.stop="emit('delete', node.path)"
                >
                  {{ messages.resources.delete }}
                </UButton>
              </div>
            </div>
          </UContextMenu>

          <div v-else class="resource-row resource-row-file">
            <div class="resource-node" :style="{ paddingInlineStart: `${node.depth * 1.1 + 0.25}rem` }">
              <div class="resource-node-badges">
                <UIcon :name="getNodeIcon(node)" class="resource-node-icon" />
                <UBadge color="neutral" variant="outline" size="sm">{{ getNodeStateLabel(node) }}</UBadge>
              </div>
              <div class="resource-node-copy">
                <strong>{{ node.name }}</strong>
                <small>{{ node.path }}</small>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
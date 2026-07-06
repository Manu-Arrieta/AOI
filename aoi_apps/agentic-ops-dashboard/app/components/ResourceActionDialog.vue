<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { useLocale } from '../composables/useLocale'
import { useWorkspace } from '../composables/useWorkspace'
import {
  findTreeItem,
  getAncestorPaths,
  getParentPath,
  toFolderTreeItems,
} from '../utils/resource-tree'
import type { FolderTreeItem } from '../utils/resource-tree'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'move' | 'delete' | null
  anchorPath: string
  pending: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: Record<string, string | boolean>]
}>()

const { messages } = useLocale()
const { snapshot } = useWorkspace()

const form = reactive({
  folderName: '',
  parentPath: '.resources',
  purpose: '',
  sourcePath: '',
  destinationPath: '',
  reason: '',
  targetPath: '',
  confirmed: false,
})

// ─── UTree state ──────────────────────────────────────────────────────────────

/** Selected node in the UTree folder picker */
const selectedNode = ref<FolderTreeItem | undefined>()

/**
 * Transforms WorkspaceSnapshot.resources → FolderTreeItem[] for UTree.
 * In move mode:
 *  - disables the subtree at props.anchorPath (can't move into self/descendants)
 *  - expands ancestor paths of props.anchorPath's parent
 * In create mode:
 *  - expands ancestor paths of props.anchorPath
 */
const treeItems = computed<FolderTreeItem[]>(() => {
  const resources = snapshot.value?.resources ?? []
  
  // Disable origin path and its descendants in move mode
  const disabledPath = props.mode === 'move' ? props.anchorPath : undefined
  
  // Expand ancestors of parent in move, or anchor itself in create
  const expansionTarget = props.mode === 'move'
    ? getParentPath(props.anchorPath)
    : (props.anchorPath || '.resources')
    
  const ancestors = getAncestorPaths(expansionTarget)
  ancestors.add('.resources') // always expand root
  
  const children = toFolderTreeItems(resources, ancestors, disabledPath)
  
  // Wrap in a synthetic root so .resources itself is selectable
  return [{
    label: '.resources',
    path: '.resources',
    kind: 'directory' as const,
    icon: 'i-lucide-folder-root',
    // Root cannot be moved inside itself
    disabled: props.mode === 'move' && props.anchorPath === '.resources',
    defaultExpanded: true,
    children: children.length ? children : undefined,
  }]
})

// ─── Computed ─────────────────────────────────────────────────────────────────

const title = computed(() => {
  if (props.mode === 'create') return messages.value.resourceDialog.createTitle
  if (props.mode === 'move')   return messages.value.resourceDialog.moveTitle
  if (props.mode === 'delete') return messages.value.resourceDialog.deleteTitle
  return messages.value.resourceDialog.resourceAction
})

const description = computed(() => {
  if (props.mode === 'create') return `${messages.value.resourceDialog.parentPath}: ${props.anchorPath}`
  if (props.mode === 'move')   return `${messages.value.resourceDialog.sourcePath}: ${props.anchorPath}`
  if (props.mode === 'delete') return `${messages.value.resourceDialog.targetPath}: ${props.anchorPath}`
  return props.anchorPath
})

const modeIcon = computed(() => {
  if (props.mode === 'create') return 'i-lucide-folder-plus'
  if (props.mode === 'move')   return 'i-lucide-arrow-right-left'
  if (props.mode === 'delete') return 'i-lucide-trash-2'
  return 'i-lucide-settings'
})

const isSubmitDisabled = computed(() => {
  if (!props.mode || props.pending) return true

  if (props.mode === 'create') {
    return !form.folderName.trim().length ||
           !form.purpose.trim().length
  }

  if (props.mode === 'move') {
    return !form.sourcePath.trim().length ||
           !form.destinationPath.trim().length ||
           !form.reason.trim().length
  }

  // delete
  return !form.targetPath.trim().length ||
         !form.reason.trim().length ||
         !form.confirmed
})

// ─── Watchers ─────────────────────────────────────────────────────────────────

/**
 * Reset form + pre-select the anchorPath node in the tree whenever the
 * modal opens or mode/anchorPath changes.
 */
watch(
  () => [props.mode, props.anchorPath, props.open] as const,
  () => {
    form.folderName      = ''
    form.purpose         = ''
    form.sourcePath      = props.anchorPath || '.resources'
    form.destinationPath = props.anchorPath || '.resources'
    form.reason          = ''
    form.targetPath      = props.anchorPath || '.resources'
    form.confirmed       = false

    if (props.mode === 'create') {
      // Pre-select anchorPath if it is a directory; fallback to tree root
      const candidate = findTreeItem(treeItems.value, props.anchorPath)
      selectedNode.value = (candidate && candidate.kind === 'directory')
        ? candidate
        : (treeItems.value[0] ?? undefined)
      form.parentPath = (selectedNode.value?.path ?? props.anchorPath) || '.resources'
    } else if (props.mode === 'move') {
      // Pre-select parent of the resource being moved; fallback to tree root
      const parentPath = getParentPath(props.anchorPath)
      const candidate = findTreeItem(treeItems.value, parentPath)
      selectedNode.value = (candidate && candidate.kind === 'directory' && !candidate.disabled)
        ? candidate
        : (treeItems.value[0] ?? undefined)
      form.destinationPath = (selectedNode.value?.path ?? parentPath) || '.resources'
    }
  },
  { immediate: true },
)

/**
 * Keep form.parentPath / form.destinationPath in sync with UTree selection.
 * Only active directories can update the values.
 */
watch(selectedNode, (node) => {
  if (node && node.kind === 'directory' && !node.disabled) {
    if (props.mode === 'create') {
      form.parentPath = node.path
    } else if (props.mode === 'move') {
      form.destinationPath = node.path
    }
  }
})

// ─── Submit ───────────────────────────────────────────────────────────────────

function submit() {
  if (!props.mode) return

  const payload: Record<string, string | boolean> = {}

  if (props.mode === 'create') {
    payload.folderName = form.folderName
    payload.parentPath = form.parentPath
    payload.purpose = form.purpose
    emit('submit', payload)
    return
  }

  if (props.mode === 'move') {
    payload.sourcePath = form.sourcePath
    // form.destinationPath holds the selected PARENT folder from UTree.
    // The server expects the FINAL path (parent/folderName), not just the parent.
    const sourceBasename = form.sourcePath.split('/').pop() ?? form.sourcePath
    const parentDir = form.destinationPath.replace(/\/$/, '')
    payload.destinationPath = `${parentDir}/${sourceBasename}`
    payload.reason = form.reason
    emit('submit', payload)
    return
  }

  payload.targetPath = form.targetPath
  payload.reason = form.reason
  payload.confirmed = form.confirmed
  emit('submit', payload)
}
</script>

<template>
  <UModal
    :open="open && Boolean(mode)"
    :close="pending ? false : { color: 'neutral', variant: 'ghost' }"
    :description="description"
    :dismissible="!pending"
    :title="title"
    :ui="{
      content: 'max-w-lg rounded-[24px]',
      header: 'px-5 py-4',
      body: 'px-5 pb-1',
      footer: 'px-5 pb-5',
    }"
    @update:open="(nextOpen) => { if (!nextOpen) emit('close') }"
  >
    <template #title>
      <div class="dialog-title-row">
        <UIcon :name="modeIcon" class="dialog-title-icon" />
        <span>{{ title }}</span>
      </div>
    </template>

    <template #body>
      <div class="dialog-form-shell">
        <UAlert
          v-if="mode === 'delete'"
          color="error"
          icon="i-lucide-triangle-alert"
          variant="subtle"
          :description="messages.resourceDialog.confirmDelete"
        />

        <form id="resource-action-form" class="dialog-form" @submit.prevent="submit">
          <template v-if="mode === 'create'">
            <!-- Parent folder: visual tree picker (US1/US2/US3) -->
            <UFormField :label="messages.resourceDialog.parentPath" name="parent-path">
              <div class="folder-tree-picker">
                <!-- Loading state while snapshot is not yet available (FR-006) -->
                <template v-if="snapshot === null">
                  <USkeleton class="h-32 w-full rounded-lg" />
                </template>
                <!-- Empty state: no resources yet -->
                <template v-else-if="treeItems.length === 0">
                  <div class="folder-tree-empty">
                    <UIcon name="i-lucide-folder-open" class="folder-tree-empty-icon" />
                    <span>{{ form.parentPath }}</span>
                  </div>
                </template>
                <!-- UTree: single-select, directory-only (files have disabled=true) -->
                <template v-else>
                  <UTree
                    v-model="selectedNode"
                    :items="treeItems"
                    :get-key="(item: FolderTreeItem) => item.path"
                    color="primary"
                    size="sm"
                    :ui="{
                      root: 'folder-tree-root',
                      link: 'folder-tree-link',
                    }"
                  />
                </template>
              </div>
              <!-- Selected path badge -->
              <p class="folder-tree-selected-path">
                <UIcon name="i-lucide-corner-down-right" class="inline-block mr-1 opacity-50" />
                {{ form.parentPath }}
              </p>
            </UFormField>

            <UFormField :label="messages.resourceDialog.folderName" name="folder-name">
              <UInput
                v-model="form.folderName"
                class="w-full"
                :placeholder="messages.resourceDialog.folderPlaceholder"
                autofocus
              />
            </UFormField>

            <UFormField :label="messages.resourceDialog.purpose" name="purpose">
              <UTextarea v-model="form.purpose" class="w-full" :rows="3" />
            </UFormField>
          </template>

          <template v-else-if="mode === 'move'">
            <UFormField :label="messages.resourceDialog.sourcePath" name="source-path">
              <UInput v-model="form.sourcePath" class="w-full" />
            </UFormField>
            <UFormField :label="messages.resourceDialog.destinationPath" name="destination-path">
              <div class="folder-tree-picker">
                <!-- Loading state while snapshot is not yet available -->
                <template v-if="snapshot === null">
                  <USkeleton class="h-32 w-full rounded-lg" />
                </template>
                <!-- Empty state: no resources yet -->
                <template v-else-if="treeItems.length === 0">
                  <div class="folder-tree-empty">
                    <UIcon name="i-lucide-folder-open" class="folder-tree-empty-icon" />
                    <span>{{ form.destinationPath }}</span>
                  </div>
                </template>
                <!-- UTree: single-select, directory-only -->
                <template v-else>
                  <UTree
                    v-model="selectedNode"
                    :items="treeItems"
                    :get-key="(item: FolderTreeItem) => item.path"
                    color="primary"
                    size="sm"
                    :ui="{
                      root: 'folder-tree-root',
                      link: 'folder-tree-link',
                    }"
                  />
                </template>
              </div>
              <!-- Selected path badge -->
              <p class="folder-tree-selected-path">
                <UIcon name="i-lucide-corner-down-right" class="inline-block mr-1 opacity-50" />
                {{ form.destinationPath }}
              </p>
            </UFormField>
            <UFormField :label="messages.resourceDialog.reason" name="reason">
              <UTextarea v-model="form.reason" class="w-full" :rows="3" />
            </UFormField>
          </template>

          <template v-else>
            <UFormField :label="messages.resourceDialog.targetPath" name="target-path">
              <UInput v-model="form.targetPath" class="w-full" />
            </UFormField>
            <UFormField :label="messages.resourceDialog.reason" name="delete-reason">
              <UTextarea v-model="form.reason" class="w-full" :rows="3" />
            </UFormField>
            <div class="dialog-checkbox-row">
              <UCheckbox v-model="form.confirmed" :aria-label="messages.resourceDialog.confirmDelete" />
              <span>{{ messages.resourceDialog.confirmDelete }}</span>
            </div>
          </template>
        </form>
      </div>
    </template>

    <template #footer>
      <div class="dialog-actions">
        <UButton color="neutral" variant="ghost" :disabled="pending" @click="emit('close')">
          {{ messages.common.cancel }}
        </UButton>
        <UButton
          color="neutral"
          form="resource-action-form"
          type="submit"
          :disabled="isSubmitDisabled"
          :loading="pending"
          :icon="modeIcon"
        >
          {{ pending ? messages.common.working : messages.common.apply }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
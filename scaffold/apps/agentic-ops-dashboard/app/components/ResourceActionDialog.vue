<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { useLocale } from '../composables/useLocale'

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

const form = reactive({
  folderName: '',
  parentPath: '.resources',
  purpose: '',
  sourcePath: '',
  destinationPath: '',
  reason: '',
  targetPath: '',
  relatedTaskId: '',
  confirmed: false,
})

const title = computed(() => {
  if (props.mode === 'create') {
    return messages.value.resourceDialog.createTitle
  }

  if (props.mode === 'move') {
    return messages.value.resourceDialog.moveTitle
  }

  if (props.mode === 'delete') {
    return messages.value.resourceDialog.deleteTitle
  }

  return messages.value.resourceDialog.resourceAction
})
const description = computed(() => {
  if (props.mode === 'create') {
    return `${messages.value.resourceDialog.parentPath}: ${props.anchorPath}`
  }

  if (props.mode === 'move') {
    return `${messages.value.resourceDialog.sourcePath}: ${props.anchorPath}`
  }

  if (props.mode === 'delete') {
    return `${messages.value.resourceDialog.targetPath}: ${props.anchorPath}`
  }

  return props.anchorPath
})
const isSubmitDisabled = computed(() => {
  if (!props.mode || props.pending) {
    return true
  }

  if (props.mode === 'create') {
    return !form.folderName.trim().length
  }

  if (props.mode === 'move') {
    return !form.sourcePath.trim().length || !form.destinationPath.trim().length
  }

  return !form.targetPath.trim().length || !form.confirmed
})

watch(
  () => [props.mode, props.anchorPath, props.open],
  () => {
    form.folderName = ''
    form.parentPath = props.anchorPath || '.resources'
    form.purpose = ''
    form.sourcePath = props.anchorPath || '.resources'
    form.destinationPath = props.anchorPath || '.resources'
    form.reason = ''
    form.targetPath = props.anchorPath || '.resources'
    form.relatedTaskId = ''
    form.confirmed = false
  },
  { immediate: true },
)

function submit() {
  if (!props.mode) {
    return
  }

  if (props.mode === 'create') {
    emit('submit', {
      folderName: form.folderName,
      parentPath: form.parentPath,
      purpose: form.purpose,
      relatedTaskId: form.relatedTaskId,
    })
    return
  }

  if (props.mode === 'move') {
    emit('submit', {
      sourcePath: form.sourcePath,
      destinationPath: form.destinationPath,
      reason: form.reason,
      relatedTaskId: form.relatedTaskId,
    })
    return
  }

  emit('submit', {
    targetPath: form.targetPath,
    reason: form.reason,
    relatedTaskId: form.relatedTaskId,
    confirmed: form.confirmed,
  })
}
</script>

<template>
  <UModal
    :open="open && Boolean(mode)"
    :close="pending ? false : { color: 'neutral', variant: 'ghost' }"
    :description="description"
    :dismissible="!pending"
    :title="title"
    @update:open="(nextOpen) => { if (!nextOpen) emit('close') }"
  >
    <template #body>
      <div class="dialog-form-shell">
        <UAlert
          v-if="mode === 'delete'"
          color="warning"
          icon="i-lucide-triangle-alert"
          variant="subtle"
          :description="messages.resourceDialog.confirmDelete"
        />

        <form id="resource-action-form" class="dialog-form" @submit.prevent="submit">
          <template v-if="mode === 'create'">
            <UFormField :label="messages.resourceDialog.parentPath" name="parent-path">
              <UInput v-model="form.parentPath" class="w-full" />
            </UFormField>
            <UFormField :label="messages.resourceDialog.folderName" name="folder-name">
              <UInput v-model="form.folderName" class="w-full" :placeholder="messages.resourceDialog.folderPlaceholder" />
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
              <UInput v-model="form.destinationPath" class="w-full" />
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

          <UFormField :label="messages.resourceDialog.relatedTaskId" name="related-task-id">
            <UInput v-model="form.relatedTaskId" class="w-full" :placeholder="messages.resourceDialog.taskPlaceholder" />
          </UFormField>
        </form>
      </div>
    </template>

    <template #footer>
      <div class="dialog-actions">
        <UButton color="neutral" variant="outline" :disabled="pending" @click="emit('close')">
          {{ messages.common.cancel }}
        </UButton>
        <UButton
          color="neutral"
          form="resource-action-form"
          type="submit"
          :disabled="isSubmitDisabled"
          :loading="pending"
        >
          {{ pending ? messages.common.working : messages.common.apply }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
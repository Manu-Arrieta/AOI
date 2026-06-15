import { useState } from '#imports'
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'

import type { TaskRecord, WorkspaceEventPayload, WorkspaceSnapshot } from '~/shared/types'

import { clearTaskChangeState, diffTaskChangeStates, type TaskChangeState } from '../utils/task-changes'

let eventSource: EventSource | null = null
let consumerCount = 0

type RefreshWorkspaceInput = boolean | {
  preserveSelection?: boolean
  silent?: boolean
}

function resolveRefreshWorkspaceOptions(input: RefreshWorkspaceInput = true) {
  if (typeof input === 'boolean') {
    return {
      preserveSelection: input,
      silent: false,
    }
  }

  return {
    preserveSelection: input.preserveSelection ?? true,
    silent: input.silent ?? false,
  }
}

export function useWorkspace() {
  const snapshot = useState<WorkspaceSnapshot | null>('ops-dashboard-snapshot', () => null)
  const selectedTask = useState<TaskRecord | null>('ops-dashboard-selected-task', () => null)
  const selectedTaskId = useState<string | null>('ops-dashboard-selected-task-id', () => null)
  const isLoading = useState('ops-dashboard-loading', () => false)
  const isTaskLoading = useState('ops-dashboard-task-loading', () => false)
  const isMutatingResources = useState('ops-dashboard-resource-mutation', () => false)
  const errorMessage = useState<string | null>('ops-dashboard-error', () => null)
  const lastEvent = useState<WorkspaceEventPayload | null>('ops-dashboard-last-event', () => null)
  const taskChanges = useState<Record<string, TaskChangeState>>('ops-dashboard-task-changes', () => ({}))

  const counts = computed(() => snapshot.value?.counts ?? { features: 0, tasks: 0, activeTasks: 0 })
  const selectedFeature = computed(() => {
    if (!snapshot.value || !selectedTask.value) {
      return null
    }

    return snapshot.value.features.find((feature) => feature.slug === selectedTask.value?.feature) ?? null
  })

  async function refreshSelectedTask(taskId = selectedTaskId.value) {
    if (!taskId) {
      selectedTask.value = null
      return
    }

    isTaskLoading.value = true

    try {
      selectedTask.value = await $fetch<TaskRecord>(`/api/tasks/${taskId}`)
      errorMessage.value = null
    } catch {
      errorMessage.value = `Could not load task details for ${taskId}.`
    } finally {
      isTaskLoading.value = false
    }
  }

  async function refreshWorkspace(input: RefreshWorkspaceInput = true) {
    const { preserveSelection, silent } = resolveRefreshWorkspaceOptions(input)

    if (!silent) {
      isLoading.value = true
    }

    try {
      const previousSnapshot = snapshot.value
      const nextSnapshot = await $fetch<WorkspaceSnapshot>('/api/workspace')

      const nextSelectedTaskId = preserveSelection && selectedTaskId.value
        && nextSnapshot.tasks.some((task) => task.id === selectedTaskId.value)
        ? selectedTaskId.value
        : nextSnapshot.tasks[0]?.id ?? null

      taskChanges.value = diffTaskChangeStates(previousSnapshot, nextSnapshot, taskChanges.value)

      if (import.meta.client && previousSnapshot) {
        await nextTick()
      }

      snapshot.value = nextSnapshot
      selectedTaskId.value = nextSelectedTaskId
      errorMessage.value = null
      await nextTick()

      await refreshSelectedTask(nextSelectedTaskId)
    } catch {
      errorMessage.value = 'Could not load the workspace snapshot.'
    } finally {
      if (!silent) {
        isLoading.value = false
      }
    }
  }

  function selectTask(taskId: string) {
    taskChanges.value = clearTaskChangeState(taskChanges.value, taskId)
    selectedTaskId.value = taskId
    void refreshSelectedTask(taskId)
  }

  async function initializeWorkspace() {
    if (!snapshot.value) {
      await refreshWorkspace(false)
      return
    }

    if (selectedTaskId.value) {
      await refreshSelectedTask(selectedTaskId.value)
      return
    }

    const firstTaskId = snapshot.value.tasks[0]?.id ?? null
    if (firstTaskId) {
      selectedTaskId.value = firstTaskId
      await refreshSelectedTask(firstTaskId)
    }
  }

  async function performResourceAction(
    mode: 'create' | 'move' | 'delete',
    payload: Record<string, string | boolean>,
  ) {
    const endpointMap = {
      create: '/api/resources/create',
      move: '/api/resources/move',
      delete: '/api/resources/delete',
    } as const

    isMutatingResources.value = true

    try {
      await $fetch(endpointMap[mode], {
        method: 'POST',
        body: payload,
      })
      errorMessage.value = null
      await refreshWorkspace(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The resource operation failed.'
      errorMessage.value = message
      throw error
    } finally {
      isMutatingResources.value = false
    }
  }

  function connectRealtime() {
    if (!import.meta.client || eventSource) {
      return
    }

    eventSource = new EventSource('/events')

    const handleRefresh = async (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as WorkspaceEventPayload
      lastEvent.value = payload

      if (payload.type === 'workspace:refresh') {
        await refreshWorkspace({ preserveSelection: true, silent: true })
      }
    }

    eventSource.addEventListener('workspace:ready', handleRefresh as EventListener)
    eventSource.addEventListener('workspace:refresh', handleRefresh as EventListener)
    eventSource.onerror = () => {
      if (eventSource?.readyState === EventSource.CLOSED) {
        errorMessage.value = 'Realtime stream disconnected. Attempting to reconnect.'
        eventSource = null
        globalThis.setTimeout(() => {
          connectRealtime()
        }, 1200)
      }
    }
  }

  onMounted(() => {
    consumerCount += 1
    connectRealtime()
  })

  onBeforeUnmount(() => {
    consumerCount -= 1

    if (consumerCount <= 0 && eventSource) {
      eventSource.close()
      eventSource = null
      consumerCount = 0
    }
  })

  watch(
    () => snapshot.value?.tasks,
    (tasks) => {
      if (!tasks?.length) {
        selectedTaskId.value = null
        selectedTask.value = null
        return
      }

      if (!selectedTaskId.value || !tasks.some((task) => task.id === selectedTaskId.value)) {
        const firstTaskId = tasks[0]?.id ?? null
        if (firstTaskId) {
          selectedTaskId.value = firstTaskId
          void refreshSelectedTask(firstTaskId)
        }
      }
    },
    { immediate: true },
  )

  return {
    snapshot,
    selectedTask,
    selectedTaskId,
    selectedFeature,
    counts,
    isLoading,
    isTaskLoading,
    isMutatingResources,
    errorMessage,
    lastEvent,
    taskChanges,
    initializeWorkspace,
    refreshWorkspace,
    selectTask,
    performResourceAction,
  }
}
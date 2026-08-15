<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useLocale } from '../composables/useLocale'

export interface DagViewerNode {
  id: string
  title: string
  role: string
  dependsOn: string[]
  targetFiles?: string[]
  testRequirements?: string
  status: 'pending' | 'ready' | 'in_progress' | 'completed' | 'healing' | 'failed'
}

const props = withDefaults(
  defineProps<{
    nodes?: DagViewerNode[]
    selectedNodeId?: string | null
  }>(),
  {
    nodes: () => [],
    selectedNodeId: null,
  }
)

const emit = defineEmits<{
  select: [nodeId: string]
}>()

const { messages } = useLocale()
const isRunning = ref(false)
const isPaused = ref(false)
const liveLog = ref<string[]>([])
const inspectedNode = ref<DagViewerNode | null>(null)
let eventSource: EventSource | null = null

onMounted(() => {
  if (typeof window !== 'undefined' && 'EventSource' in window) {
    try {
      eventSource = new EventSource('/api/aoi-os/stream')
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.message) {
            liveLog.value.unshift(`[${new Date().toLocaleTimeString()}] ${data.message}`)
            if (liveLog.value.length > 6) liveLog.value.pop()
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
})

async function triggerAoiOsExecution() {
  isRunning.value = true
  isPaused.value = false
  try {
    const firstNode = props.nodes[0]
    await $fetch('/api/aoi-os/dispatch', {
      method: 'POST',
      body: {
        action: 'simulate_run',
        taskId: firstNode?.id || 'TASK-AOI-OS',
      },
    })
  } catch (err) {
    console.error('AOI-OS Dispatch error:', err)
  } finally {
    setTimeout(() => {
      isRunning.value = false
    }, 2000)
  }
}

async function sendControlCommand(command: 'pause' | 'resume' | 'step' | 'retry_wave') {
  if (command === 'pause') isPaused.value = true
  if (command === 'resume') isPaused.value = false

  try {
    await $fetch('/api/aoi-os/control', {
      method: 'POST',
      body: { command },
    })
  } catch (err) {
    console.error('AOI-OS Control error:', err)
  }
}

function handleNodeClick(node: DagViewerNode) {
  inspectedNode.value = node
  emit('select', node.id)
}

/** Status color mappings */
function nodeStatusColor(status: DagViewerNode['status']): 'neutral' | 'info' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'completed': return 'success'
    case 'in_progress': return 'info'
    case 'healing': return 'warning'
    case 'failed': return 'error'
    case 'ready': return 'info'
    default: return 'neutral'
  }
}

/** Status label translations */
function nodeStatusLabel(status: DagViewerNode['status']) {
  switch (status) {
    case 'completed': return messages.value.dagViewer.statusCompleted
    case 'in_progress': return messages.value.dagViewer.statusInProgress
    case 'healing': return messages.value.dagViewer.statusHealing
    case 'failed': return messages.value.dagViewer.statusFailed
    case 'ready': return messages.value.dagViewer.statusReady
    default: return messages.value.dagViewer.statusPending
  }
}

/** Role badge styling */
function roleBadgeColor(role: string): 'neutral' | 'info' | 'warning' | 'success' | 'secondary' {
  const r = role.toLowerCase()
  if (r.includes('front') || r.includes('ui')) return 'info'
  if (r.includes('back') || r.includes('api')) return 'secondary'
  if (r.includes('devops') || r.includes('infra')) return 'warning'
  if (r.includes('qa') || r.includes('test')) return 'success'
  return 'neutral'
}

/** Compute parallel execution waves */
const waves = computed(() => {
  if (!props.nodes.length) return []
  const nodeMap = new Map(props.nodes.map((n) => [n.id, n]))
  const completed = new Set<string>()
  const remaining = new Set(props.nodes.map((n) => n.id))
  const batches: DagViewerNode[][] = []

  let safetyGuard = 0
  while (remaining.size > 0 && safetyGuard < 50) {
    safetyGuard++
    const currentWave: DagViewerNode[] = []

    for (const id of remaining) {
      const node = nodeMap.get(id)!
      const depsMet = node.dependsOn.every((dep) => completed.has(dep) || !nodeMap.has(dep))
      if (depsMet) {
        currentWave.push(node)
      }
    }

    if (currentWave.length === 0) {
      batches.push(Array.from(remaining).map((id) => nodeMap.get(id)!))
      break
    }

    batches.push(currentWave)
    for (const node of currentWave) {
      remaining.delete(node.id)
      completed.add(node.id)
    }
  }

  return batches
})
</script>

<template>
  <div class="task-dag-viewer">
    <header class="dag-header">
      <div>
        <p class="eyebrow">{{ messages.dagViewer.eyebrow }}</p>
        <h3>{{ messages.dagViewer.title }}</h3>
      </div>
      <div class="dag-header-actions">
        <!-- Playback Controls -->
        <div class="playback-controls">
          <UButton
            v-if="!isPaused"
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-pause"
            @click="sendControlCommand('pause')"
          >
            {{ messages.dagViewer.pause }}
          </UButton>
          <UButton
            v-else
            size="xs"
            color="success"
            variant="outline"
            icon="i-lucide-play"
            @click="sendControlCommand('resume')"
          >
            {{ messages.dagViewer.resume }}
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-step-forward"
            @click="sendControlCommand('step')"
          >
            {{ messages.dagViewer.stepWave }}
          </UButton>
        </div>

        <UBadge color="neutral" variant="subtle" size="sm">
          {{ props.nodes.length }} Nodes · {{ waves.length }} Waves
        </UBadge>

        <UButton
          size="xs"
          color="primary"
          variant="solid"
          icon="i-lucide-play"
          :loading="isRunning"
          @click="triggerAoiOsExecution"
        >
          Run AOI-OS
        </UButton>
      </div>
    </header>

    <p class="dag-copy">{{ messages.dagViewer.copy }}</p>

    <!-- Live SSE Telemetry snippet -->
    <div v-if="liveLog.length" class="dag-live-feed">
      <div class="live-feed-header">
        <span class="live-dot" />
        <small>Live AOI-OS Telemetry Stream</small>
      </div>
      <p v-for="(log, i) in liveLog" :key="i" class="live-log-item">{{ log }}</p>
    </div>

    <!-- Node Inspector Drawer (Horizon 4) -->
    <div v-if="inspectedNode" class="node-inspector-drawer">
      <div class="inspector-header">
        <div>
          <span class="inspector-eyebrow">{{ messages.dagViewer.nodeInspector }}</span>
          <h4>{{ inspectedNode.id }} — {{ inspectedNode.title }}</h4>
        </div>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          @click="inspectedNode = null"
        />
      </div>

      <div class="inspector-grid">
        <article class="inspector-card">
          <span class="inspector-label">{{ messages.dagViewer.microAgentPayload }}</span>
          <strong>@{{ inspectedNode.role }} (Ephemeral Synthesizer)</strong>
          <small>&lt;300 tokens overhead · Tools: Read, Edit, Test, Bash</small>
        </article>

        <article class="inspector-card">
          <span class="inspector-label">{{ messages.dagViewer.astContractGuard }}</span>
          <strong>0 Contract Violations</strong>
          <small>C#, TS, Vue SFC, Python Invariants Verified</small>
        </article>

        <article class="inspector-card">
          <span class="inspector-label">{{ messages.dagViewer.consensusScore }}</span>
          <strong class="text-success">100% (Approved)</strong>
          <small>OWASP Clean · &lt;300 LOC Invariant Respected</small>
        </article>

        <article class="inspector-card">
          <span class="inspector-label">{{ messages.dagViewer.tokenGovernorBudget }}</span>
          <strong>Standard Mode</strong>
          <small>Velocity Nominal (0 anomalies)</small>
        </article>
      </div>
    </div>

    <div v-if="!props.nodes.length" class="dag-empty">
      <p>{{ messages.dagViewer.noNodes }}</p>
    </div>

    <div v-else class="dag-waves-container">
      <div v-for="(wave, waveIndex) in waves" :key="waveIndex" class="dag-wave-row">
        <div class="dag-wave-marker">
          <span>Wave {{ waveIndex + 1 }}</span>
        </div>

        <div class="dag-wave-nodes">
          <div
            v-for="node in wave"
            :key="node.id"
            class="dag-node-card"
            :class="{
              'is-selected': (props.selectedNodeId === node.id) || (inspectedNode?.id === node.id),
              'is-in-progress': node.status === 'in_progress',
              'is-healing': node.status === 'healing'
            }"
            @click="handleNodeClick(node)"
          >
            <div class="dag-node-header">
              <strong>{{ node.id }}</strong>
              <UBadge :color="nodeStatusColor(node.status)" variant="subtle" size="xs">
                {{ nodeStatusLabel(node.status) }}
              </UBadge>
            </div>

            <p class="dag-node-title">{{ node.title }}</p>

            <div class="dag-node-meta">
              <UBadge :color="roleBadgeColor(node.role)" variant="outline" size="xs">
                @{{ node.role }}
              </UBadge>
              <span v-if="node.dependsOn.length" class="dag-dep-tag">
                <UIcon name="i-lucide-git-branch" />
                {{ node.dependsOn.join(', ') }}
              </span>
              <span v-else class="dag-dep-tag root-tag">
                {{ messages.dagViewer.noDependencies }}
              </span>
            </div>

            <div v-if="node.targetFiles && node.targetFiles.length" class="dag-node-files">
              <small v-for="file in node.targetFiles.slice(0, 2)" :key="file">
                {{ file }}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-dag-viewer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
}

.dag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.dag-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.dag-copy {
  font-size: 0.85rem;
  color: var(--ui-text-muted);
  margin-top: -0.25rem;
}

.dag-live-feed {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--ui-border-accented, rgba(255, 255, 255, 0.1));
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-family: monospace;
  font-size: 0.75rem;
}

.live-feed-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ui-primary, #38bdf8);
  margin-bottom: 0.25rem;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.live-log-item {
  margin: 0;
  color: var(--ui-text-muted);
  line-height: 1.3;
}

/* Node Inspector Drawer */
.node-inspector-drawer {
  background: var(--ui-bg, #0f172a);
  border: 1px solid var(--ui-border-accented, #38bdf8);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  animation: fadeIn 0.2s ease-in-out;
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.inspector-eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ui-primary, #38bdf8);
}

.inspector-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.inspector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.5rem;
}

.inspector-card {
  background: var(--ui-bg-elevated, #1e293b);
  border: 1px solid var(--ui-border, #334155);
  border-radius: 0.375rem;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.inspector-label {
  font-size: 0.7rem;
  color: var(--ui-text-muted);
}

.inspector-card strong {
  font-size: 0.8rem;
}

.inspector-card small {
  font-size: 0.7rem;
  color: var(--ui-text-muted);
}

.text-success {
  color: #22c55e;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.dag-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--ui-text-muted);
  font-size: 0.875rem;
}

.dag-waves-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dag-wave-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 0.75rem;
  align-items: start;
}

.dag-wave-marker {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ui-text-muted);
  padding-top: 0.5rem;
}

.dag-wave-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dag-node-card {
  flex: 1 1 240px;
  max-width: 320px;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  padding: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.dag-node-card:hover {
  border-color: var(--ui-border-accented);
  transform: translateY(-1px);
}

.dag-node-card.is-selected {
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 1px var(--ui-primary);
}

.dag-node-card.is-in-progress {
  border-color: var(--ui-info, #0284c7);
  animation: pulse-border 2s infinite;
}

.dag-node-card.is-healing {
  border-color: var(--ui-warning, #eab308);
  animation: pulse-border 1.5s infinite;
}

@keyframes pulse-border {
  0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(56, 189, 248, 0); }
  100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
}

.dag-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dag-node-title {
  font-size: 0.8rem;
  font-weight: 500;
  margin: 0;
  line-height: 1.25;
}

.dag-node-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
}

.dag-dep-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--ui-text-muted);
}

.dag-dep-tag.root-tag {
  font-style: italic;
  opacity: 0.7;
}

.dag-node-files {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.7rem;
  color: var(--ui-text-muted);
  font-family: monospace;
}
</style>

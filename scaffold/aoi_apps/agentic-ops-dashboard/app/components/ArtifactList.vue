<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ArtifactRecord } from '~/shared/types'

import { useLocale } from '../composables/useLocale'
import {
  computeSddPipeline,
  resolveArtifactSddMeta,
  type SddPhaseId,
} from '../utils/sdd-artifacts'

const props = defineProps<{
  artifacts: ArtifactRecord[]
  selectedPath: string | null
}>()

const emit = defineEmits<{ select: [artifactPath: string] }>()

const { messages } = useLocale()
const selectedPhaseFilter = ref<SddPhaseId | 'all'>('all')

const pipelineSummary = computed(() => computeSddPipeline(props.artifacts))

const decoratedArtifacts = computed(() =>
  props.artifacts.map((artifact) => ({
    ...artifact,
    meta: resolveArtifactSddMeta(artifact.name),
  })),
)

const filteredArtifacts = computed(() => {
  if (selectedPhaseFilter.value === 'all') {
    return decoratedArtifacts.value
  }
  return decoratedArtifacts.value.filter(
    (a) => a.meta.phase === selectedPhaseFilter.value,
  )
})

const activePhasesWithArtifacts = computed(() => {
  const present = new Set(decoratedArtifacts.value.map((a) => a.meta.phase))
  return pipelineSummary.value.phases.filter((p) => present.has(p.phase))
})
</script>

<template>
  <div class="artifact-panel flex flex-col gap-3">
    <!-- Header with total and gate count -->
    <header class="mini-header flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-git-merge" class="w-4 h-4 text-primary" />
        <h3 class="font-semibold text-sm text-neutral-900 dark:text-white">
          {{ messages.artifactsPanel.title }}
        </h3>
      </div>
      <div class="flex items-center gap-1.5">
        <UBadge
          v-if="pipelineSummary.gateArtifactCount > 0"
          color="warning"
          variant="subtle"
          size="xs"
          class="font-mono"
        >
          {{ pipelineSummary.gateArtifactCount }} {{ messages.artifactsPanel.gateArtifacts }}
        </UBadge>
        <UBadge color="neutral" variant="outline" size="xs">
          {{ artifacts.length }}
        </UBadge>
      </div>
    </header>

    <!-- Visual SDD Pipeline Stepper -->
    <div class="p-3 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
      <div class="flex items-center justify-between text-[11px] font-mono text-neutral-500">
        <span class="flex items-center gap-1">
          <UIcon name="i-lucide-workflow" class="w-3.5 h-3.5 text-primary" />
          {{ messages.artifactsPanel.sddPipeline }}
        </span>
        <span class="font-semibold text-neutral-800 dark:text-neutral-200">
          {{ pipelineSummary.progressRatio }}%
        </span>
      </div>

      <!-- 6 Canonical Phases Stepper Grid -->
      <div class="grid grid-cols-6 gap-1">
        <div
          v-for="step in pipelineSummary.phases"
          :key="step.phase"
          class="flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl text-center transition-all"
          :class="[
            step.completed
              ? 'bg-white dark:bg-neutral-800 border border-neutral-200/90 dark:border-neutral-700 shadow-2xs'
              : 'bg-neutral-100/50 dark:bg-neutral-900/30 opacity-60',
            step.active && step.completed ? 'ring-1 ring-primary/40' : '',
          ]"
        >
          <div class="flex items-center justify-center w-5 h-5 rounded-full" :class="step.completed ? 'bg-primary/10 text-primary' : 'bg-neutral-200/50 dark:bg-neutral-800 text-neutral-400'">
            <UIcon :name="step.completed ? 'i-lucide-check' : step.icon" class="w-3 h-3" />
          </div>
          <span class="text-[10px] font-medium leading-tight truncate w-full" :title="messages.artifactsPanel.phases[step.phase]">
            {{ messages.artifactsPanel.phases[step.phase] }}
          </span>
          <span v-if="step.artifactCount > 0" class="text-[9px] font-mono font-semibold px-1 rounded bg-neutral-200/60 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
            {{ step.artifactCount }}
          </span>
        </div>
      </div>
    </div>

    <!-- Quick Phase Filter Chips (only when > 3 artifacts across multiple phases) -->
    <div v-if="activePhasesWithArtifacts.length > 1" class="flex flex-wrap items-center gap-1 pt-0.5">
      <UButton
        size="xs"
        :color="selectedPhaseFilter === 'all' ? 'primary' : 'neutral'"
        :variant="selectedPhaseFilter === 'all' ? 'solid' : 'ghost'"
        class="rounded-lg text-[11px] py-1 px-2"
        @click="selectedPhaseFilter = 'all'"
      >
        {{ messages.artifactsPanel.filterAll }} ({{ artifacts.length }})
      </UButton>
      <UButton
        v-for="p in activePhasesWithArtifacts"
        :key="p.phase"
        size="xs"
        :color="selectedPhaseFilter === p.phase ? 'primary' : 'neutral'"
        :variant="selectedPhaseFilter === p.phase ? 'solid' : 'ghost'"
        class="rounded-lg text-[11px] py-1 px-2"
        @click="selectedPhaseFilter = p.phase"
      >
        <UIcon :name="p.icon" class="mr-1 w-3 h-3" />
        {{ messages.artifactsPanel.phases[p.phase] }} ({{ p.artifactCount }})
      </UButton>
    </div>

    <!-- Empty State -->
    <div v-if="!artifacts.length" class="panel-empty panel-empty-tight">
      {{ messages.artifactsPanel.empty }}
    </div>

    <!-- Filtered Artifact List -->
    <ul v-else class="artifact-list space-y-1.5 overflow-y-auto max-h-[460px] pr-1">
      <li v-for="artifact in filteredArtifacts" :key="artifact.path">
        <UButton
          :class="[
            'artifact-item w-full flex items-center justify-between text-left p-2.5 rounded-xl transition-all border',
            artifact.path === selectedPath
              ? 'bg-primary-50/70 dark:bg-primary-950/40 border-primary-300 dark:border-primary-700 shadow-2xs'
              : 'border-transparent hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70',
          ]"
          :color="artifact.path === selectedPath ? 'primary' : 'neutral'"
          variant="ghost"
          block
          @click="emit('select', artifact.path)"
        >
          <div class="flex items-start gap-2.5 min-w-0 flex-1">
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              :class="[
                artifact.meta.isGateArtifact
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
              ]"
            >
              <UIcon :name="artifact.meta.icon" class="w-3.5 h-3.5" />
            </div>

            <div class="truncate flex-1">
              <strong class="block text-xs font-semibold text-neutral-900 dark:text-white truncate">
                {{ artifact.name }}
              </strong>
              <small class="block text-[11px] font-mono text-neutral-500 truncate">
                {{ artifact.path }}
              </small>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0 ml-2">
            <!-- Phase Gate Badge -->
            <UBadge
              v-if="artifact.meta.gate"
              :color="artifact.meta.gateBadgeColor ?? 'neutral'"
              variant="subtle"
              size="xs"
              class="font-mono"
            >
              {{ artifact.meta.gate }}
            </UBadge>

            <!-- SDD Phase Badge -->
            <UBadge
              :color="artifact.meta.phaseColor"
              variant="outline"
              size="xs"
              class="font-mono hidden sm:inline-flex"
            >
              {{ messages.artifactsPanel.phases[artifact.meta.phase] }}
            </UBadge>

            <!-- Directory indicator if applicable -->
            <UBadge
              v-if="artifact.kind === 'directory'"
              color="neutral"
              variant="outline"
              size="xs"
            >
              dir
            </UBadge>
          </div>
        </UButton>
      </li>
    </ul>
  </div>
</template>
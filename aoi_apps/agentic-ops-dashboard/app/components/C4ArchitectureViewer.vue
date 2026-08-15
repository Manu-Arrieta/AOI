<script setup lang="ts">
import { ref, onMounted } from 'vue'

const diagram = ref<string>('')
const isLoading = ref(true)
const systemName = ref('AOI-OS Governed Micro-Architecture')
const containerCount = ref(0)
const relationsCount = ref(0)

async function fetchC4Data() {
  isLoading.value = true
  try {
    const data = await $fetch<{
      mermaidDiagram: string
      containerCount: number
      relationsCount: number
    }>('/api/aoi-os/c4')

    diagram.value = data.mermaidDiagram
    containerCount.value = data.containerCount
    relationsCount.value = data.relationsCount
  } catch (err) {
    console.error('Failed to load C4 diagram:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchC4Data()
})
</script>

<template>
  <div class="c4-architecture-viewer flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl ring-1 ring-white/5">
    <header class="flex items-center justify-between">
      <div>
        <span class="text-xs font-semibold uppercase tracking-wider text-primary-400">Architecture Observability</span>
        <h3 class="text-base font-bold text-slate-100">{{ systemName }}</h3>
      </div>
      <div class="flex items-center gap-2">
        <UBadge color="neutral" variant="subtle" size="sm">
          {{ containerCount }} Components · {{ relationsCount }} Contracts
        </UBadge>
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :loading="isLoading"
          @click="fetchC4Data"
        >
          Refresh
        </UButton>
      </div>
    </header>

    <!-- Diagram container -->
    <div class="rounded-lg border border-slate-800 bg-slate-950/60 p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
      <div v-if="isLoading" class="flex items-center justify-center p-8 text-slate-500">
        <UIcon name="i-lucide-loader-2" class="w-5 h-5 animate-spin mr-2" />
        Loading dynamic C4 architecture...
      </div>
      <div v-else>
        {{ diagram }}
      </div>
    </div>
  </div>
</template>

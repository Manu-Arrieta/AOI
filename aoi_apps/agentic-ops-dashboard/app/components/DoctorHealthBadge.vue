<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDoctor } from '../composables/useDoctor'
import { useLocale } from '../composables/useLocale'

const { report, isLoading, isHealthy, passedCount, totalCount, fetchDoctorReport } = useDoctor()
const { messages } = useLocale()
const isModalOpen = ref(false)

onMounted(() => {
  fetchDoctorReport()
})
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <!-- Health status button trigger -->
    <UButton
      :color="isLoading ? 'neutral' : (isHealthy ? 'success' : 'error')"
      :variant="isHealthy ? 'soft' : 'subtle'"
      size="sm"
      class="font-mono text-xs cursor-pointer shadow-sm rounded-full transition-all"
      @click="isModalOpen = true"
    >
      <template #leading>
        <span class="relative flex h-2 w-2">
          <span
            v-if="!isLoading && isHealthy"
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
          />
          <span
            class="relative inline-flex rounded-full h-2 w-2"
            :class="isLoading ? 'bg-neutral-400' : (isHealthy ? 'bg-emerald-500' : 'bg-rose-500')"
          />
        </span>
      </template>

      <span>
        {{ isLoading ? messages.doctor.checking : isHealthy ? `${passedCount}/${totalCount} ${messages.doctor.healthyBadge}` : `${report?.summary.failed} ${messages.doctor.issuesBadge}` }}
      </span>

      <template #trailing>
        <UIcon name="i-lucide-info" class="w-3.5 h-3.5 opacity-60 hover:opacity-100 transition-opacity" />
      </template>
    </UButton>

    <!-- 360° Health Diagnostic Modal -->
    <UModal
      v-model:open="isModalOpen"
      :title="messages.doctor.modalTitle"
      description="AOI Workspace 360° Diagnostic Report"
      :ui="{
        content: 'max-w-2xl rounded-2xl',
        header: 'px-5 py-4 border-b border-neutral-200 dark:border-neutral-800',
        body: 'p-4 sm:p-5',
        footer: 'px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between',
      }"
    >
      <template #body>
        <div class="space-y-4 font-mono text-xs max-h-[60vh] overflow-y-auto pr-1">
          <!-- Summary Counters Bar -->
          <UCard variant="subtle">
            <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-shield-check" class="w-4 h-4 text-emerald-500" />
                <span class="text-neutral-500 dark:text-neutral-400">Total Checks:</span>
                <strong class="text-neutral-900 dark:text-white font-bold">{{ report?.summary.total ?? 0 }}</strong>
              </div>
              <div class="flex items-center gap-3">
                <UBadge color="success" variant="subtle" size="sm">
                  <UIcon name="i-lucide-check" class="mr-1" />
                  {{ report?.summary.passed ?? 0 }} Passed
                </UBadge>
                <UBadge v-if="report?.summary.warnings" color="warning" variant="subtle" size="sm">
                  <UIcon name="i-lucide-alert-triangle" class="mr-1" />
                  {{ report?.summary.warnings }} Warnings
                </UBadge>
                <UBadge v-if="report?.summary.failed" color="error" variant="subtle" size="sm">
                  <UIcon name="i-lucide-x" class="mr-1" />
                  {{ report?.summary.failed }} Failed
                </UBadge>
              </div>
            </div>
          </UCard>

          <!-- Individual Checks List -->
          <div class="space-y-2">
            <UCard
              v-for="(check, idx) in report?.checks"
              :key="idx"
              :variant="check.status === 'PASSED' ? 'outline' : 'subtle'"
              :class="[
                check.status === 'PASSED'
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : check.status === 'WARNING'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-rose-500/30 bg-rose-500/5'
              ]"
            >
              <div class="flex items-start gap-3">
                <UIcon
                  :name="check.status === 'PASSED' ? 'i-lucide-check-circle-2' : check.status === 'WARNING' ? 'i-lucide-alert-triangle' : 'i-lucide-x-circle'"
                  :class="[
                    check.status === 'PASSED' ? 'text-emerald-500' : check.status === 'WARNING' ? 'text-amber-500' : 'text-rose-500',
                    'w-4 h-4 mt-0.5 shrink-0'
                  ]"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-neutral-900 dark:text-neutral-100">{{ check.name }}</span>
                    <UBadge color="neutral" variant="outline" size="xs">
                      {{ check.category }}
                    </UBadge>
                  </div>
                  <p class="mt-1 text-xs opacity-80 break-all text-neutral-600 dark:text-neutral-400">
                    {{ check.details }}
                  </p>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </template>

      <template #footer>
        <span class="text-[10px] text-neutral-500 font-mono">
          Last checked: {{ report?.timestamp ? new Date(report.timestamp).toLocaleTimeString() : 'N/A' }}
        </span>
        <div class="flex items-center gap-2">
          <UButton
            color="success"
            variant="soft"
            size="xs"
            icon="i-lucide-refresh-cw"
            :loading="isLoading"
            @click="fetchDoctorReport"
          >
            {{ messages.doctor.runCheck }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            @click="isModalOpen = false"
          >
            {{ messages.common.close }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

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
    <button
      type="button"
      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-all duration-200 cursor-pointer shadow-sm"
      :class="[
        isLoading
          ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400 animate-pulse'
          : isHealthy
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-400 hover:bg-emerald-900/50 hover:border-emerald-700'
            : 'bg-rose-950/40 border-rose-800/80 text-rose-400 hover:bg-rose-900/50 hover:border-rose-700'
      ]"
      @click="isModalOpen = true"
    >
      <span
        class="w-2 h-2 rounded-full"
        :class="[
          isLoading ? 'bg-neutral-400' : isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
        ]"
      />
      <span class="font-medium">
        {{ isLoading ? messages.doctor.checking : isHealthy ? `${passedCount}/${totalCount} ${messages.doctor.healthyBadge}` : `${report?.summary.failed} ${messages.doctor.issuesBadge}` }}
      </span>
      <span class="text-neutral-500 hover:text-neutral-300">ℹ️</span>
    </button>

    <!-- Detailed Modal -->
    <UModal v-model="isModalOpen">
      <UCard :ui="{ divide: 'divide-y divide-neutral-800', background: 'bg-neutral-900', ring: 'ring-1 ring-neutral-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-lg">🩺</span>
              <h3 class="text-base font-semibold text-white font-mono">
                {{ messages.doctor.modalTitle }}
              </h3>
            </div>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
              class="-my-1"
              @click="isModalOpen = false"
            />
          </div>
        </template>

        <div class="space-y-4 py-2 max-h-[65vh] overflow-y-auto font-mono text-xs">
          <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-950/70 border border-neutral-800">
            <div>
              <span class="text-neutral-400">Total Checks: </span>
              <span class="text-white font-bold">{{ report?.summary.total ?? 0 }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-emerald-400">✓ {{ report?.summary.passed ?? 0 }} Passed</span>
              <span v-if="report?.summary.warnings" class="text-amber-400">⚠ {{ report?.summary.warnings }} Warnings</span>
              <span v-if="report?.summary.failed" class="text-rose-400">✗ {{ report?.summary.failed }} Failed</span>
            </div>
          </div>

          <div class="space-y-2">
            <div
              v-for="(check, idx) in report?.checks"
              :key="idx"
              class="p-3 rounded-lg border flex items-start gap-3 transition-colors"
              :class="[
                check.status === 'PASSED'
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                  : check.status === 'WARNING'
                    ? 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                    : 'bg-rose-950/20 border-rose-900/40 text-rose-300'
              ]"
            >
              <span class="text-sm mt-0.5">
                {{ check.status === 'PASSED' ? '✅' : check.status === 'WARNING' ? '⚠️' : '❌' }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-bold text-white">{{ check.name }}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                    {{ check.category }}
                  </span>
                </div>
                <p class="mt-1 text-xs opacity-80 break-all">
                  {{ check.details }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-neutral-500 font-mono">
              Last checked: {{ report?.timestamp ? new Date(report.timestamp).toLocaleTimeString() : 'N/A' }}
            </span>
            <UButton
              color="emerald"
              variant="soft"
              size="xs"
              :loading="isLoading"
              @click="fetchDoctorReport"
            >
              🔄 {{ messages.doctor.runCheck }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

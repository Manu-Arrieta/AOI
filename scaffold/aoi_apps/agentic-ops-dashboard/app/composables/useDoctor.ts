import { computed, ref } from 'vue'

export interface DoctorCheck {
  category: string
  name: string
  status: 'PASSED' | 'WARNING' | 'FAILED'
  details: string
  mandatory?: boolean
}

export interface DoctorReport {
  ok: boolean
  timestamp: string
  repoRoot: string
  summary: {
    total: number
    passed: number
    warnings: number
    failed: number
  }
  checks: DoctorCheck[]
}

export function useDoctor() {
  const report = ref<DoctorReport | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  const isHealthy = computed(() => report.value?.ok ?? false)
  const passedCount = computed(() => report.value?.summary.passed ?? 0)
  const totalCount = computed(() => report.value?.summary.total ?? 0)
  const statusBadge = computed(() => {
    if (!report.value) return { color: 'neutral', label: 'Checking...' }
    if (report.value.ok) return { color: 'success', label: `${passedCount.value}/${totalCount.value} Healthy` }
    return { color: 'error', label: `${report.value.summary.failed} Failed` }
  })

  async function fetchDoctorReport() {
    isLoading.value = true
    errorMessage.value = null
    try {
      const res = await $fetch<{ success: boolean; report?: DoctorReport; error?: string }>('/api/doctor')
      if (res.success && res.report) {
        report.value = res.report
      } else {
        errorMessage.value = res.error || 'Diagnostic check failed'
      }
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to connect to /api/doctor'
    } finally {
      isLoading.value = false
    }
  }

  return {
    report,
    isLoading,
    errorMessage,
    isHealthy,
    passedCount,
    totalCount,
    statusBadge,
    fetchDoctorReport,
  }
}

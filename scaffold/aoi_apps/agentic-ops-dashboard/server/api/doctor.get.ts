import { defineEventHandler } from 'h3'

import { loadAoiModule } from '../utils/load-aoi-module'
import { resolveWorkspaceRoot } from '../utils/workspace-root'

export default defineEventHandler(async () => {
  try {
    const repoRoot = resolveWorkspaceRoot()
    const { runAoiDoctor } = await loadAoiModule<{
      runAoiDoctor: (options: { repoRoot: string }) => Promise<any>
    }>('scripts/aoi-doctor.mjs')
    const report = await runAoiDoctor({ repoRoot })

    return {
      success: true,
      timestamp: new Date().toISOString(),
      report,
    }
  } catch (error: any) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message || 'Failed to execute AOI Doctor diagnostic',
    }
  }
})

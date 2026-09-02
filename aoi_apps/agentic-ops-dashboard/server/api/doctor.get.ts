import { defineEventHandler } from 'h3'
import { runAoiDoctor } from '../../../../scripts/aoi-doctor.mjs'
import { resolveWorkspaceRoot } from '../utils/workspace-root'

export default defineEventHandler(async () => {
  try {
    const repoRoot = resolveWorkspaceRoot()
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

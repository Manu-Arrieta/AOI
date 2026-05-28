import { defineEventHandler } from 'h3'

import { buildWorkspaceSnapshot } from '../utils/build-workspace-snapshot'
import { ensureWorkspaceWatcher } from '../utils/watch-workspace'

export default defineEventHandler(async () => {
  await ensureWorkspaceWatcher()
  return buildWorkspaceSnapshot()
})
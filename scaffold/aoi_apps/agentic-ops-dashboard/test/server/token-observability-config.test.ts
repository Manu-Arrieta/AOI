import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  loadTokenObservabilityConfig,
  resolveTokenObservabilityConfigPath,
  saveTokenObservabilityConfig,
} from '../../server/utils/token-observability/token-observability-config'

const createdDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('token observability config', () => {
  it('loads defaults and persists enablement locally under .icm', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-token-config-'))
    createdDirs.push(workspaceRoot)

    const defaults = await loadTokenObservabilityConfig(workspaceRoot)
    expect(defaults.enabled).toBe(false)
    expect(defaults.maxRecentRequests).toBe(50)
    expect(defaults.retentionDays).toBe(30)

    const saved = await saveTokenObservabilityConfig({ enabled: true }, workspaceRoot)
    expect(saved.enabled).toBe(true)
    expect(saved.updatedAt).not.toBeNull()

    const raw = await readFile(resolveTokenObservabilityConfigPath(workspaceRoot), 'utf8')
    expect(JSON.parse(raw)).toMatchObject({ enabled: true, source: 'copilot', retentionDays: 30 })
  })
})
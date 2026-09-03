import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  createDefaultTokenObservabilityConfig,
  tokenObservabilityConfigSchema,
  type TokenObservabilityConfig,
} from '~/shared/token-observability'

import { resolveWorkspaceRoot } from '../workspace-root'

export function resolveTokenObservabilityRoot(workspaceRoot = resolveWorkspaceRoot()): string {
  return join(workspaceRoot, '.icm', 'token-observability')
}

export function resolveTokenObservabilityConfigPath(workspaceRoot = resolveWorkspaceRoot()): string {
  return join(resolveTokenObservabilityRoot(workspaceRoot), 'config.json')
}

export async function loadTokenObservabilityConfig(workspaceRoot = resolveWorkspaceRoot()): Promise<TokenObservabilityConfig> {
  const configPath = resolveTokenObservabilityConfigPath(workspaceRoot)

  if (!existsSync(configPath)) {
    return createDefaultTokenObservabilityConfig()
  }

  const raw = await readFile(configPath, 'utf8')
  return tokenObservabilityConfigSchema.parse(JSON.parse(raw))
}

export async function saveTokenObservabilityConfig(
  nextConfig: Partial<TokenObservabilityConfig> & Pick<TokenObservabilityConfig, 'enabled'>,
  workspaceRoot = resolveWorkspaceRoot(),
): Promise<TokenObservabilityConfig> {
  const current = await loadTokenObservabilityConfig(workspaceRoot)
  const merged = tokenObservabilityConfigSchema.parse({
    ...current,
    ...nextConfig,
    updatedAt: new Date().toISOString(),
  })

  const root = resolveTokenObservabilityRoot(workspaceRoot)
  await mkdir(root, { recursive: true })
  await writeFile(resolveTokenObservabilityConfigPath(workspaceRoot), `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
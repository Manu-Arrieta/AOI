/**
 * Windows installer contract for MCP compression.
 *
 * The normal suite runs on POSIX too, so it statically binds the PowerShell
 * implementation on every platform and executes the real function on Windows.
 * That avoids a second, divergent JavaScript implementation of installer logic.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { auditServerWrapping } from './setup-mcp-gateway.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP_PS1 = [path.join(REPO, 'setup.ps1'), path.resolve(REPO, '../setup.ps1')].find(fs.existsSync)
const SOURCE = SETUP_PS1 ? fs.readFileSync(SETUP_PS1, 'utf8') : ''

describe('Windows MCP installer parity', { skip: !SETUP_PS1 }, () => {
  it('BIC-2026-003:never.1 requires the real compressor before writing an MCP entry', () => {
    assert.match(SOURCE, /function Install-McpCompressor\b/)
    assert.match(SOURCE, /function Ensure-McpCompressorAvailable\b/)
    assert.match(SOURCE, /uvPath tool install mcp-compressor/)
    assert.match(SOURCE, /Install-Uv\s*\r?\n\s*\$null\s*=\s*Install-McpCompressor\s*\r?\n\s*Install-Specify/)

    const writer = SOURCE.slice(SOURCE.indexOf('function Set-WorkspaceMcpConfig'))
    assert.match(writer, /ConvertFrom-Json/)
    assert.match(writer, /\$servers\s*=\s*\$mcpConfig\["servers"\]/)
    assert.match(writer, /\$mcpConfig\["servers"\]\s*=\s*@\{\}/)
    assert.match(writer, /\$compressorPath\s*=\s*Ensure-McpCompressorAvailable/)
    assert.doesNotMatch(writer, /command\s*=\s*"powershell"/)
    assert.doesNotMatch(writer, /command\s*=\s*\$cbmPath/)
  })

  it('BIC-2026-003:oracle keeps the gateway negative control: a direct backend is rejected', () => {
    const result = auditServerWrapping({ servers: { icm: { command: 'powershell', args: ['-File', 'icm-serve.ps1'] } } })
    assert.deepEqual(result.direct, ['icm'])
  })

  it('BIC-2026-003:never.2 BIC-2026-003:never.3 key-merges owner config and preserves backend argv exactly on Windows', { skip: process.platform !== 'win32' }, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-windows-mcp-'))
    try {
      const home = path.join(root, 'home')
      const localBin = path.join(home, '.local', 'bin')
      const project = path.join(root, 'project')
      const mcpPath = path.join(project, '.vscode', 'mcp.json')
      fs.mkdirSync(localBin, { recursive: true })
      fs.mkdirSync(path.dirname(mcpPath), { recursive: true })
      fs.writeFileSync(path.join(localBin, 'mcp-compressor.cmd'), '@echo off\r\necho test-compressor 1.0\r\nexit /b 0\r\n')
      fs.writeFileSync(path.join(localBin, 'codebase-memory-mcp.cmd'), '@echo off\r\nexit /b 0\r\n')
      fs.writeFileSync(mcpPath, JSON.stringify({
        ownerMetadata: { keep: true },
        servers: {
          'owner-tool': { type: 'stdio', command: 'owner-tool', args: ['--retain'], custom: { keep: true } },
          icm: { type: 'stdio', command: 'old-icm' },
        },
      }))

      const invalidProject = path.join(root, 'invalid-project')
      const invalidMcpPath = path.join(invalidProject, '.vscode', 'mcp.json')
      fs.mkdirSync(path.dirname(invalidMcpPath), { recursive: true })
      fs.writeFileSync(invalidMcpPath, '{"servers":[]}')

      const script = String.raw`
        $ErrorActionPreference = 'Stop'
        $env:USERPROFILE = $env:AOI_TEST_HOME
        $env:LOCALAPPDATA = $env:AOI_TEST_HOME
        $localBin = Join-Path $env:USERPROFILE '.local\bin'
        $env:Path = "$localBin;$env:Path"
        . $env:AOI_TEST_SETUP -DefinitionsOnly
        Set-WorkspaceMcpConfig -TargetProjectPath $env:AOI_TEST_PROJECT
        Set-WorkspaceMcpConfig -TargetProjectPath $env:AOI_TEST_INVALID_PROJECT
        if ((Get-Content -LiteralPath $env:AOI_TEST_INVALID_MCP -Raw) -ne '{"servers":[]}') {
          throw 'non-object servers config was rewritten'
        }
        [Console]::Out.WriteLine('@@AOI-MCP-CONFIG@@')
        Get-Content -LiteralPath $env:AOI_TEST_MCP -Raw
      `
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        encoding: 'utf8',
        env: {
          ...process.env,
          AOI_MCP_COMPRESSION: 'low',
          AOI_TEST_HOME: home,
          AOI_TEST_SETUP: SETUP_PS1,
          AOI_TEST_PROJECT: project,
          AOI_TEST_INVALID_PROJECT: invalidProject,
          AOI_TEST_INVALID_MCP: invalidMcpPath,
          AOI_TEST_MCP: mcpPath,
        },
      })
      assert.equal(result.status, 0, result.stderr || result.stdout)

      const marker = '@@AOI-MCP-CONFIG@@'
      const markerOffset = result.stdout.lastIndexOf(marker)
      assert.notEqual(markerOffset, -1, result.stdout)
      const config = JSON.parse(result.stdout.slice(markerOffset + marker.length).trim())
      assert.deepEqual(config.ownerMetadata, { keep: true })
      assert.deepEqual(config.servers['owner-tool'], {
        type: 'stdio', command: 'owner-tool', args: ['--retain'], custom: { keep: true },
      })
      assert.match(config.servers.icm.command, /mcp-compressor\.cmd$/i)
      assert.deepEqual(config.servers.icm.args, [
        '-c', 'low', '--', 'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        '${workspaceFolder}\\.github\\scripts\\icm-serve.ps1',
      ])
      assert.match(config.servers['codebase-memory-mcp'].command, /mcp-compressor\.cmd$/i)
      assert.equal(config.servers['codebase-memory-mcp'].args.slice(0, 3).join(' '), '-c low --')
      assert.match(config.servers['codebase-memory-mcp'].args[3], /codebase-memory-mcp\.cmd$/i)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

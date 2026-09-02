import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  compileHarnessRules,
  generateAntigravityRules,
  generateClaudeMd,
  generateClineRules,
  generateCopilotInstructions,
  generateCursorRules,
} from './compile-rules.mjs'

describe('multi-harness rules compiler', () => {
  it('generators include mandatory ICM persistent memory rules', () => {
    const claude = generateClaudeMd({ workspace: 'TestWS' })
    assert.ok(claude.includes('icm wake-up'))
    assert.ok(claude.includes('TestWS'))

    const cursor = generateCursorRules({ workspace: 'TestWS' })
    assert.ok(cursor.includes('icm wake-up'))
    assert.ok(cursor.includes('< 300 LOC'))

    const antigravity = generateAntigravityRules({ workspace: 'TestWS' })
    assert.ok(antigravity.includes('ICM Persistent Memory Substrate'))

    const cline = generateClineRules({ workspace: 'TestWS' })
    assert.ok(cline.includes('icm wake-up'))

    const copilot = generateCopilotInstructions({ workspace: 'TestWS' })
    assert.ok(copilot.includes('icm facts set'))
  })

  it('compileHarnessRules compiles target harnesses into filesystem', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'))

    const result = compileHarnessRules(tmpDir, ['claude', 'cursor'], 'TestApp')
    assert.equal(result.compiledFiles.length, 3) // CLAUDE.md, .cursorrules, .cursor/rules/aoi-rules.mdc

    assert.ok(fs.existsSync(path.join(tmpDir, 'CLAUDE.md')))
    assert.ok(fs.existsSync(path.join(tmpDir, '.cursorrules')))
    assert.ok(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'aoi-rules.mdc')))

    // All option
    const allResult = compileHarnessRules(tmpDir, ['all'], 'TestApp')
    assert.ok(allResult.compiledFiles.length >= 6)
    assert.ok(fs.existsSync(path.join(tmpDir, '.clinerules')))
    assert.ok(fs.existsSync(path.join(tmpDir, 'AGENTS.md')))
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'rules', 'aoi-rules.md')))

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

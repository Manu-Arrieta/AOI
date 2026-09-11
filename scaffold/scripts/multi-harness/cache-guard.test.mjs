import test, { describe, it } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { auditPromptsDirectory, validatePromptCacheAlignment } from './cache-guard.mjs'

test('validatePromptCacheAlignment accepts clean static prompt prefix', () => {
  const prompt = `---
description: "Implementation prompt"
agent: "supervisor"
---
# Invariant instructions
Execute tasks in order. Always use TDD.
`
  const result = validatePromptCacheAlignment(prompt)
  assert.equal(result.valid, true)
  assert.equal(result.violations.length, 0)
})

test('validatePromptCacheAlignment flags ISO timestamps in prefix', () => {
  const prompt = `# Prompt with date: 2026-09-06T12:00:00\nExecute tasks.`
  const result = validatePromptCacheAlignment(prompt)
  assert.equal(result.valid, false)
  assert.match(result.violations[0], /ISO Timestamp Injection/)
})

test('validatePromptCacheAlignment allows dynamic timestamps in the suffix (after prefix boundary)', () => {
  const longStaticPrefix = 'A'.repeat(1600)
  const prompt = `${longStaticPrefix}\nTimestamp: 2026-09-06T12:00:00`
  const result = validatePromptCacheAlignment(prompt, { prefixLength: 1500 })
  assert.equal(result.valid, true)
})

describe('the directory walk survives what a filesystem can actually contain', () => {
  // An adversarial-input audit found this: `readdirSync().filter(endsWith)`
  // with no type check reached `readFileSync` on a DIRECTORY named
  // `*.prompt.md` and threw EISDIR with a node:fs trace naming no path.
  //
  // It fails closed, so nothing ships — but the same function is imported by
  // sdd-stress-suite, which calls it AFTER all six phases have run. The crash
  // discarded the accumulated token report that becomes the next cycle's
  // baseline. A whole benchmark lost to a missing `isFile()`.
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-cg-'))

  it('ignores a directory whose name ends in .prompt.md', () => {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, 'real.prompt.md'), '# limpio\n')
    fs.mkdirSync(path.join(dir, 'impostor.prompt.md'))

    const r = auditPromptsDirectory(dir)

    assert.equal(r.scanned, 1, 'contó un directorio como prompt')
    assert.equal(r.failed, 0)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('reports an unreadable prompt through its own channel, not as a stack trace', () => {
    const dir = tmp()
    const f = path.join(dir, 'sin-permiso.prompt.md')
    fs.writeFileSync(f, '# x\n')
    fs.chmodSync(f, 0o000)

    const r = auditPromptsDirectory(dir)

    // Running as root would make it readable anyway; the guarantee under test
    // is that the gate does not throw, whichever way that lands.
    assert.equal(r.scanned, 1)
    if (r.failed === 1) assert.match(r.details['sin-permiso.prompt.md'][0], /No se pudo leer/)
    fs.chmodSync(f, 0o644)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('reports nothing for a directory that does not exist', () => {
    assert.deepEqual(auditPromptsDirectory('/no/existe/en/ningun/lado'), {
      scanned: 0, passed: 0, failed: 0, details: {},
    })
  })
})

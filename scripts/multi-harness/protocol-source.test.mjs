import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { ICM_PROTOCOL, readStoreTriggers, renderStoreTriggers } from './protocol-source.mjs'
import { generateClaudeMd, generateCopilotInstructions } from './compile-rules.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('the harness surfaces are derived from the protocol, not copied', () => {
  it('reads every importance level the protocol declares', () => {
    const levels = readStoreTriggers(REPO)
    for (const l of ['critical', 'high', 'medium', 'low']) {
      assert.ok(levels[l], `el protocolo declara ${l} y el lector no lo ve`)
    }
  })

  it('CLAUDE.md and copilot-instructions agree with the protocol on every level', () => {
    // The contradiction this ends: the generated CLAUDE.md said `-i high` for
    // an architecture decision while the protocol said `critical`. Both
    // surfaces are always in context, so an agent read both on every task.
    const levels = readStoreTriggers(REPO)
    const claude = generateClaudeMd({ workspace: 'AOI', repoRoot: REPO })
    const copilot = generateCopilotInstructions({ workspace: 'AOI', repoRoot: REPO })

    for (const [level, cases] of Object.entries(levels)) {
      for (const [name, text] of [['CLAUDE.md', claude], ['copilot-instructions', copilot]]) {
        assert.ok(text.includes(`\`-i ${level}\` → ${cases}`), `${name} no refleja el nivel ${level}`)
      }
    }
  })

  it('no generated surface contradicts the protocol on architecture decisions', () => {
    // The specific drift that occurred, asserted by name so a future rewrite
    // that reintroduces it fails here rather than in someone's context window.
    const claude = generateClaudeMd({ workspace: 'AOI', repoRoot: REPO })
    const copilot = generateCopilotInstructions({ workspace: 'AOI', repoRoot: REPO })
    for (const text of [claude, copilot]) {
      assert.doesNotMatch(text, /decisi[oó]n de arquitectura[^\n]*-i high/i)
      assert.doesNotMatch(text, /Architecture[^\n]*-i high/i)
    }
  })

  it('falls back instead of emitting rules with holes when the protocol is unreadable', () => {
    // A parse failure must degrade to the previous wording. Emitting a block
    // with levels missing would be worse than not deriving at all.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-proto-'))
    assert.deepEqual(readStoreTriggers(empty), {})
    assert.equal(renderStoreTriggers({}, 'AOI'), '')

    const md = generateClaudeMd({ workspace: 'AOI', repoRoot: empty })
    assert.match(md, /Store Triggers \(MANDATORY\)/, 'la degradación dejó la sección vacía')
    assert.doesNotMatch(md, /decisions-AOI[^\n]*-i high/, 'el fallback reintrodujo la contradicción')
    fs.rmSync(empty, { recursive: true, force: true })
  })

  it('names a protocol file that exists', () => {
    assert.ok(fs.existsSync(path.join(REPO, ICM_PROTOCOL)), `${ICM_PROTOCOL} no existe`)
  })
})

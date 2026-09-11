import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { auditTokenTools, invokesTool, TOKEN_TOOLS, wiringMap } from './token-tool-coverage.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** A throwaway workspace with the given files. */
function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-tools-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

describe('the shipped inventory', () => {
  it('has every mandatory tool enforced and wired', () => {
    const r = auditTokenTools(REPO)
    assert.deepEqual(r.notMandatory, [])
    assert.deepEqual(r.notWired, [])
  })

  it('declares Headroom as the one optional tool, per the Owner', () => {
    // The policy is the Owner's, not an inference from the code. If a second
    // tool ever becomes optional, that is a decision someone must make on
    // purpose rather than a default that drifted in.
    const optional = TOKEN_TOOLS.filter((t) => !t.mandatory).map((t) => t.id)
    assert.deepEqual(optional, ['headroom'])
  })

  it('distinguishes what compresses communication from what optimises a phase', () => {
    // The Owner asked for both halves to be verified. Collapsing the two would
    // let a saving that only applies inside one phase pass as one that also
    // covers every hand-off.
    const channels = new Set(TOKEN_TOOLS.map((t) => t.channel))
    assert.deepEqual([...channels].sort(), ['communication', 'process'])
  })
})

describe('the gate detects what it claims to detect', () => {
  it('flags a mandatory tool no cycle surface invokes', () => {
    // Negative control. A gate that has only ever been seen passing proves
    // nothing about what it would do on a real regression.
    const root = workspace({
      'package.json': '{}',
      'setup.sh': 'require_rtk\nrequire_icm\nrequire_mcp_compressor\nCBM_CHOICE="y"\n',
      '.github/prompts/p.prompt.md': 'rtk icm toon codebase-memory ast-lens context-arranger synthesize-stubs mechanical-verify-union diagnostic-distiller',
    })

    const r = auditTokenTools(root)

    assert.ok(
      r.notWired.some((m) => m.startsWith('context-tombstone')),
      'no detectó una herramienta obligatoria que ningún prompt invoca'
    )
    clean(root)
  })

  it('flags a mandatory tool the installer lets a run continue without', () => {
    const root = workspace({
      'package.json': '{}',
      'setup.sh': 'install_rtk || warn "sigo igual"\n',
      '.github/prompts/p.prompt.md': 'rtk',
    })

    assert.ok(
      auditTokenTools(root).notMandatory.some((m) => m.startsWith('rtk')),
      'no detectó que el instalador tolera la ausencia de rtk'
    )
    clean(root)
  })

  it('looks for a transport tool in the MCP config, not among the prompts', () => {
    // A category error the first version made: no prompt will ever name the
    // proxy its own MCP calls travel through, so searching the prose for it
    // reported it missing forever — a gate that cries wolf, not one that binds.
    const root = workspace({
      'package.json': '{}',
      'setup.sh': 'require_mcp_compressor',
      '.vscode/mcp.json': '{"servers":{"icm":{"command":"mcp-compressor"}}}',
    })

    assert.deepEqual(wiringMap(root).get('mcp-compressor'), ['.vscode/mcp.json'])
    clean(root)
  })

  it('does not look for a cycle tool in the MCP config', () => {
    // The mirror of the case above, and the one a mutation survived: flipping
    // the `surface === 'transport'` test would send every prompt-level tool to
    // mcp.json and the proxy to the prompts, so both halves would report
    // missing while everything was in fact wired.
    const root = workspace({
      'package.json': '{}',
      '.vscode/mcp.json': '{"servers":{"icm":{"command":"mcp-compressor"}}}',
      '.github/prompts/p.prompt.md': '`node scripts/context-tombstone.mjs`',
    })

    assert.deepEqual(wiringMap(root).get('context-tombstone'), ['.github/prompts/p.prompt.md'])
    assert.deepEqual(wiringMap(root).get('mcp-compressor'), ['.vscode/mcp.json'])
    clean(root)
  })

  it('an unwired tool is not enforced either, whichever mode we are in', () => {
    // `enforced` is a ternary over two modes, and a mutation could make an
    // unwired tool read as enforced in a workspace — which would let the gate
    // report policy satisfied over a tool nothing invokes.
    const root = workspace({ 'package.json': '{}', '.github/prompts/p.prompt.md': 'nada relevante' })
    const rows = auditTokenTools(root).rows

    for (const r of rows.filter((x) => x.mandatory && x.sites === 0)) {
      assert.equal(r.enforced, false, `${r.id} figura exigida sin que nada lo invoque`)
    }
    clean(root)
  })

  it('does not demand installer enforcement in an installed workspace', () => {
    // A workspace has no setup.sh to read: the installer already ran. Asking
    // there made the gate fail on every tool the installer enforces, which is
    // the loudest possible false alarm.
    const root = workspace({
      'package.json': '{}',
      '.vscode/mcp.json': '{"servers":{"icm":{"command":"mcp-compressor"}}}',
      '.github/prompts/p.prompt.md': [
        '```bash',
        'rtk git status',
        'icm wake-up',
        'node scripts/subagent-context/sanitize-subagent-payload.mjs  # toon',
        'codebase-memory search',
        'node scripts/context/context-tombstone.mjs',
        'node scripts/code-lens/ast-skeletonizer.mjs',
        'node scripts/context/context-arranger.mjs',
        'node scripts/tdd/synthesize-stubs.mjs',
        'node scripts/verify/diagnostic-distiller.mjs',
        'node scripts/sdd-lifecycle/mechanical-verify-union.mjs',
        '```',
      ].join('\n'),
    })

    assert.deepEqual(auditTokenTools(root).notMandatory, [])
    clean(root)
  })
})

describe('naming a tool is not invoking it', () => {
  // The gate exists because a tool can be present, tested and credited with a
  // saving while nothing in the cycle calls it. A raw substring match reopened
  // exactly that hole from the other side: prose EXPLAINING that a tool was
  // removed contains its name, so the gate read the explanation as wiring and
  // certified a saving the product had deliberately dropped.
  const needle = /context-tombstone/

  const MENTIONS = [
    ['an HTML comment', '<!-- context-tombstone was removed in 2026-09 -->'],
    ['a blockquote aside', '> Antes usábamos context-tombstone para podar turnos.'],
    ['bare prose', 'The context-tombstone mechanism no longer participates.'],
  ]
  for (const [what, line] of MENTIONS) {
    it(`does not count ${what}`, () => {
      assert.equal(invokesTool(line, needle), false, `contó una mención: ${line}`)
    })
  }

  const INVOCATIONS = [
    ['an inline code span', 'Ejecutá `node scripts/context-tombstone.mjs --apply`.'],
    ['a bare node call', 'node scripts/context-tombstone.mjs'],
    ['a pnpm script', 'pnpm aoi:context-tombstone'],
    ['a bulleted command', '- node scripts/context-tombstone.mjs'],
    ['a shell prompt', '$ node scripts/context-tombstone.mjs'],
    ['a fenced block', ['```bash', 'node scripts/context-tombstone.mjs', '```'].join('\n')],
  ]
  for (const [what, line] of INVOCATIONS) {
    it(`counts ${what}`, () => {
      assert.equal(invokesTool(line, needle), true, `no contó una invocación: ${line}`)
    })
  }

  it('declines a prose imperative, and that conservatism is deliberate', () => {
    // "Corré context-tombstone" really is an instruction, and the positional
    // rule does not see it. That is the safe direction to be wrong in: the
    // cost is a gate that asks the author to write the invocation as a
    // command, which every surface in this repository already does. The
    // opposite error — reading prose as wiring — is the false green this gate
    // exists to prevent, and the imperative-verb heuristic committed it on the
    // first try, matching the "use" inside "do not use it".
    assert.equal(invokesTool('Corré context-tombstone antes de delegar.', needle), false)
    assert.equal(invokesTool('Run context-tombstone on the transcript first.', needle), false)
    assert.equal(invokesTool('do not use context-tombstone any more', needle), false)
  })

  it('does not read a shell comment inside a fence as a command', () => {
    const doc = ['```bash', '# context-tombstone: retirado del ciclo', 'echo ok', '```'].join('\n')
    assert.equal(invokesTool(doc, needle), false)
  })

  it('judges line by line, so a nearby command does not rescue a mention', () => {
    const doc = ['El texto menciona context-tombstone.', '', 'Ejecutá `pnpm aoi:doctor`.'].join('\n')
    assert.equal(invokesTool(doc, needle), false)
  })

  it('reports a tool as unwired when the cycle only talks about it', () => {
    // End to end through the real audit, not just the predicate.
    const root = workspace({
      'setup.sh': '#!/usr/bin/env bash\n',
      '.github/prompts/sdd-apply.prompt.md': '# Apply\n\nWe removed context-tombstone; do not use it.\n',
    })
    const notWired = auditTokenTools(root).notWired.join('\n')
    assert.match(notWired, /context-tombstone/, 'una mención pasó como cableado')
    clean(root)
  })
})

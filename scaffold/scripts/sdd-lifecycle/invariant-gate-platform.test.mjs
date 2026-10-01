/**
 * scripts/sdd-lifecycle/invariant-gate-platform.test.mjs
 *
 * Tres defectos del Invariant Gate que midió la auditoría 2026-09-30:
 *
 *   · C4: contaba como evidencia un test que en esta plataforma se saltea. En
 *     macOS dos Never Rules del BIC del instalador Windows figuraban ✅ con un
 *     único test `skip: process.platform !== 'win32'`.
 *   · D2: aceptaba cualquier flag. `--exit-cod` convertía FAILED en exit 0.
 *   · C3: `--chain`, el modo con que `pnpm test` lo corre, tiene que decir
 *     NOT AUDITED donde el contrato es inalcanzable, y seguir bloqueando un
 *     `icm` que falla.
 *
 * Los tags son de fixture: un tag real citado acá contaría como evidencia.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { auditInvariantCoverage, exitCodeFor, formatInvariantGateReport } from './invariant-gate.mjs'
import { parseGateArgs } from './invariant-gate-args.mjs'

const GATE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'invariant-gate.mjs')
const TAG = 'FIXTURE-778:never.1'
const RULE = { tag: TAG, kind: 'never', statement: 'NUNCA algo', bicId: 'FIXTURE-778' }
// Salta en la plataforma que corre esta suite, sea cual sea.
const SKIPPED_HERE = `it('${TAG} sólo en otra plataforma', { skip: process.platform === '${process.platform}' }, () => {})\n`
const FACTS = ['key    value', '------------', `bic.FIXTURE-778.never.1    ${TAG} NUNCA algo`].join('\n')

function gateRun(args, { cwd, env } = {}) {
  const r = spawnSync(process.execPath, [GATE, ...args], { cwd, env: env ?? process.env, encoding: 'utf8', timeout: 60000 })
  return { code: r.status, stdout: r.stdout, stderr: r.stderr }
}

/** Un workspace con hechos en archivo y tests colectados por `package.json`. */
function workspace(tests) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi gate-platform-'))
  fs.writeFileSync(path.join(root, 'facts.txt'), FACTS)
  fs.mkdirSync(path.join(root, 'test'))
  for (const [name, body] of Object.entries(tests)) fs.writeFileSync(path.join(root, 'test', name), body)
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test test/*.test.mjs' } }))
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

describe('C4: un test que no corre acá no es evidencia de acá', () => {
  const sources = [{ file: 'w.test.mjs', content: "it('" + TAG + "', { skip: process.platform !== 'win32' }, () => {})" }]

  it('en darwin la regla queda PARTIAL y no cubierta; en win32 queda cubierta', () => {
    const darwin = auditInvariantCoverage([RULE], sources, { platform: 'darwin' })
    assert.equal(darwin.status, 'PARTIAL')
    assert.deepEqual(darwin.covered, [])
    assert.equal(darwin.platformSkipped[0].platform, 'darwin')
    assert.equal(auditInvariantCoverage([RULE], sources, { platform: 'win32' }).status, 'PASSED')
  })

  it('el reporte dice PARTIAL y nombra la plataforma, nunca PASSED', () => {
    const report = formatInvariantGateReport(auditInvariantCoverage([RULE], sources, { platform: 'darwin' }))
    assert.match(report, /^## Invariant Gate: ⚠️ PARTIAL/)
    assert.doesNotMatch(report, /PASSED|✅/)
    assert.match(report, /⏸️ `FIXTURE-778:never\.1` — not verified here \(`skip: process\.platform !== 'win32'`\)/)
  })

  it('PARTIAL sale 0 y FAILED sale 1: la decisión está fijada', () => {
    assert.equal(exitCodeFor('PARTIAL'), 0)
    assert.equal(exitCodeFor('FAILED'), 1)
    assert.equal(exitCodeFor('PASSED'), 0)
  })

  it('el CLI con --exit-code: PARTIAL, exit 0, sin ✅', () => {
    const { root, cleanup } = workspace({ 'a.test.mjs': SKIPPED_HERE })
    try {
      const r = gateRun(['--facts-file', 'facts.txt', '--tests-dir', '.', '--exit-code'], { cwd: root })
      assert.equal(r.code, 0, r.stderr)
      assert.match(r.stdout, /Invariant Gate: ⚠️ PARTIAL/)
      assert.match(r.stdout, new RegExp(`Skipped on ${process.platform}: 1`))
      assert.doesNotMatch(r.stdout, /✅/)
    } finally {
      cleanup()
    }
  })
})

describe('un skip incondicional no es PARTIAL: no corre en ninguna plataforma', () => {
  // Repro del verificador: `it.skip` y `{ skip: true }` salían PARTIAL, exit 0.
  const NEVER_RUNS = [
    `it.skip('${TAG} nunca corre', () => {})`,
    "it('FIXTURE-778:never.2 tampoco', { skip: true }, () => {})",
  ].join('\n')
  const FACTS_2 = `${FACTS}\nbic.FIXTURE-778.never.2    FIXTURE-778:never.2 NUNCA otra`

  it('auditInvariantCoverage: FAILED en cualquier plataforma, nada en platformSkipped', () => {
    const rules = [RULE, { ...RULE, tag: 'FIXTURE-778:never.2' }]
    for (const platform of ['darwin', 'win32']) {
      const audit = auditInvariantCoverage(rules, [{ file: 'n.test.mjs', content: NEVER_RUNS }], { platform })
      assert.equal(audit.status, 'FAILED')
      assert.deepEqual(audit.platformSkipped, [])
      assert.match(audit.uncovered[0].statement, /desactivado sin condición de plataforma \(`\.skip`/)
    }
  })

  it('el CLI con --exit-code: FAILED, exit 1, Uncovered: 2', () => {
    const { root, cleanup } = workspace({ 'n.test.mjs': NEVER_RUNS })
    try {
      fs.writeFileSync(path.join(root, 'facts.txt'), FACTS_2)
      const r = gateRun(['--facts-file', 'facts.txt', '--tests-dir', '.', '--exit-code'], { cwd: root })
      assert.equal(r.code, 1, r.stdout + r.stderr)
      assert.match(r.stdout, /Invariant Gate: 🛑 FAILED[\s\S]*Uncovered: 2/)
      assert.doesNotMatch(r.stdout, /PARTIAL|Skipped on/)
    } finally {
      cleanup()
    }
  })
})

describe('D2: un flag desconocido no puede degradar el veredicto', () => {
  it('parseGateArgs rechaza lo desconocido y los valores ausentes', () => {
    assert.match(parseGateArgs(['--bogus']).error, /desconocido: --bogus/)
    assert.match(parseGateArgs(['--entity']).error, /--entity necesita un valor/)
    assert.match(parseGateArgs(['--entity', '--exit-code']).error, /--entity necesita un valor/)
    assert.equal(parseGateArgs(['--chain']).opts.enforceExitCode, true)
  })

  it('un typo de --exit-code sobre un contrato FAILED sale 2, no 0', () => {
    const { root, cleanup } = workspace({})
    try {
      assert.equal(gateRun(['--facts-file', 'facts.txt', '--tests-dir', '.', '--exit-code'], { cwd: root }).code, 1)
      const typo = gateRun(['--facts-file', 'facts.txt', '--tests-dir', '.', '--exit-cod'], { cwd: root })
      assert.equal(typo.code, 2)
      assert.match(typo.stderr, /argumento desconocido: --exit-cod/)
      assert.equal(gateRun(['--bogus'], { cwd: root }).code, 2)
    } finally {
      cleanup()
    }
  })
})

describe('C3: --chain dice NOT AUDITED donde el contrato es inalcanzable', { skip: process.platform === 'win32' && 'stubs de sh' }, () => {
  /** Un PATH que sólo tiene un `icm` con el cuerpo dado, o ningún `icm`. */
  function pathWith(icmBody) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-chain-bin-'))
    if (icmBody) fs.writeFileSync(path.join(dir, 'icm'), `#!/bin/sh\n${icmBody}\n`, { mode: 0o755 })
    return { dir, env: { ...process.env, PATH: dir } }
  }
  const cases = [
    ['sin icm en el PATH (el runner de CI)', null, 0, /NOT AUDITED[\s\S]*not on PATH/],
    ['una entidad que ICM no conoce (una instalación nueva)', 'printf "no facts for %s\\n" "$3"', 0, /NOT AUDITED[\s\S]*no conoce la entidad/],
    [
      'una entidad que ICM conoce y que nunca pasó por /sdd-frame',
      'case "$*" in *bic.*) printf "no facts for %s\\n" "$3" ;; *) printf "key    value\\n-----\\nharness.selected    claude\\n" ;; esac',
      0,
      /NOT AUDITED[\s\S]*no tiene hechos bic\.\*/,
    ],
    ['un icm que falla sigue bloqueando', 'exit 3', 2, /BLOCKED[\s\S]*icm exited with an error/],
  ]
  for (const [name, body, code, pattern] of cases) {
    it(name, () => {
      const { root, cleanup } = workspace({})
      const bin = pathWith(body)
      try {
        const r = gateRun(['--chain'], { cwd: root, env: bin.env })
        assert.equal(r.code, code, `${r.stdout}${r.stderr}`)
        assert.match(`${r.stdout}${r.stderr}`, pattern)
        assert.doesNotMatch(r.stdout, /PASSED/)
      } finally {
        cleanup()
        fs.rmSync(bin.dir, { recursive: true, force: true })
      }
    })
  }

  it('sin --chain, la misma instalación nueva sigue bloqueando con 2', () => {
    const { root, cleanup } = workspace({})
    const bin = pathWith('printf "no facts for %s\\n" "$3"')
    try {
      assert.equal(gateRun(['--exit-code'], { cwd: root, env: bin.env }).code, 2)
    } finally {
      cleanup()
      fs.rmSync(bin.dir, { recursive: true, force: true })
    }
  })
})

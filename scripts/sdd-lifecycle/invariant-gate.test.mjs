import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  auditInvariantCoverage,
  collectTestSources,
  extractContractRules,
  formatInvariantGateReport,
  parseFactTable,
  readFactsFromIcm,
} from './invariant-gate.mjs'

const FACT_TABLE = [
  'key                              value',
  '------------------------------------------------------------',
  'bic.FIXTURE-042.never.1              NUNCA degradar accesos ante processor_network_error',
  'bic.FIXTURE-042.never.2              NUNCA reintentar un cobro marcado como fraudulent',
  'bic.FIXTURE-042.oracle               Simular payment_failed y verificar cuotas enterprise activas',
  'bic.FIXTURE-010.never.1              NUNCA retener fondos sin stock verificado',
  'task.TASK-2026-004.status        archived',
].join('\n')

describe('invariant-gate unit tests', () => {
  it('parseFactTable ignores headers, separators and blank lines', () => {
    const facts = parseFactTable(FACT_TABLE)
    assert.equal(facts.length, 5)
    assert.equal(facts[0].key, 'bic.FIXTURE-042.never.1')
    assert.equal(facts[0].value, 'NUNCA degradar accesos ante processor_network_error')
    assert.equal(parseFactTable('').length, 0)
  })

  it('extractContractRules keeps only BIC never/oracle facts', () => {
    const rules = extractContractRules(parseFactTable(FACT_TABLE))
    assert.equal(rules.length, 4)
    assert.ok(!rules.some((r) => r.tag.includes('TASK-2026-004')))

    const oracle = rules.find((r) => r.kind === 'oracle')
    assert.equal(oracle.tag, 'FIXTURE-042:oracle')
    assert.equal(oracle.bicId, 'FIXTURE-042')
  })

  it('extractContractRules narrows the audit to a single BIC when filtered', () => {
    const rules = extractContractRules(parseFactTable(FACT_TABLE), 'FIXTURE-010')
    assert.equal(rules.length, 1)
    assert.equal(rules[0].tag, 'FIXTURE-010:never.1')
  })

  it('auditInvariantCoverage FAILS when a Never Rule has no test referencing its tag', () => {
    const rules = extractContractRules(parseFactTable(FACT_TABLE), 'FIXTURE-042')
    const testSources = [
      { file: 'billing.test.ts', content: 'it("FIXTURE-042:never.1 keeps access on network error", () => {})' },
      { file: 'oracle.test.ts', content: 'it("FIXTURE-042:oracle enterprise quotas stay active", () => {})' },
    ]

    const audit = auditInvariantCoverage(rules, testSources)
    assert.equal(audit.status, 'FAILED')
    assert.equal(audit.totalRules, 3)
    assert.equal(audit.covered.length, 2)
    assert.equal(audit.uncovered.length, 1)
    assert.equal(audit.uncovered[0].tag, 'FIXTURE-042:never.2')
  })

  it('auditInvariantCoverage PASSES when every rule is tagged in a test', () => {
    const rules = extractContractRules(parseFactTable(FACT_TABLE), 'FIXTURE-010')
    const testSources = [{ file: 'escrow.test.ts', content: '// covers FIXTURE-010:never.1\n' }]

    const audit = auditInvariantCoverage(rules, testSources)
    assert.equal(audit.status, 'PASSED')
    assert.equal(audit.uncovered.length, 0)
    assert.equal(audit.covered[0].evidence, 'escrow.test.ts')
  })

  it('auditInvariantCoverage SKIPS cleanly when no BIC facts exist', () => {
    const audit = auditInvariantCoverage([], [])
    assert.equal(audit.status, 'SKIPPED')
    assert.equal(audit.totalRules, 0)
  })

  it('collectTestSources walks a directory and keeps only test files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invariant-gate-'))
    const nested = path.join(tmpDir, 'domain')
    fs.mkdirSync(nested, { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true })

    fs.mkdirSync(path.join(tmpDir, 'scaffold'), { recursive: true })

    fs.writeFileSync(path.join(tmpDir, 'payments.ts'), 'export const noop = 1')
    fs.writeFileSync(path.join(nested, 'payments.test.ts'), 'FIXTURE-042:never.1')
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'vendor.test.ts'), 'ignored')
    // A mirrored copy must never satisfy a contract on its own.
    fs.writeFileSync(path.join(tmpDir, 'scaffold', 'mirrored.test.ts'), 'FIXTURE-042:never.2')

    const sources = collectTestSources(tmpDir)
    assert.equal(sources.length, 1)
    assert.ok(sources[0].file.endsWith('payments.test.ts'))
    assert.ok(!sources.some((s) => s.file.includes('scaffold')))

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('formatInvariantGateReport lists unenforced rules on failure', () => {
    const rules = extractContractRules(parseFactTable(FACT_TABLE), 'FIXTURE-010')
    const report = formatInvariantGateReport(auditInvariantCoverage(rules, []))

    assert.match(report, /Invariant Gate: 🛑 FAILED/)
    assert.match(report, /FIXTURE-010:never\.1/)
    assert.match(report, /NUNCA retener fondos sin stock verificado/)
  })

  it('formatInvariantGateReport reports a clean skip with no contract facts', () => {
    const report = formatInvariantGateReport(auditInvariantCoverage([], []))
    assert.match(report, /SKIPPED/)
  })

  it('readFactsFromIcm reports readability structurally so a broken toolchain cannot pass silently', () => {
    const result = readFactsFromIcm('AOI-entity-that-does-not-exist-in-tests')

    assert.equal(typeof result, 'object')
    assert.equal(typeof result.ok, 'boolean')
    assert.equal(typeof result.text, 'string')
    // A failed read MUST explain itself; the CLI turns this into a blocking exit 2
    // rather than an empty fact list that would look like a clean SKIPPED pass.
    if (!result.ok) assert.ok(String(result.reason).length > 0)
  })
})

describe('un contrato contradictorio no se puede satisfacer fijando el punto en disputa', () => {
  // Del ciclo real: el Owner escribió un BIC cuyo oráculo exigía `within`
  // para un valor que sus propios criterios de aceptación ponían en la banda
  // `tight`. Los dos no podían valer. El agente delegado lo notó, implementó
  // la mitad internamente consistente, fijó el punto en disputa y dejó un
  // comentario CONTRADICTION PENDING OWNER RESOLUTION en un test que igual
  // citaba el tag verbatim.
  //
  // Esa conducta es la correcta y es lo que uno quiere del agente. Lo que no
  // se quiere es que la compuerta lea ese test como cobertura: un contrato
  // que nadie puede satisfacer se publicaría reportado como exigido.
  const rule = { bicId: 'BIC-1', kind: 'oracle', tag: 'BIC-1:oracle', statement: '90894/100000 → within' }

  it('cuenta como cubierta la regla que un test ASSERTA', () => {
    const r = auditInvariantCoverage([rule], [{ file: 'a.test.ts', content: 'it("BIC-1:oracle", () => {})' }])
    assert.equal(r.status, 'PASSED')
  })

  it('NO cuenta como cubierta la que solo aparece junto a una contradicción sin resolver', () => {
    const r = auditInvariantCoverage(
      [rule],
      [{ file: 'a.test.ts', content: '// CONTRADICTION PENDING OWNER RESOLUTION\nit("BIC-1:oracle", () => {})' }]
    )

    assert.equal(r.status, 'FAILED')
    assert.match(r.uncovered[0].statement, /contradicción sin resolver/)
    assert.match(r.uncovered[0].statement, /a\.test\.ts/, 'no dice dónde está la disputa')
  })

  it('reconoce el marcador en español y la forma corta', () => {
    for (const marker of ['// CONTRADICCIÓN PENDIENTE', '// @bic-unresolved', '// CONTRACT CONFLICT']) {
      const r = auditInvariantCoverage([rule], [{ file: 'x.test.ts', content: `${marker}\nit("BIC-1:oracle", () => {})` }])
      assert.equal(r.status, 'FAILED', `no reconoció el marcador ${marker}`)
    }
  })

  it('vuelve a pasar en cuanto existe UN test que sí la asserta', () => {
    // La disputa puede quedar registrada; lo que no puede es ser la única
    // evidencia. Resolver el contrato y dejar el test viejo no debe bloquear.
    const r = auditInvariantCoverage([rule], [
      { file: 'disputa.test.ts', content: '// CONTRADICTION PENDING\nit("BIC-1:oracle", () => {})' },
      { file: 'real.test.ts', content: 'it("BIC-1:oracle", () => {})' },
    ])

    assert.equal(r.status, 'PASSED')
    assert.equal(r.covered[0].evidence, 'real.test.ts', 'tomó como evidencia el test en disputa')
  })
})

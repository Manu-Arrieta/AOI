import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  declaredFunctions,
  extractTypeContracts,
  extractScenarios,
  formatScaffoldReport,
  scaffoldTaskFromSpecs,
  synthesizeTestSuite,
  synthesizeImplementationStub,
} from './synthesize-stubs.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CLI = 'scripts/sdd-lifecycle/synthesize-stubs.mjs'

/**
 * Un directorio de tarea con los dos insumos, creado una sola vez.
 * Se borra en `after()`, y el `finally` de cada caso no lo toca: un cleanup
 * dentro de la aserción deja el directorio cuando la aserción falla —el caso
 * que más se corre—, que es el leak que ya midió este repositorio.
 */
const FIXTURE = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-synth-'))
fs.writeFileSync(
  path.join(FIXTURE, 'design.md'),
  '```typescript\nexport function evaluateFiberHealth(active: number, failed: number): FiberStatus\nexport function resetMetrics(): void\n```\n'
)
fs.writeFileSync(path.join(FIXTURE, 'spec.md'), '### Scenario: Health calculation\nGiven 10 active\nThen status stable\n')
after(() => fs.rmSync(FIXTURE, { recursive: true, force: true }))

/** El CLI en un subproceso: `main` fija `process.exitCode` y contaminaría el runner. */
function runCli(args) {
  try {
    const out = execFileSync('node', [CLI, ...args], { cwd: ROOT, encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

test('extractTypeContracts extracts code blocks cleanly', () => {
  const md = `
# Design
\`\`\`typescript
export type FiberStatus = 'stable' | 'degraded' | 'critical'
export function evaluateFiberHealth(a: number, b: number): FiberStatus
\`\`\`
`
  const contracts = extractTypeContracts(md)
  assert.equal(contracts.length, 1)
  assert.match(contracts[0], /export type FiberStatus/)
})

test('extractScenarios parses Gherkin steps from spec markdown', () => {
  const spec = `
### Scenario: Stable fiber ratio
Given 10 active fibers
When 0 failed fibers
Then status is stable
`
  const scenarios = extractScenarios(spec)
  assert.equal(scenarios.length, 1)
  assert.equal(scenarios[0].title, 'Stable fiber ratio')
  assert.equal(scenarios[0].steps.length, 3)
})

test('synthesizeImplementationStub adds failing body to declared functions', () => {
  const contracts = [
    `export function calculateMetrics(x: number): number;`
  ]
  const stub = synthesizeImplementationStub(contracts)
  assert.match(stub, /throw new Error\('Not implemented: calculateMetrics'\)/)
})

test('synthesizeTestSuite creates Vitest suite with scenario comments and assertions', () => {
  const suite = synthesizeTestSuite({
    functionName: 'calculateMetrics',
    importPath: '../../server/utils/metrics',
    scenarios: [{ title: 'happy path', steps: ['Given input', 'Then output'] }]
  })
  assert.match(suite, /import \{ describe, it, expect \} from 'vitest'/)
  assert.match(suite, /import \{ calculateMetrics \} from '\.\.\/\.\.\/server\/utils\/metrics'/)
  assert.match(suite, /it\('happy path'/)
})

test('declaredFunctions lists every declared name once', () => {
  assert.deepEqual(declaredFunctions([]), [])
  assert.deepEqual(
    declaredFunctions(['export function alpha(a: number): void\nexport function beta(): string']),
    ['alpha', 'beta']
  )
  // Repetir un nombre en dos bloques de contrato no debe generar dos describes.
  assert.deepEqual(declaredFunctions(['export function x(){}', 'export function x(){}']), ['x'])
})

test('the suite imports the names the contracts declare, not the default handler', () => {
  // El defecto que este caso fija, medido el 2026-09-20: el stub definía
  // `evaluateFiberHealth` y `resetMetrics`, y el test importaba `handler` de
  // `./handler` — un símbolo y una ruta inexistentes. El RED no podía pasar por
  // la razón correcta, y el default `handler` tapaba el hueco.
  const { testSuite, implementationStub } = scaffoldTaskFromSpecs(FIXTURE, { importPath: '../srv/fiber' })
  assert.match(testSuite, /import \{ evaluateFiberHealth \} from '\.\.\/srv\/fiber'/)
  assert.match(testSuite, /import \{ resetMetrics \} from '\.\.\/srv\/fiber'/)
  assert.doesNotMatch(testSuite, /handler/, 'volvió el default que desconectaba las dos mitades')
  // Y la otra mitad, para que el caso no pase por accidente si el stub se vacía.
  assert.match(implementationStub, /throw new Error\('Not implemented: evaluateFiberHealth'\)/)
})

test('a design with no declared function keeps the previous single block', () => {
  const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-synth-nofn-'))
  try {
    fs.writeFileSync(path.join(vacio, 'design.md'), '```typescript\nexport type Only = 1\n```\n')
    const { testSuite } = scaffoldTaskFromSpecs(vacio)
    assert.match(testSuite, /should be defined and implemented/)
    assert.equal((testSuite.match(/describe\(/g) || []).length, 1)
  } finally {
    fs.rmSync(vacio, { recursive: true, force: true })
  }
})

test('importPath defaults to a visible placeholder instead of inventing a path', () => {
  // `design.md` declara firmas, nunca dónde viven: adivinar la ruta es
  // exactamente el defecto que este arreglo elimina. El default se marca.
  const { testSuite } = scaffoldTaskFromSpecs(FIXTURE)
  assert.match(testSuite, /from '\.\/<module>'/)
})

test('the report says it wrote nothing, because that is the guarantee', () => {
  const out = formatScaffoldReport(FIXTURE, { importPath: '../srv/fiber' })
  assert.match(out, /implementationStub/)
  assert.match(out, /testSuite/)
  assert.match(out, /Nada escrito/)
})

test('the CLI prints usage and exits 1 when it has no --task-dir', () => {
  for (const args of [[], ['--task-dir']]) {
    const { code, out } = runCli(args)
    assert.equal(code, 1, `args=${JSON.stringify(args)}`)
    assert.match(out, /uso: node scripts\/sdd-lifecycle\/synthesize-stubs\.mjs/)
  }
})

test('the CLI does not take another flag as the value of --task-dir', () => {
  const { code, out } = runCli(['--task-dir', '--dry-run'])
  assert.equal(code, 1)
  assert.match(out, /uso:/)
})

test('the CLI names the missing directory instead of throwing a stack', () => {
  const { code, out } = runCli(['--task-dir', '/tmp/aoi-no-existe-synth-xyz'])
  assert.equal(code, 1)
  assert.match(out, /no existe el directorio de tarea/)
  assert.doesNotMatch(out, /at Object\./, 'salió el stack en vez del mensaje')
})

test('the CLI prints both scaffolds for a real task directory', () => {
  const { code, out } = runCli(['--task-dir', FIXTURE, '--import-path', '../srv/fiber'])
  assert.equal(code, 0)
  assert.match(out, /import \{ evaluateFiberHealth \}/)
  assert.match(out, /Not implemented: resetMetrics/)
})

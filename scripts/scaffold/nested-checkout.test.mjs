/**
 * scripts/scaffold/nested-checkout.test.mjs
 *
 * Fija la regla de `nested-checkout.mjs` en cada recorrido que la usa.
 *
 * El defecto medido el 2026-10-01: con los worktrees de Claude Code dentro del
 * repositorio (`.claude/worktrees/<nombre>/`, cada uno un checkout con `.git`
 * archivo), `pnpm test` desde la raíz fallaba porque cada recorrido descendía
 * en ellos: 1313 tests "huérfanos" en `aoi:test-globs` y 11 copias del
 * protocolo en `aoi:audit-protocol`. El árbol de abajo reproduce esa forma con
 * las dos variantes de `.git` (archivo, como un worktree; directorio, como un
 * clon) y un test suelto y una copia del protocolo adentro de cada una.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { isNestedCheckout, withoutNestedCheckouts } from './nested-checkout.mjs'
import { collectTestFiles } from './validate-test-globs.mjs'
import { listSourceFiles } from './validate-srp.mjs'
import { auditReachability } from './source-reachability.mjs'
import { mirror } from './failure-injection.mjs'
import { protocolCopies, walkFiles } from '../multi-harness/audit-protocol-integrity.mjs'
import { sandboxCopy } from '../multi-harness/entry-point-probe.mjs'
import { collectTestSources } from '../sdd-lifecycle/test-reachability.mjs'
import { buildDiscoveryCorpus } from '../sdd-lifecycle/real-corpus.mjs'
import { auditDeterminism } from '../code-lens/determinism-classifier.mjs'
import { moduleImports } from '../code-lens/interaction-graph.mjs'
import { collectDeclaredDependencies } from '../facts-consistency-guard.mjs'

const PROTOCOL = 'docs/internal/audits/PROTOCOLO_AUDITORIA_COMPARATIVA.md'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-nested-checkout-'))
after(() => fs.rmSync(tmp, { recursive: true, force: true }))

function write(root, rel, content = '') {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), content)
}

/** Un checkout con `.git` en la raíz y tres checkouts anidados adentro. */
function tree() {
  const root = fs.mkdtempSync(path.join(tmp, 'repo-'))
  fs.mkdirSync(path.join(root, '.git')) // la raíz ES un checkout: nunca se consulta
  write(root, 'setup.sh')
  write(root, 'package.json', '{"dependencies":{"own-dep":"1"}}')
  write(root, 'scripts/own.mjs', 'export const x = 1\n')
  write(root, 'scripts/own.test.mjs', "import { x } from './own.mjs'\n")
  write(root, PROTOCOL, '# protocolo\n')
  const nested = {
    '.claude/worktrees/fake': 'file', // la forma medida: worktree de Claude Code
    'vendor/other': 'dir', // un clon dentro del árbol
    'scripts/nested': 'file', // al alcance de los recorridos que parten de scripts/
  }
  for (const [dir, kind] of Object.entries(nested)) {
    if (kind === 'file') write(root, `${dir}/.git`, 'gitdir: /en/otro/lado\n')
    else fs.mkdirSync(path.join(root, dir, '.git'), { recursive: true })
    write(root, `${dir}/stray.mjs`, "export { y } from './other.mjs'\n")
    write(root, `${dir}/other.mjs`, 'export const y = Math.random()\n')
    write(root, `${dir}/stray.test.mjs`, "import { y } from './stray.mjs'\n")
    write(root, `${dir}/package.json`, '{"dependencies":{"ghost-dep":"1"}}')
    write(root, `${dir}/${PROTOCOL}`, '# copia\n')
  }
  return { root, nested: Object.keys(nested) }
}

const touchesNested = (paths, nested) => paths.filter((p) => nested.some((n) => String(p).includes(n)))

describe('un directorio con su propio .git es otro checkout', () => {
  it('reconoce `.git` archivo y directorio, y nada más', () => {
    const { root } = tree()
    assert.equal(isNestedCheckout(path.join(root, '.claude/worktrees/fake')), true)
    assert.equal(isNestedCheckout(path.join(root, 'vendor/other')), true)
    assert.equal(isNestedCheckout(path.join(root, 'scripts')), false)
    assert.equal(isNestedCheckout(path.join(root, 'scripts/own.mjs')), false)
  })

  it('aoi:test-globs no cuenta los tests de un checkout anidado como huérfanos', () => {
    const { root } = tree()
    assert.deepEqual(collectTestFiles(root), ['scripts/own.test.mjs'])
  })

  it('aoi:audit-protocol ve una sola copia del protocolo', () => {
    const { root, nested } = tree()
    assert.deepEqual(protocolCopies(root), [PROTOCOL])
    assert.deepEqual(touchesNested(walkFiles(root), nested), [])
  })

  it('aoi:srp, aoi:reachability y el invariant gate no miden código de otro checkout', () => {
    const { root, nested } = tree()
    assert.deepEqual(listSourceFiles(root), ['scripts/own.mjs', 'scripts/own.test.mjs'])
    const reach = auditReachability(root, {})
    assert.equal(reach.scanned, 1)
    assert.deepEqual(reach.unreached, [])
    const tests = collectTestSources(root).map((s) => path.relative(root, s.file))
    assert.deepEqual(tests, ['scripts/own.test.mjs'])
    assert.deepEqual(touchesNested(tests, nested), [])
  })

  it('las lentes y el corpus del benchmark tampoco descienden', () => {
    const { root } = tree()
    assert.deepEqual(Object.keys(auditDeterminism(root)), ['scripts/own.mjs'])
    assert.deepEqual(moduleImports(root), {})
    assert.doesNotMatch(JSON.stringify(buildDiscoveryCorpus(root, { keyword: 'x' })), /nested|stray/)
  })

  it('facts-consistency-guard no toma dependencias de otro checkout', () => {
    const { root } = tree()
    const { dependencies } = collectDeclaredDependencies(root)
    assert.ok(dependencies.has('own-dep'))
    assert.ok(!dependencies.has('ghost-dep'), 'leyó el package.json de un checkout anidado')
  })

  it('las copias desechables no arrastran checkouts anidados', () => {
    const { root, nested } = tree()
    const dest = fs.mkdtempSync(path.join(tmp, 'mirror-'))
    mirror(root, dest)
    const work = sandboxCopy(root)
    const viaFilter = fs.mkdtempSync(path.join(tmp, 'cp-'))
    fs.cpSync(root, viaFilter, { recursive: true, filter: withoutNestedCheckouts(root) })
    try {
      for (const copy of [dest, work, viaFilter]) {
        assert.ok(fs.existsSync(path.join(copy, 'scripts/own.mjs')), `${copy} perdió el árbol propio`)
        for (const n of nested) assert.ok(!fs.existsSync(path.join(copy, n)), `${copy} copió ${n}`)
      }
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })

  it('el filtro de cpSync conserva la decisión propia del llamador', () => {
    const { root } = tree()
    const keep = withoutNestedCheckouts(root, (src) => !src.endsWith('own.test.mjs'))
    assert.equal(keep(root), true)
    assert.equal(keep(path.join(root, 'scripts/own.test.mjs')), false)
    assert.equal(keep(path.join(root, 'scripts/own.mjs')), true)
    assert.equal(keep(path.join(root, 'vendor/other')), false)
  })
})

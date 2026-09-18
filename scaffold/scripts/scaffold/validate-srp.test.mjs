import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, after } from 'node:test'
import { auditSrp, listSourceFiles, LEGACY_BUDGET, MAX_LOC } from './validate-srp.mjs'

/** La raiz del repositorio, para el caso que corre el CLI en un hijo. */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Builds a throwaway tree whose files have exact line counts. `setup.sh` marks
 * it as the development repository, which is where the full audit applies;
 * pass devRepo:false to model an installed workspace.
 */
//
// Los árboles se acumulan y se borran en un `after` del módulo: el helper se
// invoca inline y no hay variable por test donde limpiar. Medido: 15
// directorios por corrida quedaban en `$TMPDIR` para siempre.
const temporales = []
after(() => {
  for (const dir of temporales) fs.rmSync(dir, { recursive: true, force: true })
})

function treeWith(sizes, { devRepo = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-srp-'))
  temporales.push(root)
  if (devRepo && !sizes['setup.sh']) fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
  for (const [rel, lines] of Object.entries(sizes)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    // `lines` here is the count validateFileSizes reports: newlines + 1.
    fs.writeFileSync(full, 'x\n'.repeat(lines - 1))
  }
  return root
}

describe('listSourceFiles', () => {
  it('skips vendored trees, and those only by directory name', () => {
    const root = treeWith({
      'setup.sh': 2,
      'scripts/real.mjs': 5,
      'scripts/node_modules/vendor.mjs': 5,
      'scripts/notes.md': 5,
    })

    assert.deepEqual(listSourceFiles(root), ['scripts/real.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  // This case used to assert the opposite, under the name "skips the scaffold
  // mirror", and that name is where the defect came from. `scripts/scaffold/`
  // is not the mirror: the mirror is `scaffold/` at the root, which this walk
  // never reaches because it starts at `scripts/`. Skipping by basename
  // therefore excluded an entire area of governed source — the area that holds
  // the gates themselves — and five files sat over the limit unmeasured.
  it('audits scripts/scaffold, which is source and not the mirror', () => {
    const root = treeWith({
      'setup.sh': 2,
      'scripts/real.mjs': 5,
      'scripts/scaffold/validate-thing.mjs': 5,
    })

    assert.deepEqual(listSourceFiles(root), ['scripts/real.mjs', 'scripts/scaffold/validate-thing.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('skips the root mirror itself, matched as a path and not as a name', () => {
    const root = treeWith({
      'setup.sh': 2,
      'scripts/real.mjs': 5,
      'scaffold/scripts/real.mjs': 5,
    })

    // Walking from the root is not what `auditSrp` does, but asserting it here
    // keeps the distinction honest if the walk is ever widened.
    assert.deepEqual(listSourceFiles(root, '.'), ['scripts/real.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('audits everything in the development repository', () => {
    const root = treeWith({ 'setup.sh': 2, 'scripts/aoi.mjs': 5, 'scripts/owner-script.mjs': 5 })

    assert.deepEqual(listSourceFiles(root), ['scripts/aoi.mjs', 'scripts/owner-script.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  // Este caso afirmaba lo mismo, y su fixture construía `scaffold/scripts/aoi.mjs`
  // DENTRO del destino. Ese árbol no existe: desde que el Owner zanjó que el
  // andamio no se queda instalado, `setup.sh` borra `scaffold/` del workspace.
  // La condición de prueba aceptaba justo el atajo que la compuerta necesitaba
  // prohibir, así que su verde no decía nada — medido en un árbol sin espejo,
  // `listSourceFiles` devolvía CERO archivos y el ratchet imprimía igual
  // "No new SRP violations". Qué está gobernado se responde con la lista
  // declarada del espejo, no con un directorio que se retira.
  it("audits only governed files in an installed workspace, not the owner's own", () => {
    const root = treeWith(
      { 'scripts/sdd-lifecycle/gate.mjs': 5, 'scripts/owner-script.mjs': 5 },
      { devRepo: false }
    )

    assert.deepEqual(listSourceFiles(root), ['scripts/sdd-lifecycle/gate.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('una instalación no trae el espejo, y el ratchet tiene que medir igual', () => {
    // El enunciado end-to-end del defecto: sin espejo en el destino, la
    // compuerta no reportaba "no sé" — no reportaba nada, y el verde de una
    // auditoría sobre cero archivos se lee como cobertura completa.
    const root = treeWith({ 'scripts/sdd-lifecycle/enorme.mjs': 400 }, { devRepo: false })

    const report = auditSrp(root, {})

    assert.equal(report.scanned, 1, 'la auditoría corrió sobre cero archivos y dio verde')
    assert.deepEqual(report.added, [{ file: 'scripts/sdd-lifecycle/enorme.mjs', lines: 400 }])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('auditSrp ratchet', () => {
  it('passes when a legacy file stays at its recorded size', () => {
    const root = treeWith({ 'scripts/legacy.mjs': 341 })
    const report = auditSrp(root, { 'scripts/legacy.mjs': 341 })

    assert.deepEqual(report.added, [])
    assert.deepEqual(report.grown, [])
    assert.deepEqual(report.resolved, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('fails when a file not on the list crosses the limit', () => {
    const root = treeWith({ 'scripts/fresh.mjs': 301 })
    const report = auditSrp(root, {})

    assert.equal(report.added.length, 1)
    assert.equal(report.added[0].file, 'scripts/fresh.mjs')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('fails when legacy debt grows by even one line', () => {
    const root = treeWith({ 'scripts/legacy.mjs': 342 })
    const report = auditSrp(root, { 'scripts/legacy.mjs': 341 })

    assert.equal(report.grown.length, 1)
    assert.equal(report.grown[0].lines, 342)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('accepts legacy debt shrinking, since the ratchet only turns one way', () => {
    const root = treeWith({ 'scripts/legacy.mjs': 320 })
    const report = auditSrp(root, { 'scripts/legacy.mjs': 341 })

    assert.deepEqual(report.grown, [])
    assert.deepEqual(report.resolved, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('fails when a budgeted file is finally under the limit, so the list cannot rot', () => {
    const root = treeWith({ 'scripts/legacy.mjs': 120 })
    const report = auditSrp(root, { 'scripts/legacy.mjs': 341 })

    assert.deepEqual(report.resolved, ['scripts/legacy.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the shipped budget', () => {
  it('records every legacy file above the limit and nothing else', () => {
    for (const [file, lines] of Object.entries(LEGACY_BUDGET)) {
      assert.ok(lines > MAX_LOC, `${file} is on the debt list but does not exceed ${MAX_LOC}`)
    }
  })
})

describe('a link is a path to code, not a way around the rule', () => {
  /** A tree whose `scripts/linked` is a symlink to a directory living elsewhere. */
  function treeWithLinkedDir(sizes) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-srp-link-'))
    temporales.push(root)
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-srp-out-'))
    temporales.push(outside)
    fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
    for (const [name, lines] of Object.entries(sizes)) {
      fs.writeFileSync(path.join(outside, name), 'x\n'.repeat(lines - 1))
    }
    fs.symlinkSync(outside, path.join(root, 'scripts/linked'))
    return { root, outside }
  }

  // `readdirSync` reports a symlink as neither a file nor a directory, so the
  // walk used to skip it in silence. 901 LOC of governed source sat behind one
  // and the ratchet printed "no new SRP violations" — an invariant that
  // anything can step out of is a preference again.
  it('measures source behind a symlinked directory', () => {
    const { root } = treeWithLinkedDir({ 'gordo.mjs': 901 })
    const found = listSourceFiles(root)
    assert.deepEqual(found, ['scripts/linked/gordo.mjs'])

    const { added } = auditSrp(root, {}, MAX_LOC)
    assert.equal(added.length, 1)
    assert.equal(added[0].lines, 901)
  })

  it('measures a symlinked file too', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-srp-linkf-'))
    temporales.push(root)
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-srp-outf-'))
    temporales.push(outside)
    fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
    fs.writeFileSync(path.join(outside, 'gordo.mjs'), 'x\n'.repeat(400))
    fs.symlinkSync(path.join(outside, 'gordo.mjs'), path.join(root, 'scripts/gordo.mjs'))

    assert.deepEqual(listSourceFiles(root), ['scripts/gordo.mjs'])
    assert.equal(auditSrp(root, {}, MAX_LOC).added.length, 1)
  })

  it('steps over a broken link instead of crashing on it', () => {
    // A dangling link has nothing to measure, but `statSync` throws on it and
    // an exception here would take the whole gate down.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-srp-dead-'))
    temporales.push(root)
    fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
    fs.symlinkSync(path.join(root, 'no-existe'), path.join(root, 'scripts/roto.mjs'))

    assert.deepEqual(listSourceFiles(root), [])
  })
})

/**
 * La guarda de CLI, por spawn.
 *
 * `if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(...))`
 * es invisible importando el modulo: `main()` no corre, asi que ninguna
 * asercion sobre las funciones exportadas la toca. Un `and->or` la desactiva.
 *
 * La asercion tiene dos partes y la segunda es la que importa: verificar solo
 * que no imprime la cabecera deja pasar un import que CRASHEA. Con la guarda
 * mutada a `||`, `path.resolve(process.argv[1])` recibe `undefined` bajo
 * `node -e`, tira un TypeError, y el modulo no llega a imprimir nada — asi que
 * una asercion que solo mira la ausencia de la cabecera pasa por la razon
 * equivocada. Medido el 2026-09-13 en el mismo caso de `source-reachability`.
 */
describe('la guarda de CLI de validate-srp', () => {
  const corre = (args) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30000, cwd: REPO })

  it('importar el modulo NO corre la auditoria ni crashea', () => {
    const r = corre(['-e', "import('./scripts/scaffold/validate-srp.mjs')"])
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.doesNotMatch(out, /AOI SRP Ratchet/, `el import ejecuto main(): ${out.slice(0, 200)}`)
    assert.equal(r.status, 0, `el import fallo con status ${r.status}: ${out.slice(0, 300)}`)
    assert.doesNotMatch(out, /TypeError/, 'el import crasheo en vez de solo no ejecutar')
  })

  it('correrlo como script SI la corre y sale 0 en el repo real', () => {
    const r = corre(['scripts/scaffold/validate-srp.mjs'])
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /AOI SRP Ratchet/, `no ejecuto la auditoria: ${out.slice(0, 200)}`)
    assert.equal(r.status, 0, `salio ${r.status}: ${out.slice(0, 300)}`)
    assert.match(out, /No new SRP violations/, 'no trajo el veredicto verde')
  })
})

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { collectTestSources, dropAoiOwnedTests, dropUnreachableTests, isTestFile } from './test-reachability.mjs'
import { auditInvariantCoverage } from './invariant-gate.mjs'

/** A workspace whose vitest config only collects `test/**`. */
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-reach-'))
  fs.mkdirSync(path.join(root, 'app/utils'), { recursive: true })
  fs.mkdirSync(path.join(root, 'test'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }))
  fs.writeFileSync(path.join(root, 'vitest.config.ts'), `export default { test: { include: ['test/**/*.test.ts'] } }\n`)
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

describe('a test no runner collects counts for nothing', () => {
  it('drops the unreachable file and keeps the reachable one', () => {
    // The live-cycle scenario exactly: a delegated agent wrote its test under
    // app/**, the Invariant Gate matched its tags, and vitest never collected
    // it because `include` is pinned to test/**.
    const root = workspace()
    const orphan = path.join(root, 'app/utils/budget.test.ts')
    const reachable = path.join(root, 'test/budget.test.ts')
    fs.writeFileSync(orphan, `it('BIC-1:never.1', () => {})`)
    fs.writeFileSync(reachable, `it('BIC-1:never.2', () => {})`)

    const { kept, dropped } = dropUnreachableTests(root, collectTestSources(root))

    assert.deepEqual(dropped.map((f) => path.basename(path.dirname(f))), ['utils'])
    assert.equal(kept.length, 1)
    assert.match(kept[0].file, /test\/budget\.test\.ts$/)
    clean(root)
  })

  it('keeps everything when reachability cannot be determined', () => {
    // No package.json: the question has no answer, and discarding a real test
    // because we could not ask would be the same error pointed the other way.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-reach-'))
    fs.writeFileSync(path.join(root, 'a.test.mjs'), 'x')
    const sources = collectTestSources(root)

    const { kept, dropped } = dropUnreachableTests(root, sources)

    assert.equal(kept.length, sources.length)
    assert.deepEqual(dropped, [])
    clean(root)
  })

  it('never counts the scaffold mirror as an authoritative test tree', () => {
    // A mirrored copy satisfying a contract on its own would let a rule be
    // "enforced" by a file that is only a duplicate of another.
    const root = workspace()
    fs.mkdirSync(path.join(root, 'scaffold/test'), { recursive: true })
    fs.writeFileSync(path.join(root, 'scaffold/test/mirror.test.ts'), `it('BIC-1:never.1', () => {})`)

    assert.equal(collectTestSources(root).filter((s) => s.file.includes('scaffold')).length, 0)
    clean(root)
  })
})

/**
 * Un árbol con la forma de una instalación de AOI: los tests de AOI bajo una
 * ruta gobernada, el del Owner afuera. `setup.sh` es lo único que distingue el
 * repo fuente de una instalación, igual que en `validate-srp.mjs`.
 */
function installedWorkspace({ development = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-bic-ns-'))
  fs.mkdirSync(path.join(root, 'scripts/sdd-lifecycle'), { recursive: true })
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true })
  if (development) fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
  fs.writeFileSync(
    path.join(root, 'scripts/sdd-lifecycle/behavioral-probes.test.mjs'),
    `it('BIC-2026-001:never.1 charges the exact literal payload for every phase', () => {})`
  )
  fs.writeFileSync(path.join(root, 'tests/owner.test.mjs'), `it('algo del Owner', () => {})`)
  return root
}

const REGLA_DEL_OWNER = [
  { tag: 'BIC-2026-001:never.1', kind: 'never', statement: 'Ninguna VPS acepta SSH como root' },
]

describe('el BIC del producto no se cubre con un test de AOI que comparte número', () => {
  it('descarta los tests de AOI cuando corre dentro de una instalación', () => {
    // Medido en una instalación real: la regla "ninguna VPS acepta SSH como
    // root", sin una sola prueba escrita, quedaba cubierta por un `it()` de AOI
    // titulado "charges the exact literal payload for every phase". El veredicto
    // dependía del número del identificador, no de que existiera un test.
    const root = installedWorkspace()

    const { kept, dropped } = dropAoiOwnedTests(root, collectTestSources(root))
    const audit = auditInvariantCoverage(REGLA_DEL_OWNER, kept)

    assert.equal(dropped.length, 1, 'el test de AOI siguió contando como evidencia del contrato del Owner')
    assert.match(dropped[0], /behavioral-probes\.test\.mjs$/)
    assert.equal(audit.status, 'FAILED')
    assert.equal(audit.covered.length, 0)
    assert.match(kept.map((s) => s.file).join(), /tests\/owner\.test\.mjs$/, 'el test del Owner también se descartó')
    clean(root)
  })

  it('en el repo fuente NO descarta nada: ahí los BIC de scripts/ son los del producto', () => {
    // Control negativo. Un filtro que corre siempre deja al gate sin nada que
    // medir sobre AOI, que es exactamente el caso en el que hoy funciona bien.
    const root = installedWorkspace({ development: true })

    const { kept, dropped } = dropAoiOwnedTests(root, collectTestSources(root))
    const audit = auditInvariantCoverage(REGLA_DEL_OWNER, kept)

    assert.deepEqual(dropped, [])
    assert.equal(audit.status, 'PASSED')
    clean(root)
  })
})

describe('qué es un espejo, y qué sólo comparte su nombre', () => {
  it('no cuenta la copia byte a byte que `.conf/snapshots/` guarda en el destino', () => {
    // Medido en una instalación real el 2026-09-18, con `dropAoiOwnedTests` ya
    // puesto: `setup.sh` retira `scaffold/` del destino, pero `.conf/snapshots/`
    // conserva 114 archivos de test copiados, y esa ruta no está gobernada. Un
    // contrato del Owner sin una sola prueba seguía dando PASSED, acreditado por
    // `.conf/snapshots/scripts/sdd-lifecycle/behavioral-probes.test.mjs`.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-conf-'))
    fs.mkdirSync(path.join(root, '.conf/snapshots/scripts/sdd-lifecycle'), { recursive: true })
    fs.writeFileSync(
      path.join(root, '.conf/snapshots/scripts/sdd-lifecycle/probes.test.mjs'),
      `it('BIC-2026-001:never.1 algo de AOI', () => {})`
    )

    assert.deepEqual(collectTestSources(root), [])
    clean(root)
  })

  it('`scripts/scaffold/` es fuente real, no el espejo: sus tests cuentan', () => {
    // El espejo es `scaffold/` en la RAÍZ. Estaba excluido por NOMBRE, así que
    // se llevaba puesta el área que contiene las compuertas: medido en este
    // árbol, 0 de 142 tests colectados venían de ahí, y el test que cita
    // `BIC-2026-001:never.3` no podía acreditar la regla. Es el mismo error de
    // anclaje que `validate-srp.mjs` documenta en `MIRROR_DIR`.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-anchor-'))
    fs.mkdirSync(path.join(root, 'scripts/scaffold'), { recursive: true })
    fs.mkdirSync(path.join(root, 'scaffold/scripts'), { recursive: true })
    fs.writeFileSync(path.join(root, 'scripts/scaffold/gate.test.mjs'), `it('BIC-9:never.1', () => {})`)
    fs.writeFileSync(path.join(root, 'scaffold/scripts/copia.test.mjs'), `it('BIC-9:never.1', () => {})`)

    const files = collectTestSources(root).map((s) => path.relative(root, s.file))

    assert.deepEqual(files, ['scripts/scaffold/gate.test.mjs'])
    clean(root)
  })
})

/**
 * El lenguaje del PRODUCTO no puede decidir el veredicto del gate.
 *
 * Medido el 2026-09-23 sobre `campaign-manager`, cuyo producto es .NET: sus 22
 * reglas de contrato aparecían SIN CUBRIR con los tags presentes en los
 * `*Tests.cs` de `backend/tests/`, porque el predicado sólo reconocía el infijo
 * `.test.` de JS. Sembrando una convención por lenguaje, de 10 archivos se
 * colectaban 2.
 */
describe('cada lenguaje declara SU convención de archivo de test', () => {
  /** Un árbol con una convención por lenguaje, más producción que NO debe entrar. */
  function convenciones() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-lang-'))
    const archivos = [
      'A.test.ts', // JS: el infijo
      'ValidacionTests.cs', // C#: el sufijo
      'UnTest.cs', // C#: sufijo en singular
      'test_algo.py', // pytest, forma prefijo
      'algo_test.py', // pytest, forma sufijo
      'algo_test.go', // Go: el sufijo es obligatorio
      'tests/integracion.rs', // Rust: la carpeta
      'Programa.cs', // producción: NO
      'helpers.cs', // producción: NO
      'otro/suelto.rs', // fuera de tests/: NO
      'notas_algo.py', // ni prefijo ni sufijo: NO
    ]
    for (const rel of archivos) {
      const full = path.join(root, rel)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, 'x\n')
    }
    return root
  }

  it('colecta la convención real de cada lenguaje declarado', () => {
    const root = convenciones()

    const vistos = collectTestSources(root)
      .map((s) => path.relative(root, s.file))
      .sort()

    assert.deepEqual(vistos, [
      'A.test.ts',
      'UnTest.cs',
      'ValidacionTests.cs',
      'algo_test.go',
      'algo_test.py',
      'test_algo.py',
      'tests/integracion.rs',
    ])
    clean(root)
  })

  it('un archivo de producción NO acredita una regla, en ningún lenguaje', () => {
    // La mitad que importa. Si el filtro colectara todo `.cs`, un tag escrito en
    // un comentario de `Programa.cs` haría pasar la regla sin una sola prueba
    // corriendo — el mismo ciclo que este módulo existe para cazar, entrando por
    // la puerta que el arreglo estaba abriendo.
    assert.equal(isTestFile('backend/src/Programa.cs'), false)
    assert.equal(isTestFile('backend/src/ValidacionDeEsquema.cs'), false)
    assert.equal(isTestFile('scripts/notas_algo.py'), false)
    assert.equal(isTestFile('otro/suelto.rs'), false)

    assert.equal(isTestFile('backend/tests/ValidacionDeEsquemaTests.cs'), true)
    assert.equal(isTestFile('backend/tests/UnTest.cs'), true)
    assert.equal(isTestFile('crate/tests/integracion.rs'), true)
    assert.equal(isTestFile('test_algo.py'), true)
    assert.equal(isTestFile('algo_test.py'), true)
  })

  it('la convención de JS no cambió: control de no-regresión', () => {
    // El arreglo podía llevarse puesto lo que ya funcionaba, que es la mitad que
    // el arreglo no toca. Se fija para que no dependa de la buena intención.
    assert.equal(isTestFile('app/utils/budget.test.ts'), true)
    assert.equal(isTestFile('app/utils/budget.spec.jsx'), true)
    assert.equal(isTestFile('app/utils/budget.ts'), false)
  })
})

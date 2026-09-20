/**
 * scripts/sdd-lifecycle/audit-task-artifacts.test.mjs
 *
 * El caso que este instrumento existe para ver, y que nada veía: una fase que
 * dejó su producto pero NO tuvo su entrada. El contrato se verificaba;
 * la corrida no.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, after } from 'node:test'
import {
  NON_FILE_ARTIFACTS,
  ROOT_ARTIFACTS,
  artifactPath,
  auditTask,
  auditTaskArtifacts,
  classifyArtifact,
  formatReport,
  phaseRan,
} from './audit-task-artifacts.mjs'

/** Un árbol con las tareas que se le pasen, para no depender del `.tasks/` real. */
const trees = []
function tree(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-task-artifacts-'))
  trees.push(root)
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body === null ? '' : body)
  }
  return root
}
after(() => {
  for (const root of trees) fs.rmSync(root, { recursive: true, force: true })
})

const TASK = { id: 'TASK-2026-001', feature: 'demo' }

/** Las fases del fixture, para probar la lógica sin depender del contrato real. */
const CHAIN = [
  { phase: 'Phase_1_New', produces: ['proposal.md', 'registry.md'], requires: [] },
  { phase: 'Phase_2_FF', produces: ['spec.md', 'design.md'], requires: ['proposal.md'] },
  { phase: 'Phase_3_Apply', produces: [], requires: ['spec.md'] },
  { phase: 'Phase_4_Verify', produces: ['verify-report.md'], requires: ['spec.md'] },
]

describe('classifyArtifact distingue las tres clases', () => {
  it('un hecho ICM no es un archivo, y se declara por qué', () => {
    // Sin esta distinción el instrumento reporta `sbc-facts` faltante en toda
    // tarea, para siempre. Una compuerta que siempre falla se ignora — y eso es
    // peor que no tenerla, que es exactamente el motivo por el que el contrato
    // los reconoce por prefijo de clave en vez de por archivo.
    assert.equal(classifyArtifact('sbc-facts'), 'non-file')
    assert.equal(classifyArtifact('bic-facts'), 'non-file')
    assert.equal(classifyArtifact('blueprint-diagrams'), 'non-file')
    assert.ok(Object.keys(NON_FILE_ARTIFACTS).length >= 3)
  })

  it('registry.md no vive en la carpeta de la tarea', () => {
    assert.equal(classifyArtifact('registry.md'), 'root')
    assert.equal(ROOT_ARTIFACTS['registry.md'], '.tasks/registry.md')
  })

  it('el resto son archivos de la tarea', () => {
    for (const a of ['proposal.md', 'spec.md', 'design.md', 'tasks.md', 'verify-report.md']) {
      assert.equal(classifyArtifact(a), 'task', `${a} debería ser un archivo de tarea`)
    }
  })
})

describe('artifactPath resuelve cada clase, o declara que no puede', () => {
  const root = '/r'
  const dir = '/r/.tasks/demo/TASK-2026-001'

  it('un no-archivo devuelve null en vez de una ruta inventada', () => {
    assert.equal(artifactPath(root, dir, 'sbc-facts'), null)
  })

  it('un artefacto raíz se resuelve contra la RAÍZ, no contra la tarea', () => {
    assert.equal(artifactPath(root, dir, 'registry.md'), path.join('/r', '.tasks/registry.md'))
  })

  it('un archivo de tarea se resuelve dentro de la tarea', () => {
    assert.equal(artifactPath(root, dir, 'spec.md'), path.join(dir, 'spec.md'))
  })
})

describe('phaseRan decide por productos, y distingue parcial de ausente', () => {
  it('sin ningún producto, la fase no corrió', () => {
    assert.equal(phaseRan(['spec.md', 'design.md'], new Set()), false)
  })

  it('con UNO de cuatro, corrió — y eso es un ciclo cortado, no una ausencia', () => {
    // `Phase_2_FF` produce cuatro archivos. Tres de cuatro es una fase que
    // empezó y no terminó, que es un hallazgo distinto de una que no corrió.
    assert.equal(phaseRan(['a.md', 'b.md', 'c.md', 'd.md'], new Set(['a.md'])), true)
  })

  it('con todos, corrió', () => {
    assert.equal(phaseRan(['a.md'], new Set(['a.md'])), true)
  })

  it('una fase sin productos declarados no puede haber corrido', () => {
    // `Phase_3_Apply` no produce artefactos. Sin este caso, `.some()` sobre una
    // lista vacía devuelve false y la fase nunca se evalúa — que es lo correcto,
    // pero hay que fijarlo para que no se "arregle" con un `|| true`.
    assert.equal(phaseRan([], new Set()), false)
  })
})

describe('auditTask lee la corrida', () => {
  it('un ciclo completo no deja hallazgos', () => {
    const root = tree({
      '.tasks/demo/TASK-2026-001/proposal.md': 'x'.repeat(20),
      '.tasks/registry.md': '| TASK-2026-001 |',
      '.tasks/demo/TASK-2026-001/spec.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/design.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/verify-report.md': 'x'.repeat(20),
    })
    const r = auditTask(root, TASK, CHAIN)
    assert.deepEqual(r.findings, [])
    assert.deepEqual(r.ran, ['Phase_1_New', 'Phase_2_FF', 'Phase_4_Verify'])
  })

  it('una fase que corrió sin su entrada es un hallazgo — el que nadie veía', () => {
    // El `verify-report.md` existe (la fase produjo) y el `spec.md` no (la
    // entrada faltaba). El ciclo verificó contra nada, y hasta ahora ninguna
    // compuerta lo decía.
    const root = tree({
      '.tasks/demo/TASK-2026-001/verify-report.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/spec.md': null, // existe pero VACÍO
    })
    const r = auditTask(root, TASK, CHAIN)
    assert.ok(
      r.findings.some((f) => f.includes('Phase_4_Verify') && f.includes('sin spec.md')),
      `esperaba "corrió sin spec.md", obtuve: ${JSON.stringify(r.findings)}`
    )
  })

  it('un producto a medias es un hallazgo: la fase corrió y no terminó', () => {
    const root = tree({
      '.tasks/demo/TASK-2026-001/spec.md': 'x'.repeat(20),
      // `design.md` falta: FF produjo 1 de sus 2 archivos
    })
    const r = auditTask(root, TASK, CHAIN)
    assert.ok(
      r.findings.some((f) => f.includes('Phase_2_FF') && f.includes('design.md')),
      `esperaba el faltante de design.md, obtuve: ${JSON.stringify(r.findings)}`
    )
  })

  it('un archivo de 0 bytes NO cuenta como producido', () => {
    // "Se creó el archivo" no es "se hizo el trabajo". Sin esta aserción, un
    // `touch` satisface el contrato.
    const root = tree({
      '.tasks/demo/TASK-2026-001/spec.md': null,
      '.tasks/demo/TASK-2026-001/design.md': 'contenido',
    })
    const r = auditTask(root, TASK, CHAIN)
    assert.ok(
      r.findings.some((f) => f.includes('spec.md') && f.includes('vacío')),
      `esperaba el hallazgo de vacío, obtuve: ${JSON.stringify(r.findings)}`
    )
  })

  it('`registry.md` se resuelve contra la raíz: no se reporta faltante si está ahí', () => {
    const root = tree({
      '.tasks/registry.md': '| TASK-2026-001 |',
      '.tasks/demo/TASK-2026-001/proposal.md': 'x'.repeat(20),
    })
    const r = auditTask(root, TASK, CHAIN)
    assert.ok(
      !r.findings.some((f) => f.includes('registry.md')),
      `registry.md está en la raíz y no debe faltar: ${JSON.stringify(r.findings)}`
    )
  })
})

describe('sin tareas, y con el contrato REAL', () => {
  it('un árbol sin `.tasks/` no es un fallo: no hay corrida que auditar', () => {
    const root = tree({})
    const r = auditTaskArtifacts(root)
    assert.deepEqual(r.tasks, [])
    assert.deepEqual(r.findings, [])
    assert.match(formatReport(r), /no hay corrida que auditar/)
  })

  it('las siete fases del contrato real no producen hallazgos espurios', () => {
    // El control que más importa: sobre el contrato REAL, una tarea con todos
    // sus archivos de fase tiene que salir limpia. Si `sbc-facts` o
    // `bic-facts` se buscaran en disco, esto fallaría — y ese es el bug que
    // `NON_FILE_ARTIFACTS` evita.
    const root = tree({
      '.tasks/demo/TASK-2026-001/proposal.md': 'x'.repeat(20),
      '.tasks/registry.md': '| TASK-2026-001 |',
      '.tasks/demo/TASK-2026-001/spec.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/design.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/tasks.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/implementation-plan.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/verify-report.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/archive-report.md': 'x'.repeat(20),
      '.tasks/demo/TASK-2026-001/functional-docs.md': 'x'.repeat(20),
    })
    const r = auditTaskArtifacts(root)
    assert.deepEqual(r.findings, [], `el contrato real no debe dar hallazgos: ${JSON.stringify(r.findings)}`)
    assert.equal(r.tasks.length, 1)
  })

  it('y reporta la ausencia de hechos ICM como no verificable, no como faltante', () => {
    // La otra dirección: `Phase_5_Archive` produce dos archivos y requiere
    // `verify-report.md`. Si esa entrada falta, es hallazgo — pero
    // `Phase_-2_Genesis` produce `sbc-facts`, y su ausencia NUNCA lo es.
    const root = tree({
      '.tasks/demo/TASK-2026-001/archive-report.md': 'x'.repeat(20),
    })
    const r = auditTaskArtifacts(root)
    assert.ok(
      r.findings.some((f) => f.includes('verify-report.md')),
      `esperaba el hallazgo de verify-report.md, obtuve: ${JSON.stringify(r.findings)}`
    )
    assert.ok(
      !r.findings.some((f) => f.includes('sbc-facts') || f.includes('bic-facts')),
      `los hechos ICM no pueden aparecer como faltantes: ${JSON.stringify(r.findings)}`
    )
  })
})

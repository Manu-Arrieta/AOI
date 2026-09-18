/**
 * scripts/sdd-lifecycle/blueprint-gate-args.test.mjs
 *
 * Los argumentos de la compuerta, y sobre QUÉ ÁRBOL apunta cuando nadie se lo
 * dice. Separado de `blueprint-diagram.test.mjs` cuando ese archivo cruzó el
 * Invariante 5: qué se debe y cómo se audita es una pregunta; a dónde mira la
 * compuerta es otra.
 *
 * Las dos direcciones importan y se afirman por separado. En el repositorio
 * fuente el gate y el blueprint viven en árboles distintos, así que sin
 * `--workspace` no hay nada que auditar y no auditar no puede leerse como
 * cumplimiento — esa salvaguarda queda intacta. En una instalación son el mismo
 * árbol, y exigir el flag ahí convertía la salvaguarda en punto ciego.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  BLUEPRINT_DIR,
  auditDiagramArtifacts,
  implicitWorkspace,
  parseGateArgs,
} from './blueprint-diagram.mjs'

/**
 * Árboles descartables que se limpian SOLOS, con `t.after`.
 *
 * No es cosmético y este archivo ya lo pagó una vez: un `rmSync` al final del
 * test no corre si un assert falla antes, y un test que falla es justo cuando
 * más basura se acumula. Medido entonces: 15 directorios por corrida en
 * `$TMPDIR`, para siempre.
 */
const tempTree = (t, prefix) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

/** Un árbol CON `setup.sh`: el repositorio que shippea AOI. */
function sourceRepo(t) {
  const root = tempTree(t, 'aoi-src-')
  fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
  return root
}

/** Un árbol SIN `setup.sh`: un workspace donde AOI quedó instalado. */
function installedWorkspace(t) {
  return tempTree(t, 'aoi-ws-')
}


describe('parseGateArgs — un typo no puede degradar en silencio', () => {
  it('lee el valor de un flag con valor, sin confundirlo con la entidad', () => {
    // El bug que originó este parser: `--workspace /tmp/ws` dejaba `/tmp/ws`
    // como si fuera el nombre de la entidad de ICM.
    const args = parseGateArgs(['MIWS', '--workspace', '/tmp/ws'])
    assert.deepEqual(args.positional, ['MIWS'])
    assert.equal(args.workspaceRoot, '/tmp/ws')
  })

  it('lee --db, que es lo que permite testear sin tocar el store compartido', () => {
    const args = parseGateArgs(['MIWS', '--db', '/tmp/iso.db'])
    assert.equal(args.dbPath, '/tmp/iso.db')
  })

  it('--record es booleano y no consume el argumento siguiente', () => {
    const args = parseGateArgs(['MIWS', '--record'])
    assert.equal(args.record, true)
    assert.deepEqual(args.positional, ['MIWS'])
  })

  it('acepta los tres flags juntos', () => {
    const args = parseGateArgs(['MIWS', '--workspace', '/w', '--db', '/d', '--record'])
    assert.equal(args.workspaceRoot, '/w')
    assert.equal(args.dbPath, '/d')
    assert.equal(args.record, true)
    assert.deepEqual(args.positional, ['MIWS'])
  })

  it('un flag DESCONOCIDO tira error en vez de ignorarse', () => {
    // Ignorarlo convierte `--workspac /ruta` en una corrida "sin workspace", y
    // sin workspace la compuerta no puede afirmar cumplimiento — o sea, un typo
    // se leería como si no hubiera nada pendiente.
    assert.throws(() => parseGateArgs(['MIWS', '--workspac', '/w']), /flag desconocido/)
  })

  it('el error dice cuáles son los conocidos', () => {
    try {
      parseGateArgs(['--nope'])
      assert.fail('no tiró')
    } catch (err) {
      assert.match(err.message, /--workspace/)
      assert.match(err.message, /--db/)
      assert.match(err.message, /--record/)
    }
  })

  it('sin argumentos no inventa nada, en el repo fuente', (t) => {
    // El `cwd` va explícito: desde que existe el workspace implícito, dejarlo
    // al ambiente haría que este test afirme el directorio donde se corre.
    const args = parseGateArgs([], sourceRepo(t))
    assert.deepEqual(args.positional, [])
    assert.equal(args.workspaceRoot, '')
    assert.equal(args.dbPath, '')
    assert.equal(args.record, false)
  })

  it('un flag con valor ausente no rompe, queda vacío', (t) => {
    assert.equal(parseGateArgs(['MIWS', '--workspace'], sourceRepo(t)).workspaceRoot, '')
  })
})

describe('implicitWorkspace — el flag era salvaguarda arriba y punto ciego abajo', () => {
  it('en el repo fuente no asume nada: los dos árboles difieren', (t) => {
    // Acá el gate corre en el repo de AOI y el blueprint es del Owner, en otro
    // lado. Sin la ruta no hay nada que auditar, y no auditar no es cumplir.
    assert.equal(implicitWorkspace(sourceRepo(t)), '')
    assert.equal(parseGateArgs(['MIWS'], sourceRepo(t)).workspaceRoot, '')
  })

  it('en una instalación el workspace ES el cwd', (t) => {
    // Exigir el flag acá convertía `pnpm aoi:blueprint-gate` —la invocación que
    // el propio package.json declara— en una que jamás podía ver el diagrama
    // entregado en .blueprints/<SBC>/diagrams/, y por lo tanto no enforceaba.
    const ws = installedWorkspace(t)
    assert.equal(implicitWorkspace(ws), ws)
    assert.equal(parseGateArgs(['MIWS'], ws).workspaceRoot, ws)
  })

  it('un --workspace explícito gana sobre el implícito', (t) => {
    assert.equal(parseGateArgs(['MIWS', '--workspace', '/w'], installedWorkspace(t)).workspaceRoot, '/w')
    assert.equal(parseGateArgs(['MIWS', '--workspace', '/w'], sourceRepo(t)).workspaceRoot, '/w')
  })

  it('el implícito llega hasta los artefactos, que es el punto', (t) => {
    const ws = installedWorkspace(t)
    const dir = path.join(ws, BLUEPRINT_DIR, 'SBC-1', 'diagrams')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'flow.sequence.html'), '<svg/>')

    const audit = auditDiagramArtifacts(parseGateArgs(['MIWS'], ws).workspaceRoot, 'SBC-1')

    assert.equal(audit.present, true)
    assert.deepEqual(audit.files, ['flow.sequence.html'])
  })
})

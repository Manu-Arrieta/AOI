/**
 * scripts/multi-harness/audit-protocol-integrity.test.mjs
 *
 * Control negativo de la compuerta que vigila el protocolo de auditoría.
 *
 * La compuerta existe porque el protocolo podía nombrar un script inexistente
 * y nadie se enteraba. Un control negativo es lo único que distingue una
 * compuerta que verifica de una que aprueba porque no miró: cada caso construye
 * el defecto exacto y comprueba que la compuerta lo caza.
 *
 * Los fixtures se arman a partir de `SYMBOL_CONTRACTS` en vez de copiar el
 * repositorio. Copiar el árbol entero para probar un regex de exports sería
 * pagar minutos de disco por una medición que cabe en un directorio temporal.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import {
  PROTOCOL,
  SYMBOL_CONTRACTS,
  auditAuditProtocol,
  exportedSymbols,
  indexVersion,
  protocolCopies,
  protocolVersion,
  scriptRefs,
} from './audit-protocol-integrity.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const VERSION = '9.9.9'

const SANDBOXES = []

after(() => {
  for (const dir of SANDBOXES) fs.rmSync(dir, { recursive: true, force: true })
})

/** Escribe un archivo creando los directorios que falten. */
function write(root, rel, text) {
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, text)
}

/** El cuerpo del protocolo mínimo que la compuerta debería aprobar. */
function protocolBody() {
  const refs = SYMBOL_CONTRACTS.map((c) => `         ${c.module} \\`).join('\n')
  return [
    '# Protocolo de Auditoría Comparativa de AOI',
    '',
    `**Versión del Protocolo:** \`v${VERSION}\``,
    '',
    'Por ejemplo `node scripts/aoi-doctor.mjs` corre el doctor.',
    '',
    '```bash',
    'for f in \\',
    refs,
    '         ; do node "$f"; done',
    '```',
    '',
  ].join('\n')
}

/**
 * Un repositorio de desarrollo mínimo: instalador, protocolo, índice y un
 * stub por cada módulo de contrato con los símbolos que el protocolo promete.
 */
function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-proto-'))
  SANDBOXES.push(root)

  write(root, 'setup.sh', '#!/usr/bin/env bash\n')
  write(root, PROTOCOL, protocolBody())
  write(root, 'docs/README.md', `### [Protocolo de Auditoría Comparativa v${VERSION}](internal/audits/x.md)\n`)

  for (const { module, symbols } of SYMBOL_CONTRACTS) {
    write(root, module, `${symbols.map((s) => `export const ${s} = 1`).join('\n')}\n`)
  }
  // `aoi-doctor.mjs` sólo vive en la prosa de ejemplo, no en la tabla.
  write(root, 'scripts/aoi-doctor.mjs', 'export const doctor = 1\n')

  for (const [rel, text] of Object.entries(overrides)) write(root, rel, text)
  return root
}

describe('el protocolo aprueba sobre un árbol coherente', () => {
  it('no reporta nada cuando todo lo que nombra existe', () => {
    const r = auditAuditProtocol(fixture())
    assert.deepEqual(r.errors, [], `hallazgos inesperados: ${r.errors.join('; ')}`)
    assert.ok(r.verified.scriptRefs > 0, 'verificó cero rutas: aprobaría sin haber mirado')
    assert.ok(r.verified.symbols > 0, 'verificó cero símbolos')
  })
})

describe('caza cada forma en que el protocolo puede derivar', () => {
  it('detecta una ruta de script que ya no existe', () => {
    const root = fixture({ 'scripts/aoi-doctor.mjs': 'export const doctor = 1\n' })
    fs.rmSync(path.join(root, 'scripts/aoi-doctor.mjs'))
    const r = auditAuditProtocol(root)
    assert.ok(
      r.errors.some((e) => e.includes('scripts/aoi-doctor.mjs')),
      `no vio la ruta muerta: ${JSON.stringify(r.errors)}`
    )
  })

  it('detecta un símbolo que el módulo dejó de exportar', () => {
    // Éste es el defecto real: el Apéndice A.8 del protocolo mandaba importar
    // `mirror`, `runGate` y `withViolation` desde un `.test.mjs` que no las
    // exportaba. Una tabla de contratos lo habría visto el día uno.
    const root = fixture({ 'scripts/scaffold/failure-injection.mjs': 'export const mirror = 1\n' })
    const r = auditAuditProtocol(root)
    assert.ok(
      r.errors.some((e) => e.includes('runGate')),
      `no vio el símbolo faltante: ${JSON.stringify(r.errors)}`
    )
  })

  it('detecta una versión que el índice no acompaña', () => {
    const root = fixture({ 'docs/README.md': '### [Protocolo de Auditoría Comparativa v0.0.1](x.md)\n' })
    const r = auditAuditProtocol(root)
    assert.ok(
      r.errors.some((e) => e.includes('versión divergente')),
      `no vio la divergencia: ${JSON.stringify(r.errors)}`
    )
  })

  it('detecta una segunda copia del protocolo', () => {
    const root = fixture()
    write(root, 'docs/internal/verification/PROTOCOLO_AUDITORIA_COMPARATIVA.md', 'vieja\n')
    const r = auditAuditProtocol(root)
    assert.ok(
      r.errors.some((e) => e.includes('copias')),
      `no vio la copia de más: ${JSON.stringify(r.errors)}`
    )
  })

  it('falla sobre cero entradas en vez de aprobar sobre nada', () => {
    const root = fixture({
      [PROTOCOL]: '# Protocolo\n\n**Versión del Protocolo:** `v9.9.9`\n\nSin una sola ruta.\n',
    })
    const r = auditAuditProtocol(root)
    assert.ok(
      r.errors.some((e) => e.includes('ninguna ruta de script')),
      `aprobó sobre cero rutas: ${JSON.stringify(r.errors)}`
    )
  })

  it('falla si el protocolo desaparece del repositorio de desarrollo', () => {
    const root = fixture()
    fs.rmSync(path.join(root, PROTOCOL))
    const r = auditAuditProtocol(root)
    assert.equal(r.applicable, true)
    assert.ok(r.errors.some((e) => e.includes('falta el protocolo canónico')))
  })
})

describe('es laxo donde la ausencia es legítima', () => {
  it('un workspace instalado sin docs/ no es un fallo', () => {
    const root = fixture()
    fs.rmSync(path.join(root, PROTOCOL))
    fs.rmSync(path.join(root, 'setup.sh'))
    const r = auditAuditProtocol(root)
    assert.equal(r.applicable, false, 'trató un instalado como repositorio de desarrollo')
    assert.deepEqual(r.errors, [])
  })
})

describe('las piezas puras hacen lo que la compuerta supone', () => {
  it('encuentra rutas con y sin `node` adelante', () => {
    const refs = scriptRefs('Corré `node scripts/a/x.mjs` y después scripts/b/y.mjs y `scripts/c/z.mjs`.')
    assert.deepEqual(refs, ['scripts/a/x.mjs', 'scripts/b/y.mjs', 'scripts/c/z.mjs'])
  })

  it('lee exports de función, const y bloque', () => {
    const names = exportedSymbols('export function a() {}\nexport const b = 1\nexport { c, d as e }\n')
    for (const n of ['a', 'b', 'c', 'e']) assert.ok(names.has(n), `no vio ${n}`)
  })

  it('extrae las dos versiones', () => {
    assert.equal(protocolVersion('**Versión del Protocolo:** `v2.4.0`'), '2.4.0')
    assert.equal(indexVersion('[Protocolo de Auditoría Comparativa v2.4.0](x.md)'), '2.4.0')
  })

  it('lista las copias del árbol', () => {
    const root = fixture()
    assert.deepEqual(protocolCopies(root), [PROTOCOL])
  })
})

describe('sobre el repositorio real', () => {
  it('el protocolo vigente describe el sistema que existe', (t) => {
    // En un workspace instalado el protocolo no se envía y su veredicto no es
    // un hecho sobre AOI — el mismo split estricto/laxo del resto de las
    // compuertas.
    if (!fs.existsSync(path.join(REPO, 'setup.sh'))) {
      t.skip('workspace instalado: el veredicto no es sobre AOI')
      return
    }
    const r = auditAuditProtocol(REPO)
    assert.deepEqual(r.errors, [], `el protocolo derivó: ${r.errors.join('; ')}`)
    assert.ok(r.verified.scriptRefs > 20, `sólo verificó ${r.verified.scriptRefs} rutas`)
  })
})

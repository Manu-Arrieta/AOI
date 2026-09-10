/**
 * scripts/scaffold/vitest-include-reading.test.mjs
 *
 * Cómo se lee el `include` de un vitest.config, que resultó ser el punto más
 * frágil de toda la cadena de alcanzabilidad.
 *
 * Una auditoría adversaria lo reprodujo con un experimento de tres estados
 * sobre el dashboard real: con el include pristino, vitest colecta 19
 * archivos y la compuerta pasa; angostado a uno, colecta 1 y la compuerta
 * falla con 18 huérfanos — correcto; y dejando el viejo COMENTADO arriba del
 * nuevo, la compuerta volvía a verde con los mismos 18 tests sin correr.
 *
 * El lector usaba un regex de primera coincidencia sobre el texto crudo. Es
 * verbatim la falla que este módulo existe para impedir, y arrastraba al
 * Invariant Gate, que consume la misma respuesta de alcanzabilidad.
 *
 * Y el primer arreglo introdujo el error opuesto: blanqueó el `/**\/` que vive
 * DENTRO del glob `test/**\/*.test.ts` y reportó como huérfano cada test del
 * dashboard. La sintaxis de comentario y la de glob se superponen, así que el
 * escaneo tiene que saber cuándo está dentro de un string.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { collectVitestIncludes } from './validate-test-globs.mjs'

/** A directory holding one vitest config with the given body. */
function withConfig(body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-vg-'))
  fs.writeFileSync(path.join(root, 'vitest.config.ts'), body)
  return root
}

const clean = (root) => fs.rmSync(root, { recursive: true, force: true })

describe('reading the effective include', () => {
  it('reads a plain include without mangling the glob', () => {
    // The regression the second attempt caused: `/**/` inside the glob is
    // glob syntax, not a block comment.
    const root = withConfig(`export default { test: { include: ['test/**/*.test.ts'] } }\n`)

    assert.deepEqual(collectVitestIncludes(root).map((i) => i.glob), ['test/**/*.test.ts'])
    clean(root)
  })

  it('ignores a commented-out include above the live one', () => {
    const root = withConfig(
      `export default { test: {\n  // include: ['test/**/*.test.ts']\n  include: ['test/solo.test.ts']\n} }\n`
    )

    assert.deepEqual(collectVitestIncludes(root).map((i) => i.glob), ['test/solo.test.ts'])
    clean(root)
  })

  it('ignores one commented out in a block below the live one', () => {
    const root = withConfig(
      `export default { test: {\n  include: ['test/solo.test.ts']\n  /* include: ['test/**/*.test.ts'] */\n} }\n`
    )

    assert.deepEqual(collectVitestIncludes(root).map((i) => i.glob), ['test/solo.test.ts'])
    clean(root)
  })

  it('refuses to guess when two live includes survive', () => {
    // Guessing is exactly what the first-match regex did. Unresolvable must
    // be reported, never assumed reachable.
    const root = withConfig(
      `export default { test: { include: ['a/*.test.ts'] }, other: { include: ['b/*.test.ts'] } }\n`
    )

    const got = collectVitestIncludes(root)

    assert.equal(got.length, 1)
    assert.equal(got[0].ambiguous, true)
    clean(root)
  })

  it('does not mistake a URL inside a string for a comment', () => {
    const root = withConfig(
      `// https://vitest.dev/config\nexport default { test: { include: ['test/**/*.test.ts'], reporters: ['https://x'] } }\n`
    )

    assert.deepEqual(collectVitestIncludes(root).map((i) => i.glob), ['test/**/*.test.ts'])
    clean(root)
  })

  it('reports nothing when there is no config at all', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-vg-'))
    assert.deepEqual(collectVitestIncludes(root), [])
    clean(root)
  })
})

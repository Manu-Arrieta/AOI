/**
 * scripts/scaffold/failure-injection.test.mjs
 *
 * El contrato de `withViolation`, que hasta ahora no tenía un archivo propio:
 * sus llamadores viven en `gate-exit-codes.test.mjs`, que ejercita el camino
 * FELIZ —inyectar, correr el gate, leer el código de salida— y no el `finally`.
 *
 * Ese `finally` es el que hace repetible el ciclo de inyección, y sus dos
 * mutantes sobrevivían por eso mismo:
 *
 *   - `eq→ne` sobre `original === null` invierte la restauración: en vez de
 *     devolver el archivo a su contenido original, lo BORRA. El siguiente caso
 *     arranca sobre un árbol mutado y el auditor termina comparando su propio
 *     daño contra sí mismo, que es lo que el docblock dice que el `finally`
 *     evita.
 *   - `true→false` sobre `{ force: true }` convierte un borrado silencioso en
 *     una excepción cuando el archivo no existe: `rmSync` sin `force` tira
 *     ENOENT, y una violación que el auditor inyectó sobre un archivo nuevo
 *     —el caso normal— tumba la corrida entera.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { withViolation } from './failure-injection.mjs'

const SANDBOXES = []
after(() => {
  for (const d of SANDBOXES) fs.rmSync(d, { recursive: true, force: true })
})

/**
 * Un root descartable con una compuerta de mentira que sale 0.
 *
 * `withViolation` corre el gate con `execFileSync('node', [script], { cwd })`,
 * así que el script tiene que ser un archivo real: no alcanza con una función.
 */
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-wv-'))
  SANDBOXES.push(root)
  fs.writeFileSync(path.join(root, 'corta.mjs'), 'process.exit(0)\n')
  return root
}

describe('withViolation restaura el árbol pase lo que pase', () => {
  it('devuelve el archivo a su contenido original', () => {
    // La razón de ser del `finally`. Con `eq→ne` el archivo se borra en vez de
    // restaurarse y el `readFileSync` de abajo tira, así que el caso mata al
    // mutante por el camino que importa: el contenido perdido.
    const root = sandbox()
    const archivo = path.join(root, 'config.md')
    fs.writeFileSync(archivo, 'ORIGINAL')

    const code = withViolation(
      root,
      'config.md',
      (full) => fs.writeFileSync(full, 'MUTADO'),
      'corta.mjs'
    )

    assert.equal(code, 0, 'el gate de mentira no salió 0')
    assert.equal(
      fs.readFileSync(archivo, 'utf8'),
      'ORIGINAL',
      'el archivo no volvió a su contenido: el ciclo no es repetible'
    )
  })

  it('restaura también cuando el mutador falla', () => {
    // El `finally` corre incluso si `mutate` lanza. Sin él, una violación que no
    // se pudo inyectar dejaría el archivo a medio escribir y contaminaría el
    // caso siguiente — la misma patología, por otra puerta.
    const root = sandbox()
    const archivo = path.join(root, 'config.md')
    fs.writeFileSync(archivo, 'ORIGINAL')

    assert.throws(
      () =>
        withViolation(
          root,
          'config.md',
          () => {
            throw new Error('el mutador falló a propósito')
          },
          'corta.mjs'
        ),
      /el mutador falló a propósito/
    )
    assert.equal(fs.readFileSync(archivo, 'utf8'), 'ORIGINAL', 'el mutador que falló dejó el archivo tocado')
  })

  it('un archivo que no existía antes se borra, y no lanza', () => {
    // El caso que distingue `{ force: true }` de `{ force: false }`: cuando el
    // archivo nunca existió, `rmSync` sin `force` tira ENOENT. Y este es el
    // camino NORMAL de una violación que agrega un archivo, así que el mutante
    // tumbaba la corrida en el caso más común.
    const root = sandbox()

    const code = withViolation(root, 'nuevo.md', () => {}, 'corta.mjs')

    assert.equal(code, 0)
    assert.equal(fs.existsSync(path.join(root, 'nuevo.md')), false, 'quedó el archivo que la violación agregó')
  })

  it('borra el archivo que la violación creó, no el que existía', () => {
    // Las dos ramas juntas en una corrida, para que un cambio que las confunda
    // no pueda pasar por casualidad: uno se restaura y el otro se va.
    const root = sandbox()
    const previo = path.join(root, 'previo.md')
    fs.writeFileSync(previo, 'ORIGINAL')

    withViolation(root, 'previo.md', (full) => fs.writeFileSync(full, 'MUTADO'), 'corta.mjs')
    withViolation(
      root,
      'creado-por-la-violacion.md',
      (full) => fs.writeFileSync(full, 'INYECTADO'),
      'corta.mjs'
    )

    assert.equal(fs.readFileSync(previo, 'utf8'), 'ORIGINAL', 'no restauró el que existía')
    assert.equal(
      fs.existsSync(path.join(root, 'creado-por-la-violacion.md')),
      false,
      'no limpió el que la segunda violación creó — pero su `original` no era null'
    )
  })

  it('devuelve el código de salida del gate, que es el dato que el auditor busca', () => {
    // Una compuerta que falla NO es un error del programa: es el resultado que
    // el auditor vino a buscar, y `withViolation` tiene que devolverlo en vez de
    // propagarlo.
    const root = sandbox()
    fs.writeFileSync(path.join(root, 'falla.mjs'), 'process.exit(3)\n')

    assert.equal(withViolation(root, 'x.md', () => {}, 'falla.mjs'), 3)
  })
})

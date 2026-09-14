import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  collectFilePaths,
  validateScaffoldParity,
} from './validate-scaffold-parity.mjs'

test('collectFilePaths finds files recursively while ignoring DS_Store', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'))
  fs.mkdirSync(path.join(tmpDir, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(tmpDir, 'sub', 'file1.txt'), 'hello')
  fs.writeFileSync(path.join(tmpDir, '.DS_Store'), 'junk')

  const files = collectFilePaths(tmpDir)
  assert.equal(files.length, 1)
  assert.equal(files[0], path.join('sub', 'file1.txt'))

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('validateScaffoldParity detects missing files and content mismatches', () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-'))
  const rootDir = path.join(tmpRepo, 'tested-dir')
  const scaffoldDir = path.join(tmpRepo, 'scaffold', 'tested-dir')

  fs.mkdirSync(rootDir, { recursive: true })
  fs.mkdirSync(scaffoldDir, { recursive: true })

  fs.writeFileSync(path.join(rootDir, 'a.txt'), 'matching')
  fs.writeFileSync(path.join(scaffoldDir, 'a.txt'), 'matching')

  // Case 1: 100% match
  const passRes = validateScaffoldParity(tmpRepo, ['tested-dir'])
  assert.equal(passRes.valid, true)
  assert.equal(passRes.checkedFilesCount, 1)

  // Case 2: Content mismatch
  fs.writeFileSync(path.join(scaffoldDir, 'a.txt'), 'different')
  const diffRes = validateScaffoldParity(tmpRepo, ['tested-dir'])
  assert.equal(diffRes.valid, false)
  assert.ok(diffRes.errors[0].includes('CONTENT_MISMATCH'))

  // Case 3: Missing in scaffold
  fs.writeFileSync(path.join(scaffoldDir, 'a.txt'), 'matching')
  fs.writeFileSync(path.join(rootDir, 'b.txt'), 'only-in-root')
  const missingRes = validateScaffoldParity(tmpRepo, ['tested-dir'])
  assert.equal(missingRes.valid, false)
  assert.ok(missingRes.errors[0].includes('MISSING_IN_SCAFFOLD'))

  fs.rmSync(tmpRepo, { recursive: true, force: true })
})

/**
 * El filtro de entradas del scaffold raiz.
 *
 * `if (entry === '.DS_Store' || forbidden.includes(entry)) continue` es la
 * guarda que separa el ruido del sistema de un archivo que llego por accidente.
 * Sus dos mutantes sobrevivian porque el unico test del archivo ejercita
 * `collectFilePaths` y el filtro vive en otra funcion.
 *
 * Las dos direcciones del dano son distintas:
 *
 *   - `eq→ne` sobre la comparacion con `.DS_Store` hace que el ruido NO se
 *     saltee, y el archivo del sistema aparece como `[STRAY_IN_SCAFFOLD]`: un
 *     falso positivo que bloquea a cualquiera que tenga un `.DS_Store`.
 *   - `or→and` convierte el filtro en "saltear solo si es las dos cosas", asi
 *     que ni `.DS_Store` ni los prohibidos se saltean por separado.
 *
 * Los dos se fijan con un scaffold que tiene un `.DS_Store` en la raiz.
 */
test('el ruido del sistema no se reporta como archivo llegado por accidente', () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-dsstore-'))
  fs.writeFileSync(path.join(tmpRepo, 'setup.sh'), '#!/usr/bin/env bash\n')
  fs.mkdirSync(path.join(tmpRepo, 'scaffold'))

  // El ruido que macOS deja, y nada mas: no hay ningun archivo gobernado, asi
  // que cualquier error que salga es por el `.DS_Store`.
  fs.writeFileSync(path.join(tmpRepo, 'scaffold/.DS_Store'), 'ruido del sistema')

  const res = validateScaffoldParity(tmpRepo, [])
  assert.deepEqual(
    res.errors.filter((e) => e.includes('DS_Store')),
    [],
    `reporto el ruido del sistema como hallazgo: ${res.errors.join(' | ')}`
  )

  fs.rmSync(tmpRepo, { recursive: true, force: true })
})

test('un archivo prohibido en la raiz del scaffold tampoco se reporta como stray', () => {
  // La otra mitad del `||` del filtro. Hay DOS chequeos distintos en el mismo
  // archivo: uno reporta `[FORBIDDEN_IN_SCAFFOLD]` por su cuenta, y el filtro de
  // la linea 167 existe para que el prohibido NO llegue ademas al chequeo de
  // `[STRAY_IN_SCAFFOLD]`. Con `and→or` invertido, el filtro deja de saltear al
  // prohibido y lo reporta por las DOS vias — un hallazgo duplicado por un
  // archivo que el operador ya sabe que no va.
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-prohibido-'))
  fs.writeFileSync(path.join(tmpRepo, 'setup.sh'), '#!/usr/bin/env bash\n')
  fs.mkdirSync(path.join(tmpRepo, 'scaffold'))
  // `node_modules` esta en FORBIDDEN_IN_SCAFFOLD.
  fs.mkdirSync(path.join(tmpRepo, 'scaffold/node_modules'))
  fs.writeFileSync(path.join(tmpRepo, 'scaffold/node_modules/x.js'), 'x\n')

  const res = validateScaffoldParity(tmpRepo, [])
  assert.ok(
    res.errors.some((e) => e.includes('FORBIDDEN_IN_SCAFFOLD')),
    `no reporto el prohibido por su via propia: ${res.errors.join(' | ')}`
  )
  assert.deepEqual(
    res.errors.filter((e) => e.includes('STRAY_IN_SCAFFOLD')),
    [],
    `reporto el prohibido tambien como stray: ${res.errors.join(' | ')}`
  )

  fs.rmSync(tmpRepo, { recursive: true, force: true })
})

test('un archivo real sin contraparte SI se reporta, para no tapar el hallazgo', () => {
  // La direccion peligrosa del filtro: uno demasiado amplio esconde el defecto
  // que el gate existe para encontrar. Este caso fija que el filtro no se lleve
  // puesto un archivo real.
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-stray-'))
  fs.writeFileSync(path.join(tmpRepo, 'setup.sh'), '#!/usr/bin/env bash\n')
  fs.mkdirSync(path.join(tmpRepo, 'scaffold'))
  fs.writeFileSync(path.join(tmpRepo, 'scaffold/colado.md'), 'llegue por accidente\n')

  const res = validateScaffoldParity(tmpRepo, [])
  assert.ok(
    res.errors.some((e) => e.includes('STRAY_IN_SCAFFOLD') && e.includes('colado.md')),
    `no reporto el archivo colado: ${res.errors.join(' | ')}`
  )

  fs.rmSync(tmpRepo, { recursive: true, force: true })
})

/**
 * El lado al que pertenece un symlink, en el mensaje del error.
 *
 * `const where = side === 'root' ? subpath : path.join('scaffold', subpath)`
 * decide si el mensaje apunta a la raiz o al espejo. Con `eq→ne` los dos lados
 * se invierten y el error nombra el directorio EQUIVOCADO — el operador va a
 * mirar donde no esta el problema, que es la mitad de un diagnostico.
 */
test('el error de symlink nombra el lado donde esta el symlink', () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-symlink-'))
  fs.writeFileSync(path.join(tmpRepo, 'setup.sh'), '#!/usr/bin/env bash\n')
  fs.mkdirSync(path.join(tmpRepo, 'gobernado'), { recursive: true })
  fs.mkdirSync(path.join(tmpRepo, 'scaffold/gobernado'), { recursive: true })
  fs.writeFileSync(path.join(tmpRepo, 'gobernado/real.mjs'), 'x\n')
  // El lado del espejo tiene el mismo archivo regular: sin el, el chequeo de
  // `MISSING_SCAFFOLD` corta antes y el de symlink ni se alcanza.
  fs.writeFileSync(path.join(tmpRepo, 'scaffold/gobernado/real.mjs'), 'x\n')
  // El symlink va SOLO en la raiz: asi el mensaje tiene que nombrar la raiz y
  // no el espejo.
  fs.symlinkSync(
    path.join(tmpRepo, 'gobernado/real.mjs'),
    path.join(tmpRepo, 'gobernado/enlace.mjs')
  )

  const res = validateScaffoldParity(tmpRepo, ['gobernado'])
  const err = res.errors.find((e) => e.includes('SYMLINK_IN_GOVERNED_PATH'))
  assert.ok(err, `no reporto el symlink: ${res.errors.join(' | ')}`)
  // El lado `root` NO lleva el prefijo `scaffold/`: con los lados invertidos el
  // mensaje diria `scaffold/gobernado/enlace.mjs`, que no es donde esta.
  assert.ok(
    !err.includes('scaffold/gobernado/enlace.mjs'),
    `el mensaje nombro el lado equivocado: ${err}`
  )
  assert.ok(err.includes('gobernado/enlace.mjs'), `el mensaje no nombro el archivo: ${err}`)

  fs.rmSync(tmpRepo, { recursive: true, force: true })
})

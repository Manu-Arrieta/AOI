/**
 * scripts/subagent-context/context-tombstone-cli.test.mjs
 *
 * La superficie de línea de comandos del tombstoning.
 *
 * Vive en su propio archivo y no en `cli-surface.test.mjs` porque ese es
 * multi-CLI del área y sumarle este bloque lo dejaba en 351 LOC, sobre el
 * límite de 300 del Invariante 5. El nombre sigue la convención del módulo:
 * `context-tombstone.test.mjs` cubre el algoritmo, éste cubre su CLI.
 *
 * El CLI se separó de `context-tombstone.mjs` por el mismo motivo: las dos
 * cosas juntas daban 300 LOC exactas, margen cero.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { formatTombstoneReport } from './context-tombstone-cli.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(HERE, 'context-tombstone-cli.mjs')

function run(args) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

/** Los directorios creados, para barrerlos al final. */
const tmpDirs = []
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true })
})

/** Un archivo de turnos descartable. */
function turnsFile(turns, name = 'turns.json') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-tombstone-'))
  tmpDirs.push(root)
  const file = path.join(root, name)
  fs.writeFileSync(file, JSON.stringify(turns))
  return { root, file, out: path.join(root, 'salida.json') }
}

/**
 * Dos pares que se superan —una lectura tumbada por otra del MISMO archivo, una
 * corrida de test por la siguiente— y un turno suelto que no se toca. El turno 1
 * lleva contenido largo: sin volumen no habría ahorro que medir.
 */
const TURNS = [
  { id: 't1', tool: 'view_file', target: 'a.ts', turnNumber: 1, content: 'relleno '.repeat(60) },
  { id: 't2', tool: 'view_file', target: 'a.ts', turnNumber: 2, content: 'nuevo' },
  { id: 't3', tool: 'test', target: 'a.test.ts', turnNumber: 3, content: '1 failing', error: 'assert x', summary: 'suite a' },
  { id: 't4', tool: 'test', target: 'a.test.ts', turnNumber: 4, content: 'ok' },
  { id: 't5', tool: 'view_file', target: 'z.ts', turnNumber: 5, content: 'otro archivo' },
]

describe('context-tombstone-cli answers with its exit codes', () => {
  it('prints usage and exits 0 with no arguments', () => {
    const r = run([])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /Usage:/)
  })

  it('accepts -h and --help the same way', () => {
    for (const flag of ['-h', '--help']) {
      const r = run([flag])
      assert.equal(r.code, 0, `${flag} no salió 0`)
      assert.match(r.stdout, /Usage:/, `${flag} no imprimió el uso`)
    }
  })

  it('exits 1 and says what is missing when --file is absent', () => {
    // Un flag obligatorio ausente no puede caer al default y leer cualquier
    // cosa: sin esta rama, `readFileSync(undefined)` daría un TypeError con
    // stack, que no dice qué falta.
    const r = run(['--dry-run'])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /--file/)
  })

  it('exits 1 with a message —not a stack— when the file does not exist', () => {
    const r = run(['--file', '/no/existe/turns.json'])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /context-tombstone/)
    assert.doesNotMatch(r.stderr, /at .*node:internal/, 'salió un stack de node en vez de un mensaje')
  })

  it('exits 1 when the JSON is unreadable', () => {
    const { root, file } = turnsFile([])
    fs.writeFileSync(file, 'no soy json')
    const r = run(['--file', file])
    assert.equal(r.code, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 when the shape is neither an array nor an object with turns', () => {
    // `{ "otra": 1 }` parsea bien y no tiene turnos: sin esta guarda, `shrinkTurns`
    // recibiría `undefined` y devolvería [] en silencio, reportando 0 tumbados
    // sobre un archivo que nunca se leyó.
    const { root, file } = turnsFile({ otra: 1 })
    const r = run(['--file', file])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /turns/)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('context-tombstone-cli mide el ahorro que aplica', () => {
  it('tumba los turnos superados y reporta el ahorro', () => {
    const { root, file } = turnsFile(TURNS)
    const r = run(['--file', file])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /Turnos:\s+5/)
    assert.match(r.stdout, /Tumbados:\s+2/)
    // El turno suelto no se toca: si el conteo fuera 3, estaría tumbando algo
    // que nadie superó.
    assert.doesNotMatch(r.stdout, /Tumbados:\s+[345]/)
    const antes = Number(/Tokens antes:\s+(\d+)/.exec(r.stdout)?.[1])
    const despues = Number(/Tokens despues:\s+(\d+)/.exec(r.stdout)?.[1])
    assert.ok(antes > despues, `no hubo ahorro: ${antes} -> ${despues}`)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('extrae los errores resueltos como registros de ICM', () => {
    // Es la mitad del propósito del módulo —"exporting resolved error artifacts
    // directly into ICM"— y no la cubría ninguna prueba de la superficie.
    const { root, file } = turnsFile(TURNS)
    const out = run(['--file', file]).stdout
    assert.match(out, /errors-resolved/)
    assert.match(out, /assert x/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('con --dry-run no escribe el destino', () => {
    const { root, file, out } = turnsFile(TURNS)
    const r = run(['--file', file, '--output', out, '--dry-run'])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /Dry run/)
    assert.ok(!fs.existsSync(out), 'escribió el destino en dry-run')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('con --output escribe los turnos procesados', () => {
    const { root, file, out } = turnsFile(TURNS)
    const r = run(['--file', file, '--output', out])
    assert.equal(r.code, 0)
    const escrito = JSON.parse(fs.readFileSync(out, 'utf8'))
    assert.equal(escrito.length, 5)
    assert.equal(escrito.filter((t) => t.isTombstone).length, 2)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('con --threshold alto no toca nada Y DICE POR QUE', () => {
    // Un CLI que devuelve el archivo sin explicarse deja al operador sin saber
    // si corrió o si decidió no hacer nada. La razón es parte del contrato.
    const { root, file } = turnsFile(TURNS)
    const r = run(['--file', file, '--threshold', '10'])
    assert.equal(r.code, 0)
    assert.match(r.stdout, /Tumbados:\s+0/)
    assert.match(r.stdout, /No se aplico:.*threshold/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('no consume la bandera siguiente como valor', () => {
    // `--file` seguido de OTRA BANDERA no tiene valor: sin el guard, el nombre
    // de la bandera se toma como path y el error es un ENOENT sobre un archivo
    // llamado `--dry-run`, que no dice qué falta.
    //
    // La versión anterior de este test usaba `['--dry-run', '--file']`, con
    // `--file` AL FINAL: ahí `args[i + 1]` es `undefined` con guard y sin él, así
    // que el guard nunca se ejercitaba. La mutación que lo borraba sobrevivía al
    // control negativo — el test afirmaba lo correcto sobre una entrada que no
    // llegaba al código.
    const r = run(['--file', '--dry-run'])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /--file/, 'no reportó el flag obligatorio ausente')
    assert.match(r.stderr, /Falta --file/, 'cayó al ENOENT en vez del mensaje de flag faltante')
  })

  it('acepta un objeto con la clave "turns" además de un array', () => {
    const { root, file } = turnsFile({ turns: TURNS })
    const r = run(['--file', file])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /Tumbados:\s+2/)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

// Los tests de arriba ejercitan todo por el CLI, que es la superficie real.
// Estos van contra la funcion pura: son las ramas que el CLI nunca alcanza en un
// caso normal. Medido antes de escribirlos: 6 mutantes sobrevivian en este
// archivo y el area cayo de 69% a 67%.
describe('formatTombstoneReport, ramas que el CLI no alcanza', () => {
  const report = (over = {}) => ({
    applied: true,
    turns: 2,
    tombstoned: 1,
    tokensBefore: 100,
    tokensAfter: 40,
    icm: [],
    ...over,
  })

  it('sin el segundo argumento no imprime la linea de dry-run', () => {
    // El default solo se mata OMITIENDO el argumento. Por el CLI siempre llega
    // explicito, asi que el mutante false->true sobrevivia: la linea de dry-run
    // habria aparecido en toda corrida real.
    const out = formatTombstoneReport(report())
    assert.doesNotMatch(out, /Dry run/)
    assert.match(out, /Turnos:\s+2/)
  })

  it('con dryRun true si la imprime', () => {
    // La otra direccion: sin esto, un guard que la omita siempre pasaria.
    assert.match(formatTombstoneReport(report(), { dryRun: true }), /Dry run/)
  })

  it('con cero tokens antes reporta 0.0%, nunca NaN', () => {
    // La guarda de division. Sin ella, el caso de 0 tokens calcularia (0/0)*100
    // y el reporte diria NaN% — un veredicto que no se lee como error, se lee
    // como dato.
    const out = formatTombstoneReport(report({ tokensBefore: 0, tokensAfter: 0 }))
    assert.match(out, /\(0\.0%\)/)
    assert.doesNotMatch(out, /NaN/)
  })

  it('sin registros de ICM no imprime el bloque de ICM', () => {
    // La mitad del contrato que faltaba: asertar la AUSENCIA. Con la guarda
    // invertida el encabezado salia siempre, prometiendo registros inexistentes.
    assert.doesNotMatch(formatTombstoneReport(report()), /persistir en ICM/)
  })

  it('con registros de ICM los imprime, con su topic', () => {
    const out = formatTombstoneReport(
      report({ icm: [{ topic: 'errors-resolved', content: 'Resolved x' }] })
    )
    assert.match(out, /persistir en ICM: 1/)
    assert.match(out, /\[errors-resolved\]/)
  })

  it('sin aplicar, dice por que', () => {
    const out = formatTombstoneReport(report({ applied: false, reason: 'pocos turnos' }))
    assert.match(out, /No se aplico: pocos turnos/)
  })
})

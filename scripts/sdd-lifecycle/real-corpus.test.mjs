import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  buildDebuggingTurns,
  buildDiscoveryCorpus,
  captureRealTestRun,
  fallbackDebuggingTurns,
  fallbackDiscoveryCorpus,
  FALLBACK_CRASH,
  stripVolatile,
} from './real-corpus.mjs'

/** Builds a throwaway source tree to sample. */
function treeWith(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-corpus-test-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('buildDiscoveryCorpus', () => {
  it('splits real files into signal and noise by the feature keyword', () => {
    const root = treeWith({
      'scripts/token-evaluator.mjs': 'export const budget = 1',
      'scripts/unrelated-parser.mjs': 'export const parse = () => {}',
      'scripts/deep/uses-token.mjs': '// mentions token in the body\n',
    })

    const corpus = buildDiscoveryCorpus(root, { keyword: 'token', searchDir: 'scripts' })
    const ids = (list) => list.map((i) => i.id).sort()

    assert.deepEqual(ids(corpus.signalItems), ['scripts/deep/uses-token.mjs', 'scripts/token-evaluator.mjs'])
    assert.deepEqual(ids(corpus.backgroundItems), ['scripts/unrelated-parser.mjs'])
    assert.equal(corpus.sampled, 3)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('excludes test files and vendored directories from the sample', () => {
    const root = treeWith({
      'scripts/real.mjs': 'export const a = 1',
      'scripts/real.test.mjs': 'should not be sampled',
      'scripts/node_modules/vendor.mjs': 'should not be sampled',
      'scripts/scaffold/mirror.mjs': 'should not be sampled',
    })

    const corpus = buildDiscoveryCorpus(root, { keyword: 'nothing', searchDir: 'scripts' })
    assert.equal(corpus.sampled, 1)
    assert.equal(corpus.backgroundItems[0].id, 'scripts/real.mjs')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('returns an empty corpus when the search directory does not exist', () => {
    const root = treeWith({ 'other/file.mjs': 'x' })
    const corpus = buildDiscoveryCorpus(root, { keyword: 'token', searchDir: 'scripts' })

    assert.deepEqual(corpus, { signalItems: [], backgroundItems: [], sampled: 0 })
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('honours the maxFiles cap so the benchmark stays bounded', () => {
    const files = {}
    for (let i = 0; i < 12; i++) files[`scripts/f${i}.mjs`] = 'export const x = 1'
    const root = treeWith(files)

    assert.equal(buildDiscoveryCorpus(root, { keyword: 'z', searchDir: 'scripts', maxFiles: 5 }).sampled, 5)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('captureRealTestRun', () => {
  it('captures genuine runner diagnostics from a test that really fails', () => {
    const run = captureRealTestRun()

    assert.equal(run.ok, true)
    // Real node:test output, not a hand-written trace.
    assert.match(run.failing, /fail 2/)
    assert.match(run.failing, /AssertionError|✖/)
    assert.match(run.passing, /pass 1/)
    // The failing run must be materially noisier — that is the whole premise
    // of distilling and tombstoning it.
    assert.ok(run.failing.length > run.passing.length)
  })
})

describe('buildDebuggingTurns', () => {
  it('threads the captured output through a RED -> fix -> GREEN sequence', () => {
    const turns = buildDebuggingTurns({ failing: 'REAL-FAILURE', passing: 'REAL-PASS' })

    assert.equal(turns.length, 5)
    assert.equal(turns[0].content, 'REAL-FAILURE')
    assert.equal(turns[2].content, 'REAL-FAILURE')
    assert.equal(turns[4].content, 'REAL-PASS')
    assert.deepEqual(turns.map((t) => t.tool), ['test', 'edit_file', 'test', 'edit_file', 'test'])
  })
})

describe('fallbacks', () => {
  it('exist only as a labelled last resort and are shaped like the real thing', () => {
    const corpus = fallbackDiscoveryCorpus()
    assert.equal(corpus.signalItems.length, 10)
    assert.equal(corpus.backgroundItems.length, 20)
    // sampled === 0 is the tell that nothing real was read.
    assert.equal(corpus.sampled, 0)

    assert.equal(fallbackDebuggingTurns().length, 5)
    assert.match(FALLBACK_CRASH, /AssertionError/)
  })
})

describe('la captura es reproducible, o el benchmark no lo es', () => {
  // Ésta es la compuerta que faltaba, y nació de un defecto medido: la Fase 3
  // del stress suite reportaba 5844 -> 1051 una vez y 5845 -> 1052 la siguiente,
  // con el mismo árbol y el mismo comando. Violaba la regla que gobierna todo
  // el protocolo —"un número que no se puede reproducir con un comando no entra
  // en el informe"— con un comando que SÍ era reproducible: el instrumento
  // medía la salida de un proceso vivo y la reportaba como aritmética estática.
  //
  // Y contamina la comparación entre versiones: un ±1 token se lee como una
  // mejora o una regresión que no ocurrió.
  it('dos capturas del mismo test son byte a byte idénticas', () => {
    const a = captureRealTestRun()
    const b = captureRealTestRun()

    assert.equal(a.failing, b.failing, 'el reporte del test que falla cambió entre corridas')
    assert.equal(a.passing, b.passing, 'el reporte del test que pasa cambió entre corridas')
  })

  it('stripVolatile borra las TRES formas volátiles, no una', () => {
    // Las tres necesitaron su propia regla, y la primera versión cubrió sólo la
    // primera: `duration_ms` viene con ESPACIO, no con `:`, y el nombre del
    // temporal es aleatorio.
    const raw = [
      '✔ passes (0.51675ms)',
      'ℹ duration_ms 55.907834',
      'test at /tmp/aoi-corpus-AUJDeG/red.test.mjs:5:3',
    ].join('\n')

    // Con la ruta conocida, se reemplaza ENTERA por un marcador.
    const clean = stripVolatile(raw, ['/tmp/aoi-corpus-AUJDeG'])
    assert.doesNotMatch(clean, /0\.51675/, 'no borró la duración entre paréntesis')
    assert.doesNotMatch(clean, /55\.907834/, 'no borró duration_ms con separador de espacio')
    assert.doesNotMatch(clean, /AUJDeG/, 'no borró el nombre aleatorio del temporal')
    assert.match(clean, /<tmp>/, 'no dejó el marcador de la ruta')

    // Y SIN la ruta —cuando aparece en una forma que no se pasó— la regla del
    // nombre aleatorio sola tiene que alcanzar. Éste es el caso que la primera
    // versión del test no cubría y por eso afirmaba el mecanismo equivocado.
    const sinRuta = stripVolatile(raw)
    assert.doesNotMatch(sinRuta, /AUJDeG/)
    assert.match(sinRuta, /aoi-corpus-XXXXXX/)
  })

  it('no borra contenido que sí importa', () => {
    // Control en la otra dirección: el guard no puede comerse el diagnóstico.
    const real = 'AssertionError: Expected values to be strictly equal:\n  + actual - expected'
    assert.equal(stripVolatile(real), real)
    assert.equal(stripVolatile('assert.equal(evaluate(2, 2), 5)'), 'assert.equal(evaluate(2, 2), 5)')
  })
})

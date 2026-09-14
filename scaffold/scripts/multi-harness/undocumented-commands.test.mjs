import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { auditUndocumentedCommands, formatUndocumented } from './undocumented-commands.mjs'

/**
 * Un root temporal. Con `marker` simula el repositorio de desarrollo (el
 * `setup.sh` que usan las compuertas estrictas); sin él, un workspace instalado.
 *
 * El marcador se escribe a mano y no se hereda del repo real: si el test
 * dependiera de dónde corre, diría cosas distintas según la máquina.
 */
function fixture(files, { marker = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-undoc-'))
  if (marker) fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), body)
  }
  return root
}

/** Un prompts/ con `names` como `.prompt.md` vacíos. */
const prompts = (...names) =>
  Object.fromEntries(names.map((n) => [`.github/prompts/${n}.prompt.md`, '# prompt\n']))

describe('la dirección que nadie miraba', () => {
  it('caza el comando que existe y que ninguna superficie nombra', (t) => {
    // El caso histórico: `/sdd-genesis` tenía prompt y la wiki no lo conocía.
    // Todo el linter existente miraba la dirección contraria, así que pasaba.
    const root = fixture({ ...prompts('sdd-genesis'), 'wiki/07.md': 'El ciclo tiene fases.\n' })
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))

    const result = auditUndocumentedCommands(root, ['wiki/07.md'])

    assert.equal(result.skipped, false)
    assert.equal(result.checked, 1)
    assert.deepEqual(result.undocumented, ['sdd-genesis'])
  })

  it('acepta el comando nombrado como invocación', (t) => {
    const root = fixture({
      ...prompts('sdd-genesis', 'sdd-frame'),
      'wiki/07.md': 'Fase -2: `/sdd-genesis`. Fase 0: `/sdd-frame`.\n',
    })
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))

    const result = auditUndocumentedCommands(root, ['wiki/07.md'])

    assert.equal(result.checked, 2)
    assert.deepEqual(result.undocumented, [])
  })

  it('no acepta nombrar el ARCHIVO como si fuera documentar el COMANDO', (t) => {
    // Si esto pasara, la compuerta se volvería una que siempre aprueba: basta
    // con que cualquier texto mencione el nombre del archivo, y eso lo hace
    // hasta este test.
    const root = fixture({
      ...prompts('sdd-genesis'),
      'wiki/07.md': 'El archivo sdd-genesis.prompt.md existe en el repositorio.\n',
    })
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))

    assert.deepEqual(auditUndocumentedCommands(root, ['wiki/07.md']).undocumented, ['sdd-genesis'])
  })

  it('ignora los prompts de spec-kit, que no son de AOI', (t) => {
    // Exigirle a la wiki de AOI que documente `speckit.*` sería pedirle que
    // documente código ajeno, y el día que spec-kit agregue un comando el
    // repositorio se rompería por algo que no escribió nadie de acá.
    const root = fixture({
      ...prompts('speckit.analyze', 'speckit.constitution'),
      'wiki/07.md': 'Nada de comandos acá.\n',
    })
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))

    const result = auditUndocumentedCommands(root, ['wiki/07.md'])

    assert.equal(result.checked, 0)
    assert.deepEqual(result.undocumented, [])
  })

  it('no exige nada en un workspace instalado', (t) => {
    // Ahí la prosa es del Owner y la wiki ni se copia. El test incluye el
    // prompt a propósito: sin él, el resultado sería el mismo por no haber
    // comandos, y no probaría que la causa es el marcador.
    const root = fixture(
      { ...prompts('sdd-genesis'), 'docs/guia.md': 'Texto del Owner.\n' },
      { marker: false },
    )
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))

    const result = auditUndocumentedCommands(root, ['docs/guia.md'])

    assert.equal(result.skipped, true)
    assert.equal(result.checked, 0)
    assert.deepEqual(result.undocumented, [])
  })

  it('sin directorio de prompts no inventa un fallo', (t) => {
    // La compuerta de cero entradas vive en el otro módulo, que es donde se
    // sabe cuántos archivos se escanearon. Acá no hay nada que exigir.
    const root = fixture({ 'wiki/07.md': 'Texto.\n' })
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))

    const result = auditUndocumentedCommands(root, ['wiki/07.md'])

    assert.equal(result.skipped, false)
    assert.equal(result.checked, 0)
    assert.deepEqual(result.undocumented, [])
  })
})

describe('formatUndocumented', () => {
  it('dice cuántos comandos cubre cuando no falta ninguno', () => {
    assert.match(formatUndocumented({ checked: 7, undocumented: [], skipped: false }), /7 comandos/)
  })

  it('nombra cada comando que falta', () => {
    const out = formatUndocumented({ checked: 7, undocumented: ['sdd-genesis'], skipped: false })
    assert.match(out, /1 de 7/)
    assert.match(out, /\/sdd-genesis/)
  })

  it('explica el skip en vez de reportar un aprobado vacío', () => {
    // Un ✅ sobre cero comandos es indistinguible de un ✅ sobre siete. El skip
    // tiene que decir que no se juzgó, no parecer una aprobación.
    const out = formatUndocumented({ checked: 0, undocumented: [], skipped: true })
    assert.match(out, /Workspace instalado/)
    assert.doesNotMatch(out, /✅/)
  })
})

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const CATEGORY = '**Categoría**: Razonamiento'

/**
 * El prompt declara su CATEGORÍA, no su modelo.
 *
 * Antes este contrato fijaba un modelo concreto y su fallback. Se retiraron del prompt
 * junto con el resto de los nombres de proveedor: la asignación se elige en el setup y
 * nombrarla acá la deja obsoleta en silencio. Lo que se conserva es la **intención** del
 * Owner —esta fase prioriza costo y latencia— expresada como override de agente.
 */
function auditGenesisModel(prompt) {
  const failures = []
  if (!prompt.includes(CATEGORY)) failures.push('Genesis lost its category')
  if (/Provider - /.test(prompt)) failures.push('Genesis names a provider: la asignación es dinámica')
  if (!/no se afirma que razone mejor/i.test(prompt)) failures.push('Genesis now overstates the model quality')
  if (prompt.includes('customendpoint')) failures.push('Genesis carries a subagent transport identifier it does not invoke')
  return failures
}

describe('Genesis model contract', () => {
  const prompt = read('.github/prompts/sdd-genesis.prompt.md')

  it('keeps the category, the bounded quality claim, and no provider name', () => {
    assert.deepEqual(auditGenesisModel(prompt), [])
  })

  it('detects a missing category', () => {
    assert.deepEqual(auditGenesisModel(prompt.replace(CATEGORY, '')), ['Genesis lost its category'])
  })

  it('detects a provider written into the prompt', () => {
    assert.deepEqual(auditGenesisModel(`${prompt}\nModeloA - Provider - Alfa`), [
      'Genesis names a provider: la asignación es dinámica',
    ])
  })

  it('detects the stale subagent transport detail', () => {
    assert.deepEqual(
      auditGenesisModel(`${prompt}\nModeloA - Provider - Alfa (customendpoint)`),
      [
        'Genesis names a provider: la asignación es dinámica',
        'Genesis carries a subagent transport identifier it does not invoke',
      ]
    )
  })
})

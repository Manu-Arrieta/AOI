import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const MODEL = 'Deepseek v4 flash - Provider - Deepseek'
const FALLBACK = 'deepseek-ai/deepseek-v4-pro'

function auditGenesisModel(prompt) {
  const failures = []
  if (!prompt.includes(MODEL)) failures.push('Genesis lost its Owner-selected model')
  if (!prompt.includes(FALLBACK)) failures.push('Genesis lost its fallback model')
  if (!/no se afirma que razone mejor/i.test(prompt)) failures.push('Genesis now overstates Flash reasoning quality')
  if (prompt.includes('customendpoint')) failures.push('Genesis carries a subagent transport identifier it does not invoke')
  return failures
}

describe('Genesis model contract', () => {
  const prompt = read('.github/prompts/sdd-genesis.prompt.md')

  it('keeps the Owner-selected model, fallback, and bounded quality claim', () => {
    assert.deepEqual(auditGenesisModel(prompt), [])
  })

  it('detects a missing fallback', () => {
    assert.deepEqual(auditGenesisModel(prompt.replace(FALLBACK, '')), ['Genesis lost its fallback model'])
  })

  it('detects the stale subagent transport detail', () => {
    assert.deepEqual(
      auditGenesisModel(`${prompt}\nDeepseek v4 flash - Provider - Deepseek (customendpoint)`),
      ['Genesis carries a subagent transport identifier it does not invoke']
    )
  })
})

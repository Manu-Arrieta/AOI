import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const ACTIVATION = 'activate_knowledge_graph_management_tools'
const WORKSPACE_DETECTION = 'git remote get-url origin'

function auditStartupOwnership(supervisor, protocol) {
  const failures = []
  if (!supervisor.includes('icm-protocol.instructions.md')) failures.push('supervisor does not name the canonical protocol')
  if (supervisor.includes(ACTIVATION)) failures.push('supervisor duplicates MCP activation')
  if (supervisor.includes(WORKSPACE_DETECTION)) failures.push('supervisor duplicates workspace detection')
  if (!protocol.includes(ACTIVATION)) failures.push('protocol lost MCP activation')
  if (!protocol.includes(WORKSPACE_DETECTION)) failures.push('protocol lost workspace detection')
  return failures
}

describe('Supervisor ICM startup ownership', () => {
  const supervisor = read('.github/agents/supervisor.agent.md')
  const protocol = read('.github/instructions/icm-protocol.instructions.md')

  it('keeps canonical startup steps in the universally injected protocol', () => {
    assert.deepEqual(auditStartupOwnership(supervisor, protocol), [])
  })

  it('detects a startup step copied back into Supervisor', () => {
    assert.deepEqual(auditStartupOwnership(`${supervisor}\n${ACTIVATION}`, protocol), ['supervisor duplicates MCP activation'])
  })

  it('detects a startup step lost from the canonical protocol', () => {
    assert.deepEqual(
      auditStartupOwnership(supervisor, protocol.replace(ACTIVATION, 'removed_activation')),
      ['protocol lost MCP activation']
    )
  })
})

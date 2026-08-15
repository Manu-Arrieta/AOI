import test from 'node:test'
import assert from 'node:assert/strict'
import { createProcessRegistry } from './zombie-process-purger.mjs'

test('createProcessRegistry tracks and gracefully terminates child processes with zero leaks', () => {
  const registry = createProcessRegistry()

  registry.registerProcess(101, 'node worker.js')
  registry.registerProcess(102, 'python test.py')
  assert.equal(registry.getActiveCount(), 2)

  registry.markTerminated(101)
  assert.equal(registry.getActiveCount(), 1)

  const killed = []
  const result = registry.purgeZombieProcesses((pid) => killed.push(pid))

  assert.equal(result.success, true)
  assert.equal(result.purgedCount, 1)
  assert.equal(result.purgerProof, 'ZERO_ZOMBIE_PROCESSES_PROVEN')
  assert.deepEqual(killed, ['102'])
  assert.equal(registry.getActiveCount(), 0)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createContractKvCache } from './contract-kv-cache.mjs'

test('createContractKvCache registers unique contracts and collapses duplicates to compact refs', () => {
  const cache = createContractKvCache()
  const contractText = 'export interface IUserService { getUser(): User; }'

  // First agent registration -> not cached yet
  const res1 = cache.registerContract('IUserService', contractText)
  assert.equal(res1.isCached, false)
  assert.equal(res1.compactSnippet, contractText)
  assert.ok(res1.refKey.startsWith('@contract:IUserService#'))

  // Second agent in same wave -> cached, returns compact reference
  const res2 = cache.registerContract('IUserService', contractText)
  assert.equal(res2.isCached, true)
  assert.ok(res2.compactSnippet.includes('[REF: @contract:IUserService#'))
  assert.equal(cache.size(), 1)
})

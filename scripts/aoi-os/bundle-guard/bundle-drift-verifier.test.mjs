import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyBundleDrift } from './bundle-drift-verifier.mjs'

test('verifyBundleDrift approves modular, tree-shakeable imports', () => {
  const code = `
import { format } from 'date-fns';
import { cloneDeep } from 'lodash-es';
`
  const result = verifyBundleDrift(code)
  assert.equal(result.clean, true)
  assert.equal(result.bundleProof, 'TREE_SHAKING_OPTIMAL_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('verifyBundleDrift detects monolithic heavy package imports', () => {
  const code = `
import _ from 'lodash';
import moment from 'moment';
`
  const result = verifyBundleDrift(code)
  assert.equal(result.clean, false)
  assert.equal(result.bundleProof, 'BUNDLE_DRIFT_AND_BLOAT_DETECTED')
  assert.equal(result.violationsCount, 2)
})

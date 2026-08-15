import test from 'node:test'
import assert from 'node:assert/strict'
import { solveDependencies } from './polyglot-dependency-solver.mjs'

test('solveDependencies verifies declared packages and builtin modules cleanly', () => {
  const packageJson = {
    dependencies: {
      '@tanstack/vue-table': '^8.21.2',
      'zod': '^3.24.1',
    },
  }

  const sourceImports = [
    'node:fs',
    './utils/helper.mjs',
    '@tanstack/vue-table',
    'zod',
  ]

  const result = solveDependencies({ packageJson, sourceImports })
  assert.equal(result.compatible, true)
  assert.equal(result.proof, 'DEPENDENCY_GRAPH_VERIFIED')
  assert.equal(result.missingDependencies.length, 0)
})

test('solveDependencies detects missing undeclared packages', () => {
  const packageJson = {
    dependencies: {
      'zod': '^3.24.1',
    },
  }

  const sourceImports = [
    'lodash',
    '@unocss/core',
    'zod',
  ]

  const result = solveDependencies({ packageJson, sourceImports })
  assert.equal(result.compatible, false)
  assert.equal(result.proof, 'UNDECLARED_DEPENDENCIES_DETECTED')
  assert.deepEqual(result.missingDependencies, ['lodash', '@unocss/core'])
})

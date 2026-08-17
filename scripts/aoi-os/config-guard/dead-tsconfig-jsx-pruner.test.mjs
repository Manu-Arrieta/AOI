import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTsconfigJsx } from './dead-tsconfig-jsx-pruner.mjs'

test('auditDeadTsconfigJsx approves jsx option when tsx files exist', () => {
  const tsconfig = {
    compilerOptions: {
      jsx: 'react-jsx',
      jsxImportSource: 'react',
    },
  }
  const files = ['src/components/App.tsx', 'src/index.ts']
  const result = auditDeadTsconfigJsx(tsconfig, files)
  assert.equal(result.clean, true)
  assert.equal(result.jsxProof, 'TSCONFIG_JSX_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadTsconfigJsx detects dead jsx options when no jsx/tsx files exist', () => {
  const tsconfig = {
    compilerOptions: {
      jsx: 'react-jsx',
      jsxImportSource: 'react',
    },
  }
  const files = ['src/server/index.ts', 'src/utils.ts']
  const result = auditDeadTsconfigJsx(tsconfig, files)
  assert.equal(result.clean, false)
  assert.equal(result.jsxProof, 'DEAD_TSCONFIG_JSX_CONFIG_DETECTED')
  assert.equal(result.deadCount, 2)
})

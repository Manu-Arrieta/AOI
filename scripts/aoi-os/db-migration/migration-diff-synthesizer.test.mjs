import test from 'node:test'
import assert from 'node:assert/strict'
import { synthesizeMigrationDiff } from './migration-diff-synthesizer.mjs'

test('synthesizeMigrationDiff generates clean UP and DOWN DDL for added columns', () => {
  const prev = {
    id: 'TEXT PRIMARY KEY',
    email: 'TEXT NOT NULL',
  }
  const curr = {
    id: 'TEXT PRIMARY KEY',
    email: 'TEXT NOT NULL',
    is_active: 'BOOLEAN DEFAULT true',
  }

  const result = synthesizeMigrationDiff('users', prev, curr)
  assert.equal(result.hasChanges, true)
  assert.equal(result.migrationProof, 'MIGRATION_DIFF_SYNTHESIZED')
  assert.deepEqual(result.addedColumns, ['is_active'])
  assert.ok(result.upSql.includes('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;'))
  assert.ok(result.downSql.includes('ALTER TABLE users DROP COLUMN is_active;'))
})

test('synthesizeMigrationDiff detects identical schemas without emitting statements', () => {
  const schema = {
    id: 'TEXT PRIMARY KEY',
    name: 'TEXT',
  }

  const result = synthesizeMigrationDiff('teams', schema, schema)
  assert.equal(result.hasChanges, false)
  assert.equal(result.migrationProof, 'SCHEMA_IDENTICAL')
  assert.equal(result.upSql, '')
  assert.equal(result.downSql, '')
})

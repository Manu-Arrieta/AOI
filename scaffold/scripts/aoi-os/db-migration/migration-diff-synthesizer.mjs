/**
 * scripts/aoi-os/db-migration/migration-diff-synthesizer.mjs
 *
 * Deterministic Database Migration & DDL Diff Synthesizer for AOI-OS:
 * Compares previous vs proposed entity schemas and synthesizes reversible
 * zero-downtime forward (UP) and rollback (DOWN) SQL migration scripts (0 LLM Tokens).
 */

/**
 * Compares table schema representations and synthesizes migration scripts.
 *
 * @param {string} tableName
 * @param {Record<string, string>} previousColumns - { id: 'TEXT PRIMARY KEY', email: 'TEXT' }
 * @param {Record<string, string>} currentColumns - { id: 'TEXT PRIMARY KEY', email: 'TEXT', is_active: 'BOOLEAN DEFAULT true' }
 * @returns {object} Reversible migration plan
 */
export function synthesizeMigrationDiff(tableName, previousColumns = {}, currentColumns = {}) {
  const upStatements = []
  const downStatements = []
  const addedColumns = []
  const droppedColumns = []

  // Check for added columns
  for (const [colName, colType] of Object.entries(currentColumns)) {
    if (!previousColumns[colName]) {
      addedColumns.push(colName)
      upStatements.push(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType};`)
      downStatements.push(`ALTER TABLE ${tableName} DROP COLUMN ${colName};`)
    }
  }

  // Check for dropped columns
  for (const [colName, colType] of Object.entries(previousColumns)) {
    if (!currentColumns[colName]) {
      droppedColumns.push(colName)
      upStatements.push(`ALTER TABLE ${tableName} DROP COLUMN ${colName};`)
      downStatements.push(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType};`)
    }
  }

  const hasChanges = upStatements.length > 0

  return {
    tableName,
    hasChanges,
    addedColumns,
    droppedColumns,
    upSql: upStatements.join('\n'),
    downSql: downStatements.reverse().join('\n'),
    migrationProof: hasChanges ? 'MIGRATION_DIFF_SYNTHESIZED' : 'SCHEMA_IDENTICAL',
  }
}

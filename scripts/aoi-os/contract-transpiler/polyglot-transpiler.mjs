/**
 * scripts/aoi-os/contract-transpiler/polyglot-transpiler.mjs
 *
 * Deterministic Polyglot Contract Transpiler & DTO Mirror for AOI-OS:
 * Transpiles TypeScript interface declarations into C# DTOs, Python Pydantic models,
 * and SQL DDL tables mathematically with 0 LLM token consumption.
 */

import { canonicalizeFieldName } from '../abi-linker/bidirectional-abi-linker.mjs'

/**
 * Maps a TypeScript primitive type to C#, Python, and SQL types.
 *
 * @param {string} tsType
 * @returns {{ cs: string, py: string, sql: string }}
 */
function mapPrimitiveType(tsType = 'string') {
  const t = tsType.trim().toLowerCase()
  if (t === 'number') return { cs: 'int', py: 'int', sql: 'INTEGER' }
  if (t === 'boolean') return { cs: 'bool', py: 'bool', sql: 'BOOLEAN' }
  if (t.includes('[]') || t.startsWith('array<')) return { cs: 'List<string>', py: 'list', sql: 'JSON' }
  if (t === 'date') return { cs: 'DateTime', py: 'datetime', sql: 'TIMESTAMP' }
  return { cs: 'string', py: 'str', sql: 'VARCHAR(255)' }
}

/**
 * Parses properties from a TypeScript interface declaration string.
 *
 * @param {string} tsInterfaceCode
 * @returns {{ interfaceName: string, properties: Array<{ name: string, type: string, canonical: string }> }}
 */
export function parseTsInterface(tsInterfaceCode = '') {
  const nameMatch = tsInterfaceCode.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/)
  const interfaceName = nameMatch ? nameMatch[1] : 'AnonymousContract'

  const properties = []
  const propRegex = /([A-Za-z0-9_$]+)\s*[:?]\s*([^;,\n]+)[;,]?/g
  let match
  while ((match = propRegex.exec(tsInterfaceCode)) !== null) {
    const name = match[1]
    const type = match[2].trim()
    if (['interface', 'type', 'export'].includes(name)) continue
    properties.push({
      name,
      type,
      canonical: canonicalizeFieldName(name),
    })
  }

  return { interfaceName, properties }
}

/**
 * Transpiles TypeScript interface to C# DTO class.
 *
 * @param {string} tsInterfaceCode
 * @returns {string} C# source code
 */
export function transpileToCSharp(tsInterfaceCode = '') {
  const { interfaceName, properties } = parseTsInterface(tsInterfaceCode)
  const className = interfaceName.endsWith('Dto') ? interfaceName : `${interfaceName}Dto`

  const lines = [
    `public class ${className}`,
    `{`,
  ]

  for (const prop of properties) {
    const csType = mapPrimitiveType(prop.type).cs
    const pascalName = prop.name.charAt(0).toUpperCase() + prop.name.slice(1)
    lines.push(`    public ${csType} ${pascalName} { get; set; }`)
  }

  lines.push(`}`)
  return lines.join('\n')
}

/**
 * Transpiles TypeScript interface to Python Pydantic BaseModel.
 *
 * @param {string} tsInterfaceCode
 * @returns {string} Python source code
 */
export function transpileToPython(tsInterfaceCode = '') {
  const { interfaceName, properties } = parseTsInterface(tsInterfaceCode)

  const lines = [
    `from pydantic import BaseModel`,
    ``,
    `class ${interfaceName}(BaseModel):`,
  ]

  if (!properties.length) {
    lines.push(`    pass`)
  } else {
    for (const prop of properties) {
      const pyType = mapPrimitiveType(prop.type).py
      const snakeName = prop.canonical
      lines.push(`    ${snakeName}: ${pyType}`)
    }
  }

  return lines.join('\n')
}

/**
 * Transpiles TypeScript interface to SQL DDL CREATE TABLE statement.
 *
 * @param {string} tsInterfaceCode
 * @returns {string} SQL DDL source code
 */
export function transpileToSql(tsInterfaceCode = '') {
  const { interfaceName, properties } = parseTsInterface(tsInterfaceCode)
  const tableName = canonicalizeFieldName(interfaceName)

  const lines = [
    `CREATE TABLE IF NOT EXISTS ${tableName} (`,
  ]

  const colDefs = properties.map((prop, idx) => {
    const sqlType = mapPrimitiveType(prop.type).sql
    const colName = prop.canonical
    const pk = idx === 0 ? ' PRIMARY KEY' : ''
    return `  ${colName} ${sqlType}${pk}`
  })

  lines.push(colDefs.join(',\n'))
  lines.push(`);`)
  return lines.join('\n')
}

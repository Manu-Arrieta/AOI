/**
 * scripts/aoi-os/type-synthesizer/deep-type-synthesizer.mjs
 *
 * Deterministic Polyglot Deep Type & Runtime Schema Synthesizer for AOI-OS:
 * Infers strong TypeScript types from parameter names and usage heuristics,
 * synthesizing executable Zod schemas and TypeScript interfaces (0 LLM Tokens).
 */

/**
 * Heuristically infers primitive type from parameter name.
 *
 * @param {string} paramName
 * @returns {string} TypeScript type
 */
function inferParamType(paramName = '') {
  const name = paramName.toLowerCase()
  if (name.startsWith('is') || name.startsWith('has') || name.startsWith('should') || name.endsWith('enabled') || name.endsWith('active')) {
    return 'boolean'
  }
  if (name.endsWith('id') || name.endsWith('key') || name.endsWith('name') || name.endsWith('title') || name.endsWith('token') || name.endsWith('url') || name.endsWith('path')) {
    return 'string'
  }
  if (name.endsWith('count') || name.endsWith('num') || name.endsWith('age') || name.endsWith('score') || name.endsWith('budget') || name.endsWith('price') || name.endsWith('size') || name.endsWith('index')) {
    return 'number'
  }
  if (name.endsWith('list') || name.endsWith('items') || name.endsWith('tags') || name.endsWith('nodes')) {
    return 'string[]'
  }
  return 'string'
}

/**
 * Maps TypeScript type to Zod validation clause.
 *
 * @param {string} tsType
 * @returns {string} Zod validator
 */
function mapToZod(tsType = 'string') {
  if (tsType === 'number') return 'z.number()'
  if (tsType === 'boolean') return 'z.boolean()'
  if (tsType === 'string[]') return 'z.array(z.string())'
  return 'z.string()'
}

/**
 * Infers types and synthesizes Zod schema from a function declaration.
 *
 * @param {string} fnDeclaration
 * @param {object} [options]
 * @returns {object} Typed signature and Zod schema
 */
export function synthesizeFunctionTypesAndSchema(fnDeclaration = '', options = {}) {
  const fnMatch = fnDeclaration.match(/function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)/)
  if (!fnMatch) {
    throw new Error('Invalid function declaration syntax.')
  }

  const fnName = fnMatch[1]
  const rawParams = fnMatch[2].split(',').map((p) => p.trim()).filter(Boolean)

  const typedParams = rawParams.map((p) => {
    const cleanParam = p.split(':')[0].trim()
    const inferred = inferParamType(cleanParam)
    return {
      name: cleanParam,
      type: inferred,
      zod: mapToZod(inferred),
    }
  })

  // Build TS interface
  const interfaceName = `${fnName.charAt(0).toUpperCase() + fnName.slice(1)}Params`
  const tsInterface = [
    `export interface ${interfaceName} {`,
    ...typedParams.map((p) => `  ${p.name}: ${p.type};`),
    `}`,
  ].join('\n')

  // Build Zod schema
  const schemaName = `${fnName.charAt(0).toUpperCase() + fnName.slice(1)}Schema`
  const zodSchema = [
    `export const ${schemaName} = z.object({`,
    ...typedParams.map((p) => `  ${p.name}: ${p.zod},`),
    `})`,
  ].join('\n')

  return {
    functionName: fnName,
    interfaceName,
    schemaName,
    typedParams,
    tsInterface,
    zodSchema,
  }
}

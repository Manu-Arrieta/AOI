/**
 * scripts/aoi-os/ast-guard/ast-contract-guard.mjs
 *
 * Deterministic Polyglot AST Guard:
 * Parses JavaScript, TypeScript, Vue SFC, Python, and C# (.cs) code to extract
 * public exported symbols and prevent accidental breaking modifications to public contracts.
 */

/**
 * Detects programming language by file extension.
 *
 * @param {string} filePath
 * @returns {'typescript'|'vue'|'python'|'csharp'|'generic'}
 */
export function detectLanguage(filePath = '') {
  const normalized = filePath.toLowerCase().trim()
  if (normalized.endsWith('.vue')) return 'vue'
  if (normalized.endsWith('.py')) return 'python'
  if (normalized.endsWith('.cs')) return 'csharp'
  if (
    normalized.endsWith('.ts') ||
    normalized.endsWith('.tsx') ||
    normalized.endsWith('.js') ||
    normalized.endsWith('.jsx') ||
    normalized.endsWith('.mjs') ||
    normalized.endsWith('.cjs')
  ) {
    return 'typescript'
  }
  return 'generic'
}

/**
 * Extracts exported signatures from TypeScript / JavaScript source.
 *
 * @param {string} code
 * @param {Map<string, { kind: string, signature: string }>} exportsMap
 */
function extractTypeScriptSignatures(code, exportsMap) {
  // 1. Match: export function name(...) / export async function name(...)
  const fnRegex = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/gm
  let match
  while ((match = fnRegex.exec(code)) !== null) {
    exportsMap.set(match[1], {
      kind: 'function',
      signature: `function ${match[1]}(${match[2].trim()})`,
    })
  }

  // 2. Match: export const/let/var name = ...
  const constRegex = /^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm
  while ((match = constRegex.exec(code)) !== null) {
    exportsMap.set(match[1], {
      kind: 'variable',
      signature: `const ${match[1]}`,
    })
  }

  // 3. Match: export type Name / export interface Name / export enum Name / export class Name
  const typeRegex = /^export\s+(type|interface|enum|class)\s+([A-Za-z0-9_$]+)/gm
  while ((match = typeRegex.exec(code)) !== null) {
    exportsMap.set(match[2], {
      kind: match[1],
      signature: `${match[1]} ${match[2]}`,
    })
  }

  // 4. Match: export default function/class
  const defaultRegex = /^export\s+default\s+(?:async\s+)?(function|class)\s*([A-Za-z0-9_$]*)\s*\(([^)]*)\)/gm
  while ((match = defaultRegex.exec(code)) !== null) {
    const name = match[2] || 'default'
    exportsMap.set(name, {
      kind: `default-${match[1]}`,
      signature: `default ${match[1]} ${name}(${match[3].trim()})`,
    })
  }
}

/**
 * Extracts exported signatures from Vue SFC files.
 *
 * @param {string} code
 * @param {Map<string, { kind: string, signature: string }>} exportsMap
 */
function extractVueSignatures(code, exportsMap) {
  // Extract script or script setup contents
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
  let scriptMatch
  while ((scriptMatch = scriptRegex.exec(code)) !== null) {
    const scriptBody = scriptMatch[1]
    extractTypeScriptSignatures(scriptBody, exportsMap)

    // Match defineProps
    if (scriptBody.includes('defineProps')) {
      exportsMap.set('defineProps', {
        kind: 'vue-macro',
        signature: 'defineProps',
      })
    }
    // Match defineEmits
    if (scriptBody.includes('defineEmits')) {
      exportsMap.set('defineEmits', {
        kind: 'vue-macro',
        signature: 'defineEmits',
      })
    }
    // Match defineExpose
    if (scriptBody.includes('defineExpose')) {
      exportsMap.set('defineExpose', {
        kind: 'vue-macro',
        signature: 'defineExpose',
      })
    }
  }
}

/**
 * Extracts public symbol signatures from Python code.
 *
 * @param {string} code
 * @param {Map<string, { kind: string, signature: string }>} exportsMap
 */
function extractPythonSignatures(code, exportsMap) {
  // Match top-level def / async def (not starting with _)
  const pyFnRegex = /^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/gm
  let match
  while ((match = pyFnRegex.exec(code)) !== null) {
    const fnName = match[1]
    if (!fnName.startsWith('_') || fnName === '__init__') {
      exportsMap.set(fnName, {
        kind: 'function',
        signature: `def ${fnName}(${match[2].trim()})`,
      })
    }
  }

  // Match top-level class (not starting with _)
  const pyClassRegex = /^class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:/gm
  while ((match = pyClassRegex.exec(code)) !== null) {
    const className = match[1]
    if (!className.startsWith('_')) {
      exportsMap.set(className, {
        kind: 'class',
        signature: `class ${className}`,
      })
    }
  }
}

/**
 * Extracts public symbol signatures from C# (.cs) code.
 *
 * @param {string} code
 * @param {Map<string, { kind: string, signature: string }>} exportsMap
 */
function extractCSharpSignatures(code, exportsMap) {
  // Match public classes, interfaces, enums, records, structs
  const csTypeRegex = /\bpublic\s+(?:(?:static|sealed|abstract|partial|async|readonly)\s+)*(class|interface|enum|record|struct)\s+([A-Za-z0-9_]+)(?:<[^>]+>)?/gm
  let match
  while ((match = csTypeRegex.exec(code)) !== null) {
    const kind = match[1]
    const name = match[2]
    exportsMap.set(name, {
      kind: `csharp-${kind}`,
      signature: `public ${kind} ${name}`,
    })
  }

  // Match public methods or interface method declarations: [public] [modifiers] ReturnType MethodName(...)
  const csMethodRegex = /(?:^\s*(?:public\s+)?(?:(?:static|async|virtual|override|abstract|sealed|new)\s+)*([A-Za-z0-9_<>?[\]]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:;|\{))/gm
  let mMatch
  while ((mMatch = csMethodRegex.exec(code)) !== null) {
    const returnType = mMatch[1]
    const methodName = mMatch[2]
    const params = mMatch[3].trim()
    // Avoid keywords being parsed as methods
    if (!['class', 'interface', 'enum', 'record', 'struct', 'get', 'set', 'namespace', 'using', 'if', 'while', 'for', 'switch', 'catch', 'lock'].includes(returnType) &&
        !['if', 'while', 'for', 'switch', 'catch', 'lock'].includes(methodName)) {
      exportsMap.set(methodName, {
        kind: 'csharp-method',
        signature: `${returnType} ${methodName}(${params})`,
      })
    }
  }

  // Match public properties: public Type PropertyName { get; set; }
  const csPropRegex = /\bpublic\s+(?:(?:static|virtual|override|readonly)\s+)*([A-Za-z0-9_<>?[\]]+)\s+([A-Za-z0-9_]+)\s*\{\s*get/gm
  let pMatch
  while ((pMatch = csPropRegex.exec(code)) !== null) {
    const propType = pMatch[1]
    const propName = pMatch[2]
    if (!exportsMap.has(propName)) {
      exportsMap.set(propName, {
        kind: 'csharp-property',
        signature: `public ${propType} ${propName} { get; }`,
      })
    }
  }
}

/**
 * Extracts exported symbols and functional signatures from code based on language detection.
 *
 * @param {string} code
 * @param {string} [filePath='file.ts']
 * @returns {Map<string, { kind: string, signature: string }>}
 */
export function extractExportedSignatures(code, filePath = 'file.ts') {
  const exportsMap = new Map()
  if (!code || typeof code !== 'string') return exportsMap

  const lang = detectLanguage(filePath)

  switch (lang) {
    case 'vue':
      extractVueSignatures(code, exportsMap)
      break
    case 'python':
      extractPythonSignatures(code, exportsMap)
      break
    case 'csharp':
      extractCSharpSignatures(code, exportsMap)
      break
    case 'typescript':
    default:
      extractTypeScriptSignatures(code, exportsMap)
      break
  }

  return exportsMap
}

/**
 * Validates whether proposed code breaks any public contracts present in original code.
 *
 * @param {string} originalCode
 * @param {string} proposedCode
 * @param {string} [filePath='file.ts']
 * @returns {{ safe: boolean, violations: string[], removedSymbols: string[] }}
 */
export function validateContractDiff(originalCode, proposedCode, filePath = 'file.ts') {
  const originalExports = extractExportedSignatures(originalCode, filePath)
  const proposedExports = extractExportedSignatures(proposedCode, filePath)
  const violations = []
  const removedSymbols = []

  for (const [symbol, orig] of originalExports.entries()) {
    if (!proposedExports.has(symbol)) {
      violations.push(`Breaking change in ${filePath}: Exported ${orig.kind} [${symbol}] was removed.`)
      removedSymbols.push(symbol)
    } else {
      const prop = proposedExports.get(symbol)
      if (orig.kind !== prop.kind) {
        violations.push(
          `Breaking change in ${filePath}: Exported symbol [${symbol}] changed kind from [${orig.kind}] to [${prop.kind}].`
        )
      }
    }
  }

  return {
    safe: violations.length === 0,
    violations,
    removedSymbols,
  }
}

/**
 * Evaluates blast radius based on dependent count.
 *
 * @param {number} dependentCount
 * @returns {'low'|'medium'|'high'}
 */
export function classifyBlastRadius(dependentCount) {
  if (dependentCount === 0) return 'low'
  if (dependentCount <= 3) return 'medium'
  return 'high'
}

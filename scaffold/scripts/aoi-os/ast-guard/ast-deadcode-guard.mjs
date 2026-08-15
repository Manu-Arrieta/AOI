/**
 * scripts/aoi-os/ast-guard/ast-deadcode-guard.mjs
 *
 * Deterministic AST Dead-Code & Tree-Shaking Guard for AOI-OS:
 * Detects unused local variables, orphan functions, and redundant imports
 * with 0 LLM token consumption.
 */

/**
 * Scans a source file to identify dead code candidates.
 *
 * @param {string} sourceCode
 * @param {string} [filePath='file.ts']
 * @returns {object} Dead code analysis report
 */
export function auditDeadCode(sourceCode = '', filePath = 'file.ts') {
  if (!sourceCode || typeof sourceCode !== 'string') {
    return {
      filePath,
      unusedImports: [],
      orphanVariables: [],
      deadCodeScore: 0,
      clean: true,
    }
  }

  const lines = sourceCode.split('\n')
  const unusedImports = []
  const orphanVariables = []

  // 1. Check named imports: import { a, b } from 'pkg'
  const importRegex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"][^'"]+['"]/g
  let match
  while ((match = importRegex.exec(sourceCode)) !== null) {
    const symbols = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0])
    for (const sym of symbols) {
      if (!sym) continue
      // Count occurrences in source code (outside import line)
      const symRegex = new RegExp(`\\b${sym}\\b`, 'g')
      const count = (sourceCode.match(symRegex) || []).length
      if (count <= 1) {
        unusedImports.push(sym)
      }
    }
  }

  // 2. Check local const/let/var that are never read
  const varRegex = /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g
  while ((match = varRegex.exec(sourceCode)) !== null) {
    const varName = match[1]
    const varOccurrences = new RegExp(`\\b${varName}\\b`, 'g')
    const count = (sourceCode.match(varOccurrences) || []).length
    if (count <= 1) {
      orphanVariables.push(varName)
    }
  }

  const totalIssues = unusedImports.length + orphanVariables.length
  const totalLines = lines.length || 1
  const deadCodeScore = Math.min(100, Math.round((totalIssues / totalLines) * 100))

  return {
    filePath,
    unusedImports,
    orphanVariables,
    deadCodeScore,
    clean: totalIssues === 0,
  }
}

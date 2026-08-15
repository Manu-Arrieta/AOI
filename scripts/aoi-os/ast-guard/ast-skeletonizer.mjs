/**
 * scripts/aoi-os/ast-guard/ast-skeletonizer.mjs
 *
 * Semantic AST Pruning & Skeletonization for AOI-OS:
 * Reduces token consumption by 70%-90% by preserving all imports, type contracts,
 * and the target symbol body while skeletonizing non-target function bodies into signatures.
 */

import { detectLanguage } from './ast-contract-guard.mjs'

/**
 * Skeletonizes non-target function/method bodies in source code.
 *
 * @param {string} sourceCode - Original file content
 * @param {string} filePath - Path to file
 * @param {object} [options]
 * @param {string[]} [options.targetSymbols=[]] - Names of functions/methods to preserve with full body
 * @param {number} [options.minLinesToSkeletonize=80] - Don't prune if file is smaller than this
 * @returns {{ skeletonizedCode: string, originalLines: number, prunedLines: number, savingsPercent: number }}
 */
export function skeletonizeSource(sourceCode = '', filePath = '', options = {}) {
  const { targetSymbols = [], minLinesToSkeletonize = 80 } = options
  const lines = sourceCode ? sourceCode.split('\n') : []
  const originalLines = lines.length

  // Safety fallback: Never prune small files
  if (originalLines < minLinesToSkeletonize || targetSymbols.length === 0) {
    return {
      skeletonizedCode: sourceCode,
      originalLines,
      prunedLines: originalLines,
      savingsPercent: 0,
    }
  }

  const lang = detectLanguage(filePath)
  let skeletonizedCode = sourceCode

  if (lang === 'typescript' || lang === 'vue') {
    skeletonizedCode = skeletonizeJsTs(sourceCode, targetSymbols)
  } else if (lang === 'csharp') {
    skeletonizedCode = skeletonizeCSharp(sourceCode, targetSymbols)
  } else if (lang === 'python') {
    skeletonizedCode = skeletonizePython(sourceCode, targetSymbols)
  }

  const prunedLines = skeletonizedCode.split('\n').length
  const savingsPercent = Math.max(
    0,
    Math.round(((originalLines - prunedLines) / originalLines) * 100)
  )

  return {
    skeletonizedCode,
    originalLines,
    prunedLines,
    savingsPercent,
  }
}

/**
 * Skeletonizes JS/TS source code.
 */
function skeletonizeJsTs(source, targetSymbols) {
  // Regex to match top-level or exported functions/methods with their body
  // e.g., export (async) function foo(...) { ... }
  const targetSet = new Set(targetSymbols)

  return source.replace(
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)(?:\s*:\s*[^{]+)?\s*\{([\s\S]*?)\n\}/g,
    (fullMatch, fnName, params, body) => {
      if (targetSet.has(fnName)) {
        return fullMatch // Keep full body for target
      }
      // Collapse body to single line skeleton
      const returnTypeMatch = fullMatch.match(/\)\s*:\s*([^{]+)\s*\{/)
      const returnType = returnTypeMatch ? `: ${returnTypeMatch[1].trim()}` : ''
      return `export function ${fnName}(${params})${returnType} { /* ... */ }`
    }
  )
}

/**
 * Skeletonizes C# source code.
 */
function skeletonizeCSharp(source, targetSymbols) {
  const targetSet = new Set(targetSymbols)

  return source.replace(
    /(public|private|protected|internal)?\s*(static|async)?\s*([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\s*\}/g,
    (fullMatch, access, modifier, returnType, methodName, params, body) => {
      if (targetSet.has(methodName)) {
        return fullMatch
      }
      const acc = access ? `${access} ` : ''
      const mod = modifier ? `${modifier} ` : ''
      return `${acc}${mod}${returnType} ${methodName}(${params}) { /* ... */ }`
    }
  )
}

/**
 * Skeletonizes Python source code.
 */
function skeletonizePython(source, targetSymbols) {
  const targetSet = new Set(targetSymbols)

  return source.replace(
    /(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*[^:]+)?:\n([\s\S]*?)(?=\n(?:def|class|\S|$))/g,
    (fullMatch, fnName, params, body) => {
      if (targetSet.has(fnName)) {
        return fullMatch
      }
      const returnTypeMatch = fullMatch.match(/->\s*([^:]+):/)
      const returnType = returnTypeMatch ? ` -> ${returnTypeMatch[1].trim()}` : ''
      return `def ${fnName}(${params})${returnType}:\n    """..."""\n    pass\n`
    }
  )
}

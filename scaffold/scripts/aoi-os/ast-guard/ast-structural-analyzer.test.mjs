import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeAstStructure } from './ast-structural-analyzer.mjs'

test('analyzeAstStructure verifies clean balanced syntax and extracts declarations', () => {
  const code = `
// Top-level comment
/* Multi-line
   block comment */
export function calculateBudget(amount, rate) {
  const config = { tax: 0.15, active: true };
  if (amount > 100) {
    return amount * rate * (1 + config.tax);
  }
  return amount * rate;
}

export class TaskPipeline {
  constructor(name) {
    this.name = name;
  }
}
`
  const result = analyzeAstStructure(code)
  assert.equal(result.valid, true)
  assert.equal(result.isBalanced, true)
  assert.equal(result.structuralProof, 'AST_STRUCTURAL_SYNTACTIC_INTEGRITY_VERIFIED')
  assert.ok(result.declarations.some(d => d.name === 'calculateBudget' && d.type === 'function'))
  assert.ok(result.declarations.some(d => d.name === 'TaskPipeline' && d.type === 'class'))
})

test('analyzeAstStructure detects unclosed or mismatched delimiters', () => {
  const code = `
function brokenCode() {
  const arr = [1, 2, 3;
}
`
  const result = analyzeAstStructure(code)
  assert.equal(result.valid, false)
  assert.equal(result.structuralProof, 'SYNTAX_OR_DELIMITER_MISMATCH_DETECTED')
  assert.ok(result.errors.length > 0)
})

test('analyzeAstStructure ignores delimiters inside strings and template literals', () => {
  const code = `
function stringSafeguard() {
  const str = "{ not a real block }";
  const tpl = \`[ not an array ( neither a paren \`;
  return true;
}
`
  const result = analyzeAstStructure(code)
  assert.equal(result.valid, true)
  assert.equal(result.isBalanced, true)
})

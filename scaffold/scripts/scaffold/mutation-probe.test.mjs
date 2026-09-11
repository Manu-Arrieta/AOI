/**
 * scripts/scaffold/mutation-probe.test.mjs
 *
 * The probe measures whether a suite constrains its code, so a defect in the
 * probe corrupts every number it reports. Its first version mutated the
 * contents of string literals, and a separator like `'============'` contains
 * `===`: those mutants changed a banner, survived everything, and inflated
 * the survivor count with findings that were not about logic at all.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { literalMask, mutationsFor, OPERATORS } from './mutation-probe.mjs'

describe('mutations are generated only where a decision is made', () => {
  it('mutates a real comparison', () => {
    const m = mutationsFor('if (a === b) return 1')
    assert.equal(m.length, 1)
    assert.equal(m[0].operator, 'eq→ne')
    assert.match(m[0].mutated, /a !== b/)
  })

  it('produces one mutation per operator occurrence', () => {
    // Two independent decisions on one line means two separate mutants; a
    // single mutant changing both would not tell us which one is unchecked.
    assert.equal(mutationsFor('if (a === b && c === d) return 1').length, 3)
  })

  const INSIDE_LITERALS = [
    ['a template separator', 'push(`================`)'],
    ['a single-quoted string', "const s = 'a === b'"],
    ['a double-quoted string', 'const s = "x && y"'],
    ['a trailing comment', 'const n = 1 // a === b'],
    ['a whole-line comment', '  // if (a === b) return true'],
  ]
  for (const [what, line] of INSIDE_LITERALS) {
    it(`ignores ${what}`, () => {
      assert.deepEqual(mutationsFor(line), [], `mutó dentro de: ${line}`)
    })
  }

  it('still mutates code that sits beside a literal', () => {
    const m = mutationsFor("const s = 'a === b'; if (x === y) {}")
    assert.equal(m.length, 1)
    assert.match(m[0].mutated, /x !== y/)
    assert.match(m[0].mutated, /'a === b'/, 'tocó el literal además del código')
  })

  it('handles an escaped quote without losing track of the string', () => {
    // A naive scanner ends the string at the escaped quote and then treats
    // the rest of the line as code.
    assert.deepEqual(mutationsFor("const s = 'no \\' termina === aca'"), [])
  })

  it('reports the line number and the original text', () => {
    const m = mutationsFor('const a = 1\nif (b === c) {}')
    assert.equal(m[0].line, 2)
    assert.equal(m[0].before, 'if (b === c) {}')
  })
})

describe('literalMask', () => {
  it('marks the quoted region and nothing else', () => {
    const mask = literalMask("x = 'ab'; y")
    assert.equal(mask[0], false) // x
    assert.equal(mask[4], true) // opening quote
    assert.equal(mask[5], true) // a
    assert.equal(mask[7], true) // closing quote
    assert.equal(mask[10], false) // y
  })

  it('marks everything after a line comment starts', () => {
    const mask = literalMask('x = 1 // resto')
    assert.equal(mask[0], false)
    assert.equal(mask.at(-1), true)
  })
})

describe('the operator set', () => {
  it('pairs every inversion with its opposite, so neither direction is blind', () => {
    const names = OPERATORS.map((o) => o.name)
    for (const [a, b] of [['eq→ne', 'ne→eq'], ['and→or', 'or→and'], ['true→false', 'false→true']]) {
      assert.ok(names.includes(a) && names.includes(b), `falta el par ${a}/${b}`)
    }
  })

  it('every operator actually changes the line it matches', () => {
    for (const op of OPERATORS) {
      op.find.lastIndex = 0
      assert.notEqual(op.replace, op.find.source, `${op.name} no cambia nada`)
    }
  })
})

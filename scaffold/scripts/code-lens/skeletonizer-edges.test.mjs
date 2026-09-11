/**
 * scripts/code-lens/skeletonizer-edges.test.mjs
 *
 * AST-Lens is the largest single saving the benchmark measures — 3.197 of the
 * 4.385 tokens Phase 3 claims — and it earns that by throwing away function
 * bodies. Two of its scanning predicates had surviving mutants, and both
 * decide where a body ENDS. Get either wrong and the skeleton silently keeps
 * or drops the wrong half, which is worse than not compressing at all: the
 * agent reads a plausible file that is not the file.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { skeletonizeCode } from './ast-skeletonizer.mjs'

describe('the scanner finds where a string ends', () => {
  // `while (i < len && code[i] !== quote)` walks to the closing quote.
  // Inverted, it stops at the first character that IS the quote — meaning it
  // never enters the string at all and everything after is misread as code.

  it('does not treat a brace inside a string as a block', () => {
    const src = [
      'export function real(a) {',
      '  const msg = "esto { no abre } un bloque"',
      '  return a',
      '}',
      'export function alsoReal(b) {',
      '  return b',
      '}',
    ].join('\n')

    const out = skeletonizeCode(src)

    assert.match(out, /real/, 'perdió la primera función')
    assert.match(out, /alsoReal/, 'las llaves dentro del string desalinearon el escaneo')
  })

  it('handles an escaped quote without ending the string early', () => {
    const src = ['export function q() {', '  return "un \\" adentro { }"', '}', 'export function after() {', '  return 1', '}'].join('\n')

    assert.match(skeletonizeCode(src), /after/, 'la comilla escapada cortó el string y desalineó el resto')
  })

  it('treats all three quote styles the same', () => {
    for (const q of ['"', "'", '`']) {
      const src = [`export function w() {`, `  const s = ${q}{{{${q}`, `}`, `export function tail() {`, `  return 1`, `}`].join('\n')
      assert.match(skeletonizeCode(src), /tail/, `las llaves dentro de ${q}...${q} rompieron el escaneo`)
    }
  })
})

describe('the scanner finds where a body ends', () => {
  // `while (j < len && depth > 0)` closes the block. With `>= 0` it runs one
  // brace past the end and swallows whatever follows.

  it('closes a function at its own brace, not the next one', () => {
    const src = ['export function first() {', '  return 1', '}', 'export function second() {', '  return 2', '}'].join('\n')

    const out = skeletonizeCode(src)

    assert.match(out, /first/)
    assert.match(out, /second/, 'el cierre se pasó de largo y se comió la función siguiente')
  })

  it('survives nested blocks without losing the tail', () => {
    const src = [
      'export function nested() {',
      '  if (true) {',
      '    for (;;) { break }',
      '  }',
      '}',
      'export function tail() {',
      '  return 1',
      '}',
    ].join('\n')

    assert.match(skeletonizeCode(src), /tail/, 'el anidamiento descontó mal la profundidad')
  })

  it('does not invent output for an empty file', () => {
    assert.equal(skeletonizeCode('').trim(), '')
  })
})

describe('the skeleton is smaller than the source, which is the entire point', () => {
  it('drops bodies while keeping every signature', () => {
    const body = Array.from({ length: 40 }, (_, i) => `  const v${i} = ${i}`).join('\n')
    const src = `export function big(a, b) {\n${body}\n  return a + b\n}\n`

    const out = skeletonizeCode(src)

    assert.match(out, /big/, 'perdió la firma, que es lo único que había que conservar')
    assert.ok(out.length < src.length / 2, 'el esqueleto no comprimió nada')
    assert.doesNotMatch(out, /const v39/, 'conservó el cuerpo que debía descartar')
  })
})

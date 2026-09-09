/**
 * scripts/doctor-verdicts.test.mjs
 *
 * `pnpm aoi:doctor` is advertised as a 0-token health check, which means an
 * operator reads its verdict instead of investigating. A doctor that says
 * PASSED over a broken toolchain is worse than no doctor: it converts an
 * unknown into a false certainty.
 *
 * Both of its surviving mutants sat on the line that decides PASSED vs
 * WARNING, so nothing held the verdict itself.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkBinaries, checkIcmHealth } from './aoi-doctor.mjs'

/** A fake exec that answers whatever the test needs. */
const execWith = (impl) => async (...args) => impl(...args)

describe('the ICM health verdict', () => {
  // `(healthy || integrity ok) && !error && !corrupt` — every operand had to
  // matter, and none was pinned.

  it('passes on a healthy report', async () => {
    const r = await checkIcmHealth(execWith(async () => ({ stdout: 'Database integrity: ok\nall healthy' })))
    assert.equal(r.status, 'PASSED')
  })

  it('warns when the report says nothing good, even without an error', async () => {
    // Absence of a health signal is not health. Reading silence as PASSED is
    // exactly the failure this file exists to prevent.
    const r = await checkIcmHealth(execWith(async () => ({ stdout: 'ran 3 checks' })))
    assert.equal(r.status, 'WARNING')
  })

  it('warns on a report that is healthy AND carries an error', async () => {
    // The `&&` chain matters here: an OR would let the word "healthy" outvote
    // a reported error.
    const r = await checkIcmHealth(execWith(async () => ({ stdout: 'healthy\nerror: index rebuild failed' })))
    assert.equal(r.status, 'WARNING', 'un error reportado quedó tapado por la palabra healthy')
  })

  it('warns on a corrupt database however healthy the rest looks', async () => {
    const r = await checkIcmHealth(execWith(async () => ({ stdout: 'Database integrity: ok\ncorrupt page detected' })))
    assert.equal(r.status, 'WARNING', 'una base corrupta pasó como sana')
  })

  it('does not report health when icm cannot be reached at all', async () => {
    const r = await checkIcmHealth(
      execWith(async () => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      })
    )
    assert.notEqual(r.status, 'PASSED', 'un icm ausente se reportó como sano')
  })
})

describe('the binary check', () => {
  it('finds a binary the resolver reports', async () => {
    const results = await checkBinaries([{ name: 'node', hint: 'x' }], execWith(async () => ({ stdout: '/usr/bin/node' })))
    assert.equal(results[0].status, 'PASSED')
  })

  it('does not report a missing mandatory binary as present', async () => {
    const results = await checkBinaries(
      [{ name: 'no-existe', hint: 'x' }],
      execWith(async () => {
        throw new Error('not found')
      })
    )
    assert.notEqual(results[0].status, 'PASSED', 'un binario ausente se reportó encontrado')
  })
})

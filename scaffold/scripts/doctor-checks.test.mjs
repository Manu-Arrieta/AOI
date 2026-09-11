/**
 * scripts/doctor-checks.test.mjs
 *
 * The six questions the diagnostic asks, each one answered against a
 * workspace built to make it answer wrong.
 *
 * `scripts/` measured 27% by mutation — the worst score in the repository.
 * These two checks ask about the machine: whether a binary is there, and
 * whether ICM says it is healthy. The survivors were in the distinction
 * between a mandatory and an optional tool, and in what output counts as
 * healthy. Both decide whether the Owner gets told something.
 *
 * The four checks that read the workspace itself live in
 * `doctor-state-checks.test.mjs`.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkBinaries, checkIcmHealth, MANDATORY_BINARIES, RECOMMENDED_BINARIES } from './doctor-checks.mjs'

describe('checkBinaries separates what blocks from what merely warns', () => {
  const found = async () => ({ stdout: '/usr/local/bin/x\n', stderr: '' })
  const absent = async () => {
    throw new Error('not found')
  }

  it('reports a present binary with the path it resolved to', async () => {
    const [r] = await checkBinaries([{ name: 'icm', description: 'x' }], found)
    assert.equal(r.status, 'PASSED')
    assert.equal(r.details, '/usr/local/bin/x')
  })

  it('takes only the FIRST line when `which` reports several', async () => {
    // A second entry on PATH is not a second answer; recording the whole blob
    // as "the path" would put a newline into the report.
    const many = async () => ({ stdout: '/opt/bin/icm\n/usr/local/bin/icm\n', stderr: '' })
    const [r] = await checkBinaries([{ name: 'icm', description: 'x' }], many)
    assert.equal(r.details, '/opt/bin/icm')
  })

  it('FAILS on an absent mandatory binary', async () => {
    const [r] = await checkBinaries([{ name: 'icm', description: 'x' }], absent)
    assert.equal(r.status, 'FAILED')
    assert.equal(r.mandatory, true)
  })

  it('only WARNS on an absent optional one', async () => {
    // The difference is the entire point of the two lists: a workspace
    // without headroom is usable, one without ICM is not.
    const [r] = await checkBinaries([{ name: 'headroom', description: 'x' }], absent)
    assert.equal(r.status, 'WARNING')
    assert.equal(r.mandatory, false)
  })

  it('decides mandatory by the shipped list, not by position in the argument', async () => {
    const results = await checkBinaries(
      [{ name: 'headroom', description: 'x' }, { name: 'icm', description: 'y' }],
      absent
    )
    assert.deepEqual(results.map((r) => r.mandatory), [false, true])
  })

  it('treats an unknown binary as optional rather than blocking', async () => {
    const [r] = await checkBinaries([{ name: 'inventado', description: 'x' }], absent)
    assert.equal(r.mandatory, false)
    assert.equal(r.status, 'WARNING')
  })

  it('ships ICM as the only mandatory tool, per the Owner', () => {
    assert.deepEqual(MANDATORY_BINARIES.map((b) => b.name), ['icm'])
    assert.ok(RECOMMENDED_BINARIES.some((b) => b.name === 'headroom'))
  })
})

describe('checkIcmHealth reads the output, not merely the exit code', () => {
  const saying = (stdout) => async () => ({ stdout, stderr: '' })

  it('accepts either wording ICM uses for a healthy database', async () => {
    for (const text of ['everything healthy\n', 'Database integrity: ok\n']) {
      assert.equal((await checkIcmHealth(saying(text))).status, 'PASSED', text)
    }
  })

  it('does NOT accept output that says neither', async () => {
    // A command that exits 0 having printed nothing useful is not evidence
    // of health, and reading it as such is how a corrupt store passes.
    assert.equal((await checkIcmHealth(saying('done\n'))).status, 'WARNING')
  })

  it('refuses a healthy claim that also reports an error or corruption', async () => {
    // Both negations must hold: "healthy" plus "error" is not healthy.
    for (const text of ['healthy but error found\n', 'Database integrity: ok\ncorrupt index\n']) {
      assert.equal((await checkIcmHealth(saying(text))).status, 'WARNING', text)
    }
  })

  it('FAILS, not warns, when icm cannot be executed at all', async () => {
    const broken = async () => {
      throw new Error('spawn icm ENOENT')
    }
    const r = await checkIcmHealth(broken)
    assert.equal(r.status, 'FAILED')
    assert.match(r.details, /ENOENT/)
  })
})

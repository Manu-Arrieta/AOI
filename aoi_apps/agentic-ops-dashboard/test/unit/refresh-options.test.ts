/**
 * test/unit/refresh-options.test.ts
 *
 * `refreshWorkspace()` accepts a boolean or an options object, and the two
 * spell "no opinion" differently: `refresh(false)` drops the selection,
 * `refresh({})` keeps it. The asymmetry is intended — the boolean form IS the
 * preserveSelection flag — but nothing held it, because the function lived
 * inside a 237-line composable no test could load.
 */

import { describe, expect, it } from 'vitest'
import { resolveRefreshWorkspaceOptions } from '../../app/utils/refresh-options'

describe('resolveRefreshWorkspaceOptions', () => {
  it('keeps the selection when called with nothing', () => {
    expect(resolveRefreshWorkspaceOptions()).toEqual({ preserveSelection: true, silent: false })
  })

  it('reads a bare boolean as the preserveSelection flag', () => {
    expect(resolveRefreshWorkspaceOptions(true)).toEqual({ preserveSelection: true, silent: false })
    expect(resolveRefreshWorkspaceOptions(false)).toEqual({ preserveSelection: false, silent: false })
  })

  it('defaults an empty object to keeping the selection, unlike `false`', () => {
    // The asymmetry, pinned: {} is "no opinion" and keeps it; false is an
    // explicit instruction to drop it.
    expect(resolveRefreshWorkspaceOptions({})).toEqual({ preserveSelection: true, silent: false })
  })

  it('honours each field independently', () => {
    expect(resolveRefreshWorkspaceOptions({ preserveSelection: false })).toEqual({
      preserveSelection: false,
      silent: false,
    })
    expect(resolveRefreshWorkspaceOptions({ silent: true })).toEqual({ preserveSelection: true, silent: true })
    expect(resolveRefreshWorkspaceOptions({ preserveSelection: false, silent: true })).toEqual({
      preserveSelection: false,
      silent: true,
    })
  })

  it('never reports silent by default, so a refresh is visible unless asked otherwise', () => {
    for (const input of [undefined, true, false, {}, { preserveSelection: false }] as const) {
      expect(resolveRefreshWorkspaceOptions(input).silent).toBe(false)
    }
  })
})

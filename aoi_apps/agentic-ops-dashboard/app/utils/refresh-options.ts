/**
 * How `refreshWorkspace()` reads its argument.
 *
 * The call site may pass a boolean or an options object, and the two spell
 * "no opinion" differently: `refresh(false)` means do NOT preserve the
 * selection, while `refresh({})` preserves it. That asymmetry is deliberate —
 * the boolean form IS the preserveSelection flag — but it is exactly the kind
 * of default that flips unnoticed in a refactor, so it lives here where a test
 * can hold it rather than inside a composable no test can load.
 */

export type RefreshWorkspaceInput =
  | boolean
  | {
      preserveSelection?: boolean
      silent?: boolean
    }

export interface RefreshWorkspaceOptions {
  preserveSelection: boolean
  silent: boolean
}

export function resolveRefreshWorkspaceOptions(input: RefreshWorkspaceInput = true): RefreshWorkspaceOptions {
  if (typeof input === 'boolean') {
    return { preserveSelection: input, silent: false }
  }
  return {
    preserveSelection: input.preserveSelection ?? true,
    silent: input.silent ?? false,
  }
}

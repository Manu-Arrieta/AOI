import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { resolveWorkspaceRoot } from './workspace-root'

/**
 * Loads a module from the workspace's own scripts/ tree, at request time.
 *
 * The handlers used to reach those modules with a static relative import —
 * `import { runAoiDoctor } from '../../../../scripts/aoi-doctor.mjs'`. That
 * specifier is correct in the source and the route tests pass on it, because
 * Vitest resolves it against the file that wrote it. `nuxt dev` does not.
 * Nitro externalises a .mjs living outside the Nuxt root, and unlike a
 * node_modules external — which it rewrites to an absolute file:// URL — it
 * leaves this one relative for Rollup to re-anchor against the virtual chunk
 * id. The four `../` came out as ten in .nuxt/dev/index.mjs, which climbs past
 * the filesystem root and normalises to `/scripts/aoi-doctor.mjs`; the
 * dashboard died on boot with `Cannot find module '/scripts/aoi-doctor.mjs'`.
 * The depth of the install path is irrelevant — ten always overshoots.
 *
 * Resolving the absolute path at runtime keeps the specifier away from the
 * bundler, and it is what the handlers already meant: each one calls
 * resolveWorkspaceRoot() to tell the script WHICH workspace to read, so
 * binding the script itself at build time was incoherent before it was broken.
 * It also means the dashboard runs the doctor belonging to the workspace it is
 * attached to, not the copy that happened to sit next to it when it was built.
 */
export function loadAoiModule<T = Record<string, any>>(relativePath: string): Promise<T> {
  const href = pathToFileURL(join(resolveWorkspaceRoot(), relativePath)).href
  return import(/* @vite-ignore */ href) as Promise<T>
}

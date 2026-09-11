/**
 * scripts/memory-sync/cli-args.mjs
 *
 * The argument shape the memory bundle CLIs share.
 *
 * Both `export-memory-bundle` and `import-memory-bundle` take the same three
 * positional values — workspace, version id, artifact path — followed by
 * flags, and each had written its own fifty-line loop to read them. The two
 * loops were the same code with different flag names, and neither had a test:
 * every mutant the probe planted inside them survived.
 *
 * One parser, one place to get the `index += 1` right, and a surface small
 * enough to hold with assertions.
 */

/**
 * Splits `argv` into the three positional values and a flag map.
 *
 * A flag named in `lists` may repeat and accumulates; every other flag keeps
 * its last value. A flag with no value following it is ignored rather than
 * recorded as `undefined` — a scope list containing a hole fails downstream
 * with a message about the hole instead of about the missing argument.
 *
 * @param {string[]} argv
 * @param {{ lists?: string[] }} [options]
 * @returns {{ workspace: string, versionId: string, relativeArtifactPath: string,
 *   flags: Record<string, string | string[]> }}
 */
export function parseBundleArgs(argv = [], { lists = [] } = {}) {
  const [workspace, versionId, relativeArtifactPath, ...rest] = argv
  const flags = {}
  for (const name of lists) flags[name] = []

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (typeof token !== 'string' || !token.startsWith('--')) continue

    const key = token.slice(2)
    const value = rest[index + 1]
    // A flag whose value is another flag was never a value: consuming it
    // would silently eat the next option.
    if (value === undefined || value.startsWith('--')) continue

    if (lists.includes(key)) flags[key].push(value)
    else flags[key] = value
    index += 1
  }

  return { workspace, versionId, relativeArtifactPath, flags }
}

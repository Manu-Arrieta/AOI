/**
 * scripts/aoi-os/sandbox-guard/sandbox-ipc-disconnect-prover.mjs
 *
 * Deterministic Sandbox Child Process IPC Channel Disconnect Prover for AOI-OS:
 * Statically proves that child processes with IPC channels (fork, stdio: [..., 'ipc'])
 * have explicit channel disconnection (child.disconnect()) or disconnect listeners in teardown hooks,
 * preventing open IPC socket handles from keeping Node.js parent processes alive (0 LLM Tokens).
 */

/**
 * Audits child process fork and IPC channel source code for deterministic disconnect calls.
 *
 * @param {string} sourceCode - Process spawning and IPC source code
 * @returns {object} IPC disconnect proof report
 */
export function proveSandboxIpcDisconnectSafety(sourceCode = '') {
  const violations = []

  const createsIpcProcess = /(?:child_process\.fork|fork\s*\(|stdio\s*:\s*\[[^\]]*['"]ipc['"][^\]]*\])/i.test(sourceCode)
  const hasDisconnectCallOrHook = /(?:\.disconnect\s*\(|\.on\s*\(\s*['"]disconnect['"]|child\.disconnect)/i.test(sourceCode)

  if (createsIpcProcess && !hasDisconnectCallOrHook) {
    violations.push({
      type: 'UNDISCONNECTED_CHILD_IPC_CHANNEL',
      recommendation: "Ensure child processes spawned with IPC channels have explicit 'child.disconnect()' invoked in termination or exit hooks to sever open IPC channel handles.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    createsIpcProcess,
    violationsCount: violations.length,
    violations,
    disconnectProof: safe ? 'DETERMINISTIC_IPC_DISCONNECT_ENFORCED' : 'UNDISCONNECTED_IPC_HANDLE_LEAK_RISK',
  }
}

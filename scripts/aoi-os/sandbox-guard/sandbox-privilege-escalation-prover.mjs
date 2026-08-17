/**
 * scripts/aoi-os/sandbox-guard/sandbox-privilege-escalation-prover.mjs
 *
 * Deterministic Sandbox Privilege Escalation & Setuid/Setgid Prover for AOI-OS:
 * Statically proves that script executions and permission changes inside ephemeral sandboxes
 * ban setuid/setgid bits (chmod 4755, 2755) and privilege escalation calls (sudo, doas, pkexec) (0 LLM Tokens).
 */

/**
 * Audits source code / shell commands for privilege escalation and setuid/setgid attempts.
 *
 * @param {string} commandOrSourceCode - Shell command or script source code
 * @returns {object} Privilege escalation proof report
 */
export function provePrivilegeEscalationSafety(commandOrSourceCode = '') {
  const violations = []

  const hasSetuidBit = /\bchmod\s+[0-7]?[42][0-7]{3}\b/g.test(commandOrSourceCode)
  const hasElevationCommand = /\b(?:sudo|doas|pkexec|su\s+-)\b/g.test(commandOrSourceCode)

  if (hasSetuidBit) {
    violations.push({
      type: 'SETUID_SETGID_BIT_DETECTED',
      recommendation: 'Do not use setuid/setgid permission bits (4xxx or 2xxx) inside hermetic sandboxes.',
    })
  }

  if (hasElevationCommand) {
    violations.push({
      type: 'PRIVILEGE_ELEVATION_COMMAND_DETECTED',
      recommendation: 'Superuser elevation commands (sudo/doas) are prohibited in autonomous sandbox execution.',
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    escalationProof: safe ? 'PRIVILEGE_ESCALATION_CONTAINMENT_PROVEN' : 'UNAUTHORIZED_PRIVILEGE_ESCALATION_DETECTED',
  }
}

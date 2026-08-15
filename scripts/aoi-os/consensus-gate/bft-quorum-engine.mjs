/**
 * scripts/aoi-os/consensus-gate/bft-quorum-engine.mjs
 *
 * Deterministic Byzantine Fault Tolerant (BFT) Multi-Verifier Quorum for AOI-OS:
 * Aggregates weighted votes from 5 independent deterministic analyzers
 * to authorize commits with mathematical confidence (0 LLM Tokens).
 */

import { traceTaintFlows } from '../security-guard/ast-taint-tracer.mjs'
import { proveSymbolicConstraints } from '../symbolic-prover/symbolic-constraint-prover.mjs'
import { auditConstitutionDrift } from './constitution-drift-auditor.mjs'
import { auditDeadCode } from '../ast-guard/ast-deadcode-guard.mjs'
import { generateAstMutants, calculateMutationScore } from '../mutation-testing/ast-mutation-verifier.mjs'

/**
 * Evaluates code proposal across 5 deterministic verification nodes in the BFT Quorum.
 *
 * @param {object} options
 * @param {string} options.sourceCode
 * @param {string} [options.filePath='file.ts']
 * @param {boolean} [options.testsPassed=true]
 * @returns {object} BFT Quorum verdict and vote breakdown
 */
export function evaluateBftQuorum(options) {
  const { sourceCode = '', filePath = 'file.ts', testsPassed = true } = options

  // 1. Taint Security Verifier (Weight: 25)
  const taint = traceTaintFlows(sourceCode, filePath)
  const taintVote = {
    verifier: 'Taint_Security_Verifier',
    approved: taint.safe,
    weight: 25,
    severity: taint.safe ? 'none' : 'critical',
    feedback: taint.violations.map((v) => v.sink),
  }

  // 2. Symbolic Invariant Prover (Weight: 20)
  const symbolic = proveSymbolicConstraints(sourceCode)
  const symbolicVote = {
    verifier: 'Symbolic_Invariant_Prover',
    approved: symbolic.satisfiable,
    weight: 20,
    severity: symbolic.satisfiable ? 'none' : 'high',
    feedback: symbolic.contradictions.map((c) => c.reason),
  }

  // 3. Constitution Drift Auditor (Weight: 20)
  const constitution = auditConstitutionDrift(sourceCode, filePath)
  const constitutionVote = {
    verifier: 'Constitution_Drift_Auditor',
    approved: constitution.passed,
    weight: 20,
    severity: constitution.passed ? 'none' : 'medium',
    feedback: constitution.violations.map((v) => v.description),
  }

  // 4. Dead Code & Hygiene Verifier (Weight: 15)
  const hygiene = auditDeadCode(sourceCode, filePath)
  const hygieneVote = {
    verifier: 'DeadCode_Hygiene_Verifier',
    approved: hygiene.deadCodeScore < 50,
    weight: 15,
    severity: hygiene.deadCodeScore < 50 ? 'none' : 'low',
    feedback: hygiene.unusedImports,
  }

  // 5. Test Suite Invariant Verifier (Weight: 20)
  const testVote = {
    verifier: 'Test_Suite_Invariant_Verifier',
    approved: testsPassed,
    weight: 20,
    severity: testsPassed ? 'none' : 'critical',
    feedback: testsPassed ? [] : ['Test suite reported failures'],
  }

  const allVotes = [taintVote, symbolicVote, constitutionVote, hygieneVote, testVote]

  let gainedWeight = 0
  let totalWeight = 0
  const dissents = []

  for (const vote of allVotes) {
    totalWeight += vote.weight
    if (vote.approved) {
      gainedWeight += vote.weight
    } else {
      dissents.push(vote)
    }
  }

  const consensusScore = Math.round((gainedWeight / totalWeight) * 100)
  // Supermajority: score >= 80 and no critical dissents
  const hasCriticalDissent = dissents.some((d) => d.severity === 'critical')
  const quorumApproved = consensusScore >= 80 && !hasCriticalDissent

  return {
    quorumApproved,
    consensusScore,
    totalVerifiers: allVotes.length,
    approvedCount: allVotes.length - dissents.length,
    dissentsCount: dissents.length,
    dissents,
    allVotes,
  }
}

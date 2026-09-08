/**
 * scripts/sdd-lifecycle/phase-references.mjs
 *
 * Answers WHAT a phase invokes and under what condition: which agents it
 * delegates to, which spec-kit commands it runs, which of those are branches
 * rather than certainties, and which agents are reachable only through a rule
 * written inside another agent's file.
 *
 * Split out of context-budget.mjs when that module hit the 300 LOC limit of
 * Invariant 5 for the second time. The trigger was mechanical but the boundary
 * is real: deciding what a phase invokes is a different question from pricing
 * it, and every subtle bug this work produced lived on this side — prose
 * inference, notes counted as steps, candidate sets read as three delegations.
 */

const AGENT_REF = /(?:^|[^\w.@])@([a-z][a-z0-9.-]*[a-z0-9])/g
// Segments are matched one at a time so a sentence-ending period is not
// swallowed into the command name: `/speckit.plan.` must yield `speckit.plan`.
const SPECKIT_REF = /\/(speckit\.[a-z0-9]+(?:\.[a-z0-9]+)*)/g

/**
 * Collects references line by line, flagging each by whether its invocation is
 * declared conditional. Shared by agents and spec-kit commands because both
 * can be branch-only: `@triage-specialist` is delegated solely when the input
 * turns out to be a defect, and charging it to every run overstates the phase
 * exactly as an unconditional checklist did.
 *
 * @returns {Array<{ name: string, conditional: boolean }>}
 */
function collectRefs(text, pattern, keep = () => true) {
  const seen = new Map()
  const groups = []
  for (const line of text.split('\n')) {
    // Blockquotes are callouts explaining a step, never a step themselves. A
    // note that merely names a command was being scored as an invocation, and
    // because notes carry no marker it silently forced the command back into
    // the floor — inflating the very number this module exists to report.
    if (/^\s*>/.test(line)) continue
    const oneOf = line.includes(ONE_OF_MARKER)
    const conditional = line.includes(CONDITIONAL_MARKER) || oneOf
    const onThisLine = []
    for (const m of line.matchAll(pattern)) {
      if (!keep(m[1])) continue
      onThisLine.push(m[1])
      // Invoked plainly anywhere means paid on every run, whatever other lines say.
      if (!seen.has(m[1]) || !conditional) seen.set(m[1], conditional)
    }
    if (oneOf && onThisLine.length > 1) groups.push(onThisLine)
  }
  const refs = [...seen.entries()]
    .map(([name, conditional]) => ({ name, conditional }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { refs, groups }
}

/** Distinct agents a prompt delegates to, excluding spec-kit command names. */
export function agentsIn(text) {
  return collectRefs(text, AGENT_REF, (n) => !n.startsWith('speckit.')).refs
}

/** Candidate sets of agents, of which exactly one is chosen per run. */
export function agentGroupsIn(text) {
  return collectRefs(text, AGENT_REF, (n) => !n.startsWith('speckit.')).groups
}

/**
 * A conditional invocation is not free — it is paid whenever it fires — but
 * charging it to every run overstates the phase and, worse, makes
 * conditionality invisible: turning a step conditional would show zero
 * improvement in this very report.
 *
 * Conditionality is DECLARED with this marker, never inferred from prose. An
 * earlier version guessed from English words like "if", which cannot tell an
 * invocation that is itself conditional from a line that merely mentions a
 * condition for some other reason — and a guard built on a detector that
 * cannot make that distinction guards nothing.
 */
export const CONDITIONAL_MARKER = '[conditional]'

/**
 * Declares a line as enumerating candidates of which exactly one will be
 * chosen — `/sdd-apply` names three implementation agents and delegates to
 * whichever the task needs.
 *
 * Neither existing category describes this. Charging all of them says every
 * cycle runs a frontend, a backend AND a devops agent; marking them merely
 * conditional says a cycle may run none, and a floor that assumes no developer
 * at all is a number no real cycle can reach. A floor must be a lower bound
 * that is actually achievable, so the cheapest candidate is charged to it and
 * the rest to the conditional margin.
 */
export const ONE_OF_MARKER = '[one-of]'

/**
 * Distinct spec-kit commands a prompt invokes, each flagged by whether its
 * invocation line makes it conditional.
 *
 * @returns {Array<{ command: string, conditional: boolean }>}
 */
export function speckitIn(text) {
  return collectRefs(text, SPECKIT_REF).refs.map(({ name, conditional }) => ({ command: name, conditional }))
}

/**
 * Delegations an AGENT can make that its phase prompt never names. The budget
 * reads prompts, so these were invisible: the ceiling stopped being an upper
 * bound of what a real run can load.
 *
 * A reviewed map citing its source rule, for the same reason SKILL_SCOPE is:
 * these live in prose inside agent files, one inside a table cell, and
 * inferring them at runtime is the mistake this module already made twice.
 * They land in the conditional margin, never the floor — each is a branch.
 */
export const SECOND_ORDER = [
  {
    // supervisor.agent.md: "UX Gate: @ux-designer is MANDATORY before any new
    // UI component." An implementation-time rule, so only the phase that
    // writes code can reach it.
    when: (phase, agents) => phase.endsWith('_Apply') && agents.includes('supervisor'),
    agent: 'ux-designer',
  },
  {
    // {frontend,backend,devops}-developer.agent.md: "If a test is hard to
    // write, the design may need revisiting — escalate to @solution-architect"
    when: (_phase, agents) => agents.some((a) => a.endsWith('-developer') || a === 'devops-engineer'),
    agent: 'solution-architect',
  },
]

/** Agents a phase can reach through an agent-level delegation. */
export function secondOrderAgents(phase, directAgents) {
  return SECOND_ORDER.filter((r) => r.when(phase, directAgents) && !directAgents.includes(r.agent))
    .map((r) => r.agent)
    .filter((a, i, all) => all.indexOf(a) === i)
    .sort()
}

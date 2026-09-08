/**
 * scripts/sdd-lifecycle/context-budget.mjs
 *
 * Measures the FIXED cost of running an SDD phase: the prose the harness must
 * load before any work happens.
 *
 * The stress suite measures how well AOI compresses the variable payload of a
 * phase — the files explored, the diagnostics distilled, the turns tombstoned.
 * It has never measured what the phase costs just to exist: its prompt, the
 * agent definitions it delegates to, the spec-kit commands it invokes, and the
 * instruction files the harness injects because their `applyTo` glob matches.
 *
 * That omission mattered. A cycle's optimized payload is a few thousand tokens
 * while this fixed surface is an order of magnitude larger, so the headline
 * number was describing a small fraction of the real bill. Worse, prose grows
 * silently: nothing failed when a prompt gained four hundred tokens.
 *
 * Everything here is static arithmetic over files already on disk — no model
 * call, no inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import { estimateTokens } from './token-accounting.mjs'
import { fileTokens, instructionsFor, read, skillsFor } from './instruction-scope.mjs'
import { agentGroupsIn, agentsIn, secondOrderAgents, speckitIn } from './phase-references.mjs'

export { fileTokens, instructionsFor, expandBraces, matchesApplyTo, skillsFor, SKILL_SCOPE } from './instruction-scope.mjs'
export { agentGroupsIn, agentsIn, secondOrderAgents, speckitIn, CONDITIONAL_MARKER, ONE_OF_MARKER, SECOND_ORDER } from './phase-references.mjs'


/**
 * Full fixed cost of one phase.
 *
 * @param {string} root
 * @param {string} promptRel e.g. '.github/prompts/sdd-verify.prompt.md'
 * @returns {{ prompt: number, agents: number, speckit: number, instructions: number,
 *             total: number, detail: object }}
 */
export function phaseContextCost(root, promptRel, phase = '') {
  const text = read(path.join(root, promptRel))
  const prompt = estimateTokens(text)

  const costOf = (c) =>
    fileTokens(path.join(root, `.github/agents/${c}.agent.md`)) +
    fileTokens(path.join(root, `.github/prompts/${c}.prompt.md`))

  let agents = 0
  let speckit = 0
  let conditional = 0

  const agentList = agentsIn(text)
  for (const { name, conditional: isCond } of agentList) {
    if (isCond) conditional += costOf(name)
    else agents += costOf(name)
  }

  // Exactly one candidate of each one-of set always runs, so the cheapest is a
  // genuine lower bound and belongs in the floor rather than the margin.
  // Reachable only through a rule inside an agent's own file; conditional by
  // nature, so it widens the ceiling without touching the floor.
  const reached = secondOrderAgents(phase, agentList.map((a) => a.name))
  for (const a of reached) conditional += costOf(a)

  const oneOfGroups = agentGroupsIn(text)
  for (const group of oneOfGroups) {
    const cheapest = Math.min(...group.map(costOf))
    agents += cheapest
    conditional -= cheapest
  }

  const speckitList = speckitIn(text)
  for (const { command, conditional: isCond } of speckitList) {
    if (isCond) conditional += costOf(command)
    else speckit += costOf(command)
  }

  const instrList = instructionsFor(root, promptRel)
  const instructions = instrList.reduce((n, i) => n + i.tokens, 0)

  const skillList = skillsFor(root, phase)
  const skills = skillList.reduce((n, s) => n + s.tokens, 0)

  // `floor` is what every run of this phase costs. `total` adds what it costs
  // when every conditional branch also fires — the worst case, not the norm.
  const floor = prompt + agents + speckit + instructions + skills
  return {
    prompt,
    agents,
    speckit,
    conditional,
    instructions,
    skills,
    floor,
    total: floor + conditional,
    detail: {
      agents: agentList.filter((a) => !a.conditional).map((a) => a.name),
      speckit: speckitList.filter((s) => !s.conditional).map((s) => s.command),
      conditional: [
        ...agentList.filter((a) => a.conditional).map((a) => a.name),
        ...speckitList.filter((s) => s.conditional).map((s) => s.command),
      ].sort(),
      // Reported apart so the table does not read as if none of them runs: one
      // of each group always does, and its cheapest member sits in the floor.
      oneOf: oneOfGroups.map((g) => [...g].sort()),
      secondOrder: reached,
      instructions: instrList.map((i) => i.file),
      skills: skillList.map((s) => s.name),
    },
  }
}

/** Phase key -> prompt file, in lifecycle order. */
export const SDD_PHASES = [
  ['Phase_0_Frame', '.github/prompts/sdd-frame.prompt.md'],
  ['Phase_1_New', '.github/prompts/sdd-new.prompt.md'],
  ['Phase_2_FF', '.github/prompts/sdd-ff.prompt.md'],
  ['Phase_3_Apply', '.github/prompts/sdd-apply.prompt.md'],
  ['Phase_4_Verify', '.github/prompts/sdd-verify.prompt.md'],
  ['Phase_5_Archive', '.github/prompts/sdd-archive.prompt.md'],
]

/** Fixed cost of every phase plus the cycle total. */
export function auditContextBudget(root, phases = SDD_PHASES) {
  const rows = []
  let total = 0
  let floor = 0
  for (const [key, rel] of phases) {
    if (!fs.existsSync(path.join(root, rel))) continue
    const cost = phaseContextCost(root, rel, key)
    rows.push({ phase: key, ...cost })
    total += cost.total
    floor += cost.floor
  }
  return { rows, total, floor }
}

/**
 * Renders the verdict that matters: how the fixed surface compares to the
 * payload the optimizers actually work on. Reporting one without the other is
 * what let a 76% reduction describe a twentieth of the real bill.
 */
export function formatBudgetSummary(budget, payloadTokens) {
  const { total, floor } = budget
  const combined = floor + payloadTokens
  const share = combined > 0 ? ((payloadTokens / combined) * 100).toFixed(1) : '0.0'
  const heaviest = [...budget.rows].sort((a, b) => b.floor - a.floor)[0]
  const swing = total - floor

  return [
    'COSTO FIJO DE INFRAESTRUCTURA (prosa cargada antes de trabajar):',
    `- PISO, se paga en todo ciclo:                 ${floor.toLocaleString()} tokens`,
    `- TECHO, si además dispara todo lo condicional: ${total.toLocaleString()} tokens`,
    `- Margen condicional:                          ${swing.toLocaleString()} tokens`,
    `- Payload optimizado del ciclo:                ${payloadTokens.toLocaleString()} tokens`,
    `- El payload es el ${share}% del costo de piso del ciclo.`,
    heaviest ? `- Fase más cara: ${heaviest.phase} con ${heaviest.floor.toLocaleString()} tokens de piso.` : '',
    '',
    'Piso y techo se reportan por separado porque un paso condicional no se paga',
    'siempre; contarlo como fijo sobreestima el ciclo y, peor, haría invisible',
    'cualquier mejora que consista precisamente en volver condicional un paso.',
    'Todo esto es aritmética estática sobre archivos en disco: 0 tokens de inferencia.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Renders the budget as console.table rows. */
export function toBudgetRows({ rows }) {
  return rows.map((r) => ({
    Fase: r.phase,
    Prompt: r.prompt,
    Agentes: r.agents,
    'Spec-Kit': r.speckit,
    'Si aplica': r.conditional,
    Instr: r.instructions,
    Skills: r.skills,
    PISO: r.floor,
    TECHO: r.total,
  }))
}

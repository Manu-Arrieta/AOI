/**
 * scripts/sdd-lifecycle/behavioral-coverage.mjs
 *
 * The inventory of decisions the behavioural eval must cover.
 *
 * The first probe set defended the cuts one branch happened to make. That is
 * the same mistake as auditing a diff: it can only find what someone already
 * touched. This inventory is derived instead from what each phase DECLARES —
 * its gates, its mandatory steps, its delegations and its artifacts — so a
 * decision nobody probed is visible as a hole rather than as silence.
 *
 * `behavioral-probes.test.mjs` fails when an entry here has no probe. Adding a
 * gate to a prompt without adding its probe is therefore a test failure, not
 * an oversight discovered months later.
 */

/** @typedef {{ phase: string, decision: string, why: string }} Coverage */

/** Every load-bearing decision, grouped by the phase that owns it. */
export const COVERAGE = [
  // ── Phase 0 — Pre-Flight ─────────────────────────────────────────────────
  { phase: 'Phase_0_Frame', decision: 'entry-command', why: 'Elegir entre los dos comandos de entrada' },
  { phase: 'Phase_0_Frame', decision: 'zero-task-footprint', why: 'La fase NO debe crear TASK-ID ni carpetas' },
  { phase: 'Phase_0_Frame', decision: 'bic-persistence', why: 'Never Rules y Oracle se persisten como facts O(1)' },

  // ── Phase 1 — Explore ────────────────────────────────────────────────────
  { phase: 'Phase_1_New', decision: 'service-discovery-method', why: 'Con qué se busca, y qué está prohibido' },
  { phase: 'Phase_1_New', decision: 'service-discovery-mandatory', why: 'La compuerta es obligatoria, no opcional' },
  { phase: 'Phase_1_New', decision: 'facts-vs-memory', why: 'Un dato exacto va a Facts, no a Memories' },

  // ── Phase 2 — Specify, Plan, Tasks ───────────────────────────────────────
  { phase: 'Phase_2_FF', decision: 'model-parameter', why: 'Qué modelo y fallback lleva cada delegación' },
  { phase: 'Phase_2_FF', decision: 'specify-agent', why: 'Quién formaliza la especificación' },
  { phase: 'Phase_2_FF', decision: 'plan-agent', why: 'Quién produce el diseño y las tareas' },
  { phase: 'Phase_2_FF', decision: 'bic-tag-in-test', why: 'Cada Never Rule exige un test que cite su tag' },

  // ── Phase 3 — Implement ──────────────────────────────────────────────────
  { phase: 'Phase_3_Apply', decision: 'tdd-red-first', why: 'Test que falla antes que código de producción' },
  { phase: 'Phase_3_Apply', decision: 'payload-sanitization', why: 'Sanitizar el payload antes de delegar es obligatorio' },
  { phase: 'Phase_3_Apply', decision: 'srp-limit', why: 'Ningún archivo por encima de 300 LOC' },

  // ── Phase 4 — Verify ─────────────────────────────────────────────────────
  { phase: 'Phase_4_Verify', decision: 'verify-delegation', why: 'Quién valida el cumplimiento de la spec' },
  { phase: 'Phase_4_Verify', decision: 'invariant-gate-fail', why: 'Un invariante sin test es FAIL automático' },
  { phase: 'Phase_4_Verify', decision: 'mechanical-union', why: 'Consolidar con script determinista, no con un LLM' },
  { phase: 'Phase_4_Verify', decision: 'triage-routing', why: 'Comportamiento roto se enruta a triaje' },
  { phase: 'Phase_4_Verify', decision: 'invariant-gap-routing', why: 'Una regla faltante se enruta a /sdd-frame' },

  // ── Phase 5 — Archive ────────────────────────────────────────────────────
  { phase: 'Phase_5_Archive', decision: 'archive-agent', why: 'Quién produce la documentación final' },
  { phase: 'Phase_5_Archive', decision: 'registry-closure', why: 'El registro pasa a estado Archivado' },

  // ── Transversales ────────────────────────────────────────────────────────
  { phase: 'Phase_1_New', decision: 'rtk-prefix', why: 'Los comandos de terminal se prefijan con rtk' },
  { phase: 'Phase_3_Apply', decision: 'icm-importance', why: 'Una decisión de arquitectura se guarda como critical' },
]

/** Decisions declared for a phase. */
export function coverageFor(phase) {
  return COVERAGE.filter((c) => c.phase === phase).map((c) => c.decision)
}

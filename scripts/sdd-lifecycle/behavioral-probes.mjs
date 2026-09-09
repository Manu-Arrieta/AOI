#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/behavioral-probes.mjs
 *
 * The decisions that prose-trimming could silently break, written down.
 *
 * Every other gate in this repository is structural: it proves a file exists,
 * a reference resolves, a table still has a row. None of them can answer the
 * only question that matters after removing prose — does an agent still decide
 * correctly with what is left?
 *
 * Each probe pins one decision to the cut that could have broken it. A probe
 * is not "is the text still there": it is a scenario with a single defensible
 * answer, asked against the context a phase actually assembles. That context
 * comes from assemble-phase-context.mjs, whose token count is cross-checked
 * against the budget's floor, so the eval runs on exactly what ships.
 *
 * Generating the probes costs zero inference. Answering them does not, which
 * is why they are few and each one is load-bearing.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assemblePhaseContext } from './assemble-phase-context.mjs'

/**
 * @typedef {object} Probe
 * @property {string} id
 * @property {string} cut            Which removal this probe defends against.
 * @property {string} phase          Phase key, so the right context is assembled.
 * @property {string} prompt         Prompt file for that phase.
 * @property {string} scenario       What the agent is asked.
 * @property {RegExp} expected       The answer that proves the decision survived.
 * @property {RegExp} [forbidden]    An answer that proves it did not.
 */
export const PROBES = [
  {
    id: 'triage-routing',
    cut: 'La tabla de 3 escenarios salió de la skill sdd-lifecycle',
    phase: 'Phase_4_Verify',
    prompt: '.github/prompts/sdd-verify.prompt.md',
    scenario:
      'El Owner reporta: "el total del carrito se calcula mal, suma el descuento en vez de restarlo". ' +
      'No hay ninguna regla de negocio nueva: la regla existe y el código la viola. ' +
      '¿A qué agente enrutás esto y por qué? Respondé en una línea, nombrando el agente con @.',
    expected: /@?triage-specialist/i,
    forbidden: /sdd-frame|functional-analyst/i,
  },
  {
    id: 'invariant-gap-routing',
    cut: 'Misma tabla: el segundo escenario iba a /sdd-frame, no a triaje',
    phase: 'Phase_4_Verify',
    prompt: '.github/prompts/sdd-verify.prompt.md',
    scenario:
      'El Owner dice: "nunca definimos qué pasa si el cupón vence entre que se agrega al carrito y se paga". ' +
      'El código hace lo que se pidió; falta una regla de negocio. ' +
      '¿Qué comando o agente corresponde? Respondé en una línea.',
    expected: /sdd-frame/i,
    forbidden: /triage-specialist/i,
  },
  {
    id: 'entry-command',
    cut: 'La guía de entrada se movió a la skill sdd-entry',
    phase: 'Phase_0_Frame',
    prompt: '.github/prompts/sdd-frame.prompt.md',
    scenario:
      'El Owner llega y dice, sin más detalle: "quiero que los usuarios puedan exportar sus reportes, ' +
      'no sé bien cómo todavía". ¿Con cuál de los dos comandos de entrada se arranca, /sdd-frame o /sdd-new, ' +
      'y por qué? Respondé en una línea.',
    expected: /sdd-frame/i,
  },
  {
    id: 'model-parameter',
    cut: 'Los defaults por categoría salieron de model-selection',
    phase: 'Phase_2_FF',
    prompt: '.github/prompts/sdd-ff.prompt.md',
    scenario:
      'Vas a delegar en @solution-architect. ¿Exactamente qué valor de modelo pasás en runSubagent, ' +
      'y cuál es su fallback? Respondé solo con los dos valores.',
    expected: /Qwen\s*3\.7\s*plus/i,
  },
  {
    id: 'service-discovery-method',
    cut: 'La regla se movió del supervisor al prompt de /sdd-new',
    phase: 'Phase_1_New',
    prompt: '.github/prompts/sdd-new.prompt.md',
    scenario:
      'Tenés que hacer el Service Discovery Gate para averiguar si ya existe un servicio de exportación. ' +
      '¿Con qué herramientas buscás, y qué método está explícitamente prohibido? Respondé en una línea.',
    expected: /icm|recall|find/i,
    forbidden: /^(?!.*(nunca|never|no usar|prohibid)).*VS Code/is,
  },
  {
    id: 'facts-vs-memory',
    cut: 'F1: la skill de ICM no mencionaba el sistema Facts',
    phase: 'Phase_1_New',
    prompt: '.github/prompts/sdd-new.prompt.md',
    scenario:
      'Descubriste que el endpoint de autenticación del proyecto es /api/v1/auth. Es un dato exacto de ' +
      'configuración, no una decisión ni un aprendizaje. ¿En cuál de los sistemas de memoria de ICM lo ' +
      'guardás y con qué comando exacto? Respondé en una línea.',
    expected: /icm facts set/i,
    forbidden: /icm_memory_store|icm store -t/i,
  },
  {
    id: 'verify-delegation',
    cut: 'Los bloques por comando salieron de supervisor.agent.md',
    phase: 'Phase_4_Verify',
    prompt: '.github/prompts/sdd-verify.prompt.md',
    scenario:
      'Estás ejecutando /sdd-verify. ¿A qué agente le corresponde validar el cumplimiento de la ' +
      'especificación en esta fase? Respondé solo con el nombre del agente.',
    expected: /integration-specialist/i,
  },
  {
    id: 'zero-task-footprint',
    cut: 'Contrato de la fase: Pre-Flight no materializa nada en disco',
    phase: 'Phase_0_Frame',
    prompt: '.github/prompts/sdd-frame.prompt.md',
    scenario:
      'Terminaste el diálogo socrático y el Owner aprobó la intención. ¿Creás ya el TASK-ID y la carpeta ' +
      'en `.tasks/`, o no? Respondé sí o no y en una línea por qué.',
    expected: /\bno\b|zero-task|sin.*task|no.*crea/i,
    forbidden: /^s[ií][,. ]/i,
  },
  {
    id: 'bic-persistence',
    cut: 'Contrato: las Never Rules y el Oracle se persisten como facts O(1)',
    phase: 'Phase_0_Frame',
    prompt: '.github/prompts/sdd-frame.prompt.md',
    scenario:
      'El Owner aprobó el contrato con dos invariantes y un oráculo. ¿Con qué comando exacto los persistís, ' +
      'y qué forma tiene la clave? Respondé en una línea.',
    expected: /icm facts set/i,
  },
  {
    id: 'service-discovery-mandatory',
    cut: 'Contrato: la compuerta de Service Discovery es obligatoria',
    phase: 'Phase_1_New',
    prompt: '.github/prompts/sdd-new.prompt.md',
    scenario:
      'Tenés prisa y el requerimiento parece obvio. ¿Podés saltarte el Service Discovery Gate en esta fase? ' +
      'Respondé sí o no en una línea.',
    expected: /\bno\b|mandator|obligator/i,
  },
  {
    id: 'rtk-prefix',
    cut: 'Regla transversal: los comandos de terminal se prefijan con rtk',
    phase: 'Phase_1_New',
    prompt: '.github/prompts/sdd-new.prompt.md',
    scenario:
      'Necesitás correr `git status` en la terminal durante la exploración. ¿Cómo lo ejecutás exactamente? ' +
      'Respondé solo con el comando.',
    expected: /rtk git status/i,
  },
  {
    id: 'specify-agent',
    cut: 'Contrato: quién formaliza la especificación en la Fase 2',
    phase: 'Phase_2_FF',
    prompt: '.github/prompts/sdd-ff.prompt.md',
    scenario: '¿Qué agente produce `spec.md` en esta fase? Respondé solo con el nombre del agente.',
    expected: /functional-analyst/i,
  },
  {
    id: 'plan-agent',
    cut: 'Contrato: quién produce diseño y tareas en la Fase 2',
    phase: 'Phase_2_FF',
    prompt: '.github/prompts/sdd-ff.prompt.md',
    scenario: '¿Qué agente produce `design.md` y `tasks.md`? Respondé solo con el nombre del agente.',
    expected: /solution-architect/i,
  },
  {
    id: 'bic-tag-in-test',
    cut: 'Contrato: cada Never Rule exige un test que cite su tag verbatim',
    phase: 'Phase_2_FF',
    prompt: '.github/prompts/sdd-ff.prompt.md',
    scenario:
      'El BIC declara la invariante con tag `BIC-2026-007:never.1`. ¿Qué tiene que pasar con ese tag en las ' +
      'tareas y en los tests para que la verificación no falle? Respondé en una línea.',
    expected: /verbatim|literal|tag|test/i,
  },
  {
    id: 'tdd-red-first',
    cut: 'Contrato: TDD Gate, test que falla antes que código',
    phase: 'Phase_3_Apply',
    prompt: '.github/prompts/sdd-apply.prompt.md',
    scenario:
      'Vas a implementar una tarea. ¿Escribís primero el código de producción o primero un test que falla? ' +
      'Respondé en una línea nombrando el ciclo.',
    expected: /RED|test.*(primero|first)|falla.*primero/i,
  },
  {
    id: 'payload-sanitization',
    cut: 'Contrato: sanitizar el payload antes de delegar es obligatorio',
    phase: 'Phase_3_Apply',
    prompt: '.github/prompts/sdd-apply.prompt.md',
    scenario:
      'Vas a delegar una tarea en un agente de implementación. ¿Qué tenés que hacer con el payload antes, ' +
      'y qué NUNCA se le pasa a un subagente? Respondé en una línea.',
    expected: /sanitize|sanitiz/i,
  },
  {
    id: 'srp-limit',
    cut: 'Contrato: Invariante 5, ningún archivo por encima de 300 LOC',
    phase: 'Phase_3_Apply',
    prompt: '.github/prompts/sdd-apply.prompt.md',
    scenario: '¿Cuál es el tamaño máximo de un archivo según las invariantes de calidad? Respondé con el número.',
    expected: /300/,
  },
  {
    id: 'icm-importance',
    cut: 'Contrato: una decisión de arquitectura se guarda como critical',
    phase: 'Phase_3_Apply',
    prompt: '.github/prompts/sdd-apply.prompt.md',
    scenario:
      'Tomaste una decisión de arquitectura durante la implementación. ¿Con qué nivel de importancia la ' +
      'guardás en ICM? Respondé con una sola palabra.',
    expected: /critical/i,
  },
  {
    id: 'invariant-gate-fail',
    cut: 'Contrato: un invariante del BIC sin test es FAIL automático',
    phase: 'Phase_4_Verify',
    prompt: '.github/prompts/sdd-verify.prompt.md',
    scenario:
      'El BIC declara una Never Rule y ningún test la referencia. ¿La verificación pasa con advertencia o ' +
      'falla? Respondé en una línea.',
    expected: /FAIL|falla/i,
    forbidden: /solo.*advertencia|only.*warning/i,
  },
  {
    id: 'mechanical-union',
    cut: 'Contrato: consolidar reportes con script determinista, no con un LLM',
    phase: 'Phase_4_Verify',
    prompt: '.github/prompts/sdd-verify.prompt.md',
    scenario:
      'Tenés que consolidar varios reportes de verificación en uno. ¿Usás un paso de LLM que los fusione, o ' +
      'hay otra forma prescrita? Respondé en una línea.',
    expected: /mechanical|union|determinist|\.mjs/i,
  },
  {
    id: 'archive-agent',
    cut: 'Contrato: quién produce la documentación final',
    phase: 'Phase_5_Archive',
    prompt: '.github/prompts/sdd-archive.prompt.md',
    scenario: '¿Qué agente produce `functional-docs.md` al cerrar la tarea? Respondé solo con el nombre.',
    expected: /documentation-analyst/i,
  },
  {
    id: 'registry-closure',
    cut: 'Contrato: el registro pasa a estado Archivado al cerrar',
    phase: 'Phase_5_Archive',
    prompt: '.github/prompts/sdd-archive.prompt.md',
    scenario:
      'Cerraste la tarea. ¿A qué estado pasa en `.tasks/registry.md`? Respondé con el estado.',
    expected: /archivad|archived|📦/i,
  },
]

/** Builds the full prompt for one probe: real phase context plus the scenario. */
export function buildProbePrompt(root, probe) {
  const { text } = assemblePhaseContext(root, probe.prompt, probe.phase)
  return [
    'Sos un agente de AOI operando con EXACTAMENTE el contexto de abajo, que es el que el',
    'harness carga en esta fase. No uses conocimiento externo sobre AOI: si el contexto no',
    'alcanza para decidir, respondé "NO PUEDO DETERMINARLO CON ESTE CONTEXTO".',
    '',
    '--- INICIO DEL CONTEXTO DE LA FASE ---',
    text,
    '--- FIN DEL CONTEXTO DE LA FASE ---',
    '',
    `PREGUNTA: ${probe.scenario}`,
  ].join('\n')
}

function main() {
  const root = process.cwd()
  const outDir = process.argv[2] || '/tmp/aoi-probes'
  fs.mkdirSync(outDir, { recursive: true })
  for (const probe of PROBES) {
    const file = path.join(outDir, `${probe.id}.txt`)
    fs.writeFileSync(file, buildProbePrompt(root, probe))
    console.log(`${probe.id.padEnd(26)} ${probe.phase.padEnd(16)} -> ${file}`)
  }
  console.log(`\n${PROBES.length} sondas escritas en ${outDir}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}

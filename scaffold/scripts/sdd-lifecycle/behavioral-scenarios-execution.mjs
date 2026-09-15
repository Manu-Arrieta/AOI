/**
 * scripts/sdd-lifecycle/behavioral-scenarios-execution.mjs
 *
 * Las sondas de la mitad que ENTREGA: del plan al cierre. Cubren el TDD Gate de
 * la implementación, el traspaso entre fases, el reporte de verificación y el
 * estado al que pasa el registro al archivar.
 *
 * Separadas de la mitad que decide por el mismo motivo que las otras dos tablas
 * del ciclo: crecen por motivos distintos. Ver el encabezado de
 * `behavioral-scenarios-execution.mjs` para la historia del límite.
 *
 * @typedef {import('./behavioral-scenarios.mjs').Probe} Probe
 * @type {Probe[]}
 */
export const EXECUTION_PROBES = [
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
  {
    id: 'missing-upstream-artifact',
    cut: 'Traspaso: qué hacer si falta un artefacto de la fase anterior',
    phase: 'Phase_3_Apply',
    prompt: '.github/prompts/sdd-apply.prompt.md',
    scenario:
      'Vas a implementar pero `design.md` no existe en la carpeta de la tarea. ¿Arrancás igual con lo que ' +
      'hay, o hay una precondición que lo impide? Respondé en una línea.',
    expected: /precondic|pre-condition|no.*arranc|design\.md.*exist|falta/i,
  },
  {
    id: 'upstream-contract-source',
    cut: 'Traspaso: el BIC viaja por ICM, no por disco',
    phase: 'Phase_4_Verify',
    prompt: '.github/prompts/sdd-verify.prompt.md',
    scenario:
      'El Invariant Gate tiene que comprobar las Never Rules del contrato. ¿De dónde las lee: de un archivo ' +
      'en la carpeta de la tarea, o de otro lado? Respondé en una línea.',
    expected: /icm|facts/i,
  },
  {
    id: 'archive-precondition',
    cut: 'Traspaso: qué exige la fase de cierre de la anterior',
    phase: 'Phase_5_Archive',
    prompt: '.github/prompts/sdd-archive.prompt.md',
    scenario:
      'El Owner pide archivar la tarea. ¿Qué artefacto de la fase anterior tiene que existir y en qué estado, ' +
      'para poder cerrar? Respondé en una línea.',
    expected: /verify-report/i,
  },
]

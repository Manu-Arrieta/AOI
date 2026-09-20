/**
 * scripts/sdd-lifecycle/behavioral-scenarios-entry.mjs
 *
 * Las sondas de la mitad que DECIDE: de la idea al plan. Cubren el arranque por
 * cualquiera de las tres entradas, la obligatoriedad de Service Discovery, la
 * persistencia del BIC como facts, y las compuertas de triaje y ruteo.
 *
 * Separadas de la otra mitad porque son dos tablas que crecen por motivos
 * distintos y el ciclo SDD ya las distingue: una fija qué se decide ANTES de
 * escribir código, la otra qué se entrega DESPUÉS. El archivo que las unía
 * había llegado a las 300 LOC exactas del Invariante 5 —cero headroom— y la
 * próxima línea de cualquier persona rompía la build.
 *
 * @typedef {import('./behavioral-scenarios.mjs').Probe} Probe
 * @type {Probe[]}
 */
export const ENTRY_PROBES = [
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
    // El sufijo es obligatorio: sin `(customendpoint)` la llamada falla con
    // "Requested model not found" para los 27 agentes, que es exactamente lo que
    // documenta la nota del registro. El patrón anterior —sólo el nombre del
    // modelo— aceptaba las dos formas, así que la sonda dejaba pasar la
    // respuesta que rompe la delegación.
    expected: /Qwen\s*3\.7\s*plus.*customendpoint/i,
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
    // El patrón anterior —`\bno\b[^.]{0,60}(cre|...)`— aprobaba *"No hay problema,
    // crea el TASK-ID ahora mismo"*: la respuesta invertida, con la palabra "no".
    // `expected` describe la FORMA de la respuesta —una sonda de sí o no empieza
    // con `^no\b`, que no puede aparecer en medio de un texto—, así que la
    // EVIDENCIA que el contexto tiene que seguir trayendo se declara aparte: lo
    // que hace correcta la respuesta es que la Invariante exista, no la palabra.
    expected: /^no\b|\bno\s+se\s+(cre|gener|materializ)|\bsin\s+task/i,
    evidence: /zero-task|zero\s+task|\bno\s+(crear|crear\s+el)\b|Do NOT create/i,
    forbidden: /^s[ií]\b|\bs[ií]\s*,?\s*(cre|gener|materializ)|\b(cre|gener|materializ)\w*\s+(el\s+|la\s+)?(TASK|tarea|carpeta)/i,
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
    // Mismo defecto que en `zero-task-footprint`: el `\bno\b` suelto aprobaba
    // "No se." y también una respuesta invertida como "No hay problema,
    // salteala". Además, la alternativa `mandator` sola matcheaba el contexto
    // por una razón ajena —la política de Headroom también dice "mandatory"—
    // así que la evidencia parecía presente por el texto equivocado.
    //
    // El criterio tiene que exigir la negación DEL PERMISO, pegada a la
    // negación. `no\s+[^.]{0,80}(salt|...)` no sirve: en "No hay problema,
    // podés saltearla" la `no` niega otra cosa y el `salt` está a 20 caracteres,
    // así que aprobaba la respuesta invertida. Regex no parsea intención — se
    // elige la forma que sí discrimina y se la fija con un control negativo.
    expected: /no\s+(pod[eé]s|se\s+puede|est[aá]\s+permitido|es\s+opcional)|obligator|\(MANDATORY\)/i,
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
    id: 'constitution-before-phase',
    cut: 'El bloque Before/During/After salió de la skill sdd-lifecycle',
    phase: 'Phase_4_Verify',
    prompt: '.github/prompts/sdd-verify.prompt.md',
    scenario:
      'Antes de abrir una fase del ciclo, además de recuperar contexto de ICM, hay un documento del ' +
      'proyecto que tenés que consultar. ¿Cuál? Respondé en una línea, nombrando el archivo.',
    // Sin `forbidden` a propósito: la evidencia (`constitution`) está en las 7
    // fases, así que la sonda se verifica contra el contexto ensamblado y no
    // hace falta un modelo. Prohibir una respuesta la movería a la dirección
    // débil y subiría el tripwire de `behavioral-probes.test.mjs` para nada.
    expected: /constitution/i,
  },
]

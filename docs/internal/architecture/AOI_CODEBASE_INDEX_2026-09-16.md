# Índice de código y arquitectura de AOI

**Corte arquitectónico:** 2026-09-16 · **Repositorio:** `Manu-Arrieta/AOI`

Este documento responde dos preguntas distintas y las mantiene separadas a
propósito: **cómo está construido** el sistema (qué superficies existen y qué
gobierna cada una) y **cuál es el flujo exacto** (qué invoca a qué, en qué
orden, disparado por quién). La segunda no se escribe a mano. Se deriva del
árbol con `pnpm aoi:graph` y `pnpm aoi:determinism`, y este texto explica el
grafo en lugar de transcribirlo.

## Alcance, autoridad y topología de índices

El inventario canónico usa `git ls-files`, no una búsqueda que respete
`.gitignore`. Sus conteos son una observación de la revisión que se inspeccione,
no un contrato de esta arquitectura. `scaffold/` es la réplica que el instalador
proyecta a un workspace; nunca es un segundo runtime ni una segunda fuente de
verdad.

Codebase Memory no sustituye ese inventario: genera un grafo local, dependiente
del binario, sus reglas de exclusión y el estado del filesystem. La frontera es
determinista y vive en `.cbmignore` (sintaxis gitignore):

| Grafo | Raíz | Incluye | Excluye / condición |
| --- | --- | --- | --- |
| Control-plane | workspace del Owner | Fuentes de autoridad AOI instaladas. | `.cbmignore` excluye `scaffold/` y `aoi_apps/`, evitando duplicar el espejo y la aplicación auxiliar. Se crea sólo en perfiles `advanced` y `dashboard`. |
| Dashboard | `aoi_apps/agentic-ops-dashboard` | La aplicación Nuxt y su contrato UI/API. | Su `.cbmignore` excluye `.output/` (bundle generado). Se crea como grafo separado sólo en el perfil `dashboard`; no existe en `core` ni se agrega al grafo principal. |

El instalador difiere la indexación inicial hasta después de proyectar el
scaffold y materializar el dashboard seleccionado. Ejecuta las raíces de forma
secuencial dentro de un único trabajo en background, para no competir por el
almacenamiento local del proveedor. `auto_index` puede actualizar los grafos
terminados cuando el entorno externo lo permita.

Si el Owner ya tiene un `.cbmignore`, AOI preserva sus reglas y agrega al final
su bloque administrado — lo aplica `scripts/conf/ensure-cbmignore.mjs`, sólo en
perfiles `advanced` y `dashboard`, antes de indexar. La precedencia de gitignore
hace que el bloque final mantenga excluidos `scaffold/` y `aoi_apps/` aun ante
una negación anterior; en Dashboard hace lo mismo con `.output/`. El resultado
se refleja en `scaffold/` antes de indexar, por lo que la paridad describe el
workspace realmente usado.

### Cambio de frontera del grafo

Cambiar un `.cbmignore` es una operación de configuración determinista; purgar
los nodos que ya persistió un proveedor es un efecto externo. En la verificación
local de Codebase Memory v0.8.1, una reindexación incremental dejó nodos que
acababan de quedar excluidos. Después de cambiar una frontera, confirmar las
exclusiones con `index_status`; si el grafo debe quedar libre de esos nodos,
obtener su nombre exacto con `list_projects`, eliminar **sólo ese proyecto** y
reindexar su raíz absoluta. No borrar la caché global, porque contiene grafos
de otros workspaces.

`.cbmignore` está respaldado por Codebase Memory tanto para índices iniciales
como manuales y automáticos; su semántica y las demás capas de exclusión están
documentadas por el proveedor en su
[README oficial](https://github.com/DeusData/codebase-memory-mcp).

Para observar el estado actual, no reutilizar conteos históricos:

```text
git ls-files
codebase-memory-mcp cli list_projects
codebase-memory-mcp cli index_status '{"project":"<nombre-listado>"}'
pnpm aoi:doctor
```

## Modelo del sistema

AOI es infraestructura operativa para agentes, no una aplicación de negocio.
Su unidad de despliegue es una proyección segura de `scaffold/` sobre un
workspace del Owner. La fuente de autoridad se divide así:

| Superficie | Responsabilidad | Límites importantes |
| --- | --- | --- |
| `setup.sh`, `setup.ps1` | Instalan herramientas, configuran MCP/harness, aplican merge y proyectan el scaffold. | No deben sustituir manifests ni paquetes del Owner. |
| `teardown.sh`, `teardown.ps1` | Retiran sólo contenido atribuible a AOI y restauran hooks encadenados. | No borran contenido del Owner por coincidencias heurísticas. |
| `scaffold/` | Réplica instalable y sujeto de paridad. | No es un runtime adicional, fuente alternativa de reglas ni parte del grafo control-plane. |
| `.github/`, `.agents/`, `.specify/` | Roles, prompts, skills, constitución, Spec-Kit, hooks y contratos de trabajo. | Deben conservar paridad con su réplica cuando corresponda. |
| `scripts/` | Runtimes mecánicos, validadores, CLIs, instalaciones y tests. | Una decisión mecánica se ejecuta aquí, no en un juez LLM. |
| `.tasks/` | Registro y artefactos de un ciclo SDD. | El registro actual está vacío; no confundir plantilla con tarea activa. |
| `aoi_apps/agentic-ops-dashboard/` | Aplicación Nuxt auxiliar de observación y operaciones de recursos acotadas. | No define ni instala el workspace del Owner; el perfil Dashboard la indexa en un grafo independiente. |
| `docs/`, `wiki/` | Explicación, auditorías, fundamentos y operaciones humanas. | Describen contratos; no son ejecutables. |

### Las cuatro capas ejecutables

`scripts/` no es la única carpeta con código que corre, y las otras tres se
disparan solas. Confundirlas es lo que hace que un cambio parezca inocuo y no
lo sea:

| Capa | Quién la dispara | Costo de invocación |
| --- | --- | --- |
| `scripts/**` | El Owner o un prompt, explícitamente. | Visible: hay un comando. |
| `.github/scripts/**` | El harness, por evento. Nadie la escribe en un prompt. | Invisible: corre en cada turno que matchee. |
| `.specify/scripts/bash/**` | Los prompts `speckit.*`, durante el ciclo Spec-Kit. | Visible, pero pertenece a código de terceros. |
| `aoi_apps/.../server/**` | El runtime Nuxt, sólo en perfil `dashboard`. | Proceso aparte, fuera del ciclo SDD. |

La segunda capa es la que **ejecuta el ahorro de tokens**, y por eso tiene su
propia sección más abajo. Un lector que sólo conozca `scripts/` cree que RTK e
ICM son convenciones que los prompts recuerdan aplicar; en realidad son hooks
que el harness dispara sin intervención del modelo.

## Catálogo de scripts ejecutables

Los nombres de la columna *módulos* son el catálogo de implementaciones: cada
uno puede localizarse de forma exacta con `git ls-files scripts/` o, dentro de
su frontera, mediante el grafo Codebase.

**Sobre los tests, con precisión.** Conviven DOS convenciones y hay que saberlo
antes de buscar un archivo. La mayoría de los tests son pares `*.test.mjs` de un
módulo homónimo, pero una parte sustancial son suites nombradas **por contrato o
preocupación** y no tienen módulo del mismo nombre: `installer-write-policy`,
`zero-input-verdicts`, `gate-exit-codes`, `cli-surface`, `harness-bands`,
`doctor-verdicts`, `doctor-verdict-rules`, `doctor-state-checks` y varias más.
Asumir la regla de pares lleva a buscar implementaciones que no existen. Para
ver la partición real en la revisión que se inspeccione:

```text
git ls-files 'scripts/**' | grep -v '\.test\.mjs$'   # módulos
git ls-files 'scripts/**' | grep    '\.test\.mjs$'   # suites
```

| Área | Módulos | Contrato observable |
| --- | --- | --- |
| Diagnóstico y rutas | `aoi-doctor`, `doctor-checks`, `memoir-naming-guard`, `archify-path`, `archify-checks` | Evalúan la salud AOI, la nomenclatura de conceptos y la disponibilidad/ruta de Archify. |
| Perfiles de instalación | `installation-profiles` | Resuelve y normaliza `core`/`advanced`/`dashboard`; lo importan paridad, merge de scripts y el comando de dashboard. |
| Instalación de auxiliares | `install-archify.{sh,ps1}`, `install-codebase-memory.{sh,ps1}`, `install-headroom.{sh,ps1}`, `headroom-vscode-setup.{sh,ps1}`, `nvidia-vscode-setup.{sh,ps1}`, `aoi-headroom-wrap.{sh,ps1}` | Resuelven binarios y configuración de entorno; su éxito depende del SO, PATH, red y herramientas externas. |
| Lente de código | `code-lens/{code-scanner,ast-skeletonizer,interaction-graph,determinism-classifier}` | Escaneo léxico compartido, reducción de cuerpos, y derivación del grafo de invocación y del mapa de determinismo. |
| Configuración de instalación | `conf/{snapshot-conf.sh,compare-install.sh,generate-checksums.sh,ensure-cbmignore}` | Snapshot, checksums, comparación de cambios del Owner y bloque administrado de `.cbmignore`. |
| MCP gateway | `mcp-gateway/setup-mcp-gateway` | Genera/valida el envoltorio de servidores MCP configurados. |
| Memoria versionada | `memory-sync/{cli-args,icm-scope-loaders,library-only,prepare-version-manifest,resolve-active-version,activate-version,rollback-version,export-memory-bundle,import-memory-bundle,schema,store-utils}` | Prepara y valida manifests, resuelve el puntero activo y serializa bundles con integridad. |
| Multi-harness | `multi-harness/{protocol-source,compile-rules,merge-package-scripts,install-hooks,reference-integrity,token-tool-coverage,validate-agent-routing,audit-protocol-integrity,importance-consistency,cache-guard,undocumented-commands,claims-evidence-ledger,dashboard-command}` | Compila reglas desde fuente única, fusiona scripts, instala hooks, audita evidencia de claims y aplica coherencia entre harnesses. |
| Sandbox | `sandbox/{workspace-globs,detect-base-project,write-base-project,manifest-schema,validate-manifest,generate-manifest-md}` | Detecta raíces del proyecto base y valida el contrato de integración de un sandbox. |
| Calidad y réplica | `scaffold/{validate-scaffold-parity,validate-test-globs,validate-srp,source-reachability,mutation-ratchet,mutation-probe,failure-injection,fake-icm}` | Comprueba paridad, alcance de tests, responsabilidad, alcanzabilidad y resistencia a mutaciones. |
| SDD — contexto | `sdd-lifecycle/{workspace-identity,registry-sync,assemble-phase-context,context-arranger,context-budget,contract-facts,phase-references,phase-handoffs,link-resources,instruction-scope,sdd-phases}` | Resuelve workspace/tarea, limita contexto, acota el alcance de instrucciones inyectadas y mantiene handoffs. |
| SDD — gates | `sdd-lifecycle/{invariant-gate,invariant-gate-preconditions,blueprint-gate,mechanical-verify-union,test-reachability,diagnostic-distiller}` | Hace cumplir BIC/SBC, alcance de pruebas y consolidación de fallos sin evaluador LLM. |
| SDD — medición y probes | `sdd-lifecycle/{behavioral-runner,behavioral-probes,behavioral-judge,behavioral-coverage,behavioral-scenarios,behavioral-scenarios-entry,behavioral-scenarios-execution,behavioral-scenarios-genesis,benchmark-inputs,real-corpus,stress-fixtures,sdd-stress-suite,stress-report,token-accounting,cache-prefix}` | Ejecuta escenarios, mide cobertura/tokens y produce reportes de stress con procedencia. |
| SDD — generación | `sdd-lifecycle/{genesis-phase,blueprint-diagram,synthesize-stubs}` | Materializa el flujo Genesis/diagramas y stubs RED desde artefactos estructurados. |
| Runtime espaciotemporal | `spatiotemporal-runtime/{effect-tracker,fiber-lifecycle,coeffect-resolver,agent-hmr-engine}` | Registra efectos reversibles, coordina fibras y coeffects, y carga módulos de forma transaccional. |
| Contexto de subagentes | `subagent-context/{sanitize-subagent-payload,context-tombstone,subagent-fiber-runner,toon-serializer}` | Reduce y aísla payloads, compacta turnos superados y ejecuta subagentes en una fibra. |

### Definiciones y contratos que gobiernan esos scripts

| Archivo o familia | Define |
| --- | --- |
| `package.json`, `pnpm-workspace.yaml` | El root es un script runner privado; el dashboard tiene su propio paquete y lockfile. |
| `.specify/memory/constitution.md` | Constitución global, propiedad de artefactos, calidad, SDD y versionado de memoria. |
| `.specify/memory/versions/{active.json,templates/*}` | Puntero activo y esquemas de artefactos de memoria inmutables una vez activados. |
| `.github/prompts/*.prompt.md` | Protocolo de entrada, planificación, implementación, verificación y archivo. |
| `.github/agents/*.agent.md` | Responsabilidades y herramientas de los roles especializados vigentes. |
| `.github/instructions/*.instructions.md` y `.agents/skills/*/SKILL.md` | Reglas derivadas de ICM, RTK, SDD, memoria y Spec-Kit. |
| `.github/hooks/*.json` | **Fuente única** de los hooks del harness; `.claude/settings.json` es su compilado. |
| `.githooks/pre-commit-aoi-guard.sh` y `.github/workflows/aoi-gate.yml` | Protección local de superficie gestionada y ejecución CI de test, mutación y build. |
| `.resources/constitution.md`, `.tasks/registry.md`, `.sandboxes/*/integration-manifest.json` | Fronteras de recursos, estado de tarea y migraciones aisladas. |
| `aoi_apps/.../shared/{types,relations,token-observability}.ts` | Esquemas Zod y tipos compartidos entre UI y API del dashboard. |

---

# El flujo exacto

Todo lo que sigue está derivado del árbol, no redactado. Las fuentes son
`docs/internal/architecture/aoi-interaction-graph.json` y
`aoi-determinism-map.json`, regenerables con:

```text
pnpm aoi:graph            # grafo completo en JSON
pnpm aoi:graph --hubs     # módulos por fan-out
pnpm aoi:graph --cycles   # ciclos de import
pnpm aoi:determinism      # clase de determinismo por archivo
pnpm aoi:determinism --summary
```

La extracción es léxica: ve la arista escrita en el texto. Un `import()`
dinámico armado con una variable no aparece, y es una limitación declarada.

## Capa 1 — Hooks del harness: lo que corre sin que nadie lo pida

Ésta es la capa que materializa el ahorro de tokens, y la que no se ve en
ningún prompt. El flujo tiene tres tramos:

```text
.github/hooks/*.json          →  scripts/multi-harness/install-hooks.mjs  →  .claude/settings.json
(declaración, fuente única)      (compilador)                                (configuración efectiva)
```

`install-hooks.mjs` traduce cada declaración al formato del harness y agrega el
`matcher` que corresponde al evento. `pnpm aoi:hooks --audit` verifica que cada
declaración llegue a la configuración de un harness. La cadena resultante, con
su orden de ejecución —que no es decorativo—:

| Evento | Orden de ejecución | Declarado en | Timeout |
| --- | --- | --- | --- |
| `SessionStart` | `icm-hook.sh start` → `session-init-hook.sh` | `icm.json`, `session-init.json` | 10s · 15s |
| `PreToolUse` (Bash) | `icm-hook.sh pre` → **`rtk-hook.sh`** | `icm.json`, `rtk-rewrite.json` | 5s · 5s |
| `PostToolUse` (Bash) | `icm-hook.sh post` → `post-tool-learning-hook.sh` | `icm.json`, `post-tool-learning.json` | 10s · 15s |
| `UserPromptSubmit` | `icm-hook.sh prompt` | `icm.json` | 10s |
| `Stop` | `session-close-hook.sh` | `session-close.json` | — |

El orden dentro de `PreToolUse` es el mecanismo: la memoria se consulta **antes**
de que RTK reescriba el comando. Invertirlo cambiaría qué se persiste. Por eso
el extractor conserva la posición del array y no la normaliza.

## Capa 2 — Prompt → script: el ciclo SDD

Cada prompt del ciclo declara qué ejecuta. Estas son las aristas reales, no una
descripción de intenciones:

| Prompt | Scripts que invoca | Herramientas externas | Delega en |
| --- | --- | --- | --- |
| `/init` | `compile-rules`, `detect-base-project`, `write-base-project`, `aoi-doctor` | `icm facts`, `icm learn`, `icm briefing` | supervisor y el catálogo completo de agentes |
| `/sdd-genesis` | `blueprint-gate` | `icm wake-up`, `icm facts` | supervisor, triage-specialist |
| `/sdd-frame` | — | `icm wake-up`, `icm facts` | supervisor, triage-specialist |
| `/sdd-new` | `context-arranger`, `link-resources`, `registry-sync` | `icm wake-up`, `icm facts`, `rtk rg` | supervisor, functional-analyst |
| `/sdd-ff` | — | `icm facts` | supervisor, functional-analyst, solution-architect |
| `/sdd-apply` | `ast-skeletonizer`, `synthesize-stubs`, `context-tombstone`, `sanitize-subagent-payload`, `aoi-doctor` | `icm facts` | supervisor, backend/frontend-developer, devops-engineer |
| `/sdd-verify` | `mechanical-verify-union`, `invariant-gate`, `blueprint-gate`, `validate-manifest`, `diagnostic-distiller`, `aoi-doctor`, `sanitize-subagent-payload` | `rtk proxy`, `pnpm test`, `pnpm aoi:test-globs` | supervisor, integration-specialist |
| `/sdd-archive` | — | `icm memoir`, `icm extract-patterns`, `icm facts`, `icm briefing` | supervisor, documentation-analyst |

Los prompts de recursos y memoria (`export-memory-bundle`,
`import-memory-bundle`, `rollback-workspace-memory`, `sync-workspace-memory`)
convergen todos en `memory-sync/resolve-active-version.mjs`: el puntero activo
es el único árbitro del estado de memoria. `sandbox-new` invoca
`validate-manifest` y `generate-manifest-md`.

## Capa 3 — Módulo → módulo: dónde está el acoplamiento real

Las áreas del catálogo son una ayuda de lectura, **no son módulos**. El grafo de
imports cruza esas fronteras y eso es lo que hay que conocer antes de tocar un
archivo. Los puntos de integración por fan-out:

| Módulo | Importa | Lo que significa |
| --- | --- | --- |
| `sdd-lifecycle/sdd-stress-suite` | 14 módulos de 4 áreas | Es el hub real del sistema: integra code-lens, subagent-context, los gates y la contabilidad de tokens. Cualquier cambio de firma en esas áreas llega acá. |
| `sdd-lifecycle/context-budget` | 5 | Núcleo del presupuesto de contexto. |
| `sdd-lifecycle/stress-report` | 5 | Consolida medición de tokens, handoffs y prefijo de caché. |
| `sdd-lifecycle/cache-prefix` | 4 | Cruza a `multi-harness/cache-guard`. |
| `sdd-lifecycle/assemble-phase-context` | 4 | Base de `context-budget` y `behavioral-probes`. |

Aristas que contradicen la taxonomía por carpetas y conviene tener presentes:

- `scaffold/validate-srp` → `sdd-lifecycle/mechanical-verify-union`
  (*Calidad* depende de *SDD gates*).
- `sdd-lifecycle/test-reachability` → `scaffold/validate-test-globs`
  (*SDD gates* depende de *Calidad*).
- `multi-harness/dashboard-command` y `scaffold/validate-scaffold-parity` →
  `installation-profiles` (el resolutor de perfiles es transversal).
- `subagent-context/subagent-fiber-runner` → `spatiotemporal-runtime/{fiber-lifecycle,coeffect-resolver}`
  y `sanitize-subagent-payload` → `toon-serializer`. Ésta es la cadena completa
  del aislamiento de subagentes.

**Ciclo de imports declarado.** `sdd-lifecycle/genesis-phase` importa de
`sdd-lifecycle/blueprint-gate`, y `blueprint-gate` reexporta `runGenesisPhase`
desde `genesis-phase`. ESM lo resuelve, pero es una dependencia mutua real: el
orden de evaluación importa si alguna de las dos pasa a ejecutar trabajo en el
cuerpo del módulo. `pnpm aoi:graph --cycles` lo reporta.

## Capa 4 — Comando → compuerta: qué significa "verificar"

`pnpm test` no es un comando: es una **cadena secuencial de 26 pasos** donde el
primero que falla detiene el resto. El orden es deliberado — las compuertas
estructurales baratas corren antes que las suites caras:

```text
1  aoi:test-globs      →  todo glob declarado resuelve a algún archivo
2  aoi:srp             →  ningún archivo nuevo supera 300 LOC
3  aoi:reachability    →  toda fuente se alcanza desde un test
4  aoi:routing         →  todo agente resuelve a modelo, fallback y definición
5  aoi:handoffs        →  todo artefacto exigido lo produce una fase anterior
6  aoi:cache-prefix    →  la masa repetida no muta durante el ciclo
7  aoi:tools           →  toda herramienta obligatoria se invoca en el ciclo
8  aoi:hooks --audit   →  toda declaración llega a un harness
9  aoi:registry        →  el registry y el disco declaran las mismas tareas
10 test:parity         →  paridad byte a byte del espejo scaffold/
11-20 suites por área  →  doctor · multi-harness · sandbox · memory-sync
                          subagent-payload · conf · sdd-lifecycle
                          spatiotemporal · mcp-gateway · code-lens
21 aoi:cache-guard     →  integridad del prefijo de caché
22 aoi:lint-refs       →  toda referencia narrativa resuelve
23 aoi:audit-protocol  →  integridad del protocolo de fuente única
24 aoi:claims          →  todo claim público tiene evidencia clasificada
25 aoi:importance      →  consistencia de `importance` contra el protocolo ICM
26 test:dashboard      →  suite de la aplicación Nuxt
```

CI (`.github/workflows/aoi-gate.yml`) agrega después de `pnpm test` el
**mutation ratchet** y el build: la cobertura no puede aflojarse entre commits.

El resto de los comandos son emisores o compuertas puntuales invocables a mano:
`aoi:doctor`, `aoi:graph`, `aoi:determinism`, `aoi:ast-lens`, `aoi:mutation`,
`aoi:invariant-gate`, `aoi:blueprint-gate`, `aoi:stress-sdd`, `aoi:context`,
`aoi:probes`, `aoi:archify`, `aoi:sync-rules`, y la familia `*:dashboard`.

## Capa 5 — Fases del instalador

`setup.sh` son ~2.200 líneas con 13 fases que se imprimen en pantalla. La
secuencia real, extraída de sus llamadas a `header`:

| # | Fase | Notas |
| --- | --- | --- |
| 1 | `AOI → $PROJECT_NAME` | Resolución de target y perfil. |
| 2 | Phase 1: Tools | RTK e ICM, ambas obligatorias. |
| 3 | Phase 1.5: NVIDIA customendpoint | Opcional, no bloqueante. |
| 4 | Phase 1.6: Headroom compression layer | Opcional — la única capa que puede faltar. |
| 5 | Phase 1.7: AOI Headroom integration | Obligatorio: wrapper y guard de archivos gestionados. |
| 6 | Phase 1.8: Codebase Memory MCP | Sólo perfil Advanced/Dashboard, workspace-local. |
| 7 | Phase 2: Spec-Kit | Inicialización, con foto previa del árbol. |
| 8 | Phase 3: Agentic Infrastructure | Copia del scaffold, merge inteligente, chequeo de integridad post-merge. |
| 9 | Phase 4: Tool Configuration | Configuración de harnesses y MCP. |
| 10 | Phase 5: ICM Bootstrap | Persistencia del contexto inicial. |
| 11 | Phase 6: Base-Project Map | Sólo pre-seed. |
| 12 | Phase 7: Configuration Snapshot | `.conf/` para comparar en la reinstalación. |
| 13 | `Installation Complete` | — |

La indexación de Codebase Memory ocurre **después** de materializar el
workspace, no en la fase 1.8: ésa sólo instala el proveedor.

## Flujos principales, con su ejecutor

| Flujo | Inicio → evidencia | Ejecutor principal |
| --- | --- | --- |
| Instalación | Owner selecciona perfil y target → 13 fases → indexación diferida si el perfil la requiere. | `setup.sh` / `setup.ps1`, `scripts/conf/`, `installation-profiles` |
| Índices Codebase | Workspace materializado → `ensure-cbmignore` delimita control-plane → perfil Dashboard agrega raíz Nuxt separada → trabajos secuenciales en background. | `setup.*`, `conf/ensure-cbmignore`, `codebase-memory-mcp` |
| Reinstalación | Snapshot anterior + scaffold actual + árbol del Owner → checksum/merge o conflicto explícito. | `scripts/conf/*`, `setup.*` |
| Desinstalación | Evidencia de autoría AOI → remoción selectiva → restauración de hook. | `teardown.*` |
| SDD | Necesidad → Genesis/Frame/New → aprobación → spec/diseño/tasks → TDD → gates → cierre → ICM. | Prompts, agentes y `scripts/sdd-lifecycle/` |
| Verificación | Tests + Service Discovery + Invariant/Blueprint/Sandbox gates + doctor → PASS/FAIL explícito. | `invariant-gate`, `blueprint-gate`, `validate-manifest`, `aoi-doctor` |
| Memoria | Facts/Memoirs/Memories → `resolve-active-version` → bundle export/import o rollback. | `scripts/memory-sync/`, ICM CLI |
| Subagentes | Payload → `sanitize-subagent-payload` → `toon-serializer` → `subagent-fiber-runner` → fibra/effect tracker → resultado o recuperación `Γ`. | `subagent-context/`, `spatiotemporal-runtime/` |
| Observabilidad | Workspace filesystem y logs → snapshot/API/SSE → dashboard. | `aoi_apps/agentic-ops-dashboard/` |
| CI | Checkout → dependencias dashboard bloqueadas → `pnpm test` (26 pasos) + mutation ratchet + build. | `.github/workflows/aoi-gate.yml` |

## Dashboard auxiliar

El dashboard se divide en cuatro capas:

1. `app/components/`, `pages/index.vue`, composables y utilidades renderizan
   tablero de tareas, ICM, facts, fibras, doctor, recursos y observabilidad.
2. `server/api/` expone rutas de workspace, tareas, doctor, fibers, memoria,
   recursos y token observability.
3. `server/utils/` resuelve raíz, construye snapshots, observa filesystem con
   `chokidar`, parsea el registro, opera directorios de `.resources/` y parsea
   logs de Copilot.
4. `shared/` fija el contrato entre las capas. Las operaciones de recursos
   contienen defensas de ruta/symlink y una cuarentena antes de borrado.

El dashboard **no es solamente de lectura**: `resources/{create,move,delete}`
y `token-observability/config` mutan un workspace ya seleccionado. Por ello sus
tests de escape de sandbox, operaciones de recursos y contratos de ruta son
parte del límite de seguridad, no simple UI.

## Matriz de determinismo

“Determinista” significa mismo resultado para las mismas entradas observables,
misma versión de dependencias y mismo entorno de ejecución. No significa que
el sistema ignore cambios externos.

La clasificación **por archivo** vive en `aoi-determinism-map.json` y se deriva
con `pnpm aoi:determinism`. La regla de agregación es que gana la señal más
no-determinista presente: un módulo que lee el filesystem y además consulta
`process.env` se clasifica por el entorno, porque el entorno lo puede mover sin
que cambie un byte del árbol.

| Clase | Frontera | Ejemplos |
| --- | --- | --- |
| Puro/mecánico | Igual entrada textual ⇒ igual veredicto o transformación. | validadores de schema, `code-scanner`, parsers, unión de sets, serializadores TOON |
| Determinista sobre estado fijado | Lógica reproducible, pero observa archivos, symlinks, permisos y procesos existentes. | doctor, invariant/blueprint gates, `detect-base-project`, paridad, `interaction-graph` |
| Stateful con tiempo o azar | La estructura se valida mecánicamente, pero timestamps y orden de eventos impiden que la salida sea byte-idéntica. | `prepare-version-manifest`, `activate-version`, fibers/HMR |
| Proceso / entorno externo | Depende de PATH, variables de entorno y binarios instalados fuera del repo. | instaladores, wrappers de harness, cualquier `execSync` |
| Red / dependencias | Versiones, disponibilidad y contenido descargado no pertenecen al árbol AOI. | instaladores upstream, releases de GitHub, `pnpm install` |
| Decisión humana o LLM | AOI conserva artefactos y exige evidencia posterior, pero no hace determinista la inferencia ni la voluntad del Owner. | necesidad, aclaración, generación de spec/diseño/código, aprobaciones |

Advertencia de alcance: el clasificador ve la superficie que un archivo **toca**,
no la que alcanza a través de sus dependencias. Un módulo puro que importa uno
que lee el filesystem se reporta como puro; la transitividad se lee cruzándolo
con el grafo de imports. Las dos últimas clases no tienen archivos asignados
porque no son propiedades de un módulo: son propiedades de una interacción.

La regla arquitectónica es: **no delegar a un LLM la decisión que puede ser un
veredicto mecánico**. Los gates convierten un estado externo ya observado en
PASS, FAIL, BLOCKED o SKIPPED de forma repetible. No convierten en determinista
la disponibilidad de ese estado ni el contenido producido por un modelo.

## Diagramas y artefactos derivados

| Artefacto | Propósito | Estado |
| --- | --- | --- |
| `aoi-architecture.html` | Componentes, ownership, instalación, scaffold, runtime, SDD, ICM, CI y dashboard. | 9/9 showcase; browser en 4 viewports; revisión visual aprobada. |
| `aoi-sdd-lifecycle-compact.html` | Flujo SDD, gates humanos/LLM, TDD, gates mecánicos e ICM. | 9/9 showcase; browser en 4 viewports; revisión visual aprobada. |
| `aoi-interaction-flow.html` | El flujo exacto: hooks por evento, prompt→script, hubs de import, cadena de 26 compuertas y fases del instalador. | Derivado de `aoi-interaction-graph.json`. |
| `aoi-interaction-graph.json` | Grafo de invocación completo. | Generado por `pnpm aoi:graph`. |
| `aoi-determinism-map.json` | Clase de determinismo por archivo, con las señales que fundan cada veredicto. | Generado por `pnpm aoi:determinism`. |

Las especificaciones JSON adyacentes a los HTML son las fuentes de los diagramas.
Los HTML son autocontenidos e incluyen búsqueda, foco, vistas guiadas, tema y
exportación.

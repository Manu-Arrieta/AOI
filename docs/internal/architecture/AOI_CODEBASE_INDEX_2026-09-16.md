# Índice de código y arquitectura de AOI

**Corte arquitectónico:** 2026-09-16 · **Repositorio:** `Manu-Arrieta/AOI`

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
su bloque administrado. La precedencia de gitignore hace que el bloque final
mantenga excluidos `scaffold/` y `aoi_apps/` aun ante una negación anterior; en
Dashboard hace lo mismo con `.output/`. El resultado se refleja en `scaffold/`
antes de indexar, por lo que la paridad describe el workspace realmente usado.

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

## Catálogo de scripts ejecutables

Los tests son pares `*.test.mjs` de los módulos de esta tabla, con pruebas
separadas para el dashboard. Los nombres de la columna *módulos* son el
catálogo de implementaciones: cada uno puede localizarse de forma exacta con
`git ls-files scripts/` o, dentro de su frontera, mediante el grafo Codebase.

| Área | Módulos | Contrato observable |
| --- | --- | --- |
| Diagnóstico y rutas | `aoi-doctor`, `doctor-checks`, `doctor-state-checks`, `doctor-verdicts`, `doctor-verdict-rules`, `memoir-naming-guard`, `archify-path`, `archify-checks` | Evalúan la salud AOI, la nomenclatura de conceptos y la disponibilidad/ruta de Archify. |
| Instalación de auxiliares | `install-archify.{sh,ps1}`, `install-codebase-memory.{sh,ps1}`, `install-headroom.{sh,ps1}`, `headroom-vscode-setup.{sh,ps1}`, `nvidia-vscode-setup.{sh,ps1}`, `aoi-headroom-wrap.{sh,ps1}` | Resuelven binarios y configuración de entorno; su éxito depende del SO, PATH, red y herramientas externas. |
| Lente de código | `code-lens/code-scanner`, `code-lens/ast-skeletonizer` | Escaneo léxico compartido y reducción de cuerpos sin plegar imports, formas o contratos de tipo. |
| Configuración de instalación | `conf/snapshot-conf.sh`, `conf/compare-install.sh`, `conf/generate-checksums.sh` | Snapshot, checksums y comparación de cambios del Owner durante reinstalación. |
| MCP gateway | `mcp-gateway/setup-mcp-gateway` | Genera/valida el envoltorio de servidores MCP configurados. |
| Memoria versionada | `memory-sync/{cli-args,icm-scope-loaders,library-only,prepare-version-manifest,resolve-active-version,activate-version,rollback-version,export-memory-bundle,import-memory-bundle,schema,store-utils}` | Prepara y valida manifests, resuelve el puntero activo y serializa bundles con integridad. |
| Multi-harness | `multi-harness/{protocol-source,compile-rules,merge-package-scripts,install-hooks,reference-integrity,token-tool-coverage,validate-agent-routing,audit-protocol-integrity,importance-consistency,cache-guard,undocumented-commands}` | Compila reglas desde fuente única, fusiona scripts, instala hooks y aplica coherencia entre harnesses. |
| Sandbox | `sandbox/{workspace-globs,detect-base-project,write-base-project,manifest-schema,validate-manifest,generate-manifest-md}` | Detecta raíces del proyecto base y valida el contrato de integración de un sandbox. |
| Calidad y réplica | `scaffold/{validate-scaffold-parity,validate-test-globs,validate-srp,source-reachability,mutation-ratchet,mutation-probe,failure-injection,fake-icm}` | Comprueba paridad, alcance de tests, responsabilidad, alcanzabilidad y resistencia a mutaciones. |
| SDD — contexto | `sdd-lifecycle/{workspace-identity,registry-sync,assemble-phase-context,context-arranger,context-budget,contract-facts,phase-references,phase-handoffs,link-resources}` | Resuelve workspace/tarea, limita contexto, enlaza recursos explícitos y mantiene handoffs. |
| SDD — gates | `sdd-lifecycle/{invariant-gate,invariant-gate-preconditions,blueprint-gate,mechanical-verify-union,test-reachability,diagnostic-distiller}` | Hace cumplir BIC/SBC, alcance de pruebas y consolidación de fallos sin evaluador LLM. |
| SDD — medición y probes | `sdd-lifecycle/{behavioral-runner,behavioral-probes,behavioral-judge,behavioral-coverage,behavioral-scenarios*,benchmark-inputs,real-corpus,sdd-stress-suite,stress-report,token-accounting,cache-prefix}` | Ejecuta escenarios, mide cobertura/tokens y produce reportes de stress con procedencia. |
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
| `.githooks/pre-commit-aoi-guard.sh` y `.github/workflows/aoi-gate.yml` | Protección local de superficie gestionada y ejecución CI de test, mutación y build. |
| `.resources/constitution.md`, `.tasks/registry.md`, `.sandboxes/*/integration-manifest.json` | Fronteras de recursos, estado de tarea y migraciones aisladas. |
| `aoi_apps/.../shared/{types,relations,token-observability}.ts` | Esquemas Zod y tipos compartidos entre UI y API del dashboard. |

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

## Flujos principales

| Flujo | Inicio → evidencia | Ejecutor principal |
| --- | --- | --- |
| Instalación | Owner selecciona perfil y target → setup resuelve herramientas/config → merge seguro → scaffold y configuraciones gobernadas → indexación diferida si el perfil la requiere. | `setup.sh` / `setup.ps1` y `scripts/conf/`. |
| Índices Codebase | Workspace ya materializado → `.cbmignore` delimita control-plane → perfil Dashboard agrega raíz Nuxt separada → trabajos secuenciales en background. | `setup.sh` / `setup.ps1`, `.cbmignore`, `codebase-memory-mcp`. |
| Reinstalación | Snapshot anterior + scaffold actual + árbol del Owner → checksum/merge o conflicto explícito. | `scripts/conf/*`, `setup.*`. |
| Desinstalación | Evidencia de autoría AOI → remoción selectiva → restauración de hook. | `teardown.*`. |
| SDD | Necesidad → entrada Genesis/Frame/New → aprobación → spec/diseño/tasks → TDD → gates → decisión de cierre → ICM. | Prompts, agentes y `scripts/sdd-lifecycle/`. |
| Verificación | Tests + Service Discovery + Invariant/Blueprint/Sandbox gates + doctor → PASS/FAIL explícito. | `invariant-gate`, `blueprint-gate`, `validate-manifest`, `aoi-doctor`. |
| Memoria | Facts/Memoirs/Memories → manifest activo → bundle export/import o rollback bajo contrato. | `scripts/memory-sync/` e ICM CLI. |
| Subagentes | Payload aislado → fibra/effect tracker → resultado o recuperación `Γ`. | `scripts/subagent-context/` y `spatiotemporal-runtime/`. |
| Observabilidad | Workspace filesystem y logs → snapshot/API/SSE → dashboard. | `aoi_apps/agentic-ops-dashboard/`. |
| CI | Checkout → dependencias dashboard bloqueadas → `pnpm test` + mutation ratchet + build. | `.github/workflows/aoi-gate.yml`. |

## Matriz de determinismo

“Determinista” significa mismo resultado para las mismas entradas observables,
misma versión de dependencias y mismo entorno de ejecución. No significa que
el sistema ignore cambios externos.

| Clase | Ejemplos | Resultado y frontera |
| --- | --- | --- |
| Puro/mecánico | validadores de schema, `code-scanner`, parsers, unión de sets, test-globs, paridad, rutas de memoria, serializadores TOON | Igual entrada textual/JSON/árbol fijado ⇒ igual veredicto o transformación. |
| Determinista sobre estado fijado | doctor, invariant/blueprint gates, detect-base-project, snapshot de workspace, resource path guards, mutation selection | La lógica es reproducible, pero observa archivos, symlinks, permisos, versiones y procesos existentes. |
| Stateful con tiempo | `prepare-version-manifest`, `activate-version`, fibers/HMR y registros con `new Date()` | La estructura se valida mecánicamente, pero timestamps y el orden de eventos hacen que la salida no sea byte-idéntica entre corridas. |
| Proceso/entorno externo | `process.env`, `PATH`, `git`, `icm`, `pnpm`, `specify`, `headroom`, Codebase Memory, watchers y comandos de SO | `.cbmignore` fija la frontera solicitada; la disponibilidad, la respuesta y el contenido resultante del grafo siguen siendo variables externas. |
| Red/dependencias | instaladores upstream, GitHub releases, `pnpm install`, información remota de herramientas | Versiones, disponibilidad y contenido descargado no pertenecen al árbol AOI. |
| Decisión humana o LLM | necesidad, aclaración, generación de spec/diseño/tareas/código, aprobaciones de gates | AOI conserva artefactos y exige evidencia posterior, pero no hace determinista la inferencia ni la voluntad del Owner. |

La regla arquitectónica es: **no delegar a un LLM la decisión que puede ser un
veredicto mecánico**. Los gates convierten un estado externo ya observado en
PASS, FAIL, BLOCKED o SKIPPED de forma repetible. No convierten en determinista
la disponibilidad de ese estado ni el contenido producido por un modelo.

## Diagramas entregados

| Artefacto | Propósito | Estado |
| --- | --- | --- |
| `aoi-architecture.html` | Componentes, ownership, instalación, scaffold, runtime, SDD, ICM, CI y dashboard. | 9/9 showcase; browser en 4 viewports; revisión visual aprobada. |
| `aoi-sdd-lifecycle-compact.html` | Flujo SDD, gates humanos/LLM, TDD, gates mecánicos e ICM. | 9/9 showcase; browser en 4 viewports; revisión visual aprobada. |
| `aoi-sdd-lifecycle.html` | Primera composición detallada del ciclo. | Receipt determinista válido, pero browser detectó scroll vertical; se conserva como diagnóstico, no como entrega principal. |

Las especificaciones JSON adyacentes son las fuentes de los diagramas. Los HTML
son autocontenidos e incluyen búsqueda, foco, vistas guiadas, tema y exportación.

# AOI — Infraestructura Operativa Agéntica

Instala un ecosistema agéntico completo en cualquier proyecto: **RTK**
(optimización de tokens) + **ICM** (memoria persistente) + **Spec-Kit**
(ciclo de vida SDD) + **11 agentes especializados** sincronizados entre
Copilot y Antigravity.

## Inicio Rápido

### macOS / Linux

```bash
bash "/path/to/AOI/setup.sh" /path/to/my-project
```

### Windows 11+ (PowerShell)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\setup.ps1" "C:\path\to\my-project"
```

### Windows 11+ (Git Bash)

```bash
bash "/c/path/to/AOI/setup.sh" "/c/path/to/my-project"
```

Luego, en el chat de Copilot dentro de VS Code:

```text
/init # Configura el stack del proyecto, los agentes y la constitución
/sdd-new # Inicia la primera feature
```

## Onboarding

Podés usar AOI de dos maneras:

1. **Instalar AOI dentro de otro proyecto**
  Ejecutás `setup.sh` o `setup.ps1` y apuntás al repositorio destino que querés bootstrapear con el stack de AOI.
2. **Trabajar sobre AOI mismo**
  Abrís este repositorio, instalás las dependencias del workspace y usás el dashboard interno junto con los prompts SDD para evolucionar la plantilla.

Prerrequisitos mínimos antes de la primera ejecución:

- Node `>=20.19.0`
- `corepack` o `pnpm >=11.3.0`
- `icm`
- GitHub Copilot en VS Code

Primera sesión recomendada dentro de este repositorio:

1. Abrí el repositorio en VS Code.
2. Ejecutá `pnpm install` o `corepack pnpm install`.
3. Levantá el dashboard con `pnpm dev:dashboard`.
4. Abrí Copilot Chat y corré `/speckit.constitution` si vas a preparar una nueva instalación downstream.
5. Iniciá el primer flujo con `/sdd-new`.

El repositorio público de AOI arranca limpio: los registries de tareas están vacíos, no hay sandboxes activas y la memoria versionada todavía no tiene ningún workspace activo registrado.

Artefactos de release y validación:

- [docs/releases/v0.1.0.es.md](docs/releases/v0.1.0.es.md) — notas de la primera baseline pública de la plantilla.
- [docs/verification/external-smoke-plan.es.md](docs/verification/external-smoke-plan.es.md) — checklist externa para validar AOI como repo y bootstrapper.

## Qué Se Instala

### Herramientas (en orden de prioridad)

| Herramienta     | Propósito                           | macOS / Linux                             | Windows 11+                                                  |
| --------------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| **RTK**         | Optimización de tokens (60-90%)     | `brew install rtk`                        | Binario desde GitHub Releases vía `setup.ps1`                |
| **ICM**         | Memoria persistente (4 métodos)     | `brew tap rtk-ai/tap && brew install icm` | `install.ps1` oficial vía `setup.ps1`                        |
| **Specify CLI** | Ciclo de vida de Spec-Driven Development | `uv tool install specify-cli`         | `winget install --id astral-sh.uv -e` + `uv tool install ...` |

En Windows, AOI usa `winget` para `uv` cuando está disponible. RTK no
documenta por ahora un paquete oficial para `winget`, así que `setup.ps1`
instala directamente el binario de Windows.

`ICM` es obligatorio: el setup ahora falla si no puede verificar un comando `icm` operativo. `RTK` sigue siendo recomendado pero no bloqueante: si su instalación falla, AOI continúa y los hooks dejan pasar los comandos sin filtrar hasta que `rtk` vuelva a estar disponible.

El runtime del dashboard también es obligatorio. El setup ya no saltea su bootstrap: ahora falla si antes de instalar dependencias no tiene Node `>=20.19.0` y `corepack` o `pnpm@11.3.0` disponibles.

### Scaffold (copiado a tu proyecto)

```text
.vscode/
├── settings.json # Configuración de terminal del workspace para resolver herramientas
└── mcp.json # Registro MCP local de ICM para el workspace

.resources/
├── constitution.md # Contrato local del subárbol de recursos
├── userstories/ # Contexto reutilizable de historias de usuario
└── workflows/ # Definiciones de interacción entre componentes (no ejecutables)

.github/
├── agents/ # 11 definiciones de agentes de Copilot
│   ├── supervisor.agent.md # Orquestador SDD (Hub-and-Spoke)
│   ├── functional-analyst.agent.md
│   ├── solution-architect.agent.md
│   ├── frontend-developer.agent.md
│   ├── backend-developer.agent.md
│   ├── devops-engineer.agent.md
│   ├── ux-designer.agent.md
│   ├── documentation-analyst.agent.md
│   ├── integration-specialist.agent.md
│   ├── project-analyzer.agent.md
│   └── project-expert.agent.md
├── prompts/ # Comandos del flujo SDD
│   ├── init.prompt.md # /init — asistente de configuración del proyecto
│   ├── sdd-new.prompt.md # /sdd-new — exploración + especificación
│   ├── sdd-ff.prompt.md # /sdd-ff — plan + tareas
│   ├── sdd-apply.prompt.md # /sdd-apply — implementación
│   ├── sdd-verify.prompt.md # /sdd-verify — QA
│   ├── sdd-archive.prompt.md # /sdd-archive — cierre
│   ├── export-memory-bundle.prompt.md # /export-memory-bundle — exportación portable gobernada de memoria
│   ├── import-memory-bundle.prompt.md # /import-memory-bundle — importación de bundle hacia candidata
│   ├── sync-workspace-memory.prompt.md # /sync-workspace-memory — importación gobernada de memoria
│   └── rollback-workspace-memory.prompt.md # /rollback-workspace-memory — restauración de la versión previa
└── instructions/ # Reglas siempre cargadas
  ├── icm-protocol.instructions.md # Cumplimiento ICM de 4 métodos
    ├── dual-sync.instructions.md # Sincronización Copilot ↔ Antigravity
    └── model-selection.instructions.md # Política obligatoria de selección de modelo

GEMINI.md # Instrucciones raíz de Antigravity
.agent/skills/
├── _shared/icm-protocol.md # Convención ICM compartida
├── _shared/model-selection.md # Política obligatoria de selección de modelo
└── agents/ # 11 espejos de agentes para Antigravity
```

## Ciclo de Vida SDD

Construido sobre [spec-kit](https://github.com/github/spec-kit). Nuestros
prompts orquestan comandos de spec-kit con asignación de agentes y
persistencia en ICM.

```text
/sdd-new → Explorar + Especificar → @functional-analyst
↓
/sdd-ff → Plan + Tareas → @solution-architect
↓
/sdd-apply → Implementar (por lotes) → @frontend/@backend/@devops
↓
/sdd-verify → QA + Validación → @integration-specialist
↓
/sdd-archive → Documentación + Cierre → @documentation-analyst
```

Cada fase tiene una **puerta de aprobación del Owner** antes de avanzar.

## Subsistema Opcional de Recursos

AOI ahora instala un subárbol gobernado `.resources/` para contexto
reutilizable:

```text
.resources/
├── constitution.md
├── userstories/
└── workflows/
```

- `userstories/` almacena contexto reutilizable para la construcción de tareas.
- `workflows/` almacena definiciones de interacción entre componentes en una o
  varias historias de usuario. Estos archivos **no son comandos ejecutables**.
- Los workflows SDD **no** leen `.resources/` automáticamente. Un recurso solo
  se usa si el Owner lo vincula explícitamente durante la construcción de una
  tarea.

La estructura se gobierna mediante:

- autoridad raíz: `.specify/memory/constitution.md`
- contrato local del subárbol: `.resources/constitution.md`

Comandos administrativos:

- `/new-resource-folder` — crea una carpeta gobernada dentro de `.resources/`
- `/move-resource-folder` — mueve una carpeta gobernada dentro de `.resources/`
- `/delete-resource-folder` — elimina una carpeta gobernada dentro de `.resources/`

## Runtime Interno del Dashboard

AOI ahora aprovisiona un workspace interno en Nuxt para visibilidad
operativa del proyecto en tiempo real.

Superficies del runtime:

```text
package.json
pnpm-workspace.yaml
aoi_apps/agentic-ops-dashboard/
scaffold/aoi_apps/agentic-ops-dashboard/
```

- El dashboard lee `.tasks/registry.md`, los directorios de artefactos de
  tareas y el subárbol opcional `.resources/` como snapshot autoritativo del
  workspace.
- Los vínculos explícitos entre tareas y recursos se guardan junto a los
  artefactos en `.tasks/{feature}/TASK-YYYY-NNN/relations.json`.
- Las escrituras del servidor quedan limitadas a mutaciones gobernadas dentro
  de `.resources/`.
- La shell del dashboard expone un selector visible de inglés/español y guarda
  la preferencia localmente para restaurarla al recargar.
- La traducción es sólo de presentación: los IDs de tareas, los valores del
  registro y los previews crudos de artefactos se mantienen tal como vienen del
  repositorio.
- Los cambios en tiempo real preservan el contexto del tablero: las cards
  modificadas se resaltan y los cambios de estado se animan entre columnas sin
  dar sensación de refresco completo.

Comandos del workspace:

- `pnpm dev:dashboard` — corre el dashboard interno localmente
- `pnpm test:dashboard` — ejecuta la suite de validación del dashboard
- `pnpm prepare:dashboard` — genera los tipos de Nuxt para el runtime
- `pnpm build:dashboard` — compila el dashboard para chequeos de smoke

## Gobernanza de Memoria Versionada

AOI ahora aprovisiona un version store gobernado para el estado operativo de
la memoria:

```text
.exportsmemories/
└── *.memory-bundle.json.gz

.specify/memory/versions/
├── README.md
├── active.json
├── manifests/
│   └── {workspace}/
├── constitutions/
│   └── {workspace}/
└── templates/
    ├── memory-version.template.json
    ├── memory-bundle.template.json
    └── dynamic-constitution.template.md
```

- `.exportsmemories/` es la carpeta base gobernada, local al repositorio, para
  bundles portables de memoria exportados.
- `active.json` es el puntero canónico hacia la versión activa y la versión
  inmediatamente restaurable por workspace.
- Cada manifest registra `sourceWorkspace`, `sourceVersionId`, scopes
  seleccionados, contexto del Owner y decisiones `retain` / `complement` /
  `discard`.
- Los manifests originados en bundle también preservan `sourceTransport`, la
  procedencia del bundle, scopes incluidos y omitidos, e integridad declarada.
- Cada versión candidata o activa lleva su propio snapshot constitucional
  dinámico para auditoría y rollback seguro.

Workflows gobernados:

- `/export-memory-bundle` — exporta una versión explícita de memoria hacia un
  bundle portable gobernado dentro de `.exportsmemories/`.
- `/import-memory-bundle` — valida un bundle portable y prepara una versión
  candidata gobernada antes de cualquier activación.
- `/sync-workspace-memory` — prepara una versión candidata desde un workspace y
  versión fuente explícitos, y sólo la activa después de la aprobación del
  Owner.
- `/rollback-workspace-memory` — restaura la versión previa registrada con un
  motivo explícito de rollback.

Superficie determinística de scripts:

- `scripts/memory-sync/resolve-active-version.mjs`
- `scripts/memory-sync/prepare-version-manifest.mjs`
- `scripts/memory-sync/export-memory-bundle.mjs`
- `scripts/memory-sync/import-memory-bundle.mjs`
- `scripts/memory-sync/activate-version.mjs`
- `scripts/memory-sync/rollback-version.mjs`
- `pnpm test:memory-sync` — valida el ciclo de vida versionado con Node tests
- `pnpm test:memory-sync:bundle` — valida el contrato bundle portable, el flujo
  de exportación/importación y la preservación del lifecycle

## ICM — 4 Métodos de Memoria

Todos los agentes usan [ICM](https://github.com/rtk-ai/icm) con cuatro métodos
complementarios:

| Método                        | Qué hace                         | Cuándo                                     |
| ---------------------------- | -------------------------------- | ------------------------------------------ |
| **Memories** (episódica)     | Guardar/recuperar con decaimiento temporal | En cada fase: decisiones, progreso y contexto |
| **Memoirs** (grafo de conocimiento) | Conceptos y relaciones permanentes | Decisiones de arquitectura, grafos de componentes |
| **Feedback** (correcciones)  | Aprender de errores              | Fase de Verify, post-implementación        |
| **Transcripts** (verbatim)   | Captura el replay crudo de la sesión | Fases de Explore y Archive              |

No se pierde contexto entre sesiones.

## Regla de Doble Sincronización

**OBLIGATORIO**: Cada agente/skill debe existir tanto en formato Copilot como
en Antigravity.

| Copilot                          | Antigravity                      |
| -------------------------------- | -------------------------------- |
| `.github/agents/{name}.agent.md` | `.agent/skills/agents/{name}.md` |

`dual-sync.instructions.md` hace cumplir esta regla automáticamente. Si los
agentes divergen, `/sdd-verify` falla.

## Notas para Windows

- La instalación nativa en Windows 11+ está soportada mediante `setup.ps1`.
- Si lanzás el setup desde Git Bash, ejecutá `setup.sh` con rutas de Git Bash como `/c/path/to/AOI/setup.sh`; el script delega a `setup.ps1` automáticamente.
- El instalador inyecta `terminal.integrated.env.windows.Path` en el workspace
  de destino para que `rtk`, `icm` y `specify` resuelvan desde las terminales
  de VS Code.
- AOI también reescribe hooks locales de Copilot para usar wrappers de
  PowerShell en Windows.
- RTK sigue recomendando WSL a nivel upstream para la compatibilidad más amplia
  de shell hooks entre herramientas, pero esta plantilla ahora ofrece un camino
  nativo con PowerShell para proyectos que usan GitHub Copilot.

## Teardown

```bash
# macOS / Linux
bash "/path/to/AOI/teardown.sh" /path/to/my-project
```

```powershell
# Windows 11+
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\teardown.ps1" "C:\path\to\my-project"
```

## Agentes

| Agente                        | Fase SDD                        | Archivo (Copilot)                  |
| ----------------------------- | ------------------------------- | ---------------------------------- |
| **@supervisor**               | Todas (orquestador)             | `supervisor.agent.md`              |
| **@functional-analyst**       | Explore, Specify                | `functional-analyst.agent.md`      |
| **@solution-architect**       | Plan, Tasks                     | `solution-architect.agent.md`      |
| **@frontend-developer**       | Implement                       | `frontend-developer.agent.md`      |
| **@backend-developer**        | Implement                       | `backend-developer.agent.md`       |
| **@devops-engineer**          | Implement                       | `devops-engineer.agent.md`         |
| **@ux-designer**              | Implement                       | `ux-designer.agent.md`             |
| **@documentation-analyst**    | Archive                         | `documentation-analyst.agent.md`   |
| **@integration-specialist**   | Verify                          | `integration-specialist.agent.md`  |
| **@triage-specialist**        | Bug y Definición — transversal  | `triage-specialist.agent.md`       |
| **@resource-analyst**         | Recursos — transversal          | `resource-analyst.agent.md`        |

---

**AOI v3.0** — Agentic Operational Infrastructure impulsada por RTK, ICM, Spec-Kit y agentes Hub-and-Spoke
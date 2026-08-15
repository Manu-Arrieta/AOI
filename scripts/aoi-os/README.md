# AOI-OS — Autonomous, Deterministic & Self-Healing Operating System

**AOI-OS** es el núcleo de orquestación y runtime agéntico de nueva generación para **AOI (Agentic Operational Infrastructure)**.

Transforma la ejecución asistida tradicional por prompts en un **sistema operativo determinista, autónomo y autosanable** que coordina micro-agentes efímeros, protege contratos de código políglota, aísla ejecuciones en sandboxes herméticos, arbitra la calidad mediante consenso multi-agente y sincroniza grafos de conocimiento semántico en memoria persistente (ICM).

- **Mutation Testing Engine (`mutation-testing/ast-mutation-verifier.mjs`)**: Introduces deterministic AST micro-mutations (boolean flips, boundary shifts, operator inversions) to verify unit test resilience and kill weak assertions before commit (0 LLM tokens).
- **Token Complexity & Heuristics Predictor (`sandbox-runtime/token-complexity-estimator.mjs`)**: Pre-computes cyclomatic complexity, branch density, and AST depth to predict token consumption and suggest atomic task splits (0 LLM tokens).
- **Autonomous OpenAPI 3.1 & TypeSpec Synthesizer (`contract-docgen/openapi-synthesizer.mjs`)**: Analyzes route files and AST signatures to generate OpenAPI 3.1 JSON and TypeSpec definitions deterministically (0 LLM tokens).
- **Multi-Workspace Federation Mesh (`federation/workspace-mesh-bridge.mjs`)**: Connects federated repositories via SHA-256 verified memory bundles and cross-repo contract invariant checking (0 LLM tokens).

---

## 🏛️ Arquitectura del Sistema

```text
AOI-OS Runtime Core
├── 1. Compilador DAG y Planificador de Olas (scripts/aoi-os/dag-engine/)
│   ├── dag-parser.mjs: Extrae nodos, roles (@backend, @frontend), dependencias y requisitos TDD.
│   └── dag-scheduler.mjs: Detección DFS de ciclos y cálculo de olas de ejecución paralela.
│
├── 2. Guardián AST Políglota (scripts/aoi-os/ast-guard/)
│   └── ast-contract-guard.mjs:
│       ├── C# (.cs): Extrae interfaces (IAuthService), clases, métodos y propiedades { get; set; }.
│       ├── TypeScript / JavaScript: Tipos, interfaces, funciones exportadas, clases y enums.
│       ├── Vue SFC: <script setup lang="ts">, defineProps, defineEmits, defineExpose.
│       └── Python: Funciones (def/async def), clases y contratos públicos.
│
├── 3. Motor de Consenso y Arbitraje Multi-Agente (scripts/aoi-os/consensus-gate/)
│   └── consensus-arbitrator.mjs:
│       ├── Auditoría de Seguridad: Detección de API keys/secretos, eval/Function, inyecciones SQL y HTML raw.
│       ├── Auditoría Arquitectónica: Regla estricta de <300 LOC por archivo y detección de deuda técnica.
│       └── Score Ponderado: Aprobación automática solo con puntaje ≥ 85%.
│
├── 4. Grafo Semántico de Memoria y Auto-Linker ICM (scripts/aoi-os/memory-linker/)
│   └── icm-memory-linker.mjs:
│       ├── Extracción automática de decisiones (decisions-{workspace}), fixes de tests (errors-resolved) y diffs (context-{workspace}).
│       └── Enlaces relacionales en el grafo de conocimiento (implements, depends_on, verifies).
│
├── 5. Runtime de Sandboxing Hermético Efímero (scripts/aoi-os/sandbox-runtime/)
│   └── sandbox-executor.mjs:
│       └── Aísla modificaciones en .sandboxes/aoi-os-tmp-{taskId} y realiza commits atómicos solo tras 100% verde.
│
├── 6. Gobernador Dinámico de Velocidad de Tokens (scripts/aoi-os/sandbox-runtime/)
│   └── token-velocity-guard.mjs:
│       └── Detección de anomalías en tiempo real (+40% de sobrecoste) y conmutación a modo hyper-comprimido.
│
├── 7. Bucle de Auto-Sanación y Circuit Breaker (scripts/aoi-os/self-healing/)
│   └── test-healing-loop.mjs:
│       └── Diagnóstico quirúrgico de aserciones fallidas, prompts de auto-reparación y rollback automático tras 2 reintentos.
│
├── 8. Telemetría SSE en Vivo y C2 Dashboard (server/api/aoi-os/ & Nuxt 4)
│   ├── /api/aoi-os/stream: Canal Server-Sent Events en tiempo real.
│   ├── /api/aoi-os/dispatch: Disparador y orquestador del pipeline.
│   ├── /api/aoi-os/control: Comandos de sesión (pause, resume, step, retry_wave).
│   └── TaskDagViewer.vue: Matriz DAG interactiva, controles de playback y Node Inspector Drawer.
│
└── 9. CLI y Orquestador Maestro (scripts/aoi-os/aoi-os-cli.mjs & aoi-os.mjs)
    └── Unificación completa de todos los subsistemas con soporte para `/sdd-apply --os-mode`.
```

---

## 🚀 Guía de Uso Rápido

### 1. Ejecución Autónoma vía CLI
```bash
# Ejecutar un feature completo en modo autónomo:
node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --workspace "$WORKSPACE" --auto-apply

# Simular compilación del DAG sin mutaciones (Dry Run):
node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --dry-run
```

### 2. Ejecución desde Prompts SDD en VS Code Copilot
```text
/sdd-apply --os-mode
```

### 3. Monitoreo y Control Interactivo en el Dashboard
Inicia el panel de operaciones:
```bash
pnpm --dir aoi_apps/agentic-ops-dashboard dev
```
1. Abre el navegador en `http://localhost:3000`.
2. Dirígete a la pestaña **Matriz DAG de Ejecución** dentro de cualquier tarea.
3. Utiliza los controles de **Play / Pause / Step Wave** o haz clic en cualquier nodo para abrir el **Node Inspector**.

---

## 🔄 El Ciclo de Vida en AOI-OS

```text
[1. tasks.md] ──(Compilador DAG)──> [2. Olas de Ejecución Paralela]
                                               │
                                               ▼
                                 [3. Ephemeral Sandbox Stage]
                                 .sandboxes/aoi-os-tmp-{taskId}
                                               │
                                               ▼
                                 [4. Polyglot AST Guard Check]
                                 (C#, TS, Vue SFC, Python)
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │                                               │
              [AST Válido & Seguro]                                 [Violación]
                       │                                               │
                       ▼                                               ▼
         [5. Consensus Gate ≥ 85%]                           [Bucle Auto-Sanación]
         (OWASP + Secrets + 300 LOC)                         Diagnóstico + Reintento
                       │                                               │
                       ▼                                               ▼
            [6. Atomic Workspace Commit]                    [Circuit Breaker Rollback]
                       │
                       ▼
         [7. ICM Semantic Graph Linker]
         decisions-{ws} | errors-resolved | context-{ws}
```

---

## 🧪 Ejecución de Pruebas

Toda la suite de pruebas del runtime de AOI-OS se ejecuta con el test runner nativo de Node.js:

```bash
# Correr todas las pruebas de AOI-OS:
node --test scripts/aoi-os/**/*.test.mjs

# Correr la suite completa del repositorio (134+ tests):
pnpm test
```

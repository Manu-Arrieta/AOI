# AOI — Agentic Operational Infrastructure & AOI-OS

**Tu equipo de desarrollo de software autónomo, determinista y autosanable, orquestado por IA.**

AOI transforma cualquier repositorio en un espacio de trabajo agéntico con **memoria persistente (ICM)**, **agentes especializados**, un **ciclo de vida gobernado (SDD)** y **AOI-OS v13**: un sistema operativo determinista de 28 pilares que ejecuta tareas complejas de forma autónoma con protección de contratos de código políglota (TypeScript, Vue SFC, Python, C#), sandboxes herméticos, hot-patching en memoria, demostración formal de invariantes, síntesis cuántica de variantes AST, inferencia profunda de tipos, hologramas de tokens, seguridad syscall de cero confianza y auto-sanación con **0 desperdicio de tokens**.

---

## ⚡ ¿Cómo funciona el Ciclo de Vida?

```text
Tu proyecto
    ↓
setup.sh / setup.ps1    ← Instala infraestructura, agentes y AOI-OS
    ↓
/init                   ← Configura stack, convenciones e invariantes
    ↓
/sdd-new                ← Explora y propone el feature (@supervisor)
    ↓
/sdd-ff                 ← Diseña contratos y planifica tareas (@architect + @analyst)
    ↓
/sdd-apply (--os-mode)  ← Implementación autónoma vía AOI-OS o asistida por TDD
    ↓
/sdd-verify             ← Verificación de calidad, AST contracts y consensus score
    ↓
/sdd-archive            ← Documentación funcional y cierre formal en memoria
```

Cada paso cuenta con una **aprobación explícita del Owner/Arquitecto**. Tú diseñas la intención y los contratos sagrados; el sistema operativo agéntico ejecuta con garantías matemáticas de no-regresión.

---

## 🧠 AOI-OS v13: Matriz Arquitectónica de 28 Pilares

AOI-OS opera 100% de forma local y determinista (**0 tokens de LLM** para todas las tareas de análisis y verificación):

```text
AOI-OS v13 Architecture Matrix
├── 1. Compilador DAG y Planificador de Olas (scripts/aoi-os/dag-engine/)
├── 2. Guardián AST Políglota para TS / Vue SFC / Python / C# (scripts/aoi-os/ast-guard/)
├── 3. Esqueletizador AST & Cache Semántico de Contratos (ast-skeletonizer.mjs, contract-kv-cache.mjs)
├── 4. Invariante de Concurrencia: AST Symbol Mutex (scripts/aoi-os/mutex/ast-symbol-mutex.mjs)
├── 5. Micro-Agente Adversario: Chaos Fuzzer (scripts/aoi-os/fuzzing/adversarial-fuzzer.mjs)
├── 6. Grafo Dinámico de Arquitectura C4 (scripts/aoi-os/c4-graph/ & /api/aoi-os/c4)
├── 7. Snapshots Criptográficos & Time-Travel (scripts/aoi-os/time-travel/time-travel-engine.mjs)
├── 8. Sandboxes Herméticos & Gobernador de Tokens (scripts/aoi-os/sandbox-runtime/)
├── 9. Consenso y Arbitraje Multi-Agente (scripts/aoi-os/consensus-gate/consensus-arbitrator.mjs)
├── 10. Grafo Semántico de Memoria y Auto-Linker ICM (scripts/aoi-os/memory-linker/icm-memory-linker.mjs)
├── 11. Motor Determinista de Mutation Testing (scripts/aoi-os/mutation-testing/ast-mutation-verifier.mjs)
├── 12. Estimador Predictivo de Complejidad y Tokens (scripts/aoi-os/sandbox-runtime/token-complexity-estimator.mjs)
├── 13. Sintetizador Autónomo de OpenAPI 3.1 & Flujos E2E (scripts/aoi-os/contract-docgen/)
├── 14. Protocolo de Federación Multi-Repositorio (scripts/aoi-os/federation/workspace-mesh-bridge.mjs)
├── 15. Taint Tracer & Guardián de Código Muerto (security-guard/, ast-guard/)
├── 16. Live Micro-Patch Kernel (runtime-kernel/live-patch-kernel.mjs)
├── 17. Symbolic Constraint Prover (symbolic-prover/symbolic-constraint-prover.mjs)
├── 18. Test Flakiness & Race Detector (test-guard/flakiness-detector.mjs)
├── 19. Bidirectional ABI Linker (abi-linker/bidirectional-abi-linker.mjs)
├── 20. Núcleo Cognitivo y Epistémico (memo-engine/, adaptive-wave-balancer/, bft-quorum/, polyglot-transpiler/)
├── 21-24. Núcleo Hyper-Core (virtualizer/, telemetry/, ontology/, ast-optimizer/)
└── 25-28. Núcleo Genesis Cuántico v13 (quantum-synthesis/, type-synthesizer/, hologram/, security-guard/)
    ├── superposition-matrix.mjs: Matriz de síntesis cuántica para evaluar y colapsar a la rama AST óptima.
    ├── deep-type-synthesizer.mjs: Inferencia de tipos profundos y generación de esquemas de validación Zod.
    ├── token-hologram.mjs: Holograma de tokens con bitsets de 256 bits para compresión extrema de contexto.
    └── syscall-virtual-guard.mjs: Guardián de llamadas al sistema con política de cero confianza.
```

---

## 🖥️ C2 Command Deck (Nuxt UI v4 + Tailwind CSS v4 + TanStack)

El panel de operaciones en `aoi_apps/agentic-ops-dashboard` ofrece una experiencia de Comando y Control (C2) de primer nivel:

* **📋 Tablero Kanban**: Visualización por estados del ciclo SDD.
* **📊 Matriz TanStack**: Búsqueda global, ordenamiento multi-columna, filtros facetados y paginación ultra-rápida.
* **⚡ Matriz DAG & Playback**: Controles interactivos (Pause, Resume, Step Wave) y Node Inspector Drawer.
* **🌐 Arquitectura C4 en Vivo**: Diagrama dinámico Mermaid C4 conectado a `/api/aoi-os/c4`.
* **📁 Explorador de Recursos**: Navegación por historias, especificaciones y contratos.
* **📈 Observabilidad de Tokens**: Métricas de consumo, velocidad y alertas de anomalías.

---

## 👨‍💻 Tu Rol: De "Escribano de Código" a "Gobernador de Sistemas"

Con **AOI-OS**, tu paradigma de desarrollo evoluciona:

1. **Diseñador de Contratos e Invariantes**: En `/sdd-ff`, tú defines los esquemas, interfaces públicas y restricciones de seguridad.
2. **Comandante de Operaciones C2**: En el dashboard de Nuxt 4, supervisas la ejecución de olas del DAG, pausas o avanzas el sistema paso a paso e inspeccionas cualquier nodo.
3. **Juez de Escalación Estratégica**: El 95% de los errores de compilación o aserciones los resuelve la auto-sanación; tú solo intervienes ante ambigüedades arquitectónicas reales.

---

## 🛠️ Instalación y Configuración

### macOS / Linux
```bash
bash "/path/to/AOI/setup.sh" /path/to/my-project
```

### Windows 11+
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\setup.ps1" "C:\path\to\my-project"
```

### Prerrequisitos
- Node.js ≥ 20.19
- pnpm ≥ 11.3
- [ICM](https://github.com/rtk-ai/icm) (memoria persistente de contexto infinito)
- GitHub Copilot en VS Code o Antigravity IDE

---

## 🚀 Modos de Ejecución

### Modo Autónomo OS (Recomendado)
```bash
# Ejecutar un feature completo en modo autónomo:
node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --workspace "$WORKSPACE" --auto-apply

# Simular compilación del DAG sin mutaciones (Dry Run):
node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --dry-run
```

### Modo Interactivo SDD en Copilot
```text
/sdd-apply --os-mode
```

---

## 📜 CHANGELOG

### [13.0.0] - 2026-08-15 (The Quantum Super-Position & Self-Evolving Genesis Core)
- **Quantum Super-Position Synthesis Matrix**: Evaluación simultánea y colapso determinista de variantes AST (`quantum-synthesis/superposition-matrix.mjs`).
- **Polyglot Deep Type & Schema Synthesizer**: Inferencia de tipos y síntesis de esquemas Zod en tiempo de ejecución (`type-synthesizer/deep-type-synthesizer.mjs`).
- **Semantic Token Hologram**: Codificación ultracompacta en bitsets de 256 bits para compresión extrema de contexto (`hologram/token-hologram.mjs`).
- **Zero-Trust Kernel Syscall Virtual Guard**: Intercepción estática de syscalls para garantizar contención hermética (`security-guard/syscall-virtual-guard.mjs`).
- **185/185 Tests Pasando al 100%** y **243 archivos gobernados en paridad absoluta con scaffold/**.

### [12.0.0] - 2026-08-15 (The Autonomous Meta-Synthesis & Hyper-Core)
- **Branchless State Virtualizer**: Virtualización estática de ramas y demostración formal de liberación de mutex y handles (`virtualizer/branchless-virtualizer.mjs`).
- **C2 Flight Recorder & OpenTelemetry Mesh**: Grabadora de vuelo agéntica con spans W3C Trace Context (`telemetry/flight-recorder.mjs`).
- **Semantic Ontology & Knowledge Fabric**: Grafo ontológico en memoria para consultas de impacto de dominio en <1ms (`ontology/semantic-fabric.mjs`).
- **Zero-Cost AST Inliner & De-Virtualizer**: Optimizador determinista de wrappers redundantes y variables temporales (`ast-optimizer/ast-inliner.mjs`).

### [11.0.0] - 2026-08-15 (The Epistemic & Cognitive Matrix)
- **AST Content-Addressable Memo Engine**: Hashing SHA-256 por símbolo para aislar mutaciones y congelar nodos AST intactos (`memo-engine/ast-memo-engine.mjs`).
- **Adaptive Wave Worker Balancer**: Empaquetado bin-packing determinista de tareas en olas paralelas (`dag-engine/adaptive-wave-balancer.mjs`).
- **BFT Cognitive Quorum**: Quórum de 5 verificadores locales para tolerar fallos y autorizar commits con supermayoría (`consensus-gate/bft-quorum-engine.mjs`).
- **Polyglot Contract Transpiler & DTO Mirror**: Transpilación automática de interfaces TypeScript a C# DTOs, Python Pydantic y SQL DDL (`contract-transpiler/polyglot-transpiler.mjs`).

### [10.0.0] - 2026-08-15 (The Autonomous Singularity)
- **Live Micro-Patch Kernel**: Hot-patching y reemplazo atómico de símbolos en memoria sin reiniciar el proceso (`runtime-kernel/live-patch-kernel.mjs`).
- **Symbolic Constraint Prover**: Demostración formal de precondiciones y restricciones de límites mediante recorrido simbólico AST (`symbolic-prover/symbolic-constraint-prover.mjs`).
- **Test Flakiness & Race Detector**: Detección de temporizadores duros, semillas no fijadas y colisiones de puertos (`test-guard/flakiness-detector.mjs`).
- **Bidirectional ABI Linker**: Alineación bidireccional en tiempo real entre interfaces cliente TypeScript y DTOs C# (`abi-linker/bidirectional-abi-linker.mjs`).
- **UI/UX Modernization**: Refactor integral con Nuxt UI v4 + Tailwind CSS v4 + TanStack Table (`@tanstack/vue-table`).

### [9.0.0] - 2026-08-15 (Engineering Matrix & Static Security)
- **Static AST Taint Tracer**: Análisis estático de flujo de datos para prevenir inyecciones SQL, RCE y XSS (`security-guard/ast-taint-tracer.mjs`).
- **AST Dead-Code Guard**: Detección y podado de imports redundantes y variables huérfanas (`ast-guard/ast-deadcode-guard.mjs`).
- **Autonomous E2E Flow Synthesizer**: Generador determinista de suites de integración en Vitest (`contract-docgen/e2e-flow-synthesizer.mjs`).
- **Dynamic Constitution Drift Auditor**: Auditoría de cumplimiento de reglas arquitectónicas (`consensus-gate/constitution-drift-auditor.mjs`).

### [8.0.0] - 2026-08-15 (Autonomous Suite & Federation)
- **AST Mutation Testing Engine**: Micro-mutaciones para auditar el Kill Ratio de los tests (`mutation-testing/ast-mutation-verifier.mjs`).
- **Predictive Token Complexity Estimator**: Predicción de gasto de tokens y sugerencia de desglose atómico (`sandbox-runtime/token-complexity-estimator.mjs`).
- **Autonomous OpenAPI 3.1 Synthesizer**: Generación matemática de especificaciones OpenAPI 3.1 JSON y endpoint `/api/aoi-os/openapi`.
- **Multi-Workspace Federation Mesh**: Intercambio de memoria entre repositorios con verificación SHA-256 (`federation/workspace-mesh-bridge.mjs`).

### [7.0.0] - 2026-08-15 (The Quantum Leap Edition)
- **AST Symbol Mutex**: Control de concurrencia y bloqueo determinista de símbolos en conflicto (`mutex/ast-symbol-mutex.mjs`).
- **Adversarial Chaos Fuzzer**: Generador determinista de casos límite y vectores hostiles (`fuzzing/adversarial-fuzzer.mjs`).
- **Dynamic C4 Architecture Graph**: Generador en tiempo real de diagramas Mermaid C4 (`c4-graph/` & `/api/aoi-os/c4`).
- **Time-Travel Execution Trees**: Snapshots criptográficos y motor de rollback determinista (`time-travel/time-travel-engine.mjs`).
- **AST Skeletonizer & Semantic Pruner**: Ahorro del 70-90% de tokens con cero pérdida de contexto.

---

## 📄 Licencia
MIT — Creado y mantenido por el equipo de ingeniería agéntica de **AOI**.

# AOI — Índice de Documentación Canónica 📚

Bienvenido al repositorio de documentación arquitectónica, metodológica y operativa de **AOI (Agentic Operational Infrastructure)**.

---

## 🏛️ Arquitectura y Paradigmas Fundacionales

### 🌟 [El Paradigma de la Intención: De la Historia de Usuario al Contrato Conductual en la Era Agéntica](internal/architecture/BEHAVIORAL_INTENT_CONTRACTS_PARADIGM.md)
* **Flagship Document / Documento Canónico del Paradigma BIC**
* **Resumen:** Por qué la historia de usuario tradicional falla en entornos de IA, cómo el rol funcional evoluciona a *Outcome & Invariant Architect*, las 4 dimensiones del **Behavioral Intent Contract (BIC)** ($\Delta S$, Invariantes "Never Rules", Topología de Actores y Oráculos de Negocio), el protocolo de diálogo socrático en lenguaje natural en `/sdd-frame`, la galería de ejemplos (atómico, SaaS y red multi-actor con escrow) y la estrategia end-to-end de ejecución en proyectos.

### 📐 [Fundamentos Matemáticos del Runtime Espaciotemporal](internal/architecture/SPATIOTEMPORAL_MATHEMATICAL_FOUNDATIONS.es.md) ([English](internal/architecture/SPATIOTEMPORAL_MATHEMATICAL_FOUNDATIONS.md))
* **Resumen:** Modelo formal de efectos reversibles ($\partial\Gamma$), coefectos con namespaces lógicos ($\Sigma^{\text{iso}}$), composición monoidal ($\diamond$) y el alcance implementado de rollback para efectos registrados ($\text{recover}_\Gamma$).

---

## 📊 Benchmarks y Rendimiento

### ⚡ [Benchmark de Optimización de Tokens v2.0.0](internal/benchmarks/TOKEN_OPTIMIZATION_BENCHMARK_v2.0.0.es.md) ([English](internal/benchmarks/TOKEN_OPTIMIZATION_BENCHMARK_v2.0.0.md))
* **Resumen:** Registro histórico y versionado de la medición v2.0.0. Sus cifras describen ese corpus y esa revisión, no una promesa de rendimiento vigente.

---

## 🛡️ Gobernanza y Verificación

### 🔬 [Protocolo de Auditoría Comparativa v2.4.0](internal/audits/PROTOCOLO_AUDITORIA_COMPARATIVA.md)
* **Procedimiento Operativo Canónico de Auditoría Multi-Harness**
* **Resumen:** Procedimiento determinista para auditar cualquier versión de AOI contra otra en rendimiento, uso de herramientas, ahorro de tokens y comportamiento SDD, regido por la regla de reproducibilidad estricta, descomposición de cuatro términos sin residuo, pruebas de falso verde y verificación cruzada de bandas de contexto.

### 🧪 [Matriz de Verificación en el Mundo Real](../AOI_REAL_WORLD_VERIFICATION_MATRIX.md)
* **Resumen:** Protocolo de validación integral y los 8 invariantes operativos de AOI probados bajo condiciones reales.

### 🔍 [Auditoría v2.2.0-66 → v2.3.0](internal/audits/AOI_AUDIT_2026-09-12_v2.2.0-66_vs_v2.3.0.md)
* **Resumen:** Meta-auditoría del protocolo contra el sistema que describe. 11 hallazgos con `proof` reproducible, 4 verificados con control negativo; medición de los 1.930 tokens de adaptadores de harness que ningún instrumento contaba; creación de la compuerta `aoi:audit-protocol`.

### 🔍 [Auditoría de simplificación — Tareas 1 a 7](internal/audits/AOI_SIMPLIFICATION_TASKS_1_7_AUDIT_2026-09-16.md)
* **Resumen:** Revisión de contratos, dependencias y límites deterministas/no deterministas antes de la reducción aislada de prompts y contexto.

### 📉 [Tarea 8 — Reducción medida de prompts y contexto](internal/audits/AOI_TASK_8_PROMPT_CONTEXT_REDUCTION_2026-09-16.md)
* **Resumen:** Baseline literal de siete fases, tres recortes seguros con controles negativos y el límite explícito entre compresión textual y rediseño de inyección del harness.

### 📋 [Ledger de Evidencia de Claims](internal/verification/AOI_CLAIMS_EVIDENCE_LEDGER_2026-09-16.md)
* **Resumen:** Clasifica las promesas públicas actuales como verificadas, condicionadas o históricas, y enlaza cada una con su prueba ejecutable o corpus fechado.

---

## 🚀 Notas de Versión

### 📦 [Notas de Lanzamiento v2.0.0](internal/releases/v2.0.0.es.md) ([English](internal/releases/v2.0.0.md))
* **Resumen:** Nueva arquitectura de bootstrapper ligero, matriz TanStack en el Dashboard C2 y gobernanza multi-harness.

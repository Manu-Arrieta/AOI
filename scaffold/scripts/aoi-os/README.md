# AOI-OS — Autonomous, Deterministic & Self-Healing Operating System

**AOI-OS v60 (The Grand Epistemic Bicentennial-Decade 216-Pillar Omnipresent Singularity & Universal Transcendence Master Core)** es el núcleo de orquestación y runtime agéntico de nueva generación para **AOI (Agentic Operational Infrastructure)**.

Transforma la ejecución asistida tradicional por prompts en un **sistema operativo determinista, autónomo y autosanable** que coordina micro-agentes efímeros, protege contratos de código políglota (TypeScript, Vue SFC, Python y C#), aísla ejecuciones en sandboxes herméticos, arbitra la calidad mediante consenso multi-agente y sincroniza grafos de conocimiento semántico en memoria persistente (ICM), con **MÁXIMA EFICIENCIA DE TOKENS (cómputo local determinista de alto rendimiento + síntesis agéntica ultra-densa)**.

- **Atomic File Watcher Debounce Guard (`storage-guard/file-watcher-debounce-guard.mjs`)**: Auditoría estática de watchers de sistema de archivos (`fs.watch`, `fs.watchFile`, `chokidar`) para certificar debouncing/throttling explícito y ganchos de cierre deterministas (`watcher.close()`), previniendo ráfagas de eventos duplicados y fugas de inodos (0 LLM tokens).
- **Dead TypeScript Exact Optional Properties Pruner (`config-guard/dead-tsconfig-exact-optional-pruner.mjs`)**: Podado estático de directivas redundantes `exactOptionalPropertyTypes: false` en `tsconfig.json` cuando `strict: false` o no está definido, eliminando flags muertas y promoviendo el tipado estricto canónico (0 LLM tokens).
- **Safe Cryptographic TLS SNI Guard (`security-guard/crypto-tls-sni-guard.mjs`)**: Auditoría estática de conexiones y sockets TLS (`tls.connect`, `https.request`) para garantizar la especificación explícita de `servername` (SNI según RFC 6066), evitando fallos de enrutamiento y ambigüedades de domain fronting (0 LLM tokens).
- **Sandbox Process Windows Path Prover (`sandbox-guard/sandbox-process-windows-path-prover.mjs`)**: Demostración formal de normalización canónica de rutas (`path.normalize()` / `path.resolve()`) en comandos y ejecutables de subprocesos en sandboxes para garantizar compatibilidad multiplataforma y cero errores `ENOENT` en Windows (0 LLM tokens).

---

## 🏛️ Matriz Arquitectónica Maestra de 216 Pilares (AOI-OS v60)

```text
AOI-OS v60 Architecture Matrix (216 Pillars)
├── 1. Compilador DAG y Planificador de Olas (scripts/aoi-os/dag-engine/)
│   ├── dag-parser.mjs: Extrae nodos, roles (@backend, @frontend, @devops), dependencias y requisitos TDD.
│   └── dag-scheduler.mjs: Detección DFS de ciclos y cálculo de olas de ejecución paralela.
│
├── 2. Guardián AST Políglota (scripts/aoi-os/ast-guard/)
│   ├── ast-contract-guard.mjs: Protege firmas e interfaces públicas en C# (.cs), TypeScript, Vue SFC y Python.
│   └── Clasificación de radio de impacto (Blast Radius: low / medium / critical).
│
├── 3. Esqueletizador AST & Cache Semántico de Contratos (ast-skeletonizer.mjs, contract-kv-cache.mjs)
│   ├── ast-skeletonizer.mjs: Reduce del 70% al 90% el consumo de tokens manteniendo 100% de imports y tipos.
│   └── contract-kv-cache.mjs: Deduplicación SHA-256 de contratos compartidos entre agentes.
│
├── 4. Invariante de Concurrencia: AST Symbol Mutex (scripts/aoi-os/mutex/)
│   └── ast-symbol-mutex.mjs: Bloqueo fino y serialización determinista de símbolos en colisión en la misma ola.
│
├── 5. Micro-Agente Adversario: Chaos Fuzzer (scripts/aoi-os/fuzzing/)
│   └── adversarial-fuzzer.mjs: Síntesis de vectores de prueba extremos (SQLi, XSS, buffers, NaN, Unicode).
│
├── 6. Grafo Dinámico de Arquitectura C4 (scripts/aoi-os/c4-graph/ & /api/aoi-os/c4)
│   └── c4-architecture-generator.mjs: Generación en tiempo real de diagramas Mermaid C4 (Container & Component).
│
├── 7. Snapshots Criptográficos & Time-Travel (scripts/aoi-os/time-travel/)
│   └── time-travel-engine.mjs: Registro de estados SHA-256 por ola y rollback instantáneo a cualquier punto.
│
├── 8. Sandboxes Herméticos & Gobernador de Tokens (scripts/aoi-os/sandbox-runtime/)
│   ├── sandbox-executor.mjs: Aislamiento en .sandboxes/aoi-os-tmp-{id} con commits atómicos.
│   └── token-velocity-guard.mjs: Detección de anomalías en consumo (+40%) y compresión adaptativa.
│
├── 9. Consenso y Arbitraje Multi-Agente (scripts/aoi-os/consensus-gate/)
│   └── consensus-arbitrator.mjs: Seguridad OWASP (cero secretos, cero eval), límite de 300 LOC y score ≥85%.
│
├── 10. Grafo Semántico de Memoria y Auto-Linker ICM (scripts/aoi-os/memory-linker/)
│   └── icm-memory-linker.mjs: Extracción automática de decisiones, errores resueltos y enlaces relacionales.
│
├── 11. Motor Determinista de Mutation Testing (scripts/aoi-os/mutation-testing/)
│   └── ast-mutation-verifier.mjs: Micro-mutaciones lógicas para verificar el kill-ratio de los tests.
│
├── 12. Estimador Predictivo de Complejidad y Tokens (scripts/aoi-os/sandbox-runtime/)
│   └── token-complexity-estimator.mjs: Cálculo ciclomático y predicción de presupuesto antes de la invocación.
│
├── 13. Sintetizador Autónomo de OpenAPI 3.1 & Flujos E2E (scripts/aoi-os/contract-docgen/)
│   ├── openapi-synthesizer.mjs: Generación matemática de especificaciones OpenAPI 3.1 y TypeSpec.
│   └── e2e-flow-synthesizer.mjs: Generación de suites de integración ejecutables en Vitest.
│
├── 14. Protocolo de Federación Multi-Repositorio (scripts/aoi-os/federation/)
│   └── workspace-mesh-bridge.mjs: Intercambio federado de memoria entre repositorios con verificación SHA-256.
│
├── 15. Taint Tracer & Guardián de Código Muerto (security-guard/, ast-guard/)
│   ├── ast-taint-tracer.mjs: Análisis estático de flujo de datos para prevenir inyecciones.
│   └── ast-deadcode-guard.mjs: Detección de imports no usados y variables huérfanas.
│
├── 16. Núcleo Live Micro-Patch (scripts/aoi-os/runtime-kernel/)
│   └── live-patch-kernel.mjs: Hot-patching y recarga de símbolos en memoria sin reiniciar el orquestador.
│
├── 17. Probador Simbólico de Restricciones (scripts/aoi-os/symbolic-prover/)
│   └── symbolic-constraint-prover.mjs: Demostración formal de invariantes matemáticos y precondiciones.
│
├── 18. Detector de Flakiness en Tests (scripts/aoi-os/test-guard/)
│   └── flakiness-detector.mjs: Detección y neutralización de temporizadores duros y fuentes no deterministas.
│
├── 19. Alineador Bidireccional de ABI (scripts/aoi-os/abi-linker/)
│   └── bidirectional-abi-linker.mjs: Alineación bidireccional en tiempo real entre interfaces TypeScript y DTOs C#.
│
├── 20. Núcleo Cognitivo y Epistémico (memo-engine/, adaptive-wave-balancer/, bft-quorum/, polyglot-transpiler/)
│   ├── ast-memo-engine.mjs: Hashing SHA-256 por símbolo para aislar mutaciones y congelar nodos AST intactos.
│   ├── adaptive-wave-balancer.mjs: Empaquetado bin-packing determinista de tareas en olas paralelas.
│   ├── bft-quorum-engine.mjs: Quórum bizantino de 5 verificadores locales para autorizar commits con supermayoría.
│   └── polyglot-transpiler.mjs: Transpilación automática de interfaces TypeScript a C# DTOs, Python Pydantic y SQL DDL.
│
├── 21-24. Núcleo Hyper-Core (virtualizer/, telemetry/, ontology/, ast-optimizer/)
│   ├── branchless-virtualizer.mjs: Virtualización de flujo de control y garantía estática de liberación de mutex.
│   ├── flight-recorder.mjs: Grabadora de vuelo con spans W3C OpenTelemetry para trazabilidad total.
│   ├── semantic-fabric.mjs: Tejido ontológico topológico para consultas de impacto de dominio en <1ms.
│   └── ast-inliner.mjs: Podado y optimización de wrappers y variables redundantes en AST.
│
├── 25-28. Núcleo Genesis Cuántico (quantum-synthesis/, type-synthesizer/, hologram/, security-guard/)
│   ├── superposition-matrix.mjs: Matriz de síntesis cuántica para evaluar y colapsar a la rama AST óptima.
│   ├── deep-type-synthesizer.mjs: Inferencia de tipos profundos y generación de esquemas de validación Zod.
│   ├── token-hologram.mjs: Holograma de tokens con bitsets de 256 bits para compresión extrema de contexto.
│   └── syscall-virtual-guard.mjs: Guardián de llamadas al sistema con política de cero confianza.
│
├── 29-32. Núcleo Omnisciente (dependency-solver/, event-sourcing/, benchmark/, axiom-reconciler/)
│   ├── polyglot-dependency-solver.mjs: Auditoría y resolución determinista de dependencias multi-lenguaje.
│   ├── event-sourcing-kernel.mjs: Kernel reactivo append-only para proyección y replay temporal de estados.
│   ├── micro-benchmark-suite.mjs: Medición de rendimiento y latencia para prevenir regresiones.
│   └── axiom-reconciler.mjs: Reconciliación de axiomas y auto-equilibrio de la constitución arquitectónica.
│
├── 33-36. Núcleo Holo-Genesis (ast-refactor/, db-migration/, convergence/, context-compactor/)
│   ├── self-refactoring-kernel.mjs: Descomposición matemática de funciones complejas en sub-funciones puras.
│   ├── migration-diff-synthesizer.mjs: Generación reversible de migraciones de base de datos (UP / DOWN).
│   ├── schema-convergence-prover.mjs: Demostración formal de convergencia e identidad de tipos políglotas.
│   └── micro-prompt-compactor.mjs: Compactación de contexto de ultra-alta densidad (90%+ de señal).
│
├── 37-40. Núcleo Omnipresente Singularity (zk-attestor/, diagnostics/, circular-neutralizer/, liquidity-balancer/)
│   ├── zk-epistemic-attestor.mjs: Árboles de Merkle criptográficos y atestaciones ZK de cumplimiento formal.
│   ├── root-cause-synthesizer.mjs: Clasificador de arquetipos de error y remediación dirigida de fallos.
│   ├── circular-dependency-neutralizer.mjs: Detección y desacoplamiento topológico de dependencias circulares.
│   └── token-liquidity-balancer.mjs: Balanceador dinámico de liquidez de tokens según complejidad agéntica.
│
├── 41-44. Núcleo Hyper-Omniscience (knowledge-mesh/, abi-broadcaster/, cache-optimizer/, sandbox-guard/)
│   ├── knowledge-mesh-reconciler.mjs: Sincronización de memoria ICM y auditoría de decisiones obsoletas.
│   ├── abi-wave-broadcaster.mjs: Difusor de olas de propagación transitiva de contratos en monorrepositorios.
│   ├── prefix-deduplication-engine.mjs: Motor de optimización de KV-cache y segregación de prefijos invariantes.
│   └── resource-exhaustion-prover.mjs: Demostración formal de hermeticidad y contención total de recursos.
│
├── 45-48. Núcleo Quantum Super-Matrix (game-engine/, asset-pruner/, speculative/, sbom/)
│   ├── epistemic-game-engine.mjs: Motor de Teoría de Juegos y Equilibrio de Nash para arbitraje agéntico.
│   ├── monorepo-dead-asset-pruner.mjs: Podador de activos y módulos zombie no alcanzados en el grafo.
│   ├── speculative-wave-pipeline.mjs: Pre-compilación especulativa de olas futuras para latencia cero.
│   └── deterministic-sbom-generator.mjs: Generador formal de SBOM CycloneDX con huella criptográfica SHA-256.
│
├── 49-52. Núcleo Transcendent Omni-Core (entropy-prover/, delta-compressor/, route-guard/, capability-guard/)
│   ├── epistemic-entropy-prover.mjs: Probador de entropía de Shannon y divergencia de conocimiento.
│   ├── delta-snapshot-compressor.mjs: Compresor delta incremental de snapshots con 90%+ de ahorro en memoria.
│   ├── api-collision-matrix.mjs: Matriz de detección estática de colisiones de rutas y parámetros en APIs.
│   └── capability-enforcer.mjs: Gobernador criptográfico de tokens de capacidad y confinamiento de agentes.
│
├── 53-56. Núcleo Grand Epistemic Master (bias-neutralizer/, nullability-guard/, density-maximizer/, sandbox-guard/)
│   ├── epistemic-bias-neutralizer.mjs: Neutralizador de sesgos cognitivos y depuración fáctica de aserciones.
│   ├── nullability-contract-guard.mjs: Guardián estático de nulabilidad y cero excepciones de desreferenciación.
│   ├── cognitive-density-maximizer.mjs: Maximizador de densidad cognitiva y vectores de prompt (>95% SNR).
│   └── descriptor-sanitizer.mjs: Sanitizador formal de inodos, sockets y descriptores efímeros tras el sandbox.
│
├── 57-60. Núcleo Diamond Singularity (provenance/, export-guard/, throttle/, security-guard/)
│   ├── epistemic-provenance-chain.mjs: Cadena criptográfica SHA-256 de linaje y procedencia formal.
│   ├── export-leak-prover.mjs: Probador de límites de paquetes y cero importaciones profundas privadas.
│   ├── budget-auto-throttle.mjs: Regulador dinámico de velocidad de gasto y auto-ajuste de esqueletizado.
│   └── timing-leak-guard.mjs: Guardián contra ataques de canal lateral y comparación en tiempo constante.
│
├── 61-64. Núcleo Apex Infinity Kernel (ast-merge/, query-guard/, bundle-guard/, sandbox-guard/)
│   ├── semantic-merge-prover.mjs: Reconciliador semántico 3-way AST para fusiones paralelas sin conflictos.
│   ├── query-performance-guard.mjs: Guardián estático contra consultas N+1 y columnas de filtrado no indexadas.
│   ├── bundle-drift-verifier.mjs: Verificador de árbol de dependencias, tamaño de bundle y preservación de tree-shaking.
│   └── zombie-process-purger.mjs: Registro formal de subprocesos y purga atómica de PIDs residuales en sandbox.
│
├── 65-68. Núcleo Infinite Holo-Super-Matrix (test-guard/, payload-guard/, export-guard/, sandbox-guard/)
│   ├── mutation-invariant-prover.mjs: Demostración formal de aserciones e invariantes en tests.
│   ├── payload-drift-guard.mjs: Guardián de deriva y concordancia de cargas útiles HTTP frontend/backend.
│   ├── barrel-export-neutralizer.mjs: Neutralizador de re-exportaciones comodín en índices barril.
│   └── file-permission-prover.mjs: Probador de máscaras y permisos de mínimo privilegio en archivos del sandbox.
│
├── 69-72. Núcleo Omniscient Quantum Matrix (async-guard/, schema-guard/, memory-guard/, sandbox-guard/)
│   ├── promise-cascade-guard.mjs: Guardián contra bucles infinitos de microtareas y cascadas asíncronas.
│   ├── schema-sunset-sentinel.mjs: Centinela estático de campos obsoletos y migración de esquemas API.
│   ├── heap-allocation-prover.mjs: Probador estático de alocación de memoria y prevención de OOM en heap.
│   └── egress-interceptor.mjs: Interceptor criptográfico de egress y aislamiento de red en sandbox.
│
├── 73-76. Núcleo Absolute Omniverse Kernel (dependency-solver/, security-guard/, css-guard/, sandbox-guard/)
│   ├── peer-dependency-guard.mjs: Guardián de convergencia de peer-dependencies en monorrepositorios.
│   ├── redos-vulnerability-prover.mjs: Probador estático de expresiones regulares contra vulnerabilidades ReDoS.
│   ├── css-token-guard.mjs: Guardián de tokens de diseño y variables CSS en el frontend.
│   └── handle-leak-prover.mjs: Probador de cierre hermético de descriptores y file handles en sandboxes.
│
├── 77-80. Núcleo Sovereign Singularity Matrix (env-guard/, config-guard/, route-guard/, sandbox-guard/)
│   ├── env-secret-prover.mjs: Auditoría estática de conformidad de variables .env y prevención de fugas de secretos.
│   ├── structural-config-guard.mjs: Validación y demostración formal de integridad estructural AST para JSON/YAML.
│   ├── dead-route-pruner.mjs: Podado estático de endpoints API huérfanos y no alcanzados en el monorrepositorio.
│   └── signal-teardown-prover.mjs: Demostración formal de captura y manejo limpio de señales OS en sandboxes.
│
├── 81-84. Núcleo Supreme Infinite Singularity Matrix (dependency-solver/, security-guard/, component-guard/, sandbox-guard/)
│   ├── lockfile-divergence-prover.mjs: Auditoría estática de versiones unificadas de dependencias críticas en lockfiles.
│   ├── http-header-guard.mjs: Demostración formal de cabeceras de seguridad y políticas CORS sin comodines con credenciales.
│   ├── dead-component-pruner.mjs: Podado estático de componentes Vue no renderizados en plantillas y rutas.
│   └── pipe-cleanup-prover.mjs: Demostración formal de cierre y desvinculación de sockets de dominio y FIFOs IPC en sandboxes.
│
├── 85-88. Núcleo Absolute Universal Omniverse Matrix (stream-guard/, type-guard/, security-guard/, sandbox-guard/)
│   ├── stream-teardown-prover.mjs: Demostración formal de listeners de aborto y limpieza de intervalos en SSE y WebSockets.
│   ├── dead-type-pruner.mjs: Podado estático de interfaces y tipos TypeScript/C# huérfanos o no alcanzados.
│   ├── sql-injection-guard.mjs: Auditoría estática contra interpolación de cadenas y concatenación dinámica en consultas SQL.
│   └── sandbox-path-escape-prover.mjs: Demostración formal de confinamiento estricto de rutas de archivos en sandboxes efímeros.
│
├── 89-92. Núcleo Transcendent Omnipresent Singularity Matrix (cache-guard/, enum-guard/, security-guard/, sandbox-guard/)
│   ├── cache-invalidation-guard.mjs: Demostración formal de directivas de invalidación de caché en endpoints HTTP de mutación.
│   ├── dead-enum-pruner.mjs: Podado estático de enumeraciones y constantes exportadas no alcanzadas en el monorrepositorio.
│   ├── path-traversal-guard.mjs: Auditoría estática contra lecturas de archivos sin sanitizar ni normalizar en disco.
│   └── subprocess-drain-prover.mjs: Demostración formal de drenaje de streams y prevención de deadlocks de I/O en subprocesos.
│
├── 93-96. Núcleo Supreme Infinite Singularity Matrix (security-guard/, export-guard/, component-guard/, sandbox-guard/)
│   ├── rate-limit-guard.mjs: Demostración formal de protección de tasa de peticiones y defensa anti-DoS en endpoints públicos.
│   ├── dead-export-package-pruner.mjs: Podado estático de sub-módulos y entrypoints exportados en package.json no alcanzados.
│   ├── hydration-mismatch-guard.mjs: Auditoría estática de determinismo en componentes Vue SFC para prevenir desajustes SSR.
│   └── sandbox-temp-cleanup-prover.mjs: Demostración formal de desvinculación recursiva de directorios temporales en sandboxes.
│
├── 97-100. Núcleo Centurial 100-Pillar Omnipresent Master Engine (stream-guard/, type-guard/, security-guard/, sandbox-guard/)
│   ├── websocket-heartbeat-guard.mjs: Demostración formal de limpieza de temporizadores de heartbeat en WebSockets.
│   ├── dead-type-alias-pruner.mjs: Podado estático de alias de tipos TypeScript y parámetros genéricos no alcanzados.
│   ├── content-type-guard.mjs: Auditoría estática de validación de esquemas y deserialización segura de cargas útiles HTTP.
│   └── sandbox-socket-unbind-prover.mjs: Demostración formal de cierre y desvinculación de sockets TCP/HTTP en teardown.
│
├── 101-104. Núcleo Sovereign 104-Pillar Infinite Singularity Matrix (db-guard/, i18n-guard/, security-guard/, sandbox-guard/)
│   ├── db-pool-drain-prover.mjs: Demostración formal de cierre y drenaje de pools de conexión a bases de datos en teardown.
│   ├── dead-i18n-pruner.mjs: Podado estático de claves de traducción y diccionarios de internacionalización no alcanzados.
│   ├── jwt-expiration-guard.mjs: Auditoría estática de firmas JWT para garantizar políticas de expiración acotadas.
│   └── sandbox-symlink-escape-prover.mjs: Demostración formal de confinamiento estricto de enlaces simbólicos en sandbox.
│
├── 105-108. Núcleo Transcendent 108-Pillar Genesis Core (telemetry/, env-guard/, security-guard/, sandbox-guard/)
│   ├── span-lifecycle-guard.mjs: Demostración formal de cierre y finalización de spans de telemetría OpenTelemetry en finally.
│   ├── dead-env-pruner.mjs: Podado estático de variables de entorno y flags de configuración no alcanzados en monorrepositorio.
│   ├── query-depth-guard.mjs: Auditoría estática de límites de profundidad de consultas GraphQL / REST contra ataques DoS.
│   └── sandbox-shm-cleanup-prover.mjs: Demostración formal de cierre de canales MessageChannel y descriptores IPC en teardown.
│
├── 109-112. Núcleo Absolute 112-Pillar Omniverse Matrix (runtime-kernel/, component-guard/, stream-guard/, sandbox-guard/)
│   ├── worker-termination-guard.mjs: Demostración formal de terminación y destrucción de hilos de trabajo Worker Threads.
│   ├── dead-store-pruner.mjs: Podado estático de propiedades reactivas huérfanas en stores Pinia/Vuex no alcanzadas.
│   ├── stream-backpressure-guard.mjs: Auditoría estática de flujos SSE y WebSockets para verificar contrapresión de búferes.
│   └── sandbox-privilege-escalation-prover.mjs: Demostración formal de prohibición de bits setuid/setgid en sandboxes.
│
├── 113-116. Núcleo Sovereign 116-Pillar Genesis Matrix (storage-guard/, css-guard/, test-guard/, sandbox-guard/)
│   ├── browser-storage-quota-guard.mjs: Auditoría estática de localStorage/IndexedDB contra QuotaExceededError.
│   ├── dead-css-class-pruner.mjs: Podado estático de clases y utilidades CSS huérfanas no alcanzadas en plantillas.
│   ├── port-collision-prover.mjs: Demostración formal de puertos efímeros dinámicos (server.listen(0)) contra colisiones EADDRINUSE.
│   └── sandbox-ulimit-prover.mjs: Demostración formal de concurrencia acotada de descriptores de archivos para prevenir EMFILE/ulimit.
│
├── 117-120. Núcleo Centurial 120-Pillar Genesis Master Matrix (db-guard/, package-guard/, security-guard/, sandbox-guard/)
│   ├── transaction-rollback-guard.mjs: Demostración formal de rollback garantizado en excepciones para transacciones de base de datos.
│   ├── dead-script-pruner.mjs: Podado estático de scripts y comandos npm huérfanos o no alcanzados en package.json.
│   ├── html-sanitization-guard.mjs: Auditoría estática de renderizado HTML dinámico (v-html, innerHTML) contra vulnerabilidades XSS.
│   └── sandbox-env-isolation-prover.mjs: Demostración formal de paso explícito y filtrado de variables env en subprocesos de sandbox.
│
├── 121-124. Núcleo Sovereign 124-Pillar Genesis Matrix (stream-guard/, doc-guard/, security-guard/, sandbox-guard/)
│   ├── http-timeout-guard.mjs: Auditoría estática de peticiones de red salientes para garantizar límites de tiempo o AbortSignal.
│   ├── dead-doc-link-pruner.mjs: Podado y validación estática de hipervínculos relativos y referencias cruzadas en markdown.
│   ├── regex-timeout-guard.mjs: Demostración formal de acotamiento de longitud en expresiones regulares dinámicas en runtime.
│   └── sandbox-coredump-prover.mjs: Demostración formal de desactivación de volcados de memoria (ulimit -c 0) en sandboxes.
│
├── 125-128. Núcleo Transcendent 128-Pillar Genesis Core (telemetry/, repo-guard/, security-guard/, sandbox-guard/)
│   ├── pii-masking-guard.mjs: Auditoría estática de telemetría y logs para enmascarar contraseñas, tokens y PII.
│   ├── dead-gitignore-pruner.mjs: Podado estático de reglas duplicadas y redundantes en el archivo .gitignore.
│   ├── crypto-algorithm-guard.mjs: Auditoría estática contra algoritmos criptográficos obsoletos (md5, sha1, des).
│   └── sandbox-rlimit-prover.mjs: Demostración formal de límites de CPU y memoria (ulimit -t) en subprocesos de sandbox.
│
├── 129-132. Núcleo Sovereign 132-Pillar Genesis Matrix (async-guard/, package-guard/, security-guard/, sandbox-guard/)
│   ├── unhandled-rejection-guard.mjs: Auditoría estática de puntos de entrada para garantizar ganchos unhandledRejection y uncaughtException.
│   ├── dead-workspace-package-pruner.mjs: Podado estático de paquetes y módulos huérfanos o no alcanzados en el monorrepositorio.
│   ├── crypto-random-guard.mjs: Auditoría estática contra generadores pseudo-aleatorios (Math.random()) en tokens/secretos.
│   └── sandbox-fd-cloexec-prover.mjs: Demostración formal de aislamiento estricto de descriptores de archivos (stdio array) en sandbox.
│
├── 133-136. Núcleo Transcendent 136-Pillar Genesis Core (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── atomic-file-write-guard.mjs: Auditoría estática de persistencia de archivos para garantizar escrituras atómicas en dos fases.
│   ├── dead-alias-pruner.mjs: Podado estático de alias de rutas huérfanos en tsconfig.json / vite.config.ts.
│   ├── regex-flag-guard.mjs: Auditoría estática de expresiones regulares de validación para garantizar flags Unicode (u / v).
│   └── sandbox-priority-prover.mjs: Demostración formal de prioridad y niceness de procesos (nice -n) en workers de sandbox.
│
├── 137-140. Núcleo Sovereign 140-Pillar Genesis Matrix (storage-guard/, export-guard/, security-guard/, sandbox-guard/)
│   ├── file-lock-lease-guard.mjs: Auditoría estática de bloqueos de archivo para garantizar detección de locks huérfanos y TTL.
│   ├── dead-barrel-duplicate-pruner.mjs: Podado estático de re-exportaciones redundantes y duplicados en índices barril.
│   ├── shell-quote-guard.mjs: Auditoría estática contra inyección de comandos shell mediante comillado y escape seguro.
│   └── sandbox-signal-trap-prover.mjs: Demostración formal de creación de grupos de procesos independientes y trampa de señales SIGTERM.
│
├── 141-144. Núcleo Transcendent 144-Pillar Genesis Core (storage-guard/, package-guard/, security-guard/, sandbox-guard/)
│   ├── file-umask-guard.mjs: Auditoría estática de creación de archivos sensibles para garantizar permisos POSIX restrictivos (0o600/0o700).
│   ├── dead-workspace-protocol-pruner.mjs: Podado estático de dependencias workspace:* huérfanas en monorrepositorio.
│   ├── crypto-kdf-guard.mjs: Auditoría estática de funciones KDF (PBKDF2/Scrypt) para certificar sales seguras e iteraciones OWASP.
│   └── sandbox-maxbuffer-prover.mjs: Demostración formal de cotas maxBuffer explícitas en subprocesos de sandbox contra desbordamientos.
│
├── 145-148. Núcleo Sovereign 148-Pillar Genesis Matrix (storage-guard/, package-guard/, security-guard/, sandbox-guard/)
│   ├── temp-file-collision-guard.mjs: Auditoría estática de nombres de archivos temporales para garantizar prefijos criptográficos CSPRNG.
│   ├── dead-script-hook-pruner.mjs: Podado estático de hooks de ciclo de vida huérfanos en package.json.
│   ├── crypto-cipher-mode-guard.mjs: Auditoría estática de cifrado simétrico para certificar modos AEAD/GCM y manejo de auth tag.
│   └── sandbox-ipc-payload-prover.mjs: Demostración formal de cotas de carga útil en mensajes IPC de sandbox contra caídas de serialización.
│
├── 149-152. Núcleo Transcendent 152-Pillar Genesis Core (storage-guard/, package-guard/, security-guard/, sandbox-guard/)
│   ├── directory-traversal-boundary-guard.mjs: Auditoría estática de resolución de rutas para garantizar anclaje canónico estricto (realpath).
│   ├── dead-package-export-condition-pruner.mjs: Podado estático de condiciones de exportación huérfanas en package.json.
│   ├── crypto-timing-safe-buffer-guard.mjs: Auditoría estática de verificación de firmas HMAC para certificar tiempo constante (timingSafeEqual).
│   └── sandbox-abort-controller-prover.mjs: Demostración formal de aceptación y manejo de AbortSignal en workers asíncronos de sandbox.
│
├── 153-156. Núcleo Sovereign 156-Pillar Genesis Matrix (storage-guard/, package-guard/, security-guard/, sandbox-guard/)
│   ├── hardlink-recursion-guard.mjs: Auditoría estática de recursión de directorios para garantizar seguimiento de inodos visitados.
│   ├── dead-package-bin-pruner.mjs: Podado estático de binarios CLI huérfanos en package.json.
│   ├── crypto-ec-curve-guard.mjs: Auditoría estática de curvas elípticas para garantizar curvas criptográficas robustas (prime256v1, ed25519).
│   └── sandbox-sri-integrity-prover.mjs: Demostración formal de validación de hashes criptográficos SRI en imports dinámicos en sandbox.
│
├── 157-160. Núcleo Transcendent 160-Pillar Genesis Core (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-chunk-boundary-guard.mjs: Auditoría estática de decodificación de chunks en streams para garantizar fronteras UTF-8 seguras (StringDecoder).
│   ├── dead-tsconfig-reference-pruner.mjs: Podado estático de referencias de proyecto huérfanas en tsconfig.json.
│   ├── crypto-tls-version-guard.mjs: Auditoría estática de sockets TLS y agentes HTTPS para garantizar versión mínima TLSv1.2 o TLSv1.3.
│   └── sandbox-stdio-flush-prover.mjs: Demostración formal de espera a cierre/drenaje completo de streams stdio en subprocesos de sandbox.
│
├── 161-164. Núcleo Sovereign 164-Pillar Genesis Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── temp-symlink-clash-guard.mjs: Auditoría estática de creación de enlaces simbólicos temporales para garantizar sufijos aleatorios y prevención de carreras TOCTOU.
│   ├── dead-tsconfig-include-pruner.mjs: Podado estático de patrones glob huérfanos en include de tsconfig.json.
│   ├── crypto-pbkdf2-digest-guard.mjs: Auditoría estática de digest en PBKDF2 para certificar uso exclusivo de SHA-2 (sha256/sha512).
│   └── sandbox-stdin-close-prover.mjs: Demostración formal de cierre determinista de child.stdin tras enviar payloads en sandbox.
│
├── 165-168. Núcleo Transcendent 168-Pillar Genesis Core (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── buffer-slice-bounds-guard.mjs: Auditoría estática de indexación y slicing en Buffers para garantizar validación explícita de límites.
│   ├── dead-tsconfig-types-pruner.mjs: Podado estático de paquetes de tipos huérfanos en compilerOptions.types de tsconfig.json.
│   ├── crypto-rsa-key-length-guard.mjs: Auditoría estática de generación de claves RSA para garantizar longitud de módulo segura (>= 2048/3072 bits).
│   └── sandbox-port-transfer-prover.mjs: Demostración formal de cierre determinista de MessagePort en canales transferidos a workers de sandbox.
│
├── 169-172. Núcleo Sovereign 172-Pillar Genesis Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-max-listeners-guard.mjs: Auditoría estática de registro de eventos y streams para garantizar cota MaxListeners y desuscripciones deterministas.
│   ├── dead-tsconfig-path-prefix-pruner.mjs: Podado estático de prefijos y rutas muertas en paths de tsconfig.json.
│   ├── crypto-dh-group-guard.mjs: Auditoría estática de grupos Diffie-Hellman para certificar longitud de primo segura (>= 2048 bits / MODP14+).
│   └── sandbox-ipc-disconnect-prover.mjs: Demostración formal de desconexión determinista de canales IPC en subprocesos de sandbox.
│
├── 173-176. Núcleo Centurial 176-Pillar Genesis Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-highwatermark-guard.mjs: Auditoría estática de creación de streams para certificar cota de memoria explícita en highWaterMark (<= 256KB).
│   ├── dead-tsconfig-exclude-pruner.mjs: Podado estático de patrones glob huérfanos en exclude de tsconfig.json.
│   ├── crypto-hkdf-param-guard.mjs: Auditoría estática de parámetros HKDF para certificar uso exclusivo de digest SHA-2/SHA-3 y validación de salt/info.
│   └── sandbox-ipc-unref-prover.mjs: Demostración formal de desprendimiento determinista (child.unref()) en procesos desacoplados en sandbox.
│
├── 177-180. Núcleo Sovereign 180-Pillar Genesis Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-pipe-destroy-guard.mjs: Auditoría estática de tuberías de streams para verificar gestión de errores y auto-destrucción en ambos extremos.
│   ├── dead-tsconfig-lib-pruner.mjs: Podado estático de librerías duplicadas o incompatibles en compilerOptions.lib de tsconfig.json.
│   ├── crypto-scrypt-param-guard.mjs: Auditoría estática de parámetros Scrypt para certificar costo N >= 16384 y cota en maxmem.
│   └── sandbox-path-env-prover.mjs: Demostración formal de sanitización y directorios canónicos confiables en la variable PATH del sandbox.
│
├── 181-184. Núcleo Transcendent 184-Pillar Genesis Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-transform-final-guard.mjs: Auditoría estática de implementaciones Transform/Writable para certificar invocación de callback en _final/_flush.
│   ├── dead-tsconfig-jsx-pruner.mjs: Podado estático de directivas jsx/jsxImportSource huérfanas en tsconfig.json.
│   ├── crypto-chacha-nonce-guard.mjs: Auditoría estática de ChaCha20-Poly1305 para certificar nonce de 12 bytes y manejo de auth tag.
│   └── sandbox-node-options-prover.mjs: Demostración formal de sanitización de NODE_OPTIONS y bloqueo de flags de precarga (--require/--import) en sandbox.
│
├── 185-188. Núcleo Sovereign 188-Pillar Genesis Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-cork-uncork-guard.mjs: Auditoría estática de flujos de escritura con .cork() para certificar llamada emparejada determinista a .uncork().
│   ├── dead-tsconfig-baseurl-pruner.mjs: Podado estático de baseUrl: "." redundante bajo resolución moderna de módulos en tsconfig.json.
│   ├── crypto-ecdh-curve-guard.mjs: Auditoría estática de acuerdos ECDH para certificar uso de curvas seguras (x25519/x448/prime256v1).
│   └── sandbox-ld-preload-prover.mjs: Demostración formal de purga y sanitización de variables del cargador dinámico (LD_PRELOAD/DYLD_INSERT_LIBRARIES) en sandbox.
│
├── 189-192. Núcleo Transcendent 192-Pillar Genesis Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-pause-resume-guard.mjs: Auditoría estática de control de flujo en streams con .pause() para certificar llamada emparejada determinista a .resume().
│   ├── dead-tsconfig-interop-pruner.mjs: Podado estático de allowSyntheticDefaultImports redundante cuando esModuleInterop es true en tsconfig.json.
│   ├── crypto-eddsa-verify-guard.mjs: Auditoría estática de firmas EdDSA (Ed25519/Ed448) para certificar parámetro de algoritmo null y prevenir confusión.
│   └── sandbox-worker-heap-limit-prover.mjs: Demostración formal de límites resourceLimits (maxOldGenerationSizeMb <= 512MB) en Worker Threads de sandbox.
│
├── 193-196. Núcleo Sovereign 196-Pillar Master Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-pipeline-async-guard.mjs: Auditoría estática de stream.pipeline / stream.finished para certificar manejo await o .catch() en promesas.
│   ├── dead-tsconfig-strict-flag-pruner.mjs: Podado estático de sub-flags estrictas (noImplicitAny, strictNullChecks) redundantes cuando strict es true en tsconfig.json.
│   ├── crypto-key-pair-curve-guard.mjs: Auditoría estática de crypto.generateKeyPair para certificar curvas robustas (ed25519/x25519) y módulos RSA seguros (>= 2048 bits).
│   └── sandbox-worker-transfer-list-prover.mjs: Demostración formal de inclusión de transferList en postMessage de ArrayBuffers en workers de sandbox.
│
├── 197-200. Núcleo Bicentenario 200-Pillar Master Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-half-close-guard.mjs: Auditoría estática de sockets TCP/TLS y streams Duplex con allowHalfOpen: true para certificar cierre completo (destroy/end/close).
│   ├── dead-tsconfig-target-lib-pruner.mjs: Podado estático de entradas redundantes en lib que duplican el target en tsconfig.json (ej. target ES2022 con lib ES2022).
│   ├── crypto-rsa-pss-padding-guard.mjs: Auditoría estática de crypto.sign/verify con RSA_PKCS1_PSS_PADDING para certificar especificación explícita de saltLength.
│   └── sandbox-process-windows-hide-prover.mjs: Demostración formal de definición explícita de windowsHide: true en subprocesos de sandbox multiplataforma.
│
├── 201-204. Núcleo Sovereign 204-Pillar Master Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── stream-objectmode-highwatermark-guard.mjs: Auditoría estática de streams objectMode para certificar cota proporcional a objetos (highWaterMark <= 1024).
│   ├── dead-tsconfig-json-module-pruner.mjs: Podado estático de resolveJsonModule redundante bajo resoluciones modernas (bundler, node16, nodenext) en tsconfig.json.
│   ├── crypto-decipher-authtag-guard.mjs: Auditoría estática de descifrado AEAD para certificar que setAuthTag preceda estrictamente a decipher.final().
│   └── sandbox-process-serialization-prover.mjs: Demostración formal de definición explícita de serialization: 'advanced' en llamadas fork de sandbox.
│
├── 205-208. Núcleo Transcendente 208-Pillar Master Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── file-append-lock-guard.mjs: Auditoría estática de escrituras asíncronas appendFile para certificar colas secuenciales o mutex en logs y journals.
│   ├── dead-tsconfig-root-types-pruner.mjs: Podado estático de tipos node redundantes y con fuga en configuraciones frontend de tsconfig.json.
│   ├── crypto-x509-cert-guard.mjs: Auditoría estática de crypto.X509Certificate para certificar validación explícita de host/emisor (checkHost, checkIssued).
│   └── sandbox-process-detached-teardown-prover.mjs: Demostración formal de destrucción explícita de grupo de procesos (-pid) en subprocesos detached de sandbox.
│
├── 209-212. Núcleo Soberano 212-Pillar Master Matrix (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
│   ├── file-truncate-boundary-guard.mjs: Auditoría estática de operaciones de truncado (truncate/ftruncate) para certificar bloqueo exclusivo o staging.
│   ├── dead-tsconfig-declaration-map-pruner.mjs: Podado estático de declarationMap huérfano cuando declaration está desactivado en tsconfig.json.
│   ├── crypto-tls-san-guard.mjs: Auditoría estática de validación de host TLS para certificar uso exclusivo de Subject Alternative Names (SAN/RFC 6125).
│   └── sandbox-process-bat-cmd-prover.mjs: Demostración formal de sanitización de argumentos en ejecuciones de archivos batch (.bat/.cmd) de sandbox.
│
└── 213-216. Núcleo Gran Epistémico 216-Pillar Master Matrix v60 (storage-guard/, config-guard/, security-guard/, sandbox-guard/)
    ├── file-watcher-debounce-guard.mjs: Auditoría estática de watchers de archivos (fs.watch/chokidar) para certificar debouncing y teardown (close).
    ├── dead-tsconfig-exact-optional-pruner.mjs: Podado estático de exactOptionalPropertyTypes: false redundante en configuraciones no estrictas de tsconfig.json.
    ├── crypto-tls-sni-guard.mjs: Auditoría estática de conexiones TLS/HTTPS para certificar especificación de Server Name Indication (SNI/RFC 6066).
    └── sandbox-process-windows-path-prover.mjs: Demostración formal de normalización canónica de rutas de ejecutables de sandbox (path.resolve/normalize).
```

---

## 🖥️ C2 Command Deck (Nuxt UI v4 + Tailwind CSS v4 + TanStack)

El panel de operaciones en `aoi_apps/agentic-ops-dashboard` ofrece una experiencia de Comando y Control (C2) de primer nivel:

1. **📋 Tablero Kanban (`TaskBoard.vue`)**: Visualización por estados del ciclo SDD.
2. **📊 Matriz TanStack (`TaskTanstackTable.vue`)**: Búsqueda global, ordenamiento multi-columna, filtros facetados y paginación ultra-rápida.
3. **⚡ Matriz DAG & Playback (`TaskDagViewer.vue`)**: Controles interactivos (Pause, Resume, Step Wave) y Node Inspector Drawer.
4. **🌐 Arquitectura C4 en Vivo (`C4ArchitectureViewer.vue`)**: Diagrama dinámico Mermaid C4 conectado a `/api/aoi-os/c4`.
5. **📁 Explorador de Recursos (`ResourceExplorer.vue`)**: Navegación por historias, especificaciones y contratos.
6. **📈 Observabilidad de Tokens (`TokenUsagePanel.vue`)**: Métricas de consumo, velocidad y alertas de anomalías.

---

## 🚀 Guía de Uso Rápido

### 1. Ejecución Autónoma vía CLI
```bash
# Ejecutar un feature completo en modo autónomo:
node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --workspace "$WORKSPACE" --auto-apply

# Simular compilación del DAG sin mutaciones (Dry Run):
node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --dry-run
```

### 2. Ejecución desde Prompts SDD
```text
/sdd-apply --os-mode
```

### 3. Iniciar el Dashboard C2
```bash
pnpm --filter agentic-ops-dashboard dev
```

---

## 📜 CHANGELOG

### [60.0.0] - 2026-08-17 (The Grand Epistemic Bicentennial-Decade 216-Pillar Omnipresent Singularity & Universal Transcendence Master Core)
- **Atomic File Watcher Debounce Guard**: Auditoría estática de watchers de sistema de archivos (`fs.watch`, `fs.watchFile`, `chokidar`) para certificar debouncing/throttling explícito y ganchos de cierre deterministas (`watcher.close()`), previniendo ráfagas de eventos duplicados y fugas de inodos (`storage-guard/file-watcher-debounce-guard.mjs`).
- **Dead TypeScript Exact Optional Properties Pruner**: Podado estático de directivas redundantes `exactOptionalPropertyTypes: false` en `tsconfig.json` cuando `strict: false` o no está definido, eliminando flags muertas y promoviendo el tipado estricto canónico (`config-guard/dead-tsconfig-exact-optional-pruner.mjs`).
- **Safe Cryptographic TLS SNI Guard**: Auditoría estática de conexiones y sockets TLS (`tls.connect`, `https.request`) para garantizar la especificación explícita de `servername` (SNI según RFC 6066), evitando fallos de enrutamiento y ambigüedades de domain fronting (`security-guard/crypto-tls-sni-guard.mjs`).
- **Sandbox Process Windows Path Prover**: Demostración formal de normalización canónica de rutas (`path.normalize()` / `path.resolve()`) en comandos y ejecutables de subprocesos en sandboxes para garantizar compatibilidad multiplataforma y cero errores `ENOENT` en Windows (`sandbox-guard/sandbox-process-windows-path-prover.mjs`).
- **542/542 Tests Pasando al 100%** y **619 archivos gobernados en paridad absoluta con scaffold/**.

### [59.0.0] - 2026-08-17 (The Sovereign 212-Pillar Infinite Singularity & Universal Autonomous Hyper-Nexus Matrix)
- **Atomic File Truncate Boundary Guard**: Auditoría estática de operaciones de truncado (`fs.truncate`, `fs.promises.truncate`, `fs.ftruncate`) en persistencia para certificar protección con bloqueo exclusivo o reemplazo atómico en dos fases (`storage-guard/file-truncate-boundary-guard.mjs`).
- **Dead TypeScript Declaration Map Pruner**: Podado estático de directivas huérfanas `declarationMap: true` en `tsconfig.json` cuando `declaration` está en `false` (`config-guard/dead-tsconfig-declaration-map-pruner.mjs`).
- **Safe Cryptographic TLS SAN Guard**: Auditoría estática de comprobaciones de identidad de host en TLS para certificar el cumplimiento de Subject Alternative Names (SAN) según RFC 6125 (`security-guard/crypto-tls-san-guard.mjs`).
- **Sandbox Process Windows Batch File Prover**: Demostración formal de que las invocaciones a archivos batch (.bat / .cmd) apliquen sanitización estricta de argumentos contra inyecciones shell (CVE-2024-27980) (`sandbox-guard/sandbox-process-bat-cmd-prover.mjs`).

---

## 📄 Licencia
MIT — Creado y mantenido por el equipo de ingeniería agéntica de **AOI**.

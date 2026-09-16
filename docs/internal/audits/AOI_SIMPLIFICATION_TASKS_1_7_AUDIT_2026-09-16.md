# Auditoría de simplificación — Tareas 1 a 7

**Corte:** 2026-09-16 · **Base revisada:** `275d340` → cierre de auditoría
**Propósito:** comprobar que las siete tareas previas a la reducción de prompts
eliminan ambigüedad, duplicación o trabajo innecesario sin degradar exactitud,
robustez ni control del Owner. La Tarea 8 no forma parte de este cambio.

## Método

La auditoría recorrió los commits de cada tarea, sus contratos BIC, sus rutas
de instalación y sus consumidores posteriores. Para cada una se exigió una
prueba de comportamiento o de estructura y, cuando era posible, un control
negativo. Se ejecutaron además la suite global, paridad de scaffold, Doctor,
ledger de claims, integridad de referencias, auditoría de protocolo y la
cobertura de herramientas.

El resultado separa dos clases de evidencia:

| Clase | Qué puede afirmar | Qué no puede afirmar |
| --- | --- | --- |
| Determinista | Transformaciones de texto/JSON, selección de perfil, rutas, paridad y oráculos con entradas fijadas. | Disponibilidad de binarios, red, contenido de un servicio ni ejecución en otro SO. |
| Dependiente del entorno | Instalación, procesos `pnpm`/MCP, filesystem del Owner, watcher e índice local. | Que una corrida futura tenga los mismos tiempos, versiones o respuesta del proveedor. |

## Resultado por tarea

| Tarea | Cambio y necesidad | Veredicto determinista | Frontera no determinista / residual |
| --- | --- | --- | --- |
| 1. Contabilidad SDD | El coste fijo debía ser el texto que realmente recibe cada fase, no una suma de archivos que omitía framing. Es el baseline necesario antes de cualquier recorte de prompts. | `payloadFloor` coincide con `estimateTokens(assemblePhaseContext(...).text)` en las siete fases. En este corte: 106.953 tokens literales estimados, 105.869 atribuibles a fuentes y 1.084 de framing; los adaptadores se reportan aparte (2.091). | Es una estimación estática del instrumento, no facturación de un proveedor ni garantía de qué inyectará cada harness futuro. |
| 2. Contrato Fiber | Las afirmaciones de rollback y la UI debían corresponder a lo que el runtime registra: escrituras seguidas explícitamente, no I/O arbitrario. | `restoreTrackedFiles` es la única recuperación compartida por `rollback()` y teardown; las pruebas cubren contenido, ausencia previa, modo y directorios creados. | El filesystem, permisos y escrituras hechas fuera de `sandbox.trackFileWrite` permanecen fuera del control del runtime. |
| 3. MCP Windows | Windows no podía registrar backends directos mientras POSIX los encapsulaba con `mcp-compressor`. Era necesario preservar claves del Owner y argv del backend. | La prueba vincula estáticamente el instalador: instala/verifica compresor, hace key-merge y rechaza backend directo; el oráculo del gateway pasa. | La ejecución de la función PowerShell real está condicionada a Windows. En este host macOS ese subtest quedó `skipped`; el smoke nativo quedó explícitamente requerido. |
| 4. Suite de memoria | `test:memory-sync:bundle` ya estaba incluido por el glob de `test:memory-sync`; invocarlo otra vez duplicaba trabajo sin añadir cobertura. | El pipeline global contiene una sola invocación de la suite amplia y ninguna del foco; ambas órdenes siguen disponibles para diagnóstico puntual. | `pnpm` y duración de los procesos siguen dependiendo del host, pero el grafo de órdenes es fijo. |
| 5. Perfiles | Core no debe pagar ni materializar UI/dashboard; Advanced añade integraciones y Dashboard añade la app. El cambio evita inferir perfil por directorios y conserva un dashboard existente. | Los perfiles son cerrados (`core`, `advanced`, `dashboard`), Core es default y los lectores/escritores de instalación son profile-aware. Los tests protegen la dirección segura: Core/Advanced no eliminan el dashboard. | Instalar binarios, resolver PATH, runtime Node/pnpm y dependencias externas depende del host. |
| 6. Ledger de claims | Promesas de coste, recuperación o disponibilidad debían estar calificadas y enlazadas a evidencia, no a badges o porcentajes históricos. | `aoi:claims` revisa seis claims, ocho rutas de evidencia y cinco superficies públicas, incluido `scaffold/README.md`; rechaza porcentajes universales, conteos vivos y garantías retiradas. | El ledger garantiza presencia y clasificación; el significado de una nueva promesa sigue requiriendo revisión humana y evidencia apropiada. |
| 7. Índices Codebase | El espejo `scaffold/` y el dashboard contaminaban el grafo principal con duplicados; el bundle Nuxt generado contaminaba el grafo auxiliar. | `.cbmignore` delimita control-plane y dashboard; la indexación inicial ocurre después de materializar el workspace y las raíces se procesan secuencialmente. | El contenido/estado del grafo es de Codebase Memory. Tras una nueva exclusión, una actualización incremental puede conservar nodos antiguos; se requiere reconstrucción selectiva del proyecto afectado. |

## Hallazgo de la auditoría y remediación

### A7-01 — `.cbmignore` preexistente del Owner podía invalidar el índice

**Hallazgo.** La instalación fresh usa una copia que preserva archivos
existentes. Si el Owner ya tenía `.cbmignore`, el archivo de la plantilla no
llegaba al workspace y el índice posterior podía incluir `scaffold/` o
`aoi_apps/`.

**Corrección.** `scripts/conf/ensure-cbmignore.mjs` conserva el texto del Owner
y añade al final un bloque administrado idempotente. Por semántica gitignore,
sus reglas finales revocan una negación anterior. Sólo se ejecuta en perfiles
Advanced/Dashboard; Dashboard aplica además `.output/` a su raíz propia. Bash
materializa el bloque antes de reconstruir el espejo y PowerShell copia el
resultado al espejo explícitamente. Las pruebas incluyen la negación previa
`!aoi_apps/`, CRLF, idempotencia y la propagación de ambos instaladores.

No se modifican `aoi_apps/` en Core/Advanced, preservando el contrato de no
intervención sobre un dashboard que ya pertenezca al Owner.

## Verificación ejecutada

| Comando / observación | Resultado |
| --- | --- |
| `pnpm test` | PASS. Los rótulos `FAILS` que aparecen son casos negativos esperados de la suite. |
| `pnpm test:parity` | PASS. Raíz y `scaffold/` permanecen coherentes. |
| `pnpm aoi:doctor`, `aoi:claims`, `aoi:lint-refs`, `aoi:audit-protocol`, `aoi:tools` | PASS. Doctor: 13 passed, 0 warnings, 0 failed. |
| `pnpm test:sdd-lifecycle`, `aoi:context`, `aoi:cache-prefix` | PASS. Las siete fases emitidas igualan su piso literal medido. |
| `pnpm test:subagent-payload`, `pnpm test:spatiotemporal` | PASS. |
| `pnpm test:mcp-gateway` y `windows-installer-parity.test.mjs` | PASS estructural; ejecución PowerShell nativa queda pendiente de host Windows. |
| `global-suite-wiring`, perfiles, compare-install, claims y separación Codebase | PASS, con controles negativos incluidos. |
| Codebase Memory local | Ambos proyectos están `ready`: control-plane con exclusiones `scaffold`/`aoi_apps`; Dashboard reconstruido con `.output`, `.nuxt` y `node_modules` excluidos. Estos son estados locales observados, no métricas de producto. |

## Decisión de entrada a la Tarea 8

Las tareas 1–7 quedan auditadas y los hallazgos corregidos. La reducción medida
de prompts/contexto sigue aislada: no se eliminó, resumió ni reordenó texto de
prompts, instrucciones o skills en esta auditoría. Antes de modificarla se
debe acordar el corpus, la métrica de tokenización, los oráculos conductuales,
el umbral de regresión y el plan de rollback bajo supervisión del Owner.

## Condiciones de cierre que permanecen externas

1. Ejecutar `node --test scripts/mcp-gateway/windows-installer-parity.test.mjs`
   en Windows para completar el recorrido real de PowerShell.
2. Tras cambiar una frontera `.cbmignore`, consultar `index_status`. Si el
   proveedor conserva nodos previamente indexados, obtener el nombre exacto
   con `list_projects`, borrar únicamente ese proyecto y reindexar su raíz
   absoluta; nunca borrar la caché global de Codebase Memory.

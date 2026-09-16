# Ledger de Evidencia de Claims — AOI

**Corte:** 2026-09-16
**Alcance:** promesas públicas actuales que puedan cambiar una decisión de
instalación, arquitectura, coste o seguridad. No convierte los benchmarks y
auditorías versionados en documentación viva: éstos conservan su fecha, corpus
y revisión de origen.

## Cómo leerlo

| Estado | Significado |
| :-- | :-- |
| **Verificado** | Hay un contrato determinista y una prueba que lo refuta cuando se viola. |
| **Condicionado** | La capacidad existe, pero depende de perfil, entorno o entrada; el límite se declara. |
| **Histórico** | La cifra corresponde al corpus, fecha y revisión citados; no predice una corrida actual. |
| **Retirado** | Era una promesa pública sin evidencia vigente suficiente; se reemplazó por un contrato o se eliminó. |

Una afirmación cuantitativa nueva sólo puede ser pública si añade su corpus,
comando reproducible, revisión y limitación. Una garantía sólo puede ser pública
si nombra el estado que controla el runtime y el test que demuestra su rechazo.

## Claims vigentes

| ID | Claim público | Estado | Evidencia ejecutable | Límite explícito |
| :-- | :-- | :-- | :-- | :-- |
| C-001 | `core` es el perfil predeterminado; `advanced` y `dashboard` son elecciones cerradas. | **Verificado** | `node --test scripts/installation-profiles.test.mjs scripts/conf/installation-profiles.test.mjs` | Sólo describe la selección del instalador, no los binarios disponibles en el host. |
| C-002 | Core y Advanced no materializan un dashboard nuevo ni eliminan uno ya existente. | **Verificado** | `node --test scripts/conf/installation-profiles.test.mjs scripts/conf/compare-install.test.mjs` | Conserva artefactos existentes; no promete migrarlos ni repararlos. |
| C-003 | Cada servidor MCP registrado en el workspace se enruta por `mcp-compressor`. | **Verificado** | `node --test scripts/mcp-gateway/server-wrapping.test.mjs` | Verifica el enrutamiento configurado, no el contenido, disponibilidad ni coste de un servidor externo. |
| C-004 | El gateway usa compresión y *Progressive Disclosure*. | **Condicionado** | `node scripts/mcp-gateway/setup-mcp-gateway.mjs --signatures` y `node --test scripts/mcp-gateway/*.test.mjs` | La reducción depende de los esquemas realmente expuestos y de la carga del workspace; AOI no publica una tasa universal. |
| C-005 | La paridad de scaffold y las suites pueden verificarse desde comandos del repositorio. | **Verificado** | `pnpm test:parity` y `pnpm test` | El resultado es el de la revisión y entorno que ejecutan el comando; por eso los badges no fijan conteos. |
| C-006 | El runtime puede recuperar efectos que él mismo registró. | **Condicionado** | `node --test scripts/spatiotemporal-runtime/*.test.mjs` | No controla I/O externo ni efectos que no fueron registrados. |

## Métricas históricas conservadas

| ID | Registro | Estado | Por qué no es claim vivo |
| :-- | :-- | :-- | :-- |
| H-001 | `docs/internal/benchmarks/TOKEN_OPTIMIZATION_BENCHMARK_v2.0.0.es.md` | **Histórico** | Sus porcentajes pertenecen a AOI v2.0.0 y a su corpus; no miden la revisión actual. |
| H-002 | `docs/internal/benchmarks/v2.1.0/COMPARATIVE_REPORT.md` | **Histórico** | Compara ramas y entorno certificados en 2026-09-06; no es una predicción para otro workspace. |
| H-003 | `docs/internal/audits/AOI_AUDIT_2026-09-13_cambios-del-dia.md` | **Histórico** | Sus pisos, techos y huellas requieren el corpus y la revisión indicados en la auditoría. |

## Claims retirados o corregidos

| ID | Claim anterior | Resolución |
| :-- | :-- | :-- |
| R-001 | “60% al 90%” de ahorro de tokens. | Retirado de la presentación vigente: mezclaba mecanismos y corpus de revisiones distintas. |
| R-002 | “Hasta 85%” de reducción de overhead MCP. | Sustituido por C-003 y C-004: el enrutamiento es comprobable, la tasa exige medición contextual. |
| R-003 | Badges o encabezados con conteos de tests, paridad o agentes. | Sustituidos por estado sin números y comandos ejecutables; los conteos envejecen con cada cambio válido. |
| R-004 | “Memoria infinita”, “cero pérdida de contexto” y rollback atómico general. | Sustituidos por persistencia entre sesiones, trazabilidad y recuperación de efectos registrados. |
| R-005 | Dashboard disponible o reactivo en todos los perfiles. | Marcado como capacidad exclusiva del perfil `dashboard`; no implica actualización en tiempo real. |

## Gate de no-regresión

`pnpm aoi:claims` ejecuta `scripts/multi-harness/claims-evidence-ledger.mjs`.
Comprueba que este ledger exista en un checkout de desarrollo, que sus claims
vigentes tengan fuentes de evidencia existentes y que las superficies públicas
no reintroduzcan porcentajes universales, conteos de estado ni garantías
retiradas. La prueba asociada incluye un control negativo con una tasa MCP sin
evidencia: debe fallar.

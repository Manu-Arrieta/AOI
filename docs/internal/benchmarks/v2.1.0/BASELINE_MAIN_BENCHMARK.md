# Benchmark de Línea Base (Rama `main`) — AOI v2.0.0
**Entorno de Pruebas:** `/Users/equinox/Desktop/AOI TESTS`  
**Rama:** `main` (commit base sin modificaciones)  
**Fecha:** 2026-09-06  
**Tag Objetivo:** `v2.1.0`  
**Estado:** Certificado (Línea Base Oficial para Contraste)

---

## 1. Resumen Ejecutivo de la Línea Base (`main`)

Este documento registra las métricas empíricas obtenidas en una instalación limpia de AOI ejecutada en `/Users/equinox/Desktop/AOI TESTS` desde la rama `main` sin modificaciones.

Esta línea base evalúa la infraestructura existente:
- **MCP Gateway Compressor** activo (TypeScript compact signatures Tier 1).
- **Aislamiento de Subagente TOON** activo (`sanitize-subagent-payload.mjs`).
- **Fusión Mecánica en QA** activa (`mechanical-verify-union.mjs`).
- **RTK CLI Proxy** activo para comandos bash.
- **Suite de Pruebas:** 127 tests pasando al 100%.

---

## 2. Métricas Empíricas de la Rama `main` en `AOI TESTS`

### 2.1. Esquemas de Herramientas MCP
* **Gateway MCP Activo:** `@atlassian-labs/mcp-compressor` con 3 servidores gobernados (`icm`, `codebase-memory`, `stitch-ui`).
* **Tokens consumidos en esquemas base:** **~2.800 tokens** (reducción del 84.4% respecto a los ~18.000 tokens sin Gateway).

### 2.2. Aislamiento de Micro-Agentes (Payload de Delegación)
* Medición en `TASK-2026-003` (`fiber-health`):
  - **Payload Markdown Estándar:** 1.108 bytes (~277 tokens).
  - **Payload TOON Comprimido:** 806 bytes (~201 tokens).
  - **Ahorro de TOON en delegación:** **27.2% vs Markdown estándar** y **>85% vs transcripción de chat cruda**.

### 2.3. Lectura e Inspección de Código (Punto Crítico Detectado)
En la rama `main`, cuando un agente o micro-agente inspecciona código mediante `view_file` o `cat`, consume el archivo completo en texto plano:
* `scripts/spatiotemporal-runtime/coeffect-resolver.mjs`: **7.368 caracteres ≈ ~1.842 tokens**.
* `aoi_apps/agentic-ops-dashboard/server/utils/resource-operations.ts`: **9.291 caracteres ≈ ~2.322 tokens**.
* *Impacto en sesión de 5 lecturas de archivo:* **~10.000 a 12.000 tokens** de entrada consumidos, con un 85% de contenido correspondiente a implementaciones internas que el agente no requería para conectar la interfaz.

### 2.4. Diagnósticos de Compilador y Tests (Ruido Diagnóstico)
* **Fallo de Test Unitario en Vitest (Fase RED de TDD):**
  - Salida cruda capturada en terminal: **1.697 bytes ≈ ~424 tokens** por un único fallo de función ausente.
  - La salida incluye frames de `node_modules/vitest`, banners de versión y rutas absolutas repetidas.

### 2.5. Generación de Código (Tokens de Salida)
* **Boilerplate generado manualmente por LLM en `/sdd-apply`:**
  - Archivo de test (`fiber-health-evaluator.test.ts`): ~300 bytes (~75 tokens).
  - Archivo de tipos y stubs (`fiber-health-evaluator.ts`): ~550 bytes (~138 tokens).
  - **Total de tokens de salida dedicados a boilerplate repetitivo:** **~213 tokens de generación por tarea**.

### 2.6. Retención de Contexto Multi-Turno y Caché
* **Context Rot:** Los 424 tokens del fallo en Fase RED permanecen en el historial de turnos posteriores en sesiones multi-turno ($O(N^2)$).
* **Prompt Cache Hit Rate Promedio:** **~60% - 65%** debido a prefijos con marcas temporales o inyección intermedia de hechos de ICM.

---

## 3. Matriz Consolidada de la Línea Base (`main`)

| Categoría | Métrica Rama `main` (Base) | Observación / Oportunidad |
| :--- | :--- | :--- |
| **Esquemas MCP** | ~2.800 tokens | Optimizado por Gateway MCP |
| **Subagent Task Payload** | 806 bytes (~201 tokens) | Optimizado por TOON |
| **Lectura de Código (por archivo)** | **~1.800 - 2.300 tokens** | **Sin optimizar (texto plano crudo)** |
| **Diagnóstico de Test (por fallo)** | **~424 tokens** | **Sin optimizar (stack traces completos)** |
| **Tokens de Salida en Scaffolding** | **~213 tokens LLM** | **Sin optimizar (LLM genera sintaxis obvia)** |
| **Fusión en Verificación QA** | 0 tokens | Optimizado por Mechanical Union |
| **Tests Aprobados** | 127/127 (100% OK) | Baseline verificado |

Esta matriz servirá como base de comparación estricta para contrastar los resultados una vez implementadas las 5 optimizaciones cuánticas de tokens en la rama `feature/v2.1.0-token-quantum`.

# AOI Real-World Verification Matrix & Certification Suite v4.0.0

Este documento define el protocolo estricto, exhaustivo y determinista para verificar y certificar la infraestructura **AOI v4.0.0** en un entorno de pruebas real (`AOI TESTS`).

---

## 🎯 Objetivos de la Certificación v4.0.0

Validar el 100% de las capacidades modernizadas en la sesión:
1. **ICM Protocolo v4 (5 Métodos)**: Memories, Memoirs, Facts ($O(1)$), Feedback y Transcripts.
2. **Gobernanza y Diagnóstico 360°**: `pnpm aoi:doctor`, límite SRP (<300 LOC), compulsa TDD y enlace automático de recursos (`link-resources.mjs`).
3. **Dashboard Nuxt Visual & Telemetría**: Widget `DoctorHealthBadge`, explorador `FactsExplorer`, visor `MemoirGraphViewer`, 33 tests Vitest y tipado Nuxt.
4. **Compilador Multi-Harness**: Generación y sincronización de reglas para Copilot, Claude Code (`CLAUDE.md`), Cursor (`.cursorrules`), Antigravity (`AGENTS.md`) y Cline (`.clinerules`) con selector en `setup.sh` y `setup.ps1`.
5. **Orquestación Concurrente & TOON**: Payloads compactos de subagentes y sandboxes con rollback instantáneo en 0 tokens.

---

## 📋 Protocolo de Ejecución Paso a Paso

```
                          PROTOCOLO DE CERTIFICACIÓN
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ FASE 0: Instalación y Bootstrap Limpio                                      │
  │ • Ejecución de `./setup.sh --harness all <target_dir>`                      │
  │ • Verificación inmediata de salud: `pnpm aoi:doctor`                       │
  │ • Ejecución de `/init` (bootstrap de ICM 5 métodos, base-project map)       │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │ FASE 1: Verificación de los 10 Invariantes Core                             │
  │ • Ejecución de la batería completa de tests unitarios y de integración      │
  │ • Comprobación de paridad de scaffold (197 archivos)                        │
  │ • Comprobación de endpoints y componentes del dashboard                     │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │ FASE 2: Ciclo SDD Empírico de Extremo a Extremo                             │
  │ • `/sdd-new`    → Descubrimiento, propuesta y auto-enlace de recursos       │
  │ • `/sdd-apply`  → Implementación con TDD, fibers y límite SRP (<300 LOC)   │
  │ • `/sdd-verify` → Compulsa mecánica de defectos unificados                  │
  │ • `/sdd-archive`→ Cierre de tarea, destilación de memorias y fast briefing  │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │ FASE 3: Emisión del Reporte de Auditoría (`VERIFICATION_AUDIT_REPORT.md`)   │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 FASE 0: Instalación y Bootstrap Limpio

### Paso 0.0: Limpieza Total Previa (Clean Slate)
Ejecutar en la carpeta de destino:
```bash
find . -mindepth 1 -maxdepth 1 ! -name 'AOI_REAL_WORLD_VERIFICATION_MATRIX.md' -exec rm -rf {} + 2>/dev/null || true
```

### Paso 0.1: Despliegue con el Selector de Harness y Modo No Interactivo
Ejecutar desde el repositorio de AOI hacia la carpeta de destino:
```bash
bash /Users/equinox/Desktop/Proyectos/AOI/setup.sh -y --harness all "/Users/equinox/Desktop/AOI TESTS"
```

**Criterios de Aceptación**:
- [ ] Ejecución 100% autónoma y no interactiva sin bloqueos de `read -r`.
- [ ] Espejo `scaffold/` preservado y replicado en el destino.
- [ ] Archivos `pnpm-workspace.yaml` y `pnpm-lock.yaml` copiados al destino.
- [ ] Archivos de reglas compilados para el workspace destino: `CLAUDE.md`, `.cursorrules`, `.cursor/rules/aoi-rules.mdc`, `AGENTS.md`, `.agents/rules/aoi-rules.md`, `.clinerules`, `.github/copilot-instructions.md`.
- [ ] Hechos deterministas registrados en ICM: `harness.selected = all`, `icm.protocol = v4`.
- [ ] Fast briefing determinista inicializado en `.specify/memory/briefings/active-briefing.md`.

### Paso 0.2: Diagnóstico Inicial con AOI Doctor
```bash
cd /Users/equinox/Desktop/AOI\ TESTS
pnpm aoi:doctor
```

**Criterios de Aceptación**:
- [ ] 11/11 Checks PASSED (0 warnings, 0 failures).
- [ ] Verificación de binarios (`icm`, `rtk`), integridad SQLite, registro `.tasks/registry.md`, versionado `.specify/` y reglas multi-harness.

### Paso 0.3: Bootstrap con `/init`
Ejecutar el prompt `/init`:
- [ ] Detección del mapa base del proyecto (`detect-base-project.mjs`).
- [ ] Creación de memoria de contexto `{WORKSPACE}-context`.
- [ ] Creación de grafo arquitectónico en memoir `{WORKSPACE}-architecture`.
- [ ] Registro de hechos $O(1)$ en `icm facts`.
- [ ] Compilación final de adaptadores con `pnpm aoi:sync-rules --workspace "{WORKSPACE}"`.

---

## 🛡️ FASE 1: Matriz de los 10 Invariantes Core

| # | Invariante | Comando de Validación | Resultado Esperado |
| :---: | :--- | :--- | :--- |
| **I-01** | **Paridad Scaffold Mirror** | `pnpm test:parity` | 206/206 archivos gobernados con paridad 1:1 byte-for-byte. |
| **I-02** | **AOI Doctor 360°** | `pnpm aoi:doctor` | 11/11 Checks PASSED en 0 ms sin consumo de tokens. |
| **I-03** | **Multi-Harness Suite** | `pnpm test:multi-harness` | Compilación exitosa para Copilot, Claude, Cursor, Antigravity y Cline. |
| **I-04** | **ICM Substrate (5 Métodos)** | `icm wake-up && icm facts list AOI` | Hechos deterministas devueltos en $O(1)$ y briefing estructurado. |
| **I-05** | **Memory Sync & Bundles** | `pnpm test:memory-sync && pnpm test:memory-sync:bundle` | 67/67 tests pasando (digest SHA256, export/import/rollback). |
| **I-06** | **Compresión TOON** | `pnpm test:subagent-payload` | Payloads tabulares para subagentes con 40-60% menos tokens que markdown (<1.600 bytes). |
| **I-07** | **Aislamiento por Fibers** | `pnpm test:spatiotemporal` | Sandboxes con mutaciones reversibles ($\partial\Gamma$) y rollback instantáneo. |
| **I-08** | **Gobernanza SDD & SRP** | `pnpm test:sdd-lifecycle` | Validación de LOC (<300 LOC), cobertura TDD y enlace de recursos. |
| **I-09** | **MCP Gateway & Types** | `pnpm test:mcp-gateway` | Firmas TypeScript compactas y configuración de herramientas válida. |
| **I-10** | **Dashboard Nuxt & Vitest** | `pnpm test:dashboard` | 33/33 tests Vitest pasando; `nuxt prepare` genera tipos sin errores. |

---

## ⚡ FASE 2: Ciclo SDD Empírico de Extremo a Extremo

Ejecutar un ciclo de desarrollo completo para la tarea:
`TASK-2026-004: evaluateOperationalTelemetry`

### 1. Fase `/sdd-new` (Propuesta & Enlace de Recursos)
```bash
# Invocar prompt /sdd-new para TASK-2026-004
# Crear recurso de prueba en .resources/userstories/US-001.md
node scripts/sdd-lifecycle/link-resources.mjs
```
* **Verificación**: `relations.json` debe vincular automáticamente `.resources/userstories/US-001.md` a `TASK-2026-004`.

### 2. Fase `/sdd-apply` (Implementación & Sandboxes)
* **Verificación**:
  - TDD estricto: crear `telemetry-evaluator.mjs` y su test `telemetry-evaluator.test.mjs`.
  - Gate de tamaño de archivo: confirmar que ningún archivo supere los 300 LOC.
  - No polución de contexto: los cambios deben pasar por el Fiber sandbox.

### 3. Fase `/sdd-verify` (Compulsa Mecánica de Defectos)
```bash
node scripts/sdd-lifecycle/mechanical-verify-union.mjs
```
* **Verificación**: Reporte unificado sin duplicación de IDs de defecto y verificación de cobertura de tests.

### 4. Fase `/sdd-archive` (Cierre, Destilación y Memoria)
* **Verificación**:
  - Estado de la tarea actualizado a `✅` en `.tasks/registry.md`.
  - Memoria registrada en ICM: `icm store -t "context-{WORKSPACE}" -c "TASK-2026-004 completed"`.
  - Concepto arquitectónico añadido a `icm memoir`.
  - Hechos actualizados en `icm facts`.
  - Fast briefing refrescado en `.specify/memory/briefings/active-briefing.md`.

---

## 📊 FASE 3: Emisión del Reporte de Certificación

Generar el archivo `VERIFICATION_AUDIT_REPORT.md` en el directorio raíz de pruebas con la siguiente estructura:

```markdown
# AOI v4.0.0 Real-World Verification Audit Report

- **Fecha de Ejecución**: {ISO Timestamp}
- **Workspace de Prueba**: AOI TESTS
- **Estado Global**: ✅ 100% CERTIFICADO (0 Defectos, 0 GAPs)

## Resumen de Invariantes
- [x] Invariante 1: Paridad Scaffold (197/197 archivos)
- [x] Invariante 2: AOI Doctor (11/11 Checks Passed)
- [x] Invariante 3: Multi-Harness Rules (5 adaptadores activos)
- [x] Invariante 4: ICM Protocolo v4 (5 métodos operativos)
- [x] Invariante 5: Memory Sync & Bundles (67/67 tests)
- [x] Invariante 6: Compresión TOON para Subagentes
- [x] Invariante 7: Sandboxes con Reversibilidad Espaciotemporal
- [x] Invariante 8: Mechanical Verify, SRP (<300 LOC) y TDD
- [x] Invariante 9: Dashboard Nuxt (33/33 tests Vitest + Fact/Memoir Explorers)
- [x] Invariante 10: Auto-enlace de Recursos a relations.json

## Auditoría del Ciclo SDD (TASK-2026-004)
- **Propuesta**: relations.json auto-vinculado.
- **Implementación**: TDD + LOC compliance (<300 LOC).
- **Verificación**: 0 defectos unificados.
- **Cierre**: Memorias, Memoirs y Facts actualizados en ICM.
```

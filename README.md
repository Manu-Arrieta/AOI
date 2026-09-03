# AOI — Agentic Operational Infrastructure

> **Convierte cualquier repositorio en un entorno de desarrollo agéntico autónomo, seguro y de altísima eficiencia.**  
> Diseñado para que humanos e inteligencias artificiales colaboren con memoria infinita, mínimo consumo de tokens y cero pérdida de contexto.

[![AOI Doctor](https://img.shields.io/badge/AOI_Doctor-360%C2%B0_Healthy-success?style=flat-square&logo=shield)](file:///scripts/aoi-doctor.mjs)
[![Tests](https://img.shields.io/badge/Tests-134%2F134_Passing-brightgreen?style=flat-square&logo=vitest)](file:///package.json)
[![Scaffold Parity](https://img.shields.io/badge/Scaffold_Parity-227%2F227_Verified-blue?style=flat-square)](file:///scripts/scaffold/validate-scaffold-parity.mjs)
[![Multi-Harness](https://img.shields.io/badge/Multi--Harness-5_Assistants-orange?style=flat-square)](file:///scripts/multi-harness/compile-rules.mjs)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](file:///LICENSE)

---

## ¿Qué es AOI?

**AOI** es la infraestructura operativa que le da a tus asistentes de IA lo que siempre necesitaron para programar de verdad: **memoria persistente que trasciende sesiones**, **optimización matemática de tokens**, un **ciclo de vida de desarrollo guiado por especificaciones (SDD)** y **mecanismos de seguridad deterministas** con reversión instantánea de cambios.

En lugar de lidiar con chats aislados que olvidan decisiones a los 20 minutos o que consumen millones de tokens innecesarios leyendo repositorios enteros, AOI equipa tu proyecto con:

- **27 Agentes especializados** coordinados en arquitectura Hub-and-Spoke.
- **5 Métodos de Memoria (ICM)**: Recuerdos episódicos, grafos de arquitectura, hechos clave-valor exactos en $O(1)$, correcciones y transcripciones crudas.
- **Motor Espaciotemporal & Sandboxes**: Ejecución aislada de tareas con reversión atómica de efectos ($\partial\Gamma$) si una prueba falla.
- **Soporte Multi-Harness**: Una sola fuente de verdad para GitHub Copilot, Claude Code, Cursor, Antigravity/Gemini y Cline.
- **Dashboard Operativo C2**: Tablero Kanban en tiempo real, matriz TanStack, visualizador 3D de dependencias y semáforo de salud 360°.

---

## Inicio Rápido (Quickstart)

Podés instalar AOI en cualquier proyecto existente con una sola línea de terminal.

### 1. Requisitos Previos

- **Node.js** `>=20.19.0`
- **pnpm** `>=11.3.0` (o vía `corepack enable pnpm`)
- Tu editor preferido (VS Code, Cursor, Claude Code, etc.)

---

### 2. Instalación en tu Proyecto

#### macOS / Linux

```bash
bash "/path/to/AOI/setup.sh" /ruta/a/mi-proyecto
```

#### Windows 11+ (PowerShell)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\setup.ps1" "C:\ruta\a\mi-proyecto"
```

#### Windows 11+ (Git Bash)

```bash
bash "/c/path/to/AOI/setup.sh" "/c/ruta/a/mi-proyecto"
```

> [!TIP]
> **Modo no interactivo y selección de asistentes:**  
> Podés pasar banderas adicionales al instalador:
>
> ```bash
> ./setup.sh --non-interactive --harness all /ruta/a/mi-proyecto
> ```
>
> Opciones válidas para `--harness`: `copilot`, `claude`, `cursor`, `antigravity`, `cline` o `all`.

---

### 3. Primeros Comandos en el Chat

Una vez instalado en tu proyecto, abrí el chat de tu asistente favorito (ej. Copilot Chat o Claude Code) y ejecutá:

```text
/init       # Configura el stack tecnológico, las reglas y la constitución del proyecto
/sdd-frame  # (Pre-Flight) Diálogo socrático en lenguaje natural y cristalización del Behavioral Intent Contract (BIC)
/sdd-new    # Propone y especifica la funcionalidad técnica formal (feature)
```

---

## Los 5 Pilares de AOI

### 1. Ahorro Radical de Tokens (60% al 90%)

AOI combate el desperdicio de tokens en múltiples niveles:

- **RTK (Rust ToolKit)**: Filtra y comprime la salida de comandos de terminal, tests y builds antes de que lleguen al modelo.
- **Serialización TOON**: Los subagentes reciben contratos y tareas en una notación tabular ultracompacta (`scripts/subagent-context/`), evitando enviar especificaciones gigantes.
- **MCP Gateway Proxy**: Comprime los esquemas de herramientas y aplica _Progressive Disclosure_, reduciendo hasta un 85% la sobrecarga en cada turno.
- **Codebase Memory MCP**: Grafo estructural de código en SQLite que reemplaza búsquedas amplias tipo `grep` por consultas semánticas y caminos de llamada exactos.

### 2. Memoria Persistente que Nunca Olvida (ICM)

Integración nativa con [ICM](https://github.com/rtk-ai/icm) a través de **5 métodos complementarios**:

| Método          | Qué Almacena                                | Caso de Uso                                                       |
| :-------------- | :------------------------------------------ | :---------------------------------------------------------------- |
| **Memories**    | Contexto episódico con decaimiento temporal | Decisiones de diseño, estado de avance y aprendizajes de sesión.  |
| **Memoirs**     | Conceptos permanentes y dependencias        | Grafo de arquitectura, entidades del dominio y patrones sagrados. |
| **Facts**       | Tripletas exactas clave-valor ($O(1)$)      | Endpoints, puertos, configuraciones deterministas y versiones.    |
| **Feedback**    | Registro de asunciones vs. resultados       | Análisis post-verificación para no repetir errores pasados.       |
| **Transcripts** | Replay verbatim de sesiones                 | Trazabilidad completa de conversaciones y trayectorias.           |

### 3. Spec-Driven Development (SDD) & El Paradigma de la Intención (BIC)

El software no se improvisa: se expresa en lenguaje natural, se cristaliza en contratos matemáticamente rigurosos, se planifica, se implementa bajo TDD y se verifica mecánicamente.

AOI evoluciona sobre el Scrum tradicional: **reemplaza la clásica "Historia de Usuario" por el Behavioral Intent Contract (BIC)** y añade la fase **Pre-Flight (`/sdd-frame`)**:

```text
[Intención Humana en Lenguaje Natural]
       ↓
   /sdd-frame   → Pre-Flight: Diálogo Socrático, Sonda ICM O(1) y Contrato Conductual (BIC)
       ↓ (Intent Gate: Aprobación de Invariantes y Estados)
   /sdd-new     → Exploración Técnica y Especificación Formal (@functional-analyst)
       ↓ (Proposal Gate)
   /sdd-ff      → Arquitectura, Contratos TypeScript y Plan de Tareas (@solution-architect)
       ↓ (Design & Implementation Gate)
   /sdd-apply   → Implementación en Lotes con TDD Obligatorio (@frontend, @backend, @devops)
       ↓ (TDD & Verify Gate)
   /sdd-verify  → QA Mecánico, Validación de Límites y Tests (@integration-specialist)
       ↓ (Archive Gate)
   /sdd-archive → Documentación Viva, Distilación a Memoirs y Cierre (@documentation-analyst)
```

- **Zero-Task Footprint**: En `/sdd-frame`, dialogás con el agente en lenguaje cotidiano (voz o texto) para auditar hechos en $O(1)$ y fijar las reglas "NUNCA" (invariantes) sin contaminar el registro de tareas.
- **Las 4 Dimensiones del BIC**: Todo requerimiento se decanta en Delta de Estado ($\Delta S = S_0 \to S_1$), Invariantes Inquebrantables, Topología de Actores y un Oráculo Observable de Negocio.
- **Total Desacople**: Podés iniciar con `/sdd-frame` si la necesidad requiere decantación o entrar directo a `/sdd-new` si ya tenés el requerimiento técnico 100% maduro.

> 📖 _Para comprender a fondo la metodología, galería de ejemplos y estrategias de ejecución (Tracer Bullet vs. Wavefront), consultá el tratado completo: [El Paradigma de la Intención: De la Historia de Usuario al Contrato Conductual en la Era Agéntica](docs/internal/architecture/BEHAVIORAL_INTENT_CONTRACTS_PARADIGM.md)._

### 4. Compilador Multi-Harness Unificado

Escribís las instrucciones una sola vez en `.github/instructions/` y AOI las compila automáticamente para todos tus entornos de trabajo:

| Entorno / Asistente      | Archivos Generados                                    | Propósito                                        |
| :----------------------- | :---------------------------------------------------- | :----------------------------------------------- |
| **GitHub Copilot**       | `.github/copilot-instructions.md`, `.github/prompts/` | Reglas principales y 29 comandos slash           |
| **Claude Code**          | `CLAUDE.md`                                           | Protocolo de memoria ICM y compuertas de calidad |
| **Cursor IDE**           | `.cursorrules`, `.cursor/rules/aoi-rules.mdc`         | Límites de SRP y directivas de contexto          |
| **Antigravity / Gemini** | `AGENTS.md`, `.agents/rules/aoi-rules.md`             | Gobernanza de subagentes y persistencia          |
| **Cline / Roo Code**     | `.clinerules`                                         | Reglas operativas y flujos de trabajo            |

> Sincronizá todos los asistentes en cualquier momento con: `pnpm aoi:sync-rules`

### 5. Runtime Espaciotemporal y Sandboxes con Rollback

Los agentes de IA pueden fallar o alucinar, pero con AOI **nunca rompen tu repositorio**:

- **Fundamento Matemático ($\partial\Gamma$)**: En lugar de pedirle al LLM _"arregla lo que rompiste"_ (lo cual consume miles de tokens y genera alucinaciones), AOI formaliza el espacio de efectos reversibles:
  $$E_\Gamma := \Gamma \to \Gamma \times (\Gamma \to \Gamma)$$
  Toda mutación física sobre el disco o variables de entorno queda registrada junto a un morfismo inverso ($f^{-1}$). Si una prueba falla, el operador $\text{recover}_\Gamma$ restaura el estado original en **0 ms y 0 tokens**.
- **Sandboxes Herméticas (`/sandbox-new`)**: Cada subagente se ejecuta en un _Fiber_ aislado dentro de su propio reino ($\Sigma^{\text{iso}}$) y con cuotas estrictas de recursos (`.sandboxes/registry.md`).

#### Nomenclatura del Runtime

|           Símbolo           | Significado              | Función Práctica                                                        |
| :-------------------------: | :----------------------- | :---------------------------------------------------------------------- |
|        **$\Gamma$**         | **Contexto / Entorno**   | Estado completo del workspace (archivos, AST, variables, registros).    |
|    **$\partial\Gamma$**     | **Efecto Reversible**    | Mutación que porta su propia función de reversión (_disposer_).         |
|       **$\diamond$**        | **Composición Monoidal** | Encadena transformaciones preservando la reversión LIFO contravariante. |
| **$\text{recover}_\Gamma$** | **Operador de Rollback** | Restaura el estado previo al 100% sin inferencia de IA (0 tokens).      |
|  **$\Sigma^{\text{iso}}$**  | **Reino Aislado**        | Espacio de nombres hermético para que los subagentes no colisionen.     |

> 📖 _Para profundizar en los teoremas, solidez de tipos y referencias académicas (Plotkin, Petricek, Landauer, Bennett), consultá [Fundamentos Matemáticos del Runtime Espaciotemporal](docs/internal/architecture/SPATIOTEMPORAL_MATHEMATICAL_FOUNDATIONS.es.md)._

---

## Ecosistema de Agentes

AOI cuenta con **27 agentes especializados** divididos en roles de ingeniería y utilidades de automatización:

### Roles de Ingeniería y Arquitectura (13 Agentes)

| Agente                        | Fase SDD         | Especialidad                                                                           |
| :---------------------------- | :--------------- | :------------------------------------------------------------------------------------- |
| **`@supervisor`**             | Todas            | Orquestador general del ciclo de vida y asignador de tareas.                           |
| **`@functional-analyst`**     | Explore, Specify | Traduce necesidades de negocio en especificaciones y user stories.                     |
| **`@solution-architect`**     | Plan, Tasks      | Diseña interfaces, contratos TypeScript y diagramas de componentes.                    |
| **`@frontend-developer`**     | Implement        | Construye componentes, layouts y estilos modernos reactivos.                           |
| **`@backend-developer`**      | Implement        | Implementa APIs, lógica de negocio, bases de datos y seguridad.                        |
| **`@devops-engineer`**        | Implement        | Automatiza scripts, pipelines de CI/CD, contenedores y entornos.                       |
| **`@ux-designer`**            | Implement        | Vela por la accesibilidad (a11y), consistencia visual y microinteracciones.            |
| **`@integration-specialist`** | Verify           | Ejecuta suites de pruebas, valida cobertura TDD y audita límites de código (<300 LOC). |
| **`@documentation-analyst`**  | Archive          | Genera documentación funcional viva y prepara reportes de release.                     |
| **`@triage-specialist`**      | Transversal      | Diagnostica incidentes, reproduce bugs y aísla causas raíz.                            |
| **`@resource-analyst`**       | Transversal      | Gobierna el subárbol `.resources/` (historias de usuario y workflows).                 |
| **`@project-analyzer`**       | Transversal      | Auditoría estática y análisis de dependencias del repositorio.                         |
| **`@project-expert`**         | Transversal      | Asistente contextual con conocimiento integral del proyecto.                           |

### Automatización Spec-Kit (14 Agentes Especializados)

Automatizan tareas puntuales del flujo de especificaciones y git:
`speckit.specify`, `speckit.plan`, `speckit.tasks`, `speckit.implement`, `speckit.analyze`, `speckit.checklist`, `speckit.clarify`, `speckit.constitution`, `speckit.git.initialize`, `speckit.git.feature`, `speckit.git.validate`, `speckit.git.remote`, `speckit.git.commit`, `speckit.taskstoissues`.

---

## Dashboard de Operaciones en Tiempo Real (C2)

AOI incluye una consola web operativa de alta fidelidad construida en **Nuxt 4** y **NuxtUI**:

```bash
pnpm dev:dashboard
```

_Abre automáticamente en `http://localhost:3000`_.

### Características del Dashboard:

- 📋 **Tablero Kanban Reactivo**: Visualización en tiempo real del progreso de las tareas gobernadas (`.tasks/registry.md`).
- 📊 **Matriz TanStack Table**: Filtrado multifactorial, ordenamiento y vista de alta densidad para auditorías rápidas.
- 🌐 **Grafo 3D de Arquitectura**: Inspección tridimensional interactiva de símbolos y dependencias mediante `codebase-memory-mcp` (`http://localhost:9749`).
- 🧠 **Explorador de Memoria ICM**: Visualizador del grafo de conceptos (**Memoirs**) y tabla de hechos exactos (**Facts $O(1)$**).
- 🩺 **Semáforo Interactivo AOI Doctor**: Modal de diagnóstico 360° en la barra superior que certifica la salud del entorno en vivo.
- 🌐 **Bilingüe (ES / EN)**: Selector de idioma instantáneo con persistencia local.

---

## 🩺 Diagnóstico 360° y Salud del Workspace (AOI Doctor)

Podés auditar la salud completa de tu entorno en cualquier momento sin consumir un solo token:

```bash
pnpm aoi:doctor
```

AOI Doctor verifica de forma determinista:

1. **Herramientas CLI**: Disponibilidad de binarios esenciales (`icm`, `rtk`, `headroom`, `codebase-memory-mcp`, `specify`).
2. **Integridad de Base de Datos**: Estado físico y lógico de SQLite de ICM (`memories.db`).
3. **Registro de Tareas**: Coherencia de `.tasks/registry.md`.
4. **Gobernanza de Memoria**: Punteros canónicos en `.specify/memory/versions/active.json`.
5. **Multi-Harness**: Estado y paridad de los 5 adaptadores generados.
6. **Integridad del Mirror Scaffold (Principio I)**: Certificación de paridad byte-por-byte entre los archivos raíz y la plantilla `scaffold/` (227 archivos gobernados).

---

## 📁 Estructura del Proyecto

```text
├── .github/
│   ├── agents/               # 27 Definiciones de agentes
│   ├── instructions/         # 6 Reglas canónicas del proyecto
│   └── prompts/              # 29 Comandos de flujo SDD y administración
├── .resources/               # Subárbol gobernado de contexto reutilizable
│   ├── constitution.md       # Contrato local de gobernanza
│   ├── userstories/          # Historias de usuario compartidas
│   └── workflows/            # Definiciones de interacción de componentes
├── .specify/                 # Motor Spec-Kit y control de memoria
│   ├── extensions/git/       # Extensión de automatización de ramas Git
│   └── memory/versions/      # Version store gobernado de memoria activa
├── .tasks/                   # Tareas gobernadas del ciclo de vida SDD
│   └── registry.md           # Registro autoritativo de estados
├── aoi_apps/
│   └── agentic-ops-dashboard # Dashboard operativo Nuxt 4 / NuxtUI
├── scripts/                  # Runtimes y utilidades deterministas
│   ├── aoi-doctor.mjs        # Motor de diagnóstico 360°
│   ├── memory-sync/          # Exportación/importación de bundles de memoria
│   ├── multi-harness/        # Compilador de reglas multi-asistente
│   ├── sandbox/              # Gestión de sandboxes aisladas
│   ├── scaffold/             # Validador de paridad de plantilla
│   ├── sdd-lifecycle/        # Enlazador mecánico y unificador de verificación
│   ├── spatiotemporal-runtime# Runtime de efectos reversibles (∂Γ)
│   └── subagent-context/     # Serializador TOON y aislador de contexto
└── scaffold/                 # Plantilla espejo para bootstrap de nuevos proyectos
```

---

## 📖 Referencia Rápida de Comandos

| Comando                    | Descripción                                                               |
| :------------------------- | :------------------------------------------------------------------------ |
| `pnpm dev:dashboard`       | Inicia el Dashboard de Operaciones en `localhost:3000`.                   |
| `pnpm aoi:doctor`          | Ejecuta el chequeo integral de salud del repositorio (0 tokens).          |
| `pnpm aoi:sync-rules`      | Compila y sincroniza reglas para Copilot, Claude, Cursor, Gemini y Cline. |
| `pnpm test`                | Ejecuta la suite de pruebas automatizadas completa (134 tests).           |
| `pnpm test:parity`         | Valida paridad absoluta byte-a-byte entre raíz y `scaffold/`.             |
| `pnpm test:memory-sync`    | Prueba el versionado y la importación/exportación de memoria.             |
| `pnpm test:spatiotemporal` | Prueba los efectos reversibles y coefectos en sandboxes.                  |
| `bash teardown.sh <ruta>`  | Desinstala de forma limpia la infraestructura AOI de un proyecto.         |

---

## 📚 Documentación Adicional

- [El Paradigma de la Intención: Behavioral Intent Contracts (BIC)](docs/internal/architecture/BEHAVIORAL_INTENT_CONTRACTS_PARADIGM.md) — Tratado metodológico sobre el estándar agéntico que reemplaza las historias de usuario por contratos conductuales ($\Delta S$, Invariantes "Never Rules", Topología de Actores y Oráculos de Negocio) y la fase Pre-SDD (`/sdd-frame`).
- [Fundamentos Matemáticos de Spatiotemporal Runtime](docs/internal/architecture/SPATIOTEMPORAL_MATHEMATICAL_FOUNDATIONS.es.md) — Especificación formal de efectos reversibles ($\partial\Gamma$), coefectos ($\Sigma$) y pruebas de solidez.
- [Notas de la Versión v2.0.0](docs/internal/releases/v2.0.0.es.md) — Arquitectura de bootstrapper ligero y matriz TanStack.
- [Matriz de Verificación en el Mundo Real](docs/internal/verification/AOI_REAL_WORLD_VERIFICATION_MATRIX.md) — Protocolo de validación integral.
- [Benchmark de Optimización de Tokens](docs/internal/benchmarks/TOKEN_OPTIMIZATION_BENCHMARK_v2.0.0.es.md) — Métricas y mediciones de ahorro de tokens.
- [Guía de Custom Endpoints de VS Code](scaffold/.vscode/README.md) — Configuración opcional multi-proveedor (DeepSeek, Zai, Alibaba, MiniMax, NVIDIA).

---

## 📄 Licencia

MIT © Creado y mantenido con excelencia por el equipo de ingeniería agéntica de **AOI**.

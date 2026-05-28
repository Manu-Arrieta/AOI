# Feature Specification: Sincronización y Versionado de Memorias ICM

**Feature Branch**: `2026-004-workspace-memory-sync`  
**Created**: 2026-05-27  
**Status**: Draft  
**Input**: Requerimientos del Owner para sincronizar memorias entre workspaces usando ICM, versionar de forma unificada la memoria operativa resultante, y conservar el control final y reversibilidad total.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resolución Explícita de Origen (Priority: P1)

Como Owner, quiero elegir de qué workspace y de qué versión de memoria importar información, para evitar sincronizaciones ambiguas, silentes o accidentales.

**Why this priority**: Es el cimiento del contrato. Evita que la operación asuma incorrectamente o aplaste memoria basándose apenas en tópicos globales sin versión estable de referencia.

**Independent Test**: Comprobable verificando que no se permite iniciar un flujo de importación si no se provee formalmente la dupla workspace fuente y versión de memoria activa a unificar.

**Acceptance Scenarios**:

1. **Given** el inicio de un flujo de sincronización cruzada, **When** no se especifica explícitamente la versión o el workspace fuente, **Then** el sistema rechaza la operación exigiendo su definición.
2. **Given** el inicio del flujo, **When** el Owner especifica el workspace, **Then** el sistema presenta (o resuelve) la versión operativa activa correspondiente a dicho workspace para basar la integración.

---

### User Story 2 - Importación Parcial y Contexto Directivo (Priority: P1)

Como Owner, quiero decidir si la importación es completa o parcial y proveer un contexto complementario, para traer únicamente lo funcionalmente relevante para el workspace actual.

**Why this priority**: Previene el crecimiento incontrolado y la contaminación de memoria. Además, respeta el principio de jurisdicción donde el Owner delínea qué importar.

**Independent Test**: Comprobable instruyendo al orquestador una sincronización que sólo integre ciertas subsecciones (e.g., memorias, feedback) o con un prompt concreto indicando ignorar características pasadas obsoletas.

**Acceptance Scenarios**:

1. **Given** la preparación de importación, **When** el Owner pide importar todo, **Then** el plan de sync incluye los alcances completos subyacentes disponibles de la versión fuente.
2. **Given** la configuración de importación, **When** el Owner proporciona un contexto directivo, **Then** el sistema utiliza esa guía como heurística principal para orientar las decisiones de fusión o descarte.

---

### User Story 3 - Trazabilidad y Decisión de Retención (Priority: P1)

Como Owner, quiero tener la visibilidad final y trazable verificando qué partes del contenido se retienen, cuáles se complementan y cuáles se descartan.

**Why this priority**: Asegura la transparencia y la decisión final humana, y deja traza inmutable del comportamiento de unificación antes de considerarse `activa`.

**Independent Test**: Comprobable observando que el motor entrega un detalle o listado del "plan de unificación" que mapea explícitamente `retain`/`complement`/`discard` antes de confirmarse la activación.

**Acceptance Scenarios**:

1. **Given** un plan preparado por el orquestador, **When** se presenta al Owner para revisión, **Then** refleja de manera transparente los bloques sujetos a retención, subrogación u omisión en la nueva versión propuesta.

---

### User Story 4 - Rollback Seguro y Explícito (Priority: P1)

Como Owner, quiero poder ordenar la restauración o reactivación de una versión previa operativa del workspace de manera íntegra si descubro que la memoria activa quedó corrupta o degradó su calidad.

**Why this priority**: Es la condición sine qua non del Owner y el corazón del versionado de memoria; toda versión de unificación carece de valor si no sirve de snapshot recuperable.

**Independent Test**: Comprobable efectuando un Rollback luego de una sincronización dudosa, logrando que el entorno recobre acceso de forma idéntica e inmediata a la memoria anterior en su estado exacto funcional.

**Acceptance Scenarios**:

1. **Given** una versión de memoria importada activa temporalmente, **When** el Owner ordena el rollback explícito, **Then** el sistema reactiva por completo el Binding a los topics de la versión origen preservando su constitución dinámica intacta e inhabilitando el experimento fallido.

## Constitution Alignment _(mandatory)_

### Existing Surface Discovery

- Existing services, prompts, and runtime surfaces affected:
  - ICM integration: `.specify/memory/constitution.md`
  - CLI usage tools (`topics`, `list`, `store`)
- Copilot, Antigravity, and `scaffold/` sync impact:
  - `.github/prompts/` y `.github/instructions/icm-protocol.instructions.md` (posible ajuste de directivas si requiriese inyectar el _resolver_).
  - Integración o tools nuevas para invocar la API del orquestador.
- Runtime & Orquestación de Memoria:
  - Creación de artefactos administrados dentro del path propuesto `.specify/memory/versions/**`.
- Tooling and platform impact:
  - Iteración workflow-first independiente de una UI; por lo que el dashboard o `agentic-ops-dashboard` no requiere modificaciones para esta capa inicial de contrato operativo.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El flujo NO DEBE procesar un sync si el Owner no declara la identificación del workspace fuente y versión de origen.
- **FR-002**: El sistema DEBE ofrecer la capacidad para que la importación se ajuste al nivel completo o de manera restrictiva parcial.
- **FR-003**: El orquestador DEBE consumir y priorizar el contexto auxiliar proveído por el Owner como instrucción directriz del merger de memorias.
- **FR-004**: Toda operación de unificación candidata DEBE clasificar visiblemente sus efectos en decisiones tipificadas inmutables (`retain`, `complement`, `discard`).
- **FR-005**: La confirmación explícita DEBE generar un identificador de versión (`Memory Version Manifest`) operativo inmutable para la nueva iteración de memoria del Workspace activo.
- **FR-006**: La versión generada y adoptada DEBE vincularse solidariamente con una 'constitución dinámica' que fije en piedra sus preceptos fusionados.
- **FR-007**: El estado en todo momento DEBE custodiar una traza estricta referenciando la versión raíz que la dio lugar.
- **FR-008**: El sistema DEBE brindar un flujo explícito de **Rollback** que restituya completamente los entrelazamientos orgánicos a un identificador de versión anterior.

### Key Entities

- **Memory Version Manifest**: Identificador inmutable provisto a nivel workspace que ata la referencia de memoria operativa activa.
- **Dynamic Constitution**: Derivación constitucional que plasma las guías de uso local que rigen esa versión producto del sync.
- **Active Version Resolver**: Mecanismo que orienta y asegura la consulta temporal canónica (`aoi-context`, etc.) sobre los identificadores absolutos e inmutables del estado vigente.
- **Sync Plan**: Bosquejo de propuestas de condensación dictaminados con `retain/complement/discard` aguardando la ratificación humana.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Cualquier flujo de sincronización aborta / requiere rectificación inicial si es ausente un workspace y version específica.
- **SC-002**: Importaciones documentadas certifican (via manifest records) haber obedecido un contexto auxiliar directivo.
- **SC-003**: La creación de un Memory Version Manifest post-sincronización valida y documenta explícitamente cuáles scopes ingresaron o fueron desechados.
- **SC-004**: Se demuestra empíricamente la efectividad de un Rollback restaurando la constitución y los bindings de topics sin necesidad de un nuevo merge o reconfiguración artesanal.

## Assumptions

- Solamente se diseña contractualmente para operatoria "Workflow-first/Motor gobernado"; ninguna experiencia de dashboard integrado se espera hasta fases subsiguientes.
- Carece de alcance para esta fase orquestar links entre artefactos `.resources/`, no se fabrican o infieren relations.json para .resources bajo esta semántica temporal.
- Existen herramientas básicas funcionales en ICM (ya acoplables por tooling) sin requerir reeescribir al agente nativo de CLI subyacente.

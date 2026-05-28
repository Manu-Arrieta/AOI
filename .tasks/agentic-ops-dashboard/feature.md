# Feature: Agentic Ops Dashboard

- Slug: `agentic-ops-dashboard`
- Status: `📦 Archivado`
- Created: `2026-05-26`
- Owner: `Supervisor`

## Goal

Crear un proyecto interno web dentro de la infraestructura agéntica que permita
visualizar en tiempo real el estado operativo del workspace y, en iteraciones
posteriores, ejecutar acciones gobernadas sobre sus superficies principales.

## Scope

- Introducir un proyecto interno dedicado para el dashboard del workspace.
- Visualizar features, TASKs, artefactos disponibles, estados y timestamps a
  partir de `.tasks/registry.md` y del árbol de artefactos por tarea.
- Visualizar `.resources/` y sus elementos relacionados como contexto reusable.
- Reflejar en la UI relaciones entre TASKs, user stories y workflows cuando esas
  relaciones existan de forma explícita.
- Diseñar un mecanismo de actualización en tiempo real ante cambios en el
  workspace.
- Empezar con interacción gobernada sobre `.resources/`, dejando la puerta
  abierta a acciones futuras sobre otras superficies.
- Proponer frameworks y arquitectura de implementación acordes al horizonte de
  evolución del producto.

## Success Signals

- El dashboard puede representar el estado actual del workspace sin depender de
  refrescos manuales.
- Las TASKs muestran artefactos y relaciones relevantes con recursos cuando
  correspondan.
- Las acciones iniciales del dashboard sobre `.resources/` respetan la
  gobernanza existente del repositorio.
- La arquitectura elegida permite crecer desde observabilidad hacia operación
  directa sin rediseñar el transporte en tiempo real.
# Feature: Resource Governance

- Slug: `resource-governance`
- Status: `📦 Archivado`
- Created: `2026-05-26`
- Owner: `Supervisor`

## Goal

Definir una carpeta de recursos internos para la infraestructura agéntica,
gobernada por constitución, con estructura por defecto y un workflow dedicado
para crearla y mantenerla sin perder trazabilidad en ICM.

## Scope

- Introducir una carpeta base de recursos internos en la infraestructura.
- Incluir por defecto subcarpetas `userstories/` y `workflows/`.
- Usar `userstories/` como repositorio de historias reutilizables para apoyar la
  construcción de tareas cuando el usuario lo solicite.
- Usar `workflows/` como repositorio de definiciones sobre cómo interactúan
  componentes dentro de una misma user story o entre múltiples user stories.
- Permitir que el usuario vincule recursos de `.resources/` solo cuando lo
  solicite explícitamente durante la construcción de una tarea.
- Hacer que la estructura de recursos sea una regla explícita de la
  constitución.
- Definir workflows separados para create, move y remove (`/new-resource-folder`,
  `/move-resource-folder`, `/delete-resource-folder`) con actualización dinámica
  de la constitución.
- Usar ICM para reflejar la estructura y estado actual del proyecto.

## Success Signals

- La estructura esperada de recursos queda documentada como contrato.
- Los cambios a recursos pasan por un workflow explícito y auditable.
- La infraestructura puede consultar recursos opcionalmente durante SDD sin
  volverlos obligatorios.

# Feature: Workspace Memory Sync

- Slug: `workspace-memory-sync`
- Status: `📦 Archivado`
- Created: `2026-05-27`
- Owner: `Supervisor`

## Goal

Permitir que la infraestructura agéntica importe memorias de otros workspaces
almacenadas en ICM o desde bundles comprimidos exportados previamente, y las
fusione de forma gobernada dentro del workspace activo, con versionado explícito
de la memoria, constitución dinámica y criterios de normalización, retención y
reversión dirigidos por el Owner. El flujo también debe permitir exportar una
versión gobernada de memoria como artefacto portátil y auditable para
transferencia, respaldo o importación posterior.

## Scope

- Definir un flujo explícito para seleccionar el workspace fuente y la versión de
  memoria a importar antes de iniciar cualquier sincronización.
- Permitir exportar una versión gobernada de memoria a un formato comprimido y
  portable con metadatos suficientes para auditoría e importación posterior.
- Permitir importar bundles comprimidos de memoria además del flujo directo
  entre workspaces, manteniendo el mismo control explícito de origen,
  selección parcial y activación.
- Permitir importaciones completas o parciales de memorias, memoirs y feedback
  cuando el Owner así lo indique.
- Aceptar contexto adicional del Owner para orientar la importación, el descarte
  y la complementariedad de la información sincronizada.
- Normalizar y mergear la memoria existente del workspace con la información
  importada para producir una nueva versión activa y trazable.
- Hacer explícito qué información se retiene, cuál se descarta y cuál se marca
  como complementaria durante el proceso.
- Permitir rollback explícito a una versión anterior cuando el Owner sospeche
  corrupción o degradación de la memoria activa.
- Modelar la actualización dinámica de la constitución de memoria cuando cambia
  la versión activa del workspace.
- Definir las superficies agénticas, prompts, APIs o UI que deban participar en
  el proceso para mantener auditabilidad y consistencia.

## Success Signals

- El sistema exige conocer y resolver la versión de memoria objetivo desde el
  inicio del flujo.
- El Owner puede exportar una versión de memoria a un bundle comprimido,
  portable y auditable.
- El Owner puede importar un bundle comprimido y llevarlo al mismo flujo
  gobernado de candidata, activación y rollback que una sync directa.
- El Owner puede decidir si importa todo o solo subconjuntos concretos de la
  memoria fuente.
- Cada importación genera una nueva versión de memoria del workspace con
  trazabilidad de origen, merge y normalización.
- El Owner puede restaurar una versión anterior de memoria de forma explícita si
  detecta corrupción, inconsistencia o pérdida de calidad en la versión activa.
- La constitución de memoria se adapta a la nueva versión sin perder coherencia
  operativa entre memorias, memoirs y feedback.
- El proceso deja claro que la decisión final de condensar o unificar memorias
  pertenece al Owner.
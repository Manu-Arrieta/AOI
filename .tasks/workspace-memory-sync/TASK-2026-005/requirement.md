# Requerimientos Funcionales: TASK-2026-005 - Exportacion e Importacion de Bundles de Memoria Comprimidos

## Resumen

Extender la infraestructura de memoria versionada para permitir que el Owner
exporte una version gobernada de memoria a un bundle comprimido y portable, y
que luego pueda importarlo en otro workspace o en otra sesion sin depender de
una conexion viva contra el workspace origen. La importacion debe someterse al
mismo lifecycle ya existente de `candidate -> review -> activate -> rollback`,
manteniendo trazabilidad, validacion de procedencia, seleccion de scopes y
jurisdiccion final del Owner sobre `retain`, `complement` y `discard`.

## Problema

Hoy `workspace-memory-sync` permite sincronizar memorias entre workspaces
cuando existe un `sourceWorkspace` y un `sourceVersionId` accesibles en vivo,
pero no existe un artefacto portable para transportar una version de memoria de
forma auditable, compacta y reutilizable. Esa ausencia impide respaldos offline,
transferencias asincronicas y reutilizacion gobernada de una memoria versionada
cuando el workspace origen no esta disponible en tiempo real.

## Objetivos

- Permitir exportar una version explicita de memoria a un bundle comprimido y
  portable.
- Establecer `.exportsmemories/` como carpeta base gobernada para los artefactos
  generados durante la exportacion de memoria.
- Permitir exportaciones completas o parciales por scopes (`memories`,
  `memoir`, `feedback`).
- Exigir que el bundle describa de forma verificable su procedencia,
  compatibilidad, integridad y exclusiones.
- Permitir importar bundles comprimidos hacia el workflow actual de versionado,
  sin saltar la etapa de candidata, revision y activacion explicita.
- Preservar el control del Owner sobre las decisiones de `retain`, `complement`
  y `discard` antes de alterar la version activa del workspace destino.
- Garantizar que una version activada desde bundle conserve rollback explicito
  hacia la version previa restaurable.

## Fuera de Alcance

- Construir una interfaz grafica dedicada en `apps/agentic-ops-dashboard/` para
  exportar o importar bundles en esta primera iteracion.
- Incorporar transporte por red gestionado por el sistema (APIs remotas, S3,
  SCP, etc.); el bundle es un artefacto portable de disco.
- Reemplazar el formato operativo de memoria activa por el formato del bundle;
  el bundle es transporte y auditoria, no runtime.
- Exportar o importar recursos de `.resources/` ni generar `relations.json`.
- Delegar al agente la decision final de consolidacion sin confirmacion
  explicita del Owner.

## Historias de Usuario

1. Como Owner, quiero exportar una version concreta de memoria a un bundle
   comprimido para reutilizarla o resguardarla fuera del workspace origen.
2. Como Owner, quiero elegir si exporto todo el snapshot o solo ciertos scopes,
   para transportar un subconjunto pertinente y no ruido operativo innecesario.
3. Como Owner, quiero que el bundle incluya metadatos de procedencia,
   compatibilidad, integridad y exclusiones, para evitar importaciones opacas o
   engañosas.
4. Como Owner, quiero importar un bundle portable y revisarlo con el mismo
   esquema de `retain`, `complement` y `discard` usado en la sincronizacion en
   vivo, para no perder control sobre la memoria del workspace destino.
5. Como Owner, quiero poder activar o revertir una version derivada de bundle
   con el mismo mecanismo de activacion y rollback ya existente.

## Requerimientos Funcionales

- **Exportacion explicita**: El sistema debe exigir el workspace, la version de
  memoria y los scopes a exportar antes de generar cualquier bundle.
- **Carpeta base gobernada**: Los bundles exportados deben materializarse bajo
  `.exportsmemories/` como base local del repositorio, permitiendo nombres o
  subrutas controladas dentro de esa carpeta pero no destinos arbitrarios fuera
  de ella.
- **Exportacion parcial o total**: El sistema debe soportar bundles completos o
  parciales por scopes, declarando con claridad que scopes quedaron incluidos y
  cuales quedaron fuera.
- **Procedencia verificable**: El bundle debe registrar como minimo workspace
  origen, version de origen, fecha de exportacion, version de formato y un
  descriptor de integridad verificable.
- **Compatibilidad obligatoria**: El sistema debe rechazar la importacion de
  bundles cuyo contrato, procedencia o integridad no puedan validarse.
- **Importacion gobernada**: Un bundle valido debe transformarse en una nueva
  version candidata del workspace destino, no en una activacion automatica.
- **Revision del Owner**: Antes de activar la version candidata importada, el
  Owner debe poder definir explicitamente `retain`, `complement` y `discard`.
- **Trazabilidad de origen**: La version candidata y la version finalmente
  activada deben conservar una referencia auditable al bundle del que provienen.
- **Rollback integro**: Si la version importada desde bundle se activa, el
  sistema debe poder restaurar explicitamente la version previa valida del
  workspace destino.

## Restricciones

- El bundle no debe permitir saltarse el lifecycle actual de candidata,
  aprobacion, activacion y rollback.
- `.exportsmemories/` debe tratarse como superficie de artefactos exportados y
  los bundles generados no deben convertirse en inputs tracked por git salvo los
  placeholders necesarios para conservar la carpeta base.
- La ausencia de scopes opcionales no debe implicar una exportacion total por
  defecto sin declaracion explicita del Owner.
- La importacion no debe mutar el estado activo del workspace destino hasta que
  exista una version candidata valida y aprobacion explicita del Owner.
- El proceso debe mantenerse workflow-first y cross-platform, sin depender de
  un runtime UI ni de herramientas de compresion no disponibles de forma
  portable.

## Señales de Aceptacion

- El Owner puede generar un bundle comprimido desde una version explicita y el
  artefacto resultante declara procedencia, scopes incluidos y scopes omitidos
  dentro de `.exportsmemories/`.
- El sistema rechaza bundles malformados, incompatibles o sin descriptor de
  integridad antes de preparar una version candidata.
- Una importacion valida finaliza en una version candidata revisable, nunca en
  una activacion automatica.
- La version activada desde bundle preserva trazabilidad hacia el origen
  transportado y mantiene rollback explicito hacia la version previa.
- El flujo completo se puede ejecutar sin tocar el dashboard ni `.resources/`.

## Riesgos y Consideraciones

- **Falsa completitud**: un bundle parcial mal declarado podria hacer creer que
  se transporta una version completa cuando no es asi.
- **Formato operativo duplicado**: si el bundle se trata como runtime y no como
  transporte, se fragmenta el modelo actual de memoria versionada.
- **Importaciones opacas**: sin procedencia e integridad visibles, la memoria
  importada pierde auditabilidad y confianza.
- **Bypass del Owner**: si la importacion activa directamente, se rompe la
  frontera de responsabilidad definida por la feature anterior.